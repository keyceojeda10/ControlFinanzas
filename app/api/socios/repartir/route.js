// app/api/socios/repartir/route.js
//
// Reparto de utilidades entre socios por PORCENTAJE de participacion.
//
// Convive con el modelo original (la ganancia atribuida por prestamo asignado a
// un socio via Prestamo.socioId). No lo reemplaza ni lo toca: son dos formas de
// operar y cada negocio usa la que le sirve. En una sociedad con capital en bolsa
// comun no se puede decir "este prestamo es de Fulano", asi que el reparto por
// prestamo asignado no aplica y este si.
//
// El reparto NO mueve capital a proposito. La plata repartida ya entro a la caja
// cuando se cobraron los intereses; asignarla a un socio es una reclasificacion
// contable (pasa de ser del negocio a ser del socio), no efectivo nuevo. Si se
// registrara un MovimientoCapital aca, esa plata se contaria DOS veces. Cuando el
// socio efectivamente saque su plata, el flujo de "retiro" ya existente si mueve caja.
//
// El monto lo decide el dueño. Se le sugiere la utilidad neta del periodo
// (intereses cobrados - gastos aprobados) pero no se le impone: que gastos entran
// y si se aparta reserva son criterios del negocio, no del sistema.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { calcularGananciaNeta, interesDelPagoSegunTabla } from '@/lib/calculos'
import { repartoSql } from '@/lib/dinero/reparto'
import { correccionDelReparto } from '@/lib/dinero/interes-cobrado'

// De este numero depende cuanta plata se le asigna a cada socio. La formula
// tiene que ser LA MISMA que la de analiticas y la del PDF, no una copia que se
// le parezca. Ver lib/dinero/reparto.js.
const REPARTO_PAGO = repartoSql({ pago: 'p', prestamo: 'pr' })
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { porcentajeParticipacion, repartirExacto } from '@/lib/socios'

// Modos con tabla de amortizacion: su interes se lee de la tabla, no se reparte
// plano. Misma regla que /api/dashboard/analiticas.
const MODOS_CON_TABLA = ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo']

// Rango del mes en curso en hora de Colombia.
/* ⚠ EL MES SE CORTA EN BOGOTÁ, NO DONDE ESTÉ EL SERVIDOR.
 *
 * Decía `new Date(hoy.getFullYear(), hoy.getMonth(), 1)`, y ese constructor usa
 * el huso LOCAL: en producción, que corre en UTC, el mes le empezaba a las 7 de
 * la tarde del día 31 anterior. Todo lo demás del sistema corta en Bogotá
 * —`DATE_SUB(fechaPago, INTERVAL 5 HOUR)`—, así que el reparto a socios metía
 * en el mes cobros que las otras pantallas ponían en el anterior.
 *
 * Medido el 27 ago 2026 en la frontera del 1 de agosto: 133 pagos,
 * $13.966.457 recaudados y $2.607.857 de interés, en 20 negocios. Y no es un
 * caso raro: 3.830 de los 27.194 pagos del mes caen entre las 00 y las 05 UTC.
 *
 * De este número sale cuánta plata se le asigna a cada socio. */
function rangoMesActual() {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const y = hoy.getFullYear(), m = hoy.getMonth()
  // Las 00:00 de Bogotá del día 1 son las 05:00Z: el convenio del proyecto.
  const desde = new Date(Date.UTC(y, m, 1, 5, 0, 0))
  const hasta = new Date(Date.UTC(y, m + 1, 1, 5, 0, 0))
  const periodo = `${y}-${String(m + 1).padStart(2, '0')}`
  return { desde, hasta, periodo }
}

