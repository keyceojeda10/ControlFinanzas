import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { calcularDiasMora } from '@/lib/calculos'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, role } = session.user
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
  if (role === 'cobrador') return NextResponse.json({ error: 'Solo owner' }, { status: 403 })

  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  const mesesAtras = 6
  const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 1)

  const [
    pagosMensuales,
    prestamosMensuales,
    gastosMensuales,
    prestamosActivos,
    prestamosCompletados,
    prestamosCancelados,
    prestamosEsclavo,
    clientesActivos,
    clientesInactivos,
    cobradorRecaudo,
    cobradorInfo,
    pagosEsteMes,
    prestamosActivosDetalle,
    festivos,
    organization,
    clientesPorMes,
  ] = await Promise.all([
    // Pagos agrupados por mes (last 6 months)
    prisma.$queryRaw`
      SELECT
        DATE_FORMAT(fechaPago, '%Y-%m') as mes,
        SUM(montoPagado) as total,
        COUNT(*) as cantidad
      FROM Pago
      WHERE organizationId = ${organizationId}
        AND fechaPago >= ${fechaInicio}
        AND tipo NOT IN ('recargo', 'descuento')
      GROUP BY mes
      ORDER BY mes
    `,
    // Prestamos creados por mes
    prisma.$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as mes,
        SUM(montoPrestado) as capitalPrestado,
        SUM(totalAPagar) as totalAPagar,
        COUNT(*) as cantidad
      FROM Prestamo
      WHERE organizationId = ${organizationId}
        AND createdAt >= ${fechaInicio}
        AND esClavo = false
      GROUP BY mes
      ORDER BY mes
    `,
    // Gastos por mes
    prisma.$queryRaw`
      SELECT
        DATE_FORMAT(fecha, '%Y-%m') as mes,
        SUM(monto) as total
      FROM GastoMenor
      WHERE organizationId = ${organizationId}
        AND fecha >= ${fechaInicio}
        AND estado = 'aprobado'
      GROUP BY mes
      ORDER BY mes
    `,
    // Conteos de cartera
    prisma.prestamo.count({
      where: { organizationId, estado: 'activo', esClavo: false },
    }),
    prisma.prestamo.count({
      where: { organizationId, estado: 'completado', esClavo: false },
    }),
    prisma.prestamo.count({
      where: { organizationId, estado: 'cancelado', esClavo: false },
    }),
    prisma.prestamo.aggregate({
      where: { organizationId, esClavo: true },
      _count: true,
      _sum: { totalAPagar: true },
    }),
    prisma.cliente.count({
      where: { organizationId, estado: { in: ['activo', 'mora'] } },
    }),
    prisma.cliente.count({
      where: { organizationId, estado: { in: ['inactivo', 'cancelado'] } },
    }),
    // Recaudo por cobrador este mes
    prisma.$queryRaw`
      SELECT
        cobradorId,
        SUM(montoPagado) as recaudado,
        COUNT(*) as pagos
      FROM Pago
      WHERE organizationId = ${organizationId}
        AND fechaPago >= ${mesActual}
        AND tipo NOT IN ('recargo', 'descuento')
        AND cobradorId IS NOT NULL
      GROUP BY cobradorId
      ORDER BY recaudado DESC
    `,
    // Nombres de cobradores
    prisma.user.findMany({
      where: { organizationId, role: 'cobrador', activo: true },
      select: { id: true, name: true },
    }),
    // Total pagos este mes (para eficiencia)
    prisma.pago.aggregate({
      where: {
        organizationId,
        fechaPago: { gte: mesActual },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
    // Prestamos activos con detalle (para calcular esperado y mora)
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'activo', esClavo: false },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
        totalPagado: true,
        cuotaDiaria: true,
        frecuencia: true,
        fechaInicio: true,
        fechaFin: true,
        diasPlazo: true,
        ultimoPagoAt: true,
        modoInteres: true,
        tasaInteres: true,
        cuotasAmortizacion: {
          select: { numeroPeriodo: true, cuotaTotal: true, pagado: true, fechaEsperada: true },
        },
      },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    // Clientes nuevos por mes
    prisma.$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as mes,
        COUNT(*) as nuevos
      FROM Cliente
      WHERE organizationId = ${organizationId}
        AND createdAt >= ${fechaInicio}
      GROUP BY mes
      ORDER BY mes
    `,
  ])

  // Build monthly trend
  const meses = []
  for (let i = 0; i < mesesAtras; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1 + i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  const pagoMap = Object.fromEntries(pagosMensuales.map(p => [p.mes, p]))
  const prestamoMap = Object.fromEntries(prestamosMensuales.map(p => [p.mes, p]))
  const gastoMap = Object.fromEntries(gastosMensuales.map(g => [g.mes, g]))
  const clienteMap = Object.fromEntries(clientesPorMes.map(c => [c.mes, c]))

  const tendenciaMensual = meses.map(mes => ({
    mes,
    recaudado: Number(pagoMap[mes]?.total || 0),
    cantidadPagos: Number(pagoMap[mes]?.cantidad || 0),
    capitalPrestado: Number(prestamoMap[mes]?.capitalPrestado || 0),
    prestamosNuevos: Number(prestamoMap[mes]?.cantidad || 0),
    gastos: Number(gastoMap[mes]?.total || 0),
    clientesNuevos: Number(clienteMap[mes]?.nuevos || 0),
  }))

  // Interest earned this month (proportional from payments)
  const mesActualKey = mesActual.toISOString().slice(0, 7)
  const recaudadoMes = Number(pagosEsteMes._sum?.montoPagado || 0)

  // Expected collections this month (sum of cuota diaria * days elapsed)
  const diasTranscurridos = hoy.getDate()
  const diasExcluidos = organization?.diasSinCobro || []
  const cuotaDiariaTotal = prestamosActivosDetalle.reduce((sum, p) => sum + Number(p.cuotaDiaria || 0), 0)

  let diasHabiles = 0
  for (let d = 1; d <= diasTranscurridos; d++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    const diaSemana = fecha.getDay()
    const diasMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    if (!diasExcluidos.includes(diasMap[diaSemana])) diasHabiles++
  }

  const esperadoMes = cuotaDiariaTotal * diasHabiles

  // Mora calculation
  const festivosFechas = festivos.map(f => f.fecha)
  let clientesMora = 0
  let montoMora = 0
  for (const p of prestamosActivosDetalle) {
    const dias = calcularDiasMora(p, diasExcluidos, festivosFechas)
    if (dias > 0) {
      clientesMora++
      montoMora += Number(p.totalAPagar) - Number(p.totalPagado || 0)
    }
  }

  // Cobrador ranking
  const cobradorMap = Object.fromEntries(cobradorInfo.map(c => [c.id, c.name]))
  const cobradores = cobradorRecaudo.map(c => ({
    id: c.cobradorId,
    nombre: cobradorMap[c.cobradorId] || 'Sin nombre',
    recaudado: Number(c.recaudado),
    pagos: Number(c.pagos),
  }))

  // Rentabilidad
  const capitalTotal = prestamosActivosDetalle.reduce((s, p) => s + Number(p.montoPrestado), 0)
  const porCobrarTotal = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.totalPagado || 0)), 0)
  const interesEnCartera = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.montoPrestado)), 0)
  const moraIrrecuperable = Number(prestamosEsclavo._sum?.totalAPagar || 0)
  const gastosMesActual = Number(gastoMap[mesActualKey]?.total || 0)

  return NextResponse.json({
    tendenciaMensual,
    eficiencia: {
      recaudado: recaudadoMes,
      esperado: esperadoMes,
      pct: esperadoMes > 0 ? Math.round((recaudadoMes / esperadoMes) * 100) : 0,
      diasHabiles,
      diasTranscurridos,
    },
    cartera: {
      activos: prestamosActivos,
      completados: prestamosCompletados,
      cancelados: prestamosCancelados,
      enMora: clientesMora,
      montoActivo: porCobrarTotal,
      montoMora,
      capitalEnCalle: capitalTotal,
      interesEnCartera,
    },
    cobradores,
    rentabilidad: {
      capitalEnCalle: capitalTotal,
      interesEnCartera,
      moraIrrecuperable,
      clavos: prestamosEsclavo._count || 0,
      gastosMes: gastosMesActual,
      recaudadoMes,
    },
    clientes: {
      activos: clientesActivos,
      inactivos: clientesInactivos,
    },
  })
}
