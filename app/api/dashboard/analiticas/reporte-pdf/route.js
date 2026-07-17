import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatMoney } from '@/lib/i18n'
import { calcularDiasMora } from '@/lib/calculos'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'

const INK = '#111111', TEXT = '#333333', MUTED = '#666666', FAINT = '#999999'
const BORDER = '#dddddd', BORDER_L = '#eeeeee', HEAD_BG = '#f0f0f0', ROW_BG = '#f8f8f8'
const GREEN = '#16a34a', GREEN_BG = '#dcfce7', RED = '#dc2626', RED_BG = '#fee2e2'
const AMBER = '#d97706', AMBER_BG = '#fef3c7', BLUE = '#2563eb', ACCENT = '#d4a017'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, role } = session.user
  if (!organizationId) return Response.json({ error: 'Sin organización' }, { status: 400 })
  if (role === 'cobrador') return Response.json({ error: 'Solo owner' }, { status: 403 })

  const country = session.user.country ?? 'co'
  const fmt = v => formatMoney(v, country)

  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const mesesAtras = 6
  const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 1)

  const [
    org,
    pagosMensuales,
    prestamosMensuales,
    gastosMensuales,
    cobradorRecaudo,
    orgUsers,
    pagosEsteMes,
    pagosMesAnterior,
    prestamosActivosDetalle,
    festivos,
    organization,
    prestamosEsclavo,
    totalClientes,
    prestamosTotal,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { nombre: true } }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(fechaPago, '%Y-%m') as mes, SUM(montoPagado) as total, COUNT(*) as cantidad
      FROM Pago WHERE organizationId = ${organizationId} AND fechaPago >= ${fechaInicio}
        AND tipo NOT IN ('recargo', 'descuento')
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, SUM(montoPrestado) as capitalPrestado,
        COUNT(*) as cantidad
      FROM Prestamo WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio} AND esClavo = false
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
      FROM GastoMenor WHERE organizationId = ${organizationId} AND fecha >= ${fechaInicio} AND estado = 'aprobado'
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT cobradorId, SUM(montoPagado) as recaudado, COUNT(*) as pagos
      FROM Pago WHERE organizationId = ${organizationId} AND fechaPago >= ${mesActual}
        AND tipo NOT IN ('recargo', 'descuento') AND cobradorId IS NOT NULL
      GROUP BY cobradorId ORDER BY recaudado DESC
    `,
    prisma.user.findMany({ where: { organizationId }, select: { id: true, nombre: true, rol: true } }),
    prisma.pago.aggregate({
      where: { organizationId, fechaPago: { gte: mesActual }, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.pago.aggregate({
      where: { organizationId, fechaPago: { gte: mesAnterior, lt: mesActual }, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'activo', esClavo: false },
      select: {
        id: true, montoPrestado: true, totalAPagar: true, totalPagado: true,
        cuotaDiaria: true, frecuencia: true, fechaInicio: true, fechaFin: true,
        diasPlazo: true, ultimoPagoAt: true, modoInteres: true, tasaInteres: true,
        cliente: { select: { id: true, nombre: true } },
        cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, pagado: true, fechaEsperada: true } },
      },
    }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.prestamo.aggregate({ where: { organizationId, esClavo: true }, _count: true, _sum: { totalAPagar: true } }),
    prisma.cliente.count({ where: { organizationId } }),
    prisma.$queryRaw`
      SELECT clienteId, COUNT(*) as total
      FROM Prestamo WHERE organizationId = ${organizationId} AND esClavo = false
      GROUP BY clienteId HAVING total > 1
    `,
  ])

  // Calculations
  const diasExcluidos = organization?.diasSinCobro || []
  const diasMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const diasTranscurridos = hoy.getDate()
  let diasHabiles = 0
  for (let d = 1; d <= diasTranscurridos; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(diasMap[f.getDay()])) diasHabiles++
  }
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  let diasHabilesTotalMes = 0
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(diasMap[f.getDay()])) diasHabilesTotalMes++
  }

  const recaudadoMes = Number(pagosEsteMes._sum?.montoPagado || 0)
  const recaudadoMesAnterior = Number(pagosMesAnterior._sum?.montoPagado || 0)
  const cuotaDiariaTotal = prestamosActivosDetalle.reduce((s, p) => s + Number(p.cuotaDiaria || 0), 0)
  const esperadoMes = cuotaDiariaTotal * diasHabilesTotalMes
  const promedioDiario = diasHabiles > 0 ? recaudadoMes / diasHabiles : 0
  const proyeccionMes = promedioDiario * diasHabilesTotalMes

  const capitalEnCalle = prestamosActivosDetalle.reduce((s, p) => s + Number(p.montoPrestado), 0)
  const porCobrar = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.totalPagado || 0)), 0)
  const interesEnCartera = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.montoPrestado)), 0)

  const pagoMap = Object.fromEntries(pagosMensuales.map(p => [p.mes, p]))
  const gastoMap = Object.fromEntries(gastosMensuales.map(g => [g.mes, g]))
  const prestamoMap = Object.fromEntries(prestamosMensuales.map(p => [p.mes, p]))
  const mesActualKey = mesActual.toISOString().slice(0, 7)
  const gastosMesActual = Number(gastoMap[mesActualKey]?.total || 0)
  const gananciaNetaMes = recaudadoMes - gastosMesActual
  const roiMensual = capitalEnCalle > 0 ? ((gananciaNetaMes) / capitalEnCalle * 100) : 0

  // Mora
  const festivosFechas = festivos.map(f => f.fecha)
  const alertas = []
  for (const p of prestamosActivosDetalle) {
    const dias = calcularDiasMora(p, diasExcluidos, festivosFechas)
    if (dias > 0) {
      alertas.push({
        clienteNombre: p.cliente.nombre,
        diasMora: dias,
        montoEnRiesgo: Number(p.totalAPagar) - Number(p.totalPagado || 0),
        cuotaDiaria: Number(p.cuotaDiaria),
        severidad: dias >= 8 ? 'grave' : dias >= 4 ? 'moderada' : 'leve',
      })
    }
  }
  alertas.sort((a, b) => b.diasMora - a.diasMora)
  const montoMoraTotal = alertas.reduce((s, a) => s + a.montoEnRiesgo, 0)

  // Cobradores
  const userMap = Object.fromEntries(orgUsers.map(u => [u.id, u]))
  const cobradoresData = cobradorRecaudo.map(c => ({
    nombre: userMap[c.cobradorId]?.nombre || 'Sin nombre',
    rol: userMap[c.cobradorId]?.rol || 'cobrador',
    recaudado: Number(c.recaudado),
    pagos: Number(c.pagos),
  }))

  // Monthly trend
  const meses = []
  for (let i = 0; i < mesesAtras; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1 + i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  // ── PDF Generation ──
  const doc = new PDFDocument({ size: 'letter', margin: 40, bufferPages: true })
  const stream = new PassThrough()
  const chunks = []
  stream.on('data', chunk => chunks.push(chunk))
  const done = new Promise(resolve => stream.on('end', resolve))
  doc.pipe(stream)

  const W = 532, LEFT = 40, RIGHT = 572
  const t = (str, x, y, opts = {}) => doc.text(String(str ?? ''), x, y, { lineBreak: false, ...opts })

  const mesNombre = hoy.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const fechaGeneracion = hoy.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  let ensureSpace = (y, needed) => {
    if (y + needed > 740) { doc.addPage(); return 50 }
    return y
  }

  // ── HEADER ──
  doc.rect(LEFT, 38, 4, 26).fill(ACCENT)
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK)
  t(org?.nombre || 'Control Finanzas', LEFT + 12, 40)
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
  t('Informe de Rendimiento', LEFT + 12, 60)

  doc.font('Helvetica').fontSize(9).fillColor(FAINT)
  t(mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1), RIGHT - 150, 42, { width: 150, align: 'right' })
  t(`Generado: ${fechaGeneracion}`, RIGHT - 200, 54, { width: 200, align: 'right' })

  doc.moveTo(LEFT, 78).lineTo(RIGHT, 78).strokeColor(BORDER).lineWidth(0.5).stroke()

  // ── ROI & RESUMEN FINANCIERO ──
  let y = 92

  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  t('RENDIMIENTO DEL MES', LEFT, y)
  y += 20

  // Big ROI
  doc.font('Helvetica-Bold').fontSize(32).fillColor(roiMensual >= 0 ? GREEN : RED)
  t(`${Math.round(roiMensual * 10) / 10}%`, LEFT, y)
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
  t('ROI mensual', LEFT + 90, y + 14)
  doc.font('Helvetica').fontSize(8).fillColor(FAINT)
  t(`(ganancia neta / capital en calle)`, LEFT + 90, y + 28)

  // KPI cards right side
  const kpiX = 300
  const drawKpi = (x, yy, label, value, color = INK) => {
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    t(label, x, yy)
    doc.font('Helvetica-Bold').fontSize(12).fillColor(color)
    t(value, x, yy + 10)
  }
  drawKpi(kpiX, y, 'GANANCIA NETA', fmt(gananciaNetaMes), gananciaNetaMes >= 0 ? GREEN : RED)
  drawKpi(kpiX + 130, y, 'RECAUDADO', fmt(recaudadoMes), BLUE)
  drawKpi(kpiX, y + 30, 'GASTOS', fmt(gastosMesActual), RED)
  drawKpi(kpiX + 130, y + 30, 'CAPITAL EN CALLE', fmt(capitalEnCalle), INK)

  y += 70
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER_L).lineWidth(0.5).stroke()
  y += 14

  // ── PROYECCION ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  t('PROYECCION DEL MES', LEFT, y)
  y += 16

  // Progress bar
  const barW = W - 160
  const pctAvance = esperadoMes > 0 ? Math.min(recaudadoMes / esperadoMes, 1) : 0
  doc.roundedRect(LEFT, y, barW, 12, 3).fillColor('#eeeeee').fill()
  if (pctAvance > 0) doc.roundedRect(LEFT, y, barW * pctAvance, 12, 3).fillColor(ACCENT).fill()
  doc.font('Helvetica-Bold').fontSize(7).fillColor(INK)
  t(`${Math.round(pctAvance * 100)}%`, LEFT + barW * pctAvance - 20, y + 2)

  const projX = LEFT + barW + 14
  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
  t('Proyectado', projX, y - 2)
  doc.font('Helvetica-Bold').fontSize(11).fillColor(ACCENT)
  t(fmt(Math.round(proyeccionMes)), projX, y + 8)

  y += 20
  doc.font('Helvetica').fontSize(8).fillColor(TEXT)
  t(`Promedio diario: ${fmt(Math.round(promedioDiario))}  |  Dia ${diasHabiles} de ${diasHabilesTotalMes} habiles`, LEFT, y)

  if (esperadoMes > 0) {
    const diff = proyeccionMes >= esperadoMes
      ? `${Math.round(((proyeccionMes / esperadoMes) - 1) * 100)}% por encima de lo esperado (${fmt(Math.round(esperadoMes))})`
      : `${Math.round((1 - (proyeccionMes / esperadoMes)) * 100)}% por debajo de lo esperado (${fmt(Math.round(esperadoMes))})`
    doc.font('Helvetica').fontSize(8).fillColor(proyeccionMes >= esperadoMes ? GREEN : RED)
    t(diff, LEFT, y + 12)
  }

  y += 32
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER_L).lineWidth(0.5).stroke()
  y += 14

  // ── CARTERA ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  t('ESTADO DE CARTERA', LEFT, y)
  y += 16

  const colW = W / 4
  const drawStatBox = (x, yy, label, value, color = INK) => {
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    t(label, x, yy)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(color)
    t(value, x, yy + 10)
  }

  drawStatBox(LEFT, y, 'PRESTAMOS ACTIVOS', `${prestamosActivosDetalle.length}`)
  drawStatBox(LEFT + colW, y, 'POR COBRAR', fmt(porCobrar), BLUE)
  drawStatBox(LEFT + colW * 2, y, 'INTERES EN CARTERA', fmt(interesEnCartera), GREEN)
  drawStatBox(LEFT + colW * 3, y, 'EN MORA', `${alertas.length} (${prestamosActivosDetalle.length > 0 ? Math.round(alertas.length / prestamosActivosDetalle.length * 100) : 0}%)`, alertas.length > 0 ? RED : GREEN)

  y += 30

  const clientesRepiten = totalClientes > 0 ? Math.round((prestamosTotal.length / totalClientes) * 100) : 0
  const ticketPromedio = prestamosActivosDetalle.length > 0 ? capitalEnCalle / prestamosActivosDetalle.length : 0
  drawStatBox(LEFT, y, 'TICKET PROMEDIO', fmt(Math.round(ticketPromedio)))
  drawStatBox(LEFT + colW, y, 'CLIENTES QUE REPITEN', `${clientesRepiten}%`, BLUE)
  drawStatBox(LEFT + colW * 2, y, 'CLAVOS', `${prestamosEsclavo._count || 0}`, prestamosEsclavo._count > 0 ? RED : FAINT)
  drawStatBox(LEFT + colW * 3, y, 'MONTO CLAVOS', fmt(Number(prestamosEsclavo._sum?.totalAPagar || 0)), prestamosEsclavo._count > 0 ? RED : FAINT)

  y += 36
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER_L).lineWidth(0.5).stroke()
  y += 14

  // ── CLIENTES EN MORA (table) ──
  if (alertas.length > 0) {
    y = ensureSpace(y, 60)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED)
    t(`CLIENTES EN MORA (${alertas.length})`, LEFT, y)
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    t(`Monto total en riesgo: ${fmt(montoMoraTotal)}`, LEFT + 200, y)
    y += 16

    // Table header
    doc.roundedRect(LEFT, y, W, 16, 2).fillColor(HEAD_BG).fill()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT)
    t('CLIENTE', LEFT + 6, y + 4)
    t('DIAS', LEFT + 240, y + 4)
    t('SEVERIDAD', LEFT + 290, y + 4)
    t('CUOTA', LEFT + 370, y + 4)
    t('MONTO EN RIESGO', LEFT + 430, y + 4, { width: 96, align: 'right' })
    y += 18

    for (let i = 0; i < alertas.length; i++) {
      y = ensureSpace(y, 16)
      const a = alertas[i]
      if (i % 2 === 1) doc.rect(LEFT, y - 1, W, 15).fillColor(ROW_BG).fill()

      doc.font('Helvetica').fontSize(8).fillColor(TEXT)
      t(a.clienteNombre.length > 30 ? a.clienteNombre.slice(0, 28) + '...' : a.clienteNombre, LEFT + 6, y + 2)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(a.severidad === 'grave' ? RED : a.severidad === 'moderada' ? AMBER : FAINT)
      t(`${a.diasMora}`, LEFT + 244, y + 2)

      // Severity badge
      const sevColor = a.severidad === 'grave' ? RED : a.severidad === 'moderada' ? AMBER : FAINT
      const sevBg = a.severidad === 'grave' ? RED_BG : a.severidad === 'moderada' ? AMBER_BG : '#f0f0f0'
      const sevLabel = a.severidad === 'grave' ? 'GRAVE' : a.severidad === 'moderada' ? 'MODERADA' : 'LEVE'
      doc.roundedRect(LEFT + 290, y, 50, 13, 3).fillColor(sevBg).fill()
      doc.font('Helvetica-Bold').fontSize(6).fillColor(sevColor)
      t(sevLabel, LEFT + 296, y + 3)

      doc.font('Helvetica').fontSize(8).fillColor(TEXT)
      t(fmt(a.cuotaDiaria), LEFT + 370, y + 2)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(a.severidad === 'grave' ? RED : TEXT)
      t(fmt(a.montoEnRiesgo), LEFT + 430, y + 2, { width: 96, align: 'right' })
      y += 16
    }

    y += 10
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER_L).lineWidth(0.5).stroke()
    y += 14
  }

  // ── COBRADORES ──
  if (cobradoresData.length > 0) {
    y = ensureSpace(y, 60)
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    t('DESEMPENO COBRADORES', LEFT, y)
    y += 16

    doc.roundedRect(LEFT, y, W, 16, 2).fillColor(HEAD_BG).fill()
    doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT)
    t('#', LEFT + 6, y + 4)
    t('NOMBRE', LEFT + 22, y + 4)
    t('ROL', LEFT + 220, y + 4)
    t('PAGOS', LEFT + 300, y + 4)
    t('RECAUDADO', LEFT + 380, y + 4, { width: 146, align: 'right' })
    y += 18

    const totalRecaudadoCob = cobradoresData.reduce((s, c) => s + c.recaudado, 0)

    for (let i = 0; i < cobradoresData.length; i++) {
      y = ensureSpace(y, 16)
      const c = cobradoresData[i]
      if (i % 2 === 1) doc.rect(LEFT, y - 1, W, 15).fillColor(ROW_BG).fill()

      doc.font('Helvetica-Bold').fontSize(8).fillColor(i < 3 ? ACCENT : FAINT)
      t(`${i + 1}`, LEFT + 8, y + 2)
      doc.font('Helvetica').fontSize(8).fillColor(TEXT)
      t(c.nombre, LEFT + 22, y + 2)
      doc.font('Helvetica').fontSize(7).fillColor(FAINT)
      t(c.rol === 'owner' ? 'Admin' : 'Cobrador', LEFT + 220, y + 2)
      doc.font('Helvetica').fontSize(8).fillColor(TEXT)
      t(`${c.pagos}`, LEFT + 306, y + 2)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(INK)
      t(fmt(c.recaudado), LEFT + 380, y + 2, { width: 146, align: 'right' })
      y += 16
    }

    y += 10
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(BORDER_L).lineWidth(0.5).stroke()
    y += 14
  }

  // ── TENDENCIA MENSUAL (bar chart) ──
  y = ensureSpace(y, 120)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  t('RECAUDADO ULTIMOS 6 MESES', LEFT, y)
  y += 18

  const chartH = 80, chartW = W - 40, chartLeft = LEFT + 20
  const maxRecaudado = Math.max(...meses.map(m => Number(pagoMap[m]?.total || 0)), 1)

  for (let i = 0; i < meses.length; i++) {
    const val = Number(pagoMap[meses[i]]?.total || 0)
    const barH = (val / maxRecaudado) * chartH
    const barW2 = (chartW / meses.length) - 8
    const barX = chartLeft + i * (chartW / meses.length) + 4

    doc.roundedRect(barX, y + chartH - barH, barW2, barH, 2).fillColor(ACCENT).fill()

    const mesLabel = new Date(meses[i] + '-15').toLocaleDateString('es', { month: 'short' })
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    t(mesLabel.toUpperCase(), barX, y + chartH + 4, { width: barW2, align: 'center' })

    if (val > 0) {
      doc.font('Helvetica').fontSize(6).fillColor(TEXT)
      t(fmt(val), barX - 4, y + chartH - barH - 10, { width: barW2 + 8, align: 'center' })
    }
  }

  y += chartH + 24

  // ── TENDENCIA GASTOS ──
  y = ensureSpace(y, 120)
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
  t('GASTOS ULTIMOS 6 MESES', LEFT, y)
  y += 18

  const maxGasto = Math.max(...meses.map(m => Number(gastoMap[m]?.total || 0)), 1)
  for (let i = 0; i < meses.length; i++) {
    const val = Number(gastoMap[meses[i]]?.total || 0)
    const barH = maxGasto > 0 ? (val / maxGasto) * chartH : 0
    const barW2 = (chartW / meses.length) - 8
    const barX = chartLeft + i * (chartW / meses.length) + 4

    doc.roundedRect(barX, y + chartH - barH, barW2, Math.max(barH, 1), 2).fillColor(RED).fill()

    const mesLabel = new Date(meses[i] + '-15').toLocaleDateString('es', { month: 'short' })
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    t(mesLabel.toUpperCase(), barX, y + chartH + 4, { width: barW2, align: 'center' })

    if (val > 0) {
      doc.font('Helvetica').fontSize(6).fillColor(TEXT)
      t(fmt(val), barX - 4, y + chartH - barH - 10, { width: barW2 + 8, align: 'center' })
    }
  }

  // ── FOOTER (all pages) ──
  const totalPages = doc.bufferedPageRange().count
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i)
    doc.moveTo(LEFT, 760).lineTo(RIGHT, 760).strokeColor(BORDER_L).lineWidth(0.5).stroke()
    doc.font('Helvetica').fontSize(7).fillColor(FAINT)
    doc.text('Control Finanzas — Informe de Rendimiento', LEFT, 766, { lineBreak: false })
    doc.text(`Pagina ${i + 1} de ${totalPages}`, RIGHT - 80, 766, { lineBreak: false, width: 80, align: 'right' })
  }

  doc.end()
  await done
  const buffer = Buffer.concat(chunks)

  const fileName = `rendimiento-${mesActualKey}.pdf`
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