// Participacion de cada socio. El % sale del balance del socio sobre la BASE:
//   - si la organizacion fijo metaSociedad, la base es la meta y los socios
//     pueden sumar menos de 100% (el resto es del negocio/dueño)
//   - si no hay meta, la base es lo aportado entre todos y suman 100%
// Asi cada negocio define si el dueño participa, sin un ajuste extra.
async function calcularParticipacion(orgId) {
  const [socios, org] = await Promise.all([
    prisma.socio.findMany({
      where: { organizationId: orgId, activo: true },
      select: { id: true, nombre: true, aportes: { select: { tipo: true, monto: true } } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { metaSociedad: true } }),
  ])

  const conBalance = socios.map((s) => {
    const suma = s.aportes.filter((a) => a.tipo !== 'retiro').reduce((acc, a) => acc + a.monto, 0)
    const retiros = s.aportes.filter((a) => a.tipo === 'retiro').reduce((acc, a) => acc + a.monto, 0)
    return { id: s.id, nombre: s.nombre, balanceNeto: Math.max(0, Math.round(suma - retiros)) }
  })

  const totalBalances = conBalance.reduce((acc, s) => acc + s.balanceNeto, 0)
  const meta = Number(org?.metaSociedad) || 0
  const base = meta > 0 ? meta : totalBalances

  return {
    socios: conBalance.map((s) => ({
      ...s,
      porcentaje: porcentajeParticipacion(s.balanceNeto, base),
    })),
    base,
    totalBalances,
    metaSociedad: meta || null,
  }
}

// ─── GET: sugerencia del periodo + participacion actual ──────────
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el owner puede repartir utilidades' }, { status: 403 })

    const orgId = session.user.organizationId
    const { desde, hasta, periodo } = rangoMesActual()

    const [interesRows, prestamosConTabla, gastosAgg, participacion] = await Promise.all([
      // Parte de INTERES de cada pago del mes: de cada pago solo cuenta la
      // fraccion que corresponde al interes, no el capital que vuelve.
      prisma.$queryRaw`
        SELECT SUM(${Prisma.raw(REPARTO_PAGO.interes)}) AS interes
        FROM Pago p
        JOIN Prestamo pr ON pr.id = p.prestamoId
        WHERE p.organizationId = ${orgId}
          AND p.fechaPago >= ${desde} AND p.fechaPago < ${hasta}
          AND p.tipo NOT IN ('recargo', 'descuento')
          /* ⚠ LOS ANULADOS FUERA, COMO EN LAS OTRAS TRES PANTALLAS. Sin esto el
             reparto a socios contaba como ganancia los cobros de préstamos
             cancelados y analíticas no: medido el 27 ago 2026, $535.191 de
             diferencia en 3 negocios sobre el mes en curso. */
          AND pr.estado <> 'cancelado'
      `,
      // ...y los prestamos CON tabla, para corregir su parte leyendola de la
      // tabla en vez de repartirla plana. Sin esto, esta pantalla y la de
      // analiticas responderian distinto a la misma pregunta — que es justo lo
      // que se acaba de arreglar alla. Aca importa el doble: de este numero
      // depende cuanta plata se le asigna a cada socio.
      prisma.prestamo.findMany({
        where: {
          organizationId: orgId,
          totalAPagar: { gt: 0 },
          /* ⚠ Y TAMBIÉN LOS QUE LLEVAN PAGOS DECLARADOS, TENGAN TABLA O NO. De
             este número depende cuánta plata se le asigna a cada socio, así que
             un abono a capital contado como ganancia se reparte de verdad. */
          OR: [
            { modoInteres: { in: MODOS_CON_TABLA }, cuotasAmortizacion: { some: {} } },
            { pagos: { some: { tipo: { in: ['capital', 'intereses'] } } } },
          ],
          /* ⚠ AQUÍ NO VAN LOS DEVENGOS, Y ESTA CONSULTA LLEVABA ROTA DESDE EL 19
             DE AGOSTO POR PONERLOS. `devengos: { select: … }` dentro de un `where`
             es `Unknown argument 'select'`: Prisma revienta y el endpoint devuelve
             500. Nadie lo vio porque nadie había abierto esta pantalla — en los logs
             de PM2 del 31 jul al 27 ago no hay ni un acierto ni un error suyo.
             Estos préstamos solo alimentan `correccionDelReparto`, que no mira los
             devengos, así que no hacen falta en el `select` tampoco. */
        },
        select: {
          montoPrestado: true,
          totalAPagar: true,
          modoInteres: true,
          totalPagado: true,
          cuotasAmortizacion: {
            orderBy: { numeroPeriodo: 'asc' },
            select: { numeroPeriodo: true, cuotaTotal: true, interes: true },
          },
          pagos: {
            where: { tipo: { notIn: ['recargo', 'descuento'] } },
            orderBy: { fechaPago: 'asc' },
            // El `tipo` manda: un abono a capital es 100 % capital.
            select: { montoPagado: true, fechaPago: true, tipo: true },
          },
        },
      }),
      prisma.gastoMenor.aggregate({
        where: { organizationId: orgId, fecha: { gte: desde, lt: hasta }, estado: 'aprobado' },
        _sum: { monto: true },
      }),
      calcularParticipacion(orgId),
    ])

    // Correccion por tabla: la DIFERENCIA contra el reparto plano. Un prestamo
    // que no entre aca conserva su cifra proporcional.
    /* La MISMA función que usan analíticas y su PDF. Antes cada uno llevaba su
       copia del bucle, y el 27 de agosto se vio lo que cuesta: dos pantallas
       decían cifras distintas del mismo mes. Ver `correccionDelReparto`. */
    let correccion = 0
    for (const prestamo of prestamosConTabla) {
      for (const { fechaPago, delta } of correccionDelReparto(prestamo).porPago) {
        if (fechaPago >= desde && fechaPago < hasta) correccion += delta
      }
    }

    const interesesMes = Math.round(Number(interesRows?.[0]?.interes || 0) + correccion)
    const gastosMes = Math.round(Number(gastosAgg._sum?.monto || 0))

    // Lo ya repartido en este mismo periodo, para no repartir dos veces sin darse cuenta.
    const yaRepartido = await prisma.aporteSocio.aggregate({
      where: { organizationId: orgId, tipo: 'utilidad', fecha: { gte: desde, lt: hasta } },
      _sum: { monto: true },
      _count: true,
    })

    return Response.json({
      periodo,
      sugerido: {
        interesesMes,
        gastosMes,
        utilidadNeta: calcularGananciaNeta({ interesCobrado: interesesMes, gastos: gastosMes }),
      },
      yaRepartidoEnElPeriodo: Math.round(yaRepartido._sum?.monto || 0),
      repartosEnElPeriodo: yaRepartido._count || 0,
      ...participacion,
    })
  } catch (e) {
    console.error('[GET /api/socios/repartir]', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST: ejecutar el reparto ───────────────────────────────────
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el owner puede repartir utilidades' }, { status: 403 })
    const bloqueo = await bloquearSiSuscripcionVencida(session)
    if (bloqueo) return bloqueo

    const orgId = session.user.organizationId
    const body = await request.json()

    const monto = Math.round(Number(body.monto))
    if (!Number.isFinite(monto) || monto <= 0) {
      return Response.json({ error: 'El monto a repartir debe ser mayor a 0' }, { status: 400 })
    }

    const fondoPct = Number(body.fondoPerdidasPct) || 0
    if (fondoPct < 0 || fondoPct >= 100) {
      return Response.json({ error: 'El fondo de pérdidas debe estar entre 0% y 99%' }, { status: 400 })
    }

    const { socios, base, totalBalances, metaSociedad } = await calcularParticipacion(orgId)
    if (!socios.length) {
      return Response.json({ error: 'No hay socios activos registrados' }, { status: 400 })
    }
    if (totalBalances <= 0) {
      return Response.json({
        error: 'Los socios no tienen aportes registrados, así que no hay porcentajes para repartir. Registra primero el capital que puso cada uno.',
      }, { status: 400 })
    }

    const fondoPerdidas = Math.round(monto * (fondoPct / 100))
    const aRepartir = monto - fondoPerdidas
    const { asignaciones, totalSocios } = repartirExacto(aRepartir, socios, base, totalBalances)
    const restanteNegocio = aRepartir - totalSocios

    const { periodo } = rangoMesActual()
    const fecha = body.fecha ? new Date(`${String(body.fecha).slice(0, 10)}T05:00:00.000Z`) : new Date()
    const notaBase = body.nota?.trim() || `Reparto de utilidades ${periodo}`

    // Sin registrarMovimientoCapital a proposito — ver la cabecera del archivo.
    await prisma.$transaction(async (tx) => {
      for (const a of asignaciones) {
        if (a.monto <= 0) continue
        await tx.aporteSocio.create({
          data: {
            socioId: a.id,
            organizationId: orgId,
            tipo: 'utilidad',
            monto: a.monto,
            fecha,
            nota: `${notaBase} — ${a.porcentaje}% de participación`,
          },
        })
      }
    })

    logActividad({
      session,
      accion: 'repartir_utilidades',
      entidadTipo: 'socio',
      detalle: `Reparto de utilidades ${periodo}: $${monto.toLocaleString('es-CO')} entre ${asignaciones.filter(a => a.monto > 0).length} socio(s)`
        + (fondoPerdidas > 0 ? ` (fondo de pérdidas $${fondoPerdidas.toLocaleString('es-CO')})` : ''),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ok: true,
      periodo,
      monto,
      fondoPerdidas,
      repartidoASocios: totalSocios,
      restanteNegocio,
      metaSociedad,
      asignaciones: asignaciones.map((a) => ({
        socioId: a.id, nombre: a.nombre, porcentaje: a.porcentaje, monto: a.monto,
      })),
    }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/socios/repartir]', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
