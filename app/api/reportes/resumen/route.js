// app/api/reportes/resumen/route.js
import { NextResponse }  from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'
import { prisma }        from '@/lib/prisma'
import { calcularDiasMora, calcularCapitalRestante } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'
import { fraccionInteres } from '@/lib/dinero/reparto'
import { exigeNivelReportes } from '@/lib/plan-servidor'

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

const toLocalDate = (date, country = 'co') => new Date(date.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)

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
  const desde = searchParams.get('desde') // YYYY-MM-DD
  const hasta = searchParams.get('hasta') // YYYY-MM-DD

  let fechaDesde, fechaHasta
  
  if (desde && hasta) {
    const rangeDesde = getDayRange(desde)
    const rangeHasta = getDayRange(hasta)
    fechaDesde = rangeDesde.inicio
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
  } else {
    // Default: inicio del mes en Colombia
    const country = session.user.country ?? 'co'
    const ahoraColombia = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
    const primerDiaMes = new Date(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), 1)
    const fechaIniColombia = primerDiaMes.toISOString().slice(0, 10)
    const rangeIni = getDayRange(fechaIniColombia)
    fechaDesde = rangeIni.inicio
    
    const fechaFinColombia = ahoraColombia.toISOString().slice(0, 10)
    const rangeFin = getDayRange(fechaFinColombia)
    fechaHasta = new Date(rangeFin.fin.getTime() + 1)
  }

  const [org, festivos, prestamosActivosDetalle, prestamosCompletados, pagos, pagosPeriodo] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { diasSinCobro: true },
    }),

    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        esClavo: false,
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        fechaInicio: true,
        diasPlazo: true,
        cuotaDiaria: true,
        frecuencia: true,
        estado: true,
        // modoInteres + totalPagado + la tabla: lo que necesita
        // calcularCapitalRestante. Sin modoInteres, tieneTablaAmortizacion da
        // false siempre y los modos con tabla se calcularian por la rama
        // equivocada.
        modoInteres: true,
        totalPagado: true,
        cuotasAmortizacion: {
          orderBy: { numeroPeriodo: 'asc' },
          select: { numeroPeriodo: true, cuotaTotal: true, capital: true, interes: true, pagado: true, fechaEsperada: true },
        },
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: {
            id: true,
            diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
      },
    }),

    prisma.prestamo.count({ where: { organizationId: orgId, estado: 'completado' } }),

    // Pagos en el período (excluir ajustes)
    prisma.pago.aggregate({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Pagos del período CON el prestamo (para repartir interes vs capital).
    // Se trae montoPrestado y totalAPagar de cada prestamo cobrado para
    // calcular el interes ganado de forma proporcional.
    prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: {
        montoPagado: true,
        prestamo: { select: { montoPrestado: true, totalAPagar: true } },
      },
    }),
  ])

  // ── Interes ganado (proporcional) ───────────────────────────────
  // La fraccion de cada pago la define lib/dinero/reparto.js. Funciona para
  // prestamos y mercancia (ahi el "interes" es la ganancia = precio venta -
  // costo). Estaba escrita a mano aqui, con una guarda propia que en los
  // prestamos cerrados por debajo de lo prestado contestaba distinto que
  // analiticas sobre los mismos pagos.
  let interesGanado = 0
  let capitalRecuperado = 0
  for (const pago of pagosPeriodo) {
    const monto = pago.montoPagado ?? 0
    const interesPago = monto * fraccionInteres(pago.prestamo)
    interesGanado += interesPago
    capitalRecuperado += monto - interesPago
  }

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  // Capital que sigue AFUERA (no el que salio algun dia). Misma definicion que
  // el dashboard: si las dos pantallas dan cifras distintas para lo mismo, se
  // rompe la confianza. Ver app/api/dashboard/resumen/route.js.
  let capitalEnCalle = 0
  let saldoPorCobrar = 0

  for (const p of prestamosActivosDetalle) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    capitalEnCalle += calcularCapitalRestante(p) ?? p.montoPrestado ?? 0
    const pagado = (p.pagos || [])
      .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
      .reduce((a, pg) => a + (pg.montoPagado || 0), 0)
    saldoPorCobrar += Math.max(0, (p.totalAPagar ?? 0) - pagado)

    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos, festivos) > 0) {
      clientesMora.add(p.clienteId)
    }
  }

  return NextResponse.json({
    clientes: {
      total: clientesActivos.size,
      enMora: clientesMora.size,
    },
    prestamos: {
      activos:     prestamosActivosDetalle.length,
      completados: prestamosCompletados,
      carteraActiva,
      saldoPorCobrar,
      capitalEnCalle,
    },
    pagos: {
      totalPeriodo: pagos._sum.montoPagado ?? 0,
      cantidad:     pagos._count        ?? 0,
      interesGanado:      Math.round(interesGanado),
      capitalRecuperado: Math.round(capitalRecuperado),
    },
    periodo: { desde: desde ?? fechaDesde.toISOString().slice(0, 10), hasta: hasta ?? fechaHasta.toISOString().slice(0, 10) },
  })
}
