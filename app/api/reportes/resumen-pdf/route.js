import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { nivelReportes }    from '@/lib/planes'
import { formatMoney, getUtcOffset, getLocalDayRange, formatFechaCorta } from '@/lib/i18n'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import PDFDocument          from 'pdfkit'
import { PassThrough }      from 'stream'

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })
  if (nivelReportes(session.user.plan) < 2) return Response.json({ error: 'Plan insuficiente' }, { status: 403 })

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  let fechaDesde, fechaHasta, desdeStr, hastaStr

  if (desdeParam && hastaParam) {
    const rangeDesde = getDayRange(desdeParam, country)
    const rangeHasta = getDayRange(hastaParam, country)
    fechaDesde = rangeDesde.inicio
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
    desdeStr = desdeParam
    hastaStr = hastaParam
  } else {
    const ahora = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    desdeStr = primerDia.toISOString().slice(0, 10)
    hastaStr = ahora.toISOString().slice(0, 10)
    fechaDesde = getDayRange(desdeStr, country).inicio
    fechaHasta = new Date(getDayRange(hastaStr, country).fin.getTime() + 1)
  }

  // ── Data fetching (parallel) ─────────────────────────────
  const [
    org,
    prestamosActivos,
    prestamosCompletados,
    pagosAgg,
    pagosPeriodo,
    cobradores,
    desembolsos,
    recaudos,
    gastosCap,
    pagosDiarios,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, country: true, diasSinCobro: true },
    }),
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        esClavo: false,
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true, montoPrestado: true, totalAPagar: true,
        fechaInicio: true, diasPlazo: true, cuotaDiaria: true, frecuencia: true, estado: true,
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: { id: true, diasSinCobro: true, ruta: { select: { diasSinCobro: true } } },
        },
      },
    }),
    prisma.prestamo.count({ where: { organizationId: orgId, estado: 'completado' } }),
    prisma.pago.aggregate({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
    prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: {
        montoPagado: true,
        prestamo: { select: { montoPrestado: true, totalAPagar: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador', activo: true },
      include: {
        rutas: { where: { activo: true }, take: 1, select: { nombre: true } },
        cierresCaja: {
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          select: {
            totalRecogido: true, totalEsperado: true,
            totalGastos: true, totalDesembolsado: true,
          },
        },
      },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'desembolso', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'recaudo', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'gasto', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true, fechaPago: true },
      orderBy: { fechaPago: 'asc' },
    }),
  ])

  // ── Compute metrics ──────────────────────────────────────
  let interesGanado = 0, capitalRecuperado = 0
  for (const pago of pagosPeriodo) {
    const total = pago.prestamo?.totalAPagar ?? 0
    const capital = pago.prestamo?.montoPrestado ?? 0
    const monto = pago.montoPagado ?? 0
    if (total > 0 && total > capital) {
      const fraccion = (total - capital) / total
      interesGanado += monto * fraccion
      capitalRecuperado += monto * (1 - fraccion)
    } else {
      capitalRecuperado += monto
    }
  }
  interesGanado = Math.round(interesGanado)
  capitalRecuperado = Math.round(capitalRecuperado)

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0, capitalPrestado = 0

  for (const p of prestamosActivos) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    capitalPrestado += p.montoPrestado ?? 0
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) clientesMora.add(p.clienteId)
  }

  const totalPeriodo = pagosAgg._sum.montoPagado ?? 0
  const cantidadPagos = pagosAgg._count ?? 0

  const cobradoresData = cobradores.map(c => {
    const esperado = c.cierresCaja.reduce((a, ci) => a + ci.totalEsperado, 0)
    const recogido = c.cierresCaja.reduce((a, ci) => a + ci.totalRecogido, 0)
    const gastosC = c.cierresCaja.reduce((a, ci) => a + (ci.totalGastos || 0), 0)
    return {
      nombre: c.nombre,
      ruta: c.rutas?.[0]?.nombre ?? 'Sin ruta',
      esperado, recogido, gastos: gastosC,
      eficiencia: esperado > 0 ? Math.round((recogido / esperado) * 100) : 0,
    }
  })

  const desembolsadoMes = desembolsos._sum.monto ?? 0
  const recaudadoMes = recaudos._sum.monto ?? 0
  const gastosMes = gastosCap._sum.monto ?? 0
  const flujoNeto = recaudadoMes - desembolsadoMes - gastosMes

  const toLocal = (date) => new Date(date.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  const ingresosPorDia = {}
  for (const p of pagosDiarios) {
    const f = toLocal(new Date(p.fechaPago))
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    ingresosPorDia[key] = (ingresosPorDia[key] ?? 0) + p.montoPagado
  }
  const ingresosArr = Object.entries(ingresosPorDia).map(([fecha, total]) => ({ fecha, total }))

  const nombreNegocio = org?.nombre ?? 'Mi Negocio'
  const fmt = (v) => formatMoney(v, country)

  // ── Generate PDF ─────────────────────────────────────────
  const doc = new PDFDocument({ size: 'letter', margin: 40 })
  const stream = new PassThrough()
  const chunks = []
  stream.on('data', chunk => chunks.push(chunk))
  const done = new Promise(resolve => stream.on('end', resolve))
  doc.pipe(stream)

  const W = 612 - 80 // usable width
  const LEFT = 40
  const RIGHT = 572

  // ── A. Header ────────────────────────────────────────────
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#111111')
     .text(nombreNegocio, LEFT, 40, { width: W * 0.7 })

  doc.fontSize(11).font('Helvetica').fillColor('#555555')
     .text('Resumen del Periodo', LEFT, 62)

  const fechaDesdeFmt = formatFechaCorta(new Date(desdeStr + 'T12:00:00Z'), country)
  const fechaHastaFmt = formatFechaCorta(new Date(hastaStr + 'T12:00:00Z'), country)
  doc.fontSize(10).fillColor('#777777')
     .text(`${fechaDesdeFmt} — ${fechaHastaFmt}`, LEFT, 76)

  doc.fontSize(8).fillColor('#999999')
     .text(`Generado: ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, LEFT, 40, { width: W, align: 'right' })

  doc.moveTo(LEFT, 95).lineTo(RIGHT, 95).strokeColor('#dddddd').lineWidth(0.5).stroke()

  // ── B. KPIs (2x2 grid) ──────────────────────────────────
  const kpis = [
    { label: 'Ingresos del periodo', value: fmt(totalPeriodo), sub: `${cantidadPagos} pagos` },
    { label: 'Interes ganado', value: fmt(interesGanado) },
    { label: 'Capital recuperado', value: fmt(capitalRecuperado) },
    { label: 'Cartera activa', value: fmt(carteraActiva) },
  ]

  const kpiW = (W - 10) / 2
  const kpiH = 48
  let kpiY = 105

  kpis.forEach((kpi, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = LEFT + col * (kpiW + 10)
    const y = kpiY + row * (kpiH + 8)

    doc.save()
    doc.roundedRect(x, y, kpiW, kpiH, 4).fill('#f5f5f5')
    doc.restore()

    doc.fontSize(8).font('Helvetica').fillColor('#888888')
       .text(kpi.label, x + 10, y + 8, { width: kpiW - 20 })
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111111')
       .text(kpi.value, x + 10, y + 20, { width: kpiW - 20 })
    if (kpi.sub) {
      doc.fontSize(7).font('Helvetica').fillColor('#aaaaaa')
         .text(kpi.sub, x + 10, y + 36, { width: kpiW - 20 })
    }
  })

  // ── C. Clientes & Prestamos ──────────────────────────────
  let yC = kpiY + 2 * (kpiH + 8) + 10
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
     .text('Clientes y Prestamos', LEFT, yC)
  yC += 16

  const statsGrid = [
    { label: 'Clientes activos', value: String(clientesActivos.size) },
    { label: 'En mora', value: String(clientesMora.size) },
    { label: 'Prestamos activos', value: String(prestamosActivos.length) },
    { label: 'Completados', value: String(prestamosCompletados) },
  ]
  const statW = (W - 30) / 4
  statsGrid.forEach((s, i) => {
    const x = LEFT + i * (statW + 10)
    doc.fontSize(8).font('Helvetica').fillColor('#888888')
       .text(s.label, x, yC, { width: statW })
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111111')
       .text(s.value, x, yC + 12, { width: statW })
  })

  // ── D. Flujo de Capital ──────────────────────────────────
  let yD = yC + 38
  doc.moveTo(LEFT, yD).lineTo(RIGHT, yD).strokeColor('#eeeeee').lineWidth(0.5).stroke()
  yD += 10

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
     .text('Flujo de Capital', LEFT, yD)
  yD += 16

  const capitalStats = [
    { label: 'Desembolsado', value: fmt(desembolsadoMes), color: '#ef4444' },
    { label: 'Recaudado', value: fmt(recaudadoMes), color: '#22c55e' },
    { label: 'Gastos', value: fmt(gastosMes), color: '#f59e0b' },
    { label: 'Flujo neto', value: fmt(flujoNeto), color: flujoNeto >= 0 ? '#22c55e' : '#ef4444' },
  ]
  const capW = (W - 30) / 4
  capitalStats.forEach((s, i) => {
    const x = LEFT + i * (capW + 10)
    doc.fontSize(8).font('Helvetica').fillColor('#888888')
       .text(s.label, x, yD, { width: capW })
    doc.fontSize(12).font('Helvetica-Bold').fillColor(s.color)
       .text(s.value, x, yD + 12, { width: capW })
  })

  // ── E. Tabla Cobradores ──────────────────────────────────
  let yE = yD + 38
  doc.moveTo(LEFT, yE).lineTo(RIGHT, yE).strokeColor('#eeeeee').lineWidth(0.5).stroke()
  yE += 10

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
     .text('Rendimiento de Cobradores', LEFT, yE)
  yE += 18

  if (cobradoresData.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor('#999999')
       .text('Sin datos de cobradores en el periodo', LEFT, yE)
    yE += 16
  } else {
    const cols = [
      { label: 'Cobrador', w: 120, align: 'left' },
      { label: 'Ruta', w: 100, align: 'left' },
      { label: 'Esperado', w: 95, align: 'right' },
      { label: 'Recogido', w: 95, align: 'right' },
      { label: 'Eficiencia', w: 60, align: 'right' },
    ]

    // Header
    doc.save()
    doc.roundedRect(LEFT, yE, W, 16, 2).fill('#f0f0f0')
    doc.restore()
    let xCol = LEFT + 6
    cols.forEach(col => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#555555')
         .text(col.label, xCol, yE + 4, { width: col.w - 12, align: col.align })
      xCol += col.w
    })
    yE += 18

    cobradoresData.forEach((c, idx) => {
      if (yE > 700) {
        doc.addPage()
        yE = 40
      }

      if (idx % 2 === 1) {
        doc.save()
        doc.rect(LEFT, yE - 1, W, 16).fill('#fafafa')
        doc.restore()
      }

      xCol = LEFT + 6
      const vals = [
        { v: c.nombre, w: 120, align: 'left' },
        { v: c.ruta, w: 100, align: 'left' },
        { v: fmt(c.esperado), w: 95, align: 'right' },
        { v: fmt(c.recogido), w: 95, align: 'right' },
        { v: `${c.eficiencia}%`, w: 60, align: 'right' },
      ]

      const efColor = c.eficiencia >= 90 ? '#16a34a' : c.eficiencia >= 80 ? '#ca8a04' : '#dc2626'

      vals.forEach((v, vi) => {
        const isEf = vi === vals.length - 1
        doc.fontSize(8).font(isEf ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor(isEf ? efColor : '#333333')
           .text(v.v, xCol, yE + 2, { width: v.w - 12, align: v.align })
        xCol += v.w
      })
      yE += 17
    })
  }

  // ── F. Mini chart ingresos diarios ───────────────────────
  if (ingresosArr.length > 1) {
    yE += 6
    if (yE > 620) { doc.addPage(); yE = 40 }

    doc.moveTo(LEFT, yE).lineTo(RIGHT, yE).strokeColor('#eeeeee').lineWidth(0.5).stroke()
    yE += 10

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333')
       .text('Ingresos Diarios', LEFT, yE)
    yE += 18

    const chartW = W
    const chartH = 80
    const maxVal = Math.max(...ingresosArr.map(d => d.total), 1)
    const barW = Math.max(2, Math.min(16, (chartW - ingresosArr.length) / ingresosArr.length))
    const gap = (chartW - barW * ingresosArr.length) / (ingresosArr.length + 1)

    ingresosArr.forEach((d, i) => {
      const barH = (d.total / maxVal) * chartH
      const x = LEFT + gap + i * (barW + gap)
      const y = yE + chartH - barH

      doc.save()
      doc.roundedRect(x, y, barW, barH, 1).fill('#22c55e')
      doc.restore()
    })

    // X axis labels (show ~8 labels max)
    const labelStep = Math.max(1, Math.floor(ingresosArr.length / 8))
    ingresosArr.forEach((d, i) => {
      if (i % labelStep !== 0) return
      const x = LEFT + gap + i * (barW + gap)
      const dayLabel = d.fecha.slice(8)
      doc.fontSize(6).font('Helvetica').fillColor('#aaaaaa')
         .text(dayLabel, x - 4, yE + chartH + 3, { width: 20, align: 'center' })
    })

    yE += chartH + 16
  }

  // ── G. Footer ────────────────────────────────────────────
  const pageH = doc.page.height
  doc.fontSize(7).font('Helvetica').fillColor('#bbbbbb')
     .text('Control Finanzas', LEFT, pageH - 30, { width: W, align: 'center' })

  // ── Finalize ─────────────────────────────────────────────
  doc.end()
  await done
  const buffer = Buffer.concat(chunks)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resumen-${desdeStr}-a-${hastaStr}.pdf"`,
    },
  })
}
