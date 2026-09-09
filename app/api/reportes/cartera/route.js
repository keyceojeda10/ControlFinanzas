// app/api/reportes/cartera/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { capitalEnCalle }  from '@/lib/dinero/reparto'
import { exigeNivelReportes } from '@/lib/plan-servidor'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  /* El plan del JWT no se refresca sin volver a entrar: quien acaba de
     pagar seguia viendo que su plan no alcanza. `exigeNivelReportes`
     usa el token como atajo y solo pregunta a la base cuando va a
     decir que no. Ver lib/plan-servidor.js. */
  /* ══ NIVEL 1, NO 2 · ARREGLADO EL 9 SEP 2026 ══════════════════════════════
   *
   * Un cliente al que el dueño acababa de subir a Básico abrió «Lo que está en
   * la calle», tocó bajar y le salió «Plan insuficiente». No era su cuenta: era
   * este 2.
   *
   * El catálogo de informes dice que `calle` es **nivel 1** —y por eso la
   * pantalla se lo ofrece, y por eso `descargar` le deja pasar—, pero este API,
   * que es el que calcula los datos, seguía pidiendo 2. Así que el informe se
   * anunciaba, se abría y reventaba al final: ni la tabla ni el PDF ni el Excel.
   * Afectaba a los **102 negocios** de nivel 1 (80 básico + 22 crecimiento),
   * no solo al que lo reportó.
   *
   * El 2 es de antes de que existiera el catálogo. Cuando en agosto el dueño
   * bajó los reportes a Básico se tocó `exportar` y se quedó esto: el mismo
   * fallo de [[feedback_arreglar_una_via_y_dejar_la_otra]].
   *
   * ⚠ Bajarlo NO abre nada nuevo: este mismo dato ya salía en nivel 1 por
   * `/api/reportes/exportar?tipo=prestamos` y por `/api/reportes/datos?tipo=cartera`.
   * Lo único que hace es dejar de mentir. */
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto

  const orgId = session.user.organizationId

  // ⚠ AQUI HABIA UN `where: { estado: 'activo' }` SOBRE LOS CLIENTES.
  //
  // El estado de un cliente moroso es literalmente 'mora'. Medido contra
  // produccion el 1 ago 2026, ese filtro escondia de este reporte:
  //
  //     1.081 clientes · 1.126 prestamos activos · $631.726.806
  //
  // El 14% de la cartera, y justo la parte a la que hay que ir a cobrar.
  // Peor: la MISMA pantalla muestra arriba «En mora: N» —que sale de
  // /api/reportes/resumen y si los cuenta— y debajo esta lista sin ellos.
  //
  // El universo correcto es «clientes de la ruta CON prestamo activo», sin
  // mirarles el estado. Ver `clientesEnMora` en lib/dinero/definiciones.js.
  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    include: {
      cobrador: { select: { nombre: true } },
      clientes: {
        include: {
          prestamos: {
            where: { estado: 'activo', esClavo: false },
            select: {
              montoPrestado: true,
              totalAPagar: true,
              totalPagado: true, abonadoCapital: true,
              cuotaDiaria: true,
              modoInteres: true,
              /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
                 interés devengado sin pagar, y un campo que no se pide vale `undefined`
                 —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
              devengos: { select: { periodo: true, interes: true } },
              cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, interes: true } },
              pagos: { select: { montoPagado: true, tipo: true } },
            },
          },
        },
      },
    },
  })

  /* ══ ⚠ LOS CLIENTES SIN RUTA TAMBIEN SON CARTERA ═════════════════════════
   *
   * Esto recorre RUTAS, asi que quien no ha creado ninguna no aparecia: ni sus
   * clientes, ni su capital, ni su saldo. Medido en produccion el 8 ago 2026,
   * al reportar un cliente que su reporte salia vacio:
   *
   *   · 160 de 223 negocios con prestamos activos NO tienen ninguna ruta
   *   · 2.904 de 5.395 prestamos activos quedaban fuera
   *
   * Se agrupan al final bajo «Sin ruta» y se comportan como una ruta mas, para
   * que el resto del codigo no tenga que saber que existen. */
  const sueltos = await prisma.cliente.findMany({
    where: {
      organizationId: orgId,
      OR: [{ rutaId: null }, { ruta: { is: null } }],
      prestamos: { some: { estado: 'activo', esClavo: false } },
    },
    include: {
      prestamos: {
        where: { estado: 'activo', esClavo: false },
        select: {
          montoPrestado: true,
          totalAPagar: true,
          totalPagado: true, abonadoCapital: true,
          cuotaDiaria: true,
          modoInteres: true,
          cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, interes: true } },
          pagos: { select: { montoPagado: true, tipo: true } },
        },
      },
    },
  })

  const grupos = sueltos.length
    ? [...rutas, { id: null, nombre: 'Sin ruta', cobrador: null, clientes: sueltos }]
    : rutas

  const resultado = grupos.map((r) => {
    let capitalActivo = 0
    let saldoPendiente = 0
    let cuotaDiariaTotal = 0
    // Se cuentan los clientes CON prestamo activo, no los que tengan cierto
    // estado: un cliente sin prestamo no es cartera de nadie.
    let clientesConCartera = 0

    for (const cliente of r.clientes) {
      if (cliente.prestamos.length === 0) continue
      clientesConCartera++
      for (const p of cliente.prestamos) {
        const pagado = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
        const saldo  = Math.max(0, p.totalAPagar - pagado)
        // Lo que sigue AFUERA, no lo que salio alguna vez. `Σ montoPrestado`
        // era el quinto sitio con esa formula bajo el rotulo de capital.
        capitalActivo   += capitalEnCalle(p)
        saldoPendiente  += saldo
        cuotaDiariaTotal += p.cuotaDiaria
      }
    }

    return {
      id:           r.id,
      ruta:         r.nombre,
      cobrador:     r.cobrador?.nombre ?? 'Sin cobrador',
      clientes:     clientesConCartera,
      capitalActivo,
      saldoPendiente,
      cuotaDiariaTotal,
    }
  })

  return NextResponse.json(resultado)
}
