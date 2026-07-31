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
    festivos,
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
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
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
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
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
  // capitalPrestado se calculaba aqui y no se imprimia en ninguna parte del PDF.
  // Se quita en vez de "arreglarlo": habria costado traer la tabla de
  // amortizacion de cada prestamo para un numero que nadie ve.
  let carteraActiva = 0, saldoPorCobrar = 0

  for (const p of prestamosActivos) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    const pagado = (p.pagos || [])
      .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
      .reduce((a, pg) => a + (pg.montoPagado || 0), 0)
    saldoPorCobrar += Math.max(0, (p.totalAPagar ?? 0) - pagado)
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos, festivos) > 0) clientesMora.add(p.clienteId)
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
  const doc = new PDFDocument({ size: 'letter', margin: 40, bufferPages: true })
  const stream = new PassThrough()
  const chunks = []
  stream.on('data', chunk => chunks.push(chunk))
  const done = new Promise(resolve => stream.on('end', resolve))
  doc.pipe(stream)

  // ── Design tokens ─────────────────────────────────────────
  const COLOR_INK      = '#111111'
  const COLOR_TEXT     = '#333333'
  const COLOR_MUTED    = '#666666'
  const COLOR_FAINT    = '#999999'
  const COLOR_BORDER   = '#dddddd'
  const COLOR_BORDER_L = '#eeeeee'
  const COLOR_HEAD_BG  = '#f0f0f0'
  const COLOR_ROW_BG   = '#f8f8f8'
  const COLOR_GREEN    = '#16a34a'
  const COLOR_GREEN_BG = '#dcfce7'
  const COLOR_RED      = '#dc2626'
  const COLOR_RED_BG   = '#fee2e2'
  const COLOR_AMBER    = '#d97706'
  const COLOR_AMBER_BG = '#fef3c7'
  const COLOR_BLUE     = '#2563eb'

  const W = 612 - 80
  const LEFT = 40
  const RIGHT = 572
  const PAGE_BOTTOM = 760

  const fechaDesdeFmt = formatFechaCorta(new Date(desdeStr + 'T12:00:00Z'), country)
  const fechaHastaFmt = formatFechaCorta(new Date(hastaStr + 'T12:00:00Z'), country)
  const generadoFmt = new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // lineBreak: false on ALL text calls — prevents PDFKit from auto-creating blank pages
  const t = (str, x, y, opts = {}) => doc.text(str, x, y, { lineBreak: false, ...opts })

  function sectionTitle(y, label) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_INK)
    t(label.toUpperCase(), LEFT, y, { width: W, characterSpacing: 0.3 })
    const lineY = y + 13
    doc.moveTo(LEFT, lineY).lineTo(RIGHT, lineY).strokeColor(COLOR_INK).lineWidth(1).stroke()
    return lineY + 12
  }

  function ensureSpace(y, needed) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      return 40
    }
    return y
  }

  function drawStat(x, y, width, label, value, color = COLOR_INK, valueSize = 13) {
    doc.fontSize(8).font('Helvetica').fillColor(COLOR_MUTED)
    t(label.toUpperCase(), x, y, { width, height: 10, characterSpacing: 0.2 })
    doc.fontSize(valueSize).font('Helvetica-Bold').fillColor(color)
    t(value, x, y + 11, { width, height: 16, ellipsis: true })
  }

  function drawBadge(x, y, width, text, bg, color) {
    const padX = 6
    const textWidth = doc.font('Helvetica-Bold').fontSize(8).widthOfString(text)
    const boxW = Math.min(width, textWidth + padX * 2)
    const boxX = x + (width - boxW)
    doc.save()
    doc.roundedRect(boxX, y - 2, boxW, 13, 6).fill(bg)
    doc.restore()
    doc.fontSize(8).font('Helvetica-Bold').fillColor(color)
    t(text, boxX, y + 1, { width: boxW, align: 'center' })
  }

  // ── A. Header ────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR_INK)
  t(nombreNegocio, LEFT, 40, { width: W * 0.68, height: 24, ellipsis: true })

  doc.fontSize(11).font('Helvetica').fillColor(COLOR_MUTED)
  t('Resumen del periodo', LEFT, 64)

  doc.fontSize(10).fillColor('#777777')
  t(`${fechaDesdeFmt}  —  ${fechaHastaFmt}`, LEFT, 79)

  doc.fontSize(8).fillColor(COLOR_FAINT)
  t(`Generado: ${generadoFmt}`, LEFT, 42, { width: W, align: 'right' })

  doc.rect(LEFT, 98, W, 2).fill(COLOR_GREEN)

  // ── B. KPI cards (2x2 grid, bordered with left accent) ───
  const kpis = [
    { label: 'Ingresos del periodo', value: fmt(totalPeriodo), sub: `${cantidadPagos} pagos`, accent: COLOR_GREEN },
    { label: 'Interes ganado', value: fmt(interesGanado), accent: COLOR_GREEN },
    { label: 'Capital recuperado', value: fmt(capitalRecuperado), accent: COLOR_BLUE },
    { label: 'Cartera activa', value: fmt(saldoPorCobrar), accent: COLOR_BLUE },
  ]

  const kpiGap = 10
  const kpiW = (W - kpiGap) / 2
  const kpiH = 54
  let kpiY = 118

  kpis.forEach((kpi, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = LEFT + col * (kpiW + kpiGap)
    const y = kpiY + row * (kpiH + kpiGap)

    doc.save()
    doc.roundedRect(x, y, kpiW, kpiH, 8).lineWidth(0.75).strokeColor(COLOR_BORDER).stroke()
    doc.restore()

    doc.save()
    doc.roundedRect(x, y, 3, kpiH, 1.5).fill(kpi.accent)
    doc.restore()

    doc.fontSize(8).font('Helvetica').fillColor(COLOR_MUTED)
    t(kpi.label.toUpperCase(), x + 14, y + 10, { width: kpiW - 24, characterSpacing: 0.2 })
    doc.fontSize(15).font('Helvetica-Bold').fillColor(COLOR_INK)
    t(kpi.value, x + 14, y + 23, { width: kpiW - 24, height: 18, ellipsis: true })
    if (kpi.sub) {
      doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
      t(kpi.sub, x + 14, y + 40, { width: kpiW - 24 })
    }
  })

  // ── C. Clientes y Prestamos ──────────────────────────────
  let yC = kpiY + 2 * (kpiH + kpiGap) + 14
  yC = sectionTitle(yC, 'Clientes y Prestamos')

  const statsGrid = [
    { label: 'Clientes activos', value: String(clientesActivos.size) },
    { label: 'En mora', value: String(clientesMora.size), color: clientesMora.size > 0 ? COLOR_RED : COLOR_INK },
    { label: 'Prestamos activos', value: String(prestamosActivos.length) },
    { label: 'Completados', value: String(prestamosCompletados) },
  ]
  const statGap = 12
  const statW = (W - statGap * 3) / 4
  statsGrid.forEach((s, i) => {
    const x = LEFT + i * (statW + statGap)
    drawStat(x, yC, statW, s.label, s.value, s.color || COLOR_INK, 14)
  })

  // ── D. Flujo de Capital ──────────────────────────────────
  let yD = yC + 40
  yD = sectionTitle(yD, 'Flujo de Capital')

  const capitalStats = [
    { label: 'Desembolsado', value: fmt(desembolsadoMes), color: COLOR_RED },
    { label: 'Recaudado', value: fmt(recaudadoMes), color: COLOR_GREEN },
    { label: 'Gastos', value: fmt(gastosMes), color: COLOR_AMBER },
    { label: 'Flujo neto', value: fmt(flujoNeto), color: flujoNeto >= 0 ? COLOR_GREEN : COLOR_RED },
  ]
  const capW = (W - statGap * 3) / 4
  capitalStats.forEach((s, i) => {
    const x = LEFT + i * (capW + statGap)
    drawStat(x, yD, capW, s.label, s.value, s.color, 13)
  })

  // ── E. Tabla Cobradores ──────────────────────────────────
  let yE = yD + 40
  yE = sectionTitle(yE, 'Rendimiento de Cobradores')

  if (cobradoresData.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(COLOR_FAINT)
    t('Sin datos de cobradores en el periodo', LEFT, yE)
    yE += 20
  } else {
    const cols = [
      { label: 'Cobrador', w: 150, align: 'left' },
      { label: 'Ruta', w: 110, align: 'left' },
      { label: 'Esperado', w: 100, align: 'right' },
      { label: 'Recogido', w: 100, align: 'right' },
      { label: 'Eficiencia', w: 72, align: 'right' },
    ]
    const rowH = 20

    function drawTableHeader(y) {
      doc.save()
      doc.rect(LEFT, y, W, 18).fill(COLOR_HEAD_BG)
      doc.restore()
      let xCol = LEFT + 8
      cols.forEach(col => {
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR_MUTED)
        t(col.label.toUpperCase(), xCol, y + 5, { width: col.w - 12, height: 10, align: col.align, characterSpacing: 0.2 })
        xCol += col.w
      })
      return y + 18
    }

    yE = drawTableHeader(yE)

    cobradoresData.forEach((c, idx) => {
      if (yE + rowH > PAGE_BOTTOM) {
        doc.addPage()
        yE = 40
        yE = drawTableHeader(yE)
      }

      if (idx % 2 === 1) {
        doc.save()
        doc.rect(LEFT, yE, W, rowH).fill(COLOR_ROW_BG)
        doc.restore()
      }

      doc.moveTo(LEFT, yE + rowH).lineTo(RIGHT, yE + rowH).strokeColor(COLOR_BORDER_L).lineWidth(0.5).stroke()

      let xCol = LEFT + 8
      const vals = [
        { v: c.nombre, w: 150, align: 'left' },
        { v: c.ruta, w: 110, align: 'left' },
        { v: fmt(c.esperado), w: 100, align: 'right' },
        { v: fmt(c.recogido), w: 100, align: 'right' },
      ]

      vals.forEach(v => {
        doc.fontSize(8.5).font('Helvetica').fillColor(COLOR_TEXT)
        t(v.v, xCol, yE + 6, { width: v.w - 12, height: 12, align: v.align, ellipsis: true })
        xCol += v.w
      })

      const efBg = c.eficiencia >= 90 ? COLOR_GREEN_BG : c.eficiencia >= 80 ? COLOR_AMBER_BG : COLOR_RED_BG
      const efColor = c.eficiencia >= 90 ? COLOR_GREEN : c.eficiencia >= 80 ? COLOR_AMBER : COLOR_RED
      drawBadge(xCol, yE + 4, cols[4].w - 12, `${c.eficiencia}%`, efBg, efColor)

      yE += rowH
    })
  }

  // ── F. Ingresos Diarios (bar chart) ──────────────────────
  if (ingresosArr.length > 1) {
    yE += 18
    yE = ensureSpace(yE, 130)
    yE = sectionTitle(yE, 'Ingresos Diarios')

    const chartW = W
    const chartH = 90
    const maxVal = Math.max(...ingresosArr.map(d => d.total), 1)
    const barW = Math.max(3, Math.min(18, (chartW - ingresosArr.length) / ingresosArr.length))
    const gap = (chartW - barW * ingresosArr.length) / (ingresosArr.length + 1)

    const sorted = [...ingresosArr].map((d, i) => ({ ...d, i })).sort((a, b) => b.total - a.total)
    const topCount = Math.min(3, sorted.length)
    const topIndexes = new Set(sorted.slice(0, topCount).filter(d => d.total > 0).map(d => d.i))

    ingresosArr.forEach((d, i) => {
      const barH = Math.max(1, (d.total / maxVal) * chartH)
      const x = LEFT + gap + i * (barW + gap)
      const y = yE + chartH - barH

      doc.save()
      doc.roundedRect(x, y, barW, barH, Math.min(3, barW / 2)).fill(COLOR_GREEN)
      doc.restore()

      if (topIndexes.has(i)) {
        doc.fontSize(6).font('Helvetica-Bold').fillColor(COLOR_INK)
        t(fmt(d.total), x - 10, Math.max(yE - 2, y - 9), { width: barW + 20, align: 'center' })
      }
    })

    doc.moveTo(LEFT, yE + chartH).lineTo(RIGHT, yE + chartH).strokeColor(COLOR_BORDER_L).lineWidth(0.5).stroke()

    const labelStep = Math.max(1, Math.floor(ingresosArr.length / 8))
    ingresosArr.forEach((d, i) => {
      if (i % labelStep !== 0) return
      const x = LEFT + gap + i * (barW + gap)
      const dayLabel = d.fecha.slice(8)
      doc.fontSize(6).font('Helvetica').fillColor(COLOR_FAINT)
      t(dayLabel, x - 4, yE + chartH + 4, { width: barW + 8, align: 'center' })
    })

    yE += chartH + 20
  }

  // ── G. Footer (every page) ───────────────────────────────
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const pageH = doc.page.height
    doc.moveTo(LEFT, pageH - 42).lineTo(RIGHT, pageH - 42).strokeColor(COLOR_BORDER_L).lineWidth(0.5).stroke()
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
    t('Control Finanzas', LEFT, pageH - 32, { width: W, align: 'center', height: 12 })
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
    t(`Pagina ${i - range.start + 1} de ${range.count}`, LEFT, pageH - 32, { width: W, align: 'right', height: 12 })
  }

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
