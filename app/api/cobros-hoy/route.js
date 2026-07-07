// app/api/cobros-hoy/route.js
// Devuelve todos los clientes pendientes de cobro del dia para el cobrador,
// agregando todas sus rutas en una sola lista plana.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularMontoParaPonerseAlDia,
  tieneCobroPendienteHoy,
  obtenerCuotaPeriodoActual,
  obtenerProximaCuotaTabla,
  tieneTablaAmortizacion,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'

function detectarCuotaExtra(prestamo, proximaCuota) {
  if (!proximaCuota || !Array.isArray(prestamo.capitalExtra) || !prestamo.capitalExtra.length) {
    return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  }
  const periodo = proximaCuota.numeroPeriodo
  const extra = prestamo.capitalExtra.find(e => e.numeroPeriodo === periodo)
  if (!extra || !extra.monto) return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  return { cuotaExtraHoy: true, montoCuotaExtra: Math.round(extra.monto) }
}

const hoy = (country = 'co') => {
  const now = new Date()
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(now.getTime() - absOffset * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, absOffset, 0, 0, 0))
}
const manana = (country = 'co') => {
  const h = hoy(country)
  return new Date(h.getTime() + 24 * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: userId, organizationId, rol, rutaIds: rutaIdsRaw } = session.user

  // Solo cobradores (owners usan el dashboard normal)
  if (rol !== 'cobrador') {
    return Response.json({ error: 'Solo para cobradores' }, { status: 403 })
  }

  const rutaIds = rutaIdsRaw ?? []
  if (rutaIds.length === 0) {
    return Response.json({ clientes: [], resumen: { total: 0, pendientes: 0, pagados: 0, esperadoHoy: 0, recaudadoHoy: 0 } })
  }

  const _hoy = hoy(), _manana = manana()

  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  // Cargar todas las rutas del cobrador con sus clientes y préstamos.
  // pagos: solo los de HOY (filtramos en DB, no en JS) — evita traer meses de historial.
  // Los cálculos de mora/saldo usan totalPagado (denormalizado), no necesitan el historial completo.
  const rutas = await prisma.ruta.findMany({
    where: { id: { in: rutaIds }, organizationId, cobradorId: userId },
    select: {
      id: true,
      nombre: true,
      diasSinCobro: true,
      clientes: {
        orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
        select: {
          id: true,
          nombre: true,
          cedula: true,
          direccion: true,
          diasSinCobro: true,
          prestamos: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              estado: true,
              esClavo: true,
              cuotaDiaria: true,
              montoPrestado: true,
              totalAPagar: true,
              totalPagado: true,
              frecuencia: true,
              fechaInicio: true,
              diasPlazo: true,
              diaCobroSemana: true,
              diaCobroMes: true,
              diaCobroMes2: true,
              diasSinCobro: true,
              modoInteres: true,
              capitalExtra: true,
              proximoCobroManual: true,
              cuotasAmortizacion: {
                select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
                orderBy: { numeroPeriodo: 'asc' },
              },
              pagos: {
                where: { fechaPago: { gte: _hoy, lt: _manana } },
                select: { id: true, montoPagado: true, fechaPago: true, tipo: true },
              },
            },
          },
        },
      },
    },
  })

  let totalClientes = 0
  let totalPendientes = 0
  let totalPagados = 0
  let esperadoHoyTotal = 0
  let recaudadoHoyTotal = 0

  const clientesAgregados = []

  for (const ruta of rutas) {
    for (const c of ruta.clientes) {
      totalClientes++

      const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
      const _hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)

      let cuotaCliente = 0
      let pagadoHoy = 0
      let mora = 0
      let montoParaAlDia = 0
      let cobroPendienteHoy = false
      const prestamosActivos = []

      for (const p of c.prestamos) {
        // p.pagos ya viene filtrado por hoy desde la query (where fechaPago gte/lt)
        const pagosHoy = p.pagos
        const montoPagadoHoy = pagosHoy
          .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
          .reduce((a, pg) => a + pg.montoPagado, 0)
        pagadoHoy += montoPagadoHoy
        recaudadoHoyTotal += montoPagadoHoy

        if (p.estado !== 'activo') continue
        if (p.esClavo) {
          const cuotaClavo = tieneTablaAmortizacion(p) ? obtenerCuotaPeriodoActual(p) : p.cuotaDiaria
          const saldoClavo = calcularSaldoPendiente(p)
          const proximaCuotaClavo = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
          const extraClavo = detectarCuotaExtra(p, proximaCuotaClavo)
          cuotaCliente += cuotaClavo
          prestamosActivos.push({
            id: p.id,
            cuotaDiaria: Math.round(cuotaClavo),
            saldoPendiente: Math.round(saldoClavo),
            diasMora: 0,
            modoInteres: p.modoInteres || 'fijo',
            esBalloon: false,
            cuotaNumero: proximaCuotaClavo?.numeroPeriodo ?? null,
            esClavo: true,
            ...extraClavo,
          })
          continue
        }

        const diasExcluidosPrestamo = obtenerDiasSinCobro(c, ruta, org, p)
        const cuotaReal = tieneTablaAmortizacion(p) ? obtenerCuotaPeriodoActual(p) : p.cuotaDiaria
        cuotaCliente += cuotaReal
        esperadoHoyTotal += cuotaReal

        const saldo = calcularSaldoPendiente(p)
        const moraPrestamo = calcularDiasMora(p, diasExcluidosPrestamo, festivos)
        const alDia = calcularMontoParaPonerseAlDia(p, diasExcluidosPrestamo, festivos)
        mora = Math.max(mora, moraPrestamo)
        montoParaAlDia += alDia

        const proximaCuota = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
        const extraInfo = detectarCuotaExtra(p, proximaCuota)
        prestamosActivos.push({
          id: p.id,
          cuotaDiaria: Math.round(cuotaReal),
          saldoPendiente: Math.round(saldo),
          diasMora: moraPrestamo,
          modoInteres: p.modoInteres || 'fijo',
          esBalloon: proximaCuota?.esBalloon || false,
          cuotaNumero: proximaCuota?.numeroPeriodo ?? null,
          ...extraInfo,
        })

        if (!_hoySinCobro && tieneCobroPendienteHoy(p, diasExcluidosPrestamo, festivos)) {
          cobroPendienteHoy = true
        }
      }

      const yaPageHoy = pagadoHoy > 0
      const pendienteHoyCliente = !_hoySinCobro && cobroPendienteHoy

      if (pendienteHoyCliente) totalPendientes++
      if (yaPageHoy && !pendienteHoyCliente) totalPagados++

      // Solo incluir clientes que tienen cobro hoy (pendiente o pagado)
      if (!pendienteHoyCliente && !yaPageHoy) continue

      clientesAgregados.push({
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        direccion: c.direccion,
        rutaId: ruta.id,
        rutaNombre: ruta.nombre,
        cuota: cuotaCliente,
        pagoHoy: yaPageHoy,
        cobroPendienteHoy: pendienteHoyCliente,
        diasMora: mora,
        montoParaPonerseAlDia: Math.round(montoParaAlDia),
        hoySinCobro: _hoySinCobro,
        prestamoActivo: prestamosActivos[0]?.id ?? null,
        prestamosActivos,
        cuotaExtraHoy: prestamosActivos.some(p => p.cuotaExtraHoy),
        montoCuotaExtra: prestamosActivos.reduce((s, p) => s + (p.montoCuotaExtra || 0), 0),
      })
    }
  }

  // Orden: mora primero → pendientes → pagados; dentro de cada grupo por nombre
  clientesAgregados.sort((a, b) => {
    if (a.diasMora > 0 && b.diasMora === 0) return -1
    if (a.diasMora === 0 && b.diasMora > 0) return 1
    if (a.cobroPendienteHoy && !b.cobroPendienteHoy) return -1
    if (!a.cobroPendienteHoy && b.cobroPendienteHoy) return 1
    return a.nombre.localeCompare(b.nombre)
  })

  return Response.json({
    clientes: clientesAgregados,
    resumen: {
      total: totalClientes,
      pendientes: totalPendientes,
      pagados: totalPagados,
      esperadoHoy: Math.round(esperadoHoyTotal),
      recaudadoHoy: Math.round(recaudadoHoyTotal),
    },
  })
}
