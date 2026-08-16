// app/api/reportes/ingresos/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { interesPagoAPago, SELECT_PARA_INTERES } from '@/lib/dinero/interes-cobrado'

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

const toLocalDate = (date, country = 'co') => new Date(date.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)

// ── RESTABA LA ZONA HORARIA DOS VECES ──
//
// `toLocalDate` ya corre el instante las horas del pais; leerlo despues con
// `getFullYear/getMonth/getDate` —que son los del SERVIDOR— lo vuelve a correr.
// En produccion no se nota porque el servidor va en UTC y ahi esos metodos son
// los de UTC. En una maquina en Bogota si: un pago del 1 de julio, guardado a
// las 05:00Z por el convenio de la casa, salia como 30 DE JUNIO.
//
// Se veia en la grafica de reportes, que decia «el dia grande fue el 30 de
// junio» con el periodo puesto en julio.
//
// Con los metodos UTC el resultado es el mismo en las dos maquinas, que es la
// regla de fechas de este proyecto: la aritmetica va en UTC.
const formatLocalDate = (date, country = 'co') => {
  const d = toLocalDate(new Date(date), country)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  /* El plan del JWT no se refresca sin volver a entrar: quien acaba de
     pagar seguia viendo que su plan no alcanza. `exigeNivelReportes`
     usa el token como atajo y solo pregunta a la base cuando va a
     decir que no. Ver lib/plan-servidor.js. */
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') ?? 'diario' // diario | semanal | mensual
  const desde   = searchParams.get('desde')
  const hasta   = searchParams.get('hasta')

  // Obtener rango de fechas en UTC
  let fechaDesde, fechaHasta
  
  if (desde && hasta) {
    const rangeDesde = getDayRange(desde)
    const rangeHasta = getDayRange(hasta)
    fechaDesde = rangeDesde.inicio
    // Para "hasta", queremos incluir todo el día
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
  } else {
    // Default: últimos 30 días desde hoy en Colombia
    const country = session.user.country ?? 'co'
    const ahoraColombia = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
    const fechaFinColombia = ahoraColombia.toISOString().slice(0, 10)
    const rangeFin = getDayRange(fechaFinColombia)
    fechaHasta = new Date(rangeFin.fin.getTime() + 1)
    
    const fechaIniColombia = new Date(ahoraColombia.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rangeIni = getDayRange(fechaIniColombia)
    fechaDesde = rangeIni.inicio
  }

  /* ══ CUÁNTO DE LO QUE ENTRÓ ES GANANCIA ═══════════════════════════════════
   *
   * Pedido por Miguel Ángel (Préstamos Rincón) por el banner de sugerencias:
   *
   *   «Lo que más uso son los reportes, pero sí sería bueno que en estos
   *    reportes estén de manera clara y específica los recaudos del mes.»
   *
   * Este informe daba el TOTAL y nada más. Y el total, para quien presta, es la
   * mitad de la respuesta: de $1.184.696 que entraron, lo suyo es saber cuánto
   * fue interés —lo que ganó— y cuánto era capital que ya era suyo y vuelve.
   *
   * ⚠ NO SE REPARTE POR PROPORCIÓN. La cuenta sale de `interesPagoAPago`, que
   *   en los préstamos con tabla pregunta a la TABLA cuánto interés reconoce
   *   cada pago. En «sobre saldo» las primeras cuotas son casi todo interés y
   *   la proporción se queda corta: en su negocio, $141.889 contra $232.119
   *   reales — un 64% de menos. Medido en producción: 526 préstamos con tabla
   *   en 41 negocios.
   *
   * ⚠ Y hacen falta TODOS los pagos del préstamo, no solo los del período: el
   *   interés de un pago depende de por dónde iba la tabla cuando entró. Con
   *   solo los del mes, el primero se calcula como si fuera el primero de todos
   *   y sale de más. */
  const prestamos = await prisma.prestamo.findMany({
    where: {
      organizationId: orgId,
      estado: { not: 'cancelado' },
      pagos: {
        some: {
          fechaPago: { gte: fechaDesde, lt: fechaHasta },
          tipo: { notIn: ['recargo', 'descuento'] },
        },
      },
    },
    select: SELECT_PARA_INTERES,
  })

  const claveDe = (fecha) => {
    const f = toLocalDate(new Date(fecha))
    if (periodo === 'mensual') return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    if (periodo === 'semanal') {
      const startOfYear = new Date(f.getFullYear(), 0, 1)
      const week = Math.ceil(((f - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      return `${f.getFullYear()}-S${String(week).padStart(2, '0')}`
    }
    return formatLocalDate(fecha)
  }

  const grupos = {}
  const totales = { recaudado: 0, interes: 0, capital: 0 }
  for (const pr of prestamos) {
    for (const fila of interesPagoAPago({ prestamo: pr, cuotas: pr.cuotasAmortizacion, pagos: pr.pagos })) {
      // Los de fuera del período ya cumplieron su papel: mover el acumulado.
      if (!fila.fecha || fila.fecha < fechaDesde || fila.fecha >= fechaHasta) continue
      const key = claveDe(fila.fecha)
      const g = grupos[key] || (grupos[key] = { total: 0, interes: 0, capital: 0 })
      g.total += fila.monto
      g.interes += fila.interes
      g.capital += fila.capital
      totales.recaudado += fila.monto
      totales.interes += fila.interes
      totales.capital += fila.capital
    }
  }

  const data = Object.entries(grupos)
    .map(([fecha, g]) => ({
      fecha,
      total: Math.round(g.total),
      interes: Math.round(g.interes),
      capital: Math.round(g.capital),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return NextResponse.json({
    periodo,
    data,
    totales: {
      recaudado: Math.round(totales.recaudado),
      interes: Math.round(totales.interes),
      capital: Math.round(totales.capital),
    },
    desde: desde ?? fechaDesde.toISOString().slice(0, 10),
    hasta: hasta ?? fechaHasta.toISOString().slice(0, 10),
  })
}
