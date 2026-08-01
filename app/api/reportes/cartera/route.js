// app/api/reportes/cartera/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { nivelReportes }   from '@/lib/planes'
import { capitalEnCalle }  from '@/lib/dinero/reparto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  if (nivelReportes(session.user.plan) < 2) return NextResponse.json({ error: 'Plan insuficiente' }, { status: 403 })

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
              totalPagado: true,
              cuotaDiaria: true,
              modoInteres: true,
              cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, interes: true } },
              pagos: { select: { montoPagado: true, tipo: true } },
            },
          },
        },
      },
    },
  })

  const resultado = rutas.map((r) => {
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
