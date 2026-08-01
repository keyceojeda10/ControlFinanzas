import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatMoney }      from '@/lib/i18n'
import { calcularSaldoPendiente, calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import PDFDocument          from 'pdfkit'
import { PassThrough }      from 'stream'
import { rotulo } from '@/lib/dinero/definiciones'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const rutaId = searchParams.get('rutaId')
  const soloMora = searchParams.get('soloMora') === '1'
  const orden = searchParams.get('orden') || 'nombre'

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
        diasSinCobro: true,
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

  const festArr = festivos.map(f => new Date(f.fecha).toISOString().slice(0, 10))

  let filas = []
  let totalCuotas = 0
  let totalSaldos = 0
  let clientesConMora = 0

  for (const ruta of rutas) {
    for (const cliente of ruta.clientes) {
      // La firma es obtenerDiasSinCobro(cliente, ruta, org, prestamo). Antes se
      // llamaba con el STRING JSON de la organizacion como primer argumento, o
      // sea en el lugar de `cliente`: adentro hacia '[0]'.diasSinCobro ->
      // undefined, y ruta/org llegaban undefined, asi que SIEMPRE devolvia [].
      // Resultado: si el negocio no cobra domingos, el papel contaba los
      // domingos como mora y los dias de atraso no coincidian con la app.
      const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, org)

      for (const p of cliente.prestamos) {
        const saldo = calcularSaldoPendiente(p)
        const mora = calcularDiasMora(p, diasExcluidos, festArr)
        const pagado = p.totalAPagar - saldo
        const avance = p.totalAPagar > 0 ? Math.round((pagado / p.totalAPagar) * 100) : 0

        if (soloMora && mora <= 0) continue

        totalCuotas += p.cuotaDiaria
        totalSaldos += saldo
        if (mora > 0) clientesConMora++

        filas.push({
          ruta: ruta.nombre,
          nombre: cliente.nombre,
          direccion: cliente.direccion || '',
          telefono: cliente.telefono || '',
          cuota: p.cuotaDiaria,
          frecuencia: p.frecuencia,
          saldo,
          mora,
          avance,
        })
      }
    }
  }

  if (orden === 'mora') filas.sort((a, b) => b.mora - a.mora)
  else if (orden === 'saldo') filas.sort((a, b) => b.saldo - a.saldo)

  // ── SOLO LA CUENTA ───────────────────────────────────────
  // T33-02 enseña «van a salir 18 clientes · $16,2M» ANTES de pulsar bajar,
  // porque hasta ahora se bajaba el PDF para ver que traia y, si no era eso,
  // otra vez. La cuenta sale de AQUI —el mismo filtrado, el mismo bucle— y no
  // de una consulta aparte: dos caminos distintos acaban dando dos numeros
  // distintos, y entonces el aviso miente sobre lo que se va a bajar.
  if (searchParams.get('solo') === 'cuenta') {
    return Response.json({
      clientes: filas.length,
      saldo: totalSaldos,
    })
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

  // lineBreak: false on ALL text calls — prevents PDFKit from auto-creating blank pages
  const t = (str, x, y, opts = {}) => doc.text(str, x, y, { lineBreak: false, ...opts })

  function ensureSpace(y, needed) {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      return 40
    }
    return y
  }

  // ── Header ────────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR_INK)
  t(nombreNegocio, LEFT, 40, { width: W * 0.68, height: 24, ellipsis: true })

  doc.fontSize(11).font('Helvetica').fillColor(COLOR_MUTED)
  t('Listado de cobros', LEFT, 64)

  doc.fontSize(10).fillColor('#777777')
  t(hoy, LEFT, 79)

  const filterLabel = soloMora ? 'Solo en mora' : 'Todos los clientes'
  doc.fontSize(8).fillColor(COLOR_FAINT)
  t(`${filas.length} clientes · ${filterLabel}`, LEFT, 42, { width: W, align: 'right' })

  doc.rect(LEFT, 98, W, 2).fill(COLOR_GREEN)

  // ── Summary cards ─────────────────────────────────────────
  const cardW = W / 3 - 6
  const cardH = 48
  let cardY = 112

  const cards = [
    { label: 'Cuota diaria total', value: fmt(totalCuotas), color: COLOR_GREEN },
    { label: 'Saldo pendiente', value: fmt(totalSaldos), color: COLOR_INK },
    { label: rotulo('clientesEnMora'), value: String(clientesConMora), color: clientesConMora > 0 ? COLOR_RED : COLOR_GREEN },
  ]

  cards.forEach((c, i) => {
    const x = LEFT + i * (cardW + 9)
    doc.save()
    doc.roundedRect(x, cardY, cardW, cardH, 6).fillAndStroke('#fafafa', COLOR_BORDER)
    doc.restore()
    doc.rect(x, cardY, 3, cardH).fill(c.color)
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_MUTED)
    t(c.label.toUpperCase(), x + 12, cardY + 10, { width: cardW - 16, characterSpacing: 0.2 })
    doc.fontSize(13).font('Helvetica-Bold').fillColor(c.color)
    t(c.value, x + 12, cardY + 25, { width: cardW - 16, height: 16, ellipsis: true })
  })

  let y = cardY + cardH + 20

  // ── Table by route ────────────────────────────────────────
  const rutasAgrupadas = {}
  for (const f of filas) {
    if (!rutasAgrupadas[f.ruta]) rutasAgrupadas[f.ruta] = []
    rutasAgrupadas[f.ruta].push(f)
  }

  const COL = {
    num:    { x: LEFT,       w: 18 },
    nombre: { x: LEFT + 18,  w: 152 },
    tel:    { x: LEFT + 170, w: 68 },
    cuota:  { x: LEFT + 238, w: 82 },
    saldo:  { x: LEFT + 320, w: 82 },
    avance: { x: LEFT + 402, w: 42 },
    mora:   { x: LEFT + 444, w: 88 },
  }
  const ROW_H = 18
  const ROW_H_DIR = 28

  for (const [rutaNombre, clientes] of Object.entries(rutasAgrupadas)) {
    y = ensureSpace(y, 50)

    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_INK)
    t(rutaNombre.toUpperCase(), LEFT, y, { width: W, characterSpacing: 0.3 })
    y += 13
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(COLOR_INK).lineWidth(1).stroke()
    y += 8

    // Table header — extraido a funcion para poder REDIBUJARLO al cambiar de
    // pagina. Antes se dibujaba una sola vez: una ruta de mas de ~30 clientes
    // pasaba a la hoja 2 y ahi salian columnas anonimas de numeros, sin forma
    // de saber cual era cuota y cual saldo. El cobrador lo lee en la calle.
    const drawTableHeader = (yy) => {
      doc.save()
      doc.rect(LEFT, yy - 2, W, ROW_H).fill(COLOR_HEAD_BG)
      doc.restore()

      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLOR_MUTED)
      t('#', COL.num.x + 2, yy + 3, { width: COL.num.w })
      t('CLIENTE', COL.nombre.x, yy + 3, { width: COL.nombre.w })
      t('TELÉFONO', COL.tel.x, yy + 3, { width: COL.tel.w })
      t('CUOTA', COL.cuota.x, yy + 3, { width: COL.cuota.w, align: 'right' })
      t('SALDO', COL.saldo.x, yy + 3, { width: COL.saldo.w, align: 'right' })
      t('AVANCE', COL.avance.x, yy + 3, { width: COL.avance.w, align: 'center' })
      t('MORA', COL.mora.x, yy + 3, { width: COL.mora.w, align: 'center' })
      return yy + ROW_H
    }

    y = ensureSpace(y, ROW_H + 10)
    y = drawTableHeader(y)

    // Table rows
    clientes.forEach((c, i) => {
      const hasDir = c.direccion.length > 0
      const rowH = hasDir ? ROW_H_DIR : ROW_H
      const yAntes = y
      y = ensureSpace(y, rowH + 4)
      if (y !== yAntes) y = drawTableHeader(y)   // hubo salto de pagina

      if (i % 2 === 1) {
        doc.save()
        doc.rect(LEFT, y - 2, W, rowH).fill(COLOR_ROW_BG)
        doc.restore()
      }

      const freq = c.frecuencia === 'semanal' ? '/sem' : c.frecuencia === 'quincenal' ? '/qna' : c.frecuencia === 'mensual' ? '/mes' : '/día'

      const cellH = 12

      doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_TEXT)
      t(String(i + 1), COL.num.x + 2, y + 3, { width: COL.num.w - 2, height: cellH })
      doc.font('Helvetica-Bold')
      t(c.nombre, COL.nombre.x, y + 3, { width: COL.nombre.w - 4, height: cellH, ellipsis: true })
      if (hasDir) {
        doc.fontSize(6).font('Helvetica').fillColor(COLOR_FAINT)
        t(c.direccion, COL.nombre.x, y + 14, { width: COL.nombre.w - 4, height: 10, ellipsis: true })
      }
      doc.fontSize(7).font('Helvetica').fillColor(COLOR_MUTED)
      t(c.telefono, COL.tel.x, y + 3, { width: COL.tel.w - 4, height: cellH, ellipsis: true })
      doc.fontSize(7).fillColor(COLOR_TEXT)
      t(fmt(c.cuota) + freq, COL.cuota.x, y + 3, { width: COL.cuota.w - 2, height: cellH, align: 'right' })
      t(fmt(c.saldo), COL.saldo.x, y + 3, { width: COL.saldo.w - 2, height: cellH, align: 'right' })

      // Avance (% pagado)
      const avText = `${c.avance}%`
      const avColor = c.avance >= 80 ? COLOR_GREEN : c.avance >= 50 ? COLOR_AMBER : COLOR_TEXT
      doc.fontSize(7).font('Helvetica-Bold').fillColor(avColor)
      t(avText, COL.avance.x, y + 3, { width: COL.avance.w, height: cellH, align: 'center' })

      // Mora badge — clamp width to column
      const drawMoraBadge = (text, bg, color) => {
        const tw = doc.font('Helvetica-Bold').fontSize(7).widthOfString(text)
        const bw = Math.min(tw + 10, COL.mora.w - 2)
        const bx = COL.mora.x + (COL.mora.w - bw) / 2
        doc.save()
        doc.roundedRect(bx, y + 1, bw, 13, 6).fill(bg)
        doc.restore()
        doc.fontSize(7).font('Helvetica-Bold').fillColor(color)
        t(text, bx, y + 4, { width: bw, height: cellH, align: 'center' })
      }

      if (c.mora > 0) {
        const badgeBg = c.mora > 10 ? '#fee2e2' : '#fef3c7'
        const badgeColor = c.mora > 10 ? COLOR_RED : COLOR_AMBER
        drawMoraBadge(`${c.mora}d mora`, badgeBg, badgeColor)
      } else {
        drawMoraBadge('Al día', '#dcfce7', COLOR_GREEN)
      }

      y += rowH
    })

    // Route subtotal
    y += 4
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke()
    y += 6
    const subtotalCuota = clientes.reduce((s, c) => s + c.cuota, 0)
    const subtotalSaldo = clientes.reduce((s, c) => s + c.saldo, 0)
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(COLOR_INK)
    t(`${clientes.length} clientes`, COL.nombre.x, y, { width: COL.nombre.w - 4, height: 12 })
    t(fmt(subtotalCuota), COL.cuota.x, y, { width: COL.cuota.w - 2, height: 12, align: 'right' })
    t(fmt(subtotalSaldo), COL.saldo.x, y, { width: COL.saldo.w - 2, height: 12, align: 'right' })
    y += 24
  }

  // ── Footer (every page) ──────────────────────────────────
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const pageH = doc.page.height
    doc.moveTo(LEFT, pageH - 42).lineTo(RIGHT, pageH - 42).strokeColor('#eeeeee').lineWidth(0.5).stroke()
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
    t('Control Finanzas', LEFT, pageH - 32, { width: W, align: 'center', height: 12 })
    doc.fontSize(7.5).font('Helvetica').fillColor(COLOR_FAINT)
    t(`Página ${i - range.start + 1} de ${range.count}`, LEFT, pageH - 32, { width: W, align: 'right', height: 12 })
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
