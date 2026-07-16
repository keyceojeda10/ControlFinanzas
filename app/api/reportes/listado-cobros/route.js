import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatMoney }      from '@/lib/i18n'
import { calcularSaldoPendiente, calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import PDFDocument          from 'pdfkit'
import { PassThrough }      from 'stream'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const rutaId = searchParams.get('rutaId')

  const fmt = (v) => formatMoney(v, country)

  const [org, festivos, rutas] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),
    prisma.ruta.findMany({
      where: {
        organizationId: orgId,
        activo: true,
        ...(rutaId ? { id: rutaId } : {}),
      },
      select: {
        id: true,
        nombre: true,
        clientes: {
          where: {
            estado: { notIn: ['eliminado', 'inactivo'] },
            prestamos: { some: { estado: 'activo', esClavo: false } },
          },
          select: {
            id: true,
            nombre: true,
            cedula: true,
            telefono: true,
            direccion: true,
            diasSinCobro: true,
            prestamos: {
              where: { estado: 'activo', esClavo: false },
              select: {
                estado: true,
                montoPrestado: true,
                totalAPagar: true,
                cuotaDiaria: true,
                frecuencia: true,
                fechaInicio: true,
                diasPlazo: true,
                modoInteres: true,
                proximoCobroManual: true,
                cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, capital: true, pagado: true, fechaEsperada: true } },
                pagos: { select: { montoPagado: true, tipo: true } },
              },
            },
          },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const diasSinCobroOrg = obtenerDiasSinCobro(org?.diasSinCobro)
  const festArr = festivos.map(f => new Date(f.fecha).toISOString().slice(0, 10))

  const filas = []
  let totalCuotas = 0
  let totalSaldos = 0
  let clientesConMora = 0

  for (const ruta of rutas) {
    for (const cliente of ruta.clientes) {
      for (const p of cliente.prestamos) {
        const saldo = calcularSaldoPendiente(p)
        const mora = calcularDiasMora(p, diasSinCobroOrg, festArr)
        totalCuotas += p.cuotaDiaria
        totalSaldos += saldo
        if (mora > 0) clientesConMora++

        filas.push({
          ruta: ruta.nombre,
          nombre: cliente.nombre,
          telefono: cliente.telefono || '',
          cuota: p.cuotaDiaria,
          frecuencia: p.frecuencia,
          saldo,
          mora,
        })
      }
    }
  }

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
  const COLOR_HEAD_BG  = '#f0f0f0'
  const COLOR_ROW_BG   = '#f8f8f8'
  const COLOR_GREEN    = '#16a34a'
  const COLOR_RED      = '#dc2626'
  const COLOR_AMBER    = '#d97706'

  const W = 612 - 80
  const LEFT = 40
  const RIGHT = 572
  const PAGE_BOTTOM = 748

  const nombreNegocio = org?.nombre ?? 'Mi Negocio'
  const hoy = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })

  function ensureSpace(y, needed) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      return 40
    }
    return y
  }

  // ── Header ────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR_INK)
     .text(nombreNegocio, LEFT, 40, { width: W * 0.68, height: 24, ellipsis: true, lineBreak: false })

  doc.fontSize(11).font('Helvetica').fillColor(COLOR_MUTED)
     .text('Listado de cobros', LEFT, 64)

  doc.fontSize(10).fillColor('#777777')
     .text(hoy, LEFT, 79)

  doc.fontSize(8).fillColor(COLOR_FAINT)
     .text(`${filas.length} clientes con préstamo activo`, LEFT, 42, { width: W, align: 'right' })

  doc.rect(LEFT, 98, W, 2).fill(COLOR_GREEN)

  // ── Summary cards ─────────────────────────────────────────
  const cardW = W / 3 - 6
  const cardH = 48
  let cardY = 112

  const cards = [
    { label: 'Cuota diaria total', value: fmt(totalCuotas), color: COLOR_GREEN },
    { label: 'Saldo pendiente', value: fmt(totalSaldos), color: COLOR_INK },
    { label: 'Clientes en mora', value: String(clientesConMora), color: clientesConMora > 0 ? COLOR_RED : COLOR_GREEN },
  ]

  cards.forEach((c, i) => {
    const x = LEFT + i * (cardW + 9)
    doc.save()
    doc.roundedRect(x, cardY, cardW, cardH, 6).fillAndStroke('#fafafa', COLOR_BORDER)
    doc.restore()
    doc.rect(x, cardY, 3, cardH).fill(c.color)
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_MUTED)
       .text(c.label.toUpperCase(), x + 12, cardY + 10, { width: cardW - 16, characterSpacing: 0.2 })
    doc.fontSize(14).font('Helvetica-Bold').fillColor(c.color)
       .text(c.value, x + 12, cardY + 24, { width: cardW - 16 })
  })

  let y = cardY + cardH + 20

  // ── Table by route ────────────────────────────────────────
  const rutasAgrupadas = {}
  for (const f of filas) {
    if (!rutasAgrupadas[f.ruta]) rutasAgrupadas[f.ruta] = []
    rutasAgrupadas[f.ruta].push(f)
  }

  const COL = {
    num:   { x: LEFT,       w: 22 },
    nombre:{ x: LEFT + 22,  w: 170 },
    tel:   { x: LEFT + 192, w: 80 },
    cuota: { x: LEFT + 272, w: 78 },
    saldo: { x: LEFT + 350, w: 85 },
    mora:  { x: LEFT + 435, w: 45 },
    estado:{ x: LEFT + 480, w: W - 440 },
  }
  const ROW_H = 18

  for (const [rutaNombre, clientes] of Object.entries(rutasAgrupadas)) {
    y = ensureSpace(y, 50)

    // Route title
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_INK)
       .text(rutaNombre.toUpperCase(), LEFT, y, { width: W, characterSpacing: 0.3 })
    y += 13
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(COLOR_INK).lineWidth(1).stroke()
    y += 8

    // Table header
    y = ensureSpace(y, ROW_H + 10)
    doc.save()
    doc.rect(LEFT, y - 2, W, ROW_H).fill(COLOR_HEAD_BG)
    doc.restore()

    doc.fontSize(7).font('Helvetica-Bold').fillColor(COLOR_MUTED)
    doc.text('#', COL.num.x + 4, y + 3, { width: COL.num.w })
    doc.text('CLIENTE', COL.nombre.x, y + 3, { width: COL.nombre.w })
    doc.text('TELÉFONO', COL.tel.x, y + 3, { width: COL.tel.w })
    doc.text('CUOTA', COL.cuota.x, y + 3, { width: COL.cuota.w, align: 'right' })
    doc.text('SALDO', COL.saldo.x, y + 3, { width: COL.saldo.w, align: 'right' })
    doc.text('MORA', COL.mora.x, y + 3, { width: COL.mora.w, align: 'center' })
    doc.text('ESTADO', COL.estado.x, y + 3, { width: COL.estado.w, align: 'center' })
    y += ROW_H

    // Table rows
    clientes.forEach((c, i) => {
      y = ensureSpace(y, ROW_H + 4)

      if (i % 2 === 1) {
        doc.save()
        doc.rect(LEFT, y - 2, W, ROW_H).fill(COLOR_ROW_BG)
        doc.restore()
      }

      const freq = c.frecuencia === 'semanal' ? '/sem' : c.frecuencia === 'quincenal' ? '/qna' : c.frecuencia === 'mensual' ? '/mes' : '/día'

      doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_TEXT)
      doc.text(String(i + 1), COL.num.x + 4, y + 3, { width: COL.num.w })
      doc.font('Helvetica-Bold').text(c.nombre, COL.nombre.x, y + 3, { width: COL.nombre.w, height: ROW_H - 4, ellipsis: true, lineBreak: false })
      doc.font('Helvetica').fillColor(COLOR_MUTED).text(c.telefono, COL.tel.x, y + 3, { width: COL.tel.w })
      doc.fillColor(COLOR_TEXT).text(fmt(c.cuota) + freq, COL.cuota.x, y + 3, { width: COL.cuota.w, align: 'right' })
      doc.text(fmt(c.saldo), COL.saldo.x, y + 3, { width: COL.saldo.w, align: 'right' })

      // Mora badge
      if (c.mora > 0) {
        const moraText = `${c.mora}d`
        const badgeBg = c.mora > 10 ? '#fee2e2' : '#fef3c7'
        const badgeColor = c.mora > 10 ? COLOR_RED : COLOR_AMBER
        const tw = doc.font('Helvetica-Bold').fontSize(7).widthOfString(moraText)
        const bw = tw + 10
        const bx = COL.mora.x + (COL.mora.w - bw) / 2
        doc.save()
        doc.roundedRect(bx, y, bw, 13, 6).fill(badgeBg)
        doc.restore()
        doc.fontSize(7).font('Helvetica-Bold').fillColor(badgeColor)
           .text(moraText, bx, y + 3, { width: bw, align: 'center' })
      } else {
        doc.fontSize(7).font('Helvetica').fillColor(COLOR_MUTED)
           .text('—', COL.mora.x, y + 3, { width: COL.mora.w, align: 'center' })
      }

      // Status
      const statusText = c.mora > 0 ? 'En mora' : 'Al día'
      const statusColor = c.mora > 0 ? COLOR_RED : COLOR_GREEN
      doc.fontSize(7).font('Helvetica-Bold').fillColor(statusColor)
         .text(statusText, COL.estado.x, y + 3, { width: COL.estado.w, align: 'center' })

      y += ROW_H
    })

    // Route subtotal
    y += 4
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke()
    y += 6
    const subtotalCuota = clientes.reduce((s, c) => s + c.cuota, 0)
    const subtotalSaldo = clientes.reduce((s, c) => s + c.saldo, 0)
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR_INK)
       .text(`${clientes.length} clientes`, COL.nombre.x, y, { width: COL.nombre.w })
    doc.text(fmt(subtotalCuota), COL.cuota.x, y, { width: COL.cuota.w, align: 'right' })
    doc.text(fmt(subtotalSaldo), COL.saldo.x, y, { width: COL.saldo.w, align: 'right' })
    y += 24
  }

  // ── Footer (every page) ──────────────────────────────────
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const pageH = doc.page.height
    doc.moveTo(LEFT, pageH - 42).lineTo(RIGHT, pageH - 42).strokeColor('#eeeeee').lineWidth(0.5).stroke()
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
       .text('Control Finanzas', LEFT, pageH - 32, { width: W, align: 'center' })
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
       .text(`Página ${i - range.start + 1} de ${range.count}`, LEFT, pageH - 32, { width: W, align: 'right' })
  }

  doc.end()
  await done
  const buffer = Buffer.concat(chunks)

  const fechaFile = new Date().toISOString().slice(0, 10)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="listado-cobros-${fechaFile}.pdf"`,
    },
  })
}
