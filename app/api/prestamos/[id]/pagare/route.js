import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatMoney }      from '@/lib/i18n'
import PDFDocument          from 'pdfkit'
import { PassThrough }      from 'stream'
import { readFile }         from 'fs/promises'
import path                 from 'path'

const FREQ_LABEL = { diario: 'diario', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }

function fmtFecha(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function numeroALetras(n) {
  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince']
  const decenas = ['', 'dieci', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  if (n === 0) return 'cero'
  if (n === 100) return 'cien'

  let resultado = ''
  const millones = Math.floor(n / 1000000)
  const miles = Math.floor((n % 1000000) / 1000)
  const resto = n % 1000

  function tresDigitos(num) {
    if (num === 0) return ''
    if (num === 100) return 'cien'
    let r = ''
    const c = Math.floor(num / 100)
    const d = Math.floor((num % 100) / 10)
    const u = num % 10
    if (c > 0) r += centenas[c] + ' '
    const du = num % 100
    if (du >= 10 && du <= 15) { r += especiales[du - 10]; return r.trim() }
    if (du >= 16 && du <= 19) { r += 'dieci' + unidades[u]; return r.trim() }
    if (du === 20) { r += 'veinte'; return r.trim() }
    if (du >= 21 && du <= 29) { r += 'veinti' + unidades[u]; return r.trim() }
    if (d >= 3) {
      r += decenas[d]
      if (u > 0) r += ' y ' + unidades[u]
    } else if (d > 0) {
      r += decenas[d] + unidades[u]
    } else if (u > 0) {
      r += unidades[u]
    }
    return r.trim()
  }

  if (millones > 0) {
    resultado += (millones === 1 ? 'un millon' : tresDigitos(millones) + ' millones') + ' '
  }
  if (miles > 0) {
    resultado += (miles === 1 ? 'mil' : tresDigitos(miles) + ' mil') + ' '
  }
  if (resto > 0) {
    resultado += tresDigitos(resto)
  }

  return resultado.trim().toUpperCase()
}

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId } = session.user
  const { id } = await params

  const [prestamo, org] = await Promise.all([
    prisma.prestamo.findFirst({
      where: { id, organizationId },
      include: {
        cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { nombre: true, ciudad: true, country: true },
    }),
  ])

  if (!prestamo) return Response.json({ error: 'Prestamo no encontrado' }, { status: 404 })

  const country = org?.country ?? 'co'
  const fmt = (v) => formatMoney(v, country)
  const cliente = prestamo.cliente || {}
  const montoInt = Math.round(prestamo.montoPrestado)
  const totalInt = Math.round(prestamo.totalAPagar)

  let firmaBuffer = null
  if (prestamo.firmaUrl) {
    try {
      firmaBuffer = await readFile(path.join(process.cwd(), 'public', prestamo.firmaUrl))
    } catch {}
  }

  const doc = new PDFDocument({ size: 'letter', margin: 50 })
  const stream = new PassThrough()
  const chunks = []
  stream.on('data', chunk => chunks.push(chunk))
  const done = new Promise(resolve => stream.on('end', resolve))
  doc.pipe(stream)

  const W = 612 - 100
  const LEFT = 50
  const RIGHT = 562
  let y = 50

  // Header
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#111111')
     .text('PAGARE', LEFT, y, { width: W, align: 'center' })
  y += 30

  doc.fontSize(9).font('Helvetica').fillColor('#666666')
     .text(`No. ${prestamo.id.slice(-8).toUpperCase()}`, LEFT, y, { width: W, align: 'center' })
  y += 20

  if (org?.ciudad) {
    doc.fontSize(10).font('Helvetica').fillColor('#333333')
       .text(`${org.ciudad}, ${fmtFecha(prestamo.createdAt)}`, LEFT, y, { width: W, align: 'center' })
    y += 18
  } else {
    doc.fontSize(10).font('Helvetica').fillColor('#333333')
       .text(fmtFecha(prestamo.createdAt), LEFT, y, { width: W, align: 'center' })
    y += 18
  }

  // Separator
  y += 5
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor('#cccccc').lineWidth(0.5).stroke()
  y += 15

  // Monto en letras
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111')
     .text(`Valor: ${fmt(totalInt)} (${numeroALetras(totalInt)} PESOS)`, LEFT, y, { width: W })
  y += 22

  // Cuerpo del pagare
  const cuerpo = `Yo, ${cliente.nombre || '________________'}` +
    (cliente.cedula && !cliente.cedula.startsWith('SIN-') ? `, identificado(a) con cedula de ciudadania No. ${cliente.cedula}` : '') +
    `, me comprometo a pagar incondicionalmente a la orden de ${org?.nombre || 'EL ACREEDOR'} la suma de ${fmt(totalInt)} (${numeroALetras(totalInt)} PESOS), correspondiente a un prestamo por valor de ${fmt(montoInt)} con una tasa de interes del ${prestamo.tasaInteres}% y un plazo de ${prestamo.diasPlazo} dias.`

  doc.fontSize(10).font('Helvetica').fillColor('#222222')
     .text(cuerpo, LEFT, y, { width: W, align: 'justify', lineGap: 3 })
  y = doc.y + 15

  // Condiciones de pago
  const condiciones = `El pago se realizara en cuotas de ${fmt(Math.round(prestamo.cuotaDiaria))} con frecuencia ${FREQ_LABEL[prestamo.frecuencia] || prestamo.frecuencia}, desde el ${fmtFecha(prestamo.fechaInicio)} hasta el ${fmtFecha(prestamo.fechaFin)}.`

  doc.text(condiciones, LEFT, y, { width: W, align: 'justify', lineGap: 3 })
  y = doc.y + 15

  // Clausulas
  const clausulas = [
    'En caso de mora, el deudor acepta pagar los intereses moratorios pactados y los gastos de cobranza que se generen.',
    'El deudor renuncia a los requerimientos de ley para ser constituido en mora y autoriza al acreedor a reportar el incumplimiento ante las centrales de riesgo o bases de datos que apliquen.',
    'Este pagare presta merito ejecutivo sin necesidad de requerimiento previo.',
    'Para todos los efectos legales, el deudor senala como domicilio la ciudad donde se suscribe este documento.',
  ]

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
     .text('CLAUSULAS:', LEFT, y)
  y = doc.y + 6

  clausulas.forEach((c, i) => {
    doc.fontSize(9).font('Helvetica').fillColor('#333333')
       .text(`${i + 1}. ${c}`, LEFT, y, { width: W, align: 'justify', lineGap: 2 })
    y = doc.y + 6
  })

  y += 10

  // Tabla resumen
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor('#cccccc').lineWidth(0.5).stroke()
  y += 12

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
     .text('RESUMEN DEL CREDITO', LEFT, y)
  y += 16

  const filas = [
    ['Monto prestado', fmt(montoInt)],
    ['Tasa de interes', `${prestamo.tasaInteres}%`],
    ['Total a pagar', fmt(totalInt)],
    ['Cuota', fmt(Math.round(prestamo.cuotaDiaria))],
    ['Frecuencia', FREQ_LABEL[prestamo.frecuencia] || prestamo.frecuencia],
    ['Plazo', `${prestamo.diasPlazo} dias`],
    ['Fecha inicio', fmtFecha(prestamo.fechaInicio)],
    ['Fecha vencimiento', fmtFecha(prestamo.fechaFin)],
  ]

  filas.forEach(([label, value]) => {
    doc.fontSize(9).font('Helvetica').fillColor('#555555')
       .text(label, LEFT, y)
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#111111')
       .text(value, LEFT + 200, y)
    y += 16
  })

  y += 15
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor('#cccccc').lineWidth(0.5).stroke()
  y += 25

  // Firmas
  const colW = W / 2 - 10
  const firmaLeft = LEFT
  const firmaRight = LEFT + colW + 20

  // Firma deudor
  if (firmaBuffer) {
    try {
      const imgH = 60
      doc.image(firmaBuffer, firmaLeft, y, { width: 150, height: imgH, fit: [150, imgH] })
      y += imgH + 5
    } catch {}
  } else {
    y += 50
  }

  doc.moveTo(firmaLeft, y).lineTo(firmaLeft + colW, y).strokeColor('#888888').lineWidth(0.5).stroke()
  doc.fontSize(9).font('Helvetica').fillColor('#333333')
     .text('Firma del deudor', firmaLeft, y + 5)
  doc.fontSize(8).fillColor('#666666')
     .text(cliente.nombre || '', firmaLeft, y + 17)
  if (cliente.cedula && !cliente.cedula.startsWith('SIN-')) {
    doc.text(`C.C. ${cliente.cedula}`, firmaLeft, y + 28)
  }

  // Firma acreedor
  doc.moveTo(firmaRight, y).lineTo(firmaRight + colW, y).strokeColor('#888888').lineWidth(0.5).stroke()
  doc.fontSize(9).font('Helvetica').fillColor('#333333')
     .text('Firma del acreedor', firmaRight, y + 5)
  doc.fontSize(8).fillColor('#666666')
     .text(org?.nombre || '', firmaRight, y + 17)

  // Footer
  const pageH = doc.page.height
  doc.fontSize(7).font('Helvetica').fillColor('#bbbbbb')
     .text('Documento generado por Control Finanzas', LEFT, pageH - 30, { width: W, align: 'center' })

  doc.end()
  await done
  const buffer = Buffer.concat(chunks)

  const nombreArchivo = `pagare-${(cliente.nombre || 'cliente').replace(/\s+/g, '-').slice(0, 30)}.pdf`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
