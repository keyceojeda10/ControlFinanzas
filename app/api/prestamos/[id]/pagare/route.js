import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatMoney }      from '@/lib/i18n'
import { readFile }         from 'fs/promises'
import path                 from 'path'
import { abrirDocumento, respuestaPdf, F } from '@/lib/papel/documento'
import { COLOR, TIPO, HOJA, RADIO } from '@/lib/papel/tokens'
import { leerSubido } from '@/lib/almacen'
import { formatearTasa } from '@/lib/adaptadores/prestamos'

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
    // tresDigitos() solo maneja hasta 999. Desde mil millones, `millones` pasa
    // de 999 y devolvia undefined: el pagare imprimia "UNDEFINED MILLONES" en
    // el renglon del valor y en el cuerpo. En un documento que presta merito
    // ejecutivo, el monto en letras corrupto lo invalida.
    if (millones > 999) {
      const milesDeMillon = Math.floor(millones / 1000)
      const restoMillones = millones % 1000
      resultado += (milesDeMillon === 1 ? 'mil' : tresDigitos(milesDeMillon) + ' mil')
      if (restoMillones > 0) resultado += ' ' + tresDigitos(restoMillones)
      resultado += ' millones '
    } else {
      resultado += (millones === 1 ? 'un millón' : tresDigitos(millones) + ' millones') + ' '
    }
  }
  if (miles > 0) {
    resultado += (miles === 1 ? 'mil' : tresDigitos(miles) + ' mil') + ' '
  }
  if (resto > 0) {
    resultado += tresDigitos(resto)
  }

  return resultado.trim().toUpperCase()
}

/** El valor en letras para el documento: «UN MILLÓN DE PESOS», «DOS MILLONES
 *  DE PESOS», «UN MILLÓN QUINIENTOS MIL PESOS». Salía «UN MILLON PESOS»: sin
 *  tilde y sin el «de» que pide un millón redondo. En un título valor el monto
 *  en letras no es adorno. */
function enPesos(n) {
  const letras = numeroALetras(n)
  return `${letras}${/MILL(Ó|O)N(ES)?$/.test(letras) ? ' DE' : ''} PESOS`
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

  /* DOS PAGARÉS (3 oct 2026). Un prestamista: «con los porcentajes tan altos
     que aparecen en el pagaré, si lo quiero usar legalmente quizás no serviría
     y sería contraproducente». El de siempre dice la tasa por escrito, y en
     Colombia el interés por encima del límite de usura es delito (art. 305 del
     Código Penal) y hace perder los intereses (Ley 45 de 1990, art. 72): el
     documento con el que se iba a cobrar era la prueba en contra.

     · `capital` (POR DEFECTO): el valor es LO PRESTADO, sin tasa, sin total con
       interés ni cuota; la mora, «a la tasa máxima legal permitida», que nunca
       pasa del límite porque es el límite. Se cobra lo que la ley reconoce.
     · `condiciones`: el de siempre, con su texto intacto.

     ⚠ NO hay un tercero «por el total sin decir la tasa»: esconde el interés
     dentro del valor y, si el deudor prueba lo que recibió, la usura aparece
     igual y con un documento armado para taparla.
     ⚠ La redacción del de capital tiene que pasar por un abogado colombiano. */
  const tipo = new URL(req.url).searchParams.get('tipo') === 'condiciones' ? 'condiciones' : 'capital'
  const porCapital = tipo === 'capital'
  const valorInt = porCapital ? montoInt : totalInt

  /* La firma se lee por `leerSubido`, que mira el almacén nuevo Y el viejo: los
     archivos salieron de `public/` porque ahí Next los servía sin sesión, y un
     pagaré sin la firma estampada no se ve roto — se ve normal y no sirve. */
  const firmaBuffer = await leerSubido(prestamo.firmaUrl)

  /* EL TEXTO LEGAL DEL PAGARÉ «CON CONDICIONES» NO SE TOCA (el de capital es de
   * 3 oct 2026: ver arriba). Lo unico que cambia respecto de la version
   * anterior es COMO SE VE: las mismas frases, las mismas clausulas, el mismo
   * orden. Este documento presta merito ejecutivo y su redaccion no es cosa de
   * un rediseno.
   *
   * Lo que si cambia: fuentes de la marca en vez de Helvetica, el filete
   * dorado, el monto en Space Grotesk, y el pie con numero de pagina. Antes se
   * escribia a `alto - 30` con margen 50, o sea por debajo del area util, que
   * es justo lo que abria hojas de mas. */
  const hoja = abrirDocumento({ pie: `Pagaré No. ${prestamo.id.slice(-8).toUpperCase()}` })
  const doc = hoja.doc
  const { L, R, W } = hoja

  doc.font(F.fuerte).fontSize(TIPO.titulo + 4).fillColor(COLOR.ink)
  hoja.escribir('PAGARÉ', L, HOJA.margen, { width: W, align: 'center', characterSpacing: 2 })

  doc.font(F.cifra).fontSize(TIPO.rotulo).fillColor(COLOR.ink4)
  hoja.escribir(`No. ${prestamo.id.slice(-8).toUpperCase()}`, L, HOJA.margen + 32, { width: W, align: 'center' })

  doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink2)
  hoja.escribir(
    org?.ciudad ? `${org.ciudad}, ${fmtFecha(prestamo.createdAt)}` : fmtFecha(prestamo.createdAt),
    L, HOJA.margen + 48, { width: W, align: 'center' },
  )

  let y = HOJA.margen + 70
  doc.rect(L, y, W, 3).fill(COLOR.gold)
  y += 22

  /* El valor, en grande. Es lo primero que busca cualquiera que abre un pagare
     y estaba en cuerpo 10, del mismo tamano que las clausulas. */
  // 52 dejaba el monto tocando el borde de abajo de la caja: 26pt de letra no
  // caben en 52 - 20 de hueco superior. Se ve en la hoja, no en el numero.
  const ALTO_VALOR = 60
  doc.roundedRect(L, y, W, ALTO_VALOR, RADIO).fillAndStroke(COLOR.goldTint, COLOR.gold)
  doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.goldInk)
  hoja.escribir('VALOR', L + 14, y + 9, { characterSpacing: 0.6 })
  doc.font(F.cifraFuerte).fontSize(TIPO.cifraGrande).fillColor(COLOR.ink)
  hoja.escribir(fmt(valorInt), L + 14, y + 20, { width: W - 28, ellipsis: true })
  y += ALTO_VALOR + 8

  doc.font(F.texto).fontSize(TIPO.tabla).fillColor(COLOR.ink3)
  doc.text(enPesos(valorInt), L, y, { width: W })
  y = doc.y + 16

  const identificacion = `Yo, ${cliente.nombre || '________________'}` +
    (cliente.cedula && !cliente.cedula.startsWith('SIN-')
      ? (porCapital ? `, identificado(a) con cédula de ciudadanía No. ${cliente.cedula}` : `, identificado(a) con cedula de ciudadania No. ${cliente.cedula}`)
      : '')
  const acreedor = org?.nombre || 'EL ACREEDOR'

  const cuerpo = porCapital
    ? `${identificacion}, me obligo a pagar incondicionalmente a la orden de ${acreedor}, o de quien represente sus derechos, la suma de ${fmt(montoInt)} (${enPesos(montoInt)}), que recibí en préstamo de dinero el ${fmtFecha(prestamo.fechaInicio)}.`
    : `${identificacion}, me comprometo a pagar incondicionalmente a la orden de ${acreedor} la suma de ${fmt(totalInt)} (${enPesos(totalInt)}), correspondiente a un prestamo por valor de ${fmt(montoInt)} con una tasa de interes del ${formatearTasa(prestamo.tasaInteres)}% y un plazo de ${prestamo.diasPlazo} dias.`

  doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink2)
  doc.text(cuerpo, L, y, { width: W, align: 'justify', lineGap: 3 })
  y = doc.y + 10

  const condiciones = porCapital
    ? `Pagaré esta suma a más tardar el ${fmtFecha(prestamo.fechaFin)}${org?.ciudad ? `, en ${org.ciudad}` : ''}. Podré hacerlo mediante abonos parciales, que se descontarán del saldo de esta obligación.`
    : `El pago se realizara en cuotas de ${fmt(Math.round(prestamo.cuotaDiaria))} con frecuencia ${FREQ_LABEL[prestamo.frecuencia] || prestamo.frecuencia}, desde el ${fmtFecha(prestamo.fechaInicio)} hasta el ${fmtFecha(prestamo.fechaFin)}.`
  doc.text(condiciones, L, y, { width: W, align: 'justify', lineGap: 3 })
  y = hoja.sitio(doc.y + 16, 90)

  const clausulas = porCapital
    ? [
      `Si el deudor no paga en la fecha indicada, reconocerá intereses moratorios a la tasa máxima legal permitida${country === 'co' ? ', certificada por la Superintendencia Financiera de Colombia,' : ''} desde el día siguiente al vencimiento y hasta el pago total, además de los gastos de cobranza.`,
      'El acreedor podrá declarar vencido el plazo y exigir de inmediato el pago total del saldo si el deudor incumple cualquiera de los abonos acordados.',
      'El deudor renuncia a la presentación para el pago, al aviso de rechazo y a los requerimientos de ley para ser constituido en mora, y autoriza al acreedor a reportar el incumplimiento ante las centrales de riesgo o bases de datos que apliquen.',
      'Este pagaré presta mérito ejecutivo sin necesidad de requerimiento previo.',
      'Para todos los efectos legales, el deudor señala como domicilio la ciudad donde se suscribe este documento.',
    ]
    : [
      'En caso de mora, el deudor acepta pagar los intereses moratorios pactados y los gastos de cobranza que se generen.',
      'El deudor renuncia a los requerimientos de ley para ser constituido en mora y autoriza al acreedor a reportar el incumplimiento ante las centrales de riesgo o bases de datos que apliquen.',
      'Este pagare presta merito ejecutivo sin necesidad de requerimiento previo.',
      'Para todos los efectos legales, el deudor senala como domicilio la ciudad donde se suscribe este documento.',
    ]

  y = hoja.seccion('Cláusulas', y)
  clausulas.forEach((c, i) => {
    doc.font(F.cifraFuerte).fontSize(TIPO.tabla).fillColor(COLOR.gold)
    hoja.escribir(`${i + 1}`, L, y + 1)
    doc.font(F.texto).fontSize(TIPO.tabla).fillColor(COLOR.ink2)
    doc.text(c, L + 16, y, { width: W - 16, align: 'justify', lineGap: 2 })
    y = doc.y + 7
  })

  y = hoja.seccion(porCapital ? 'Resumen' : 'Resumen del crédito', hoja.sitio(y + 8, 130))

  /* Dos columnas de pares rotulo/valor: ocho renglones seguidos ocupaban media
     hoja y empujaban las firmas a la siguiente. El de capital no lleva tasa,
     total, cuota ni frecuencia: es justo lo que no tiene que quedar escrito. */
  const resumen = porCapital ? [
    ['Valor prestado', fmt(montoInt)],
    ['Fecha de entrega', fmtFecha(prestamo.fechaInicio)],
    ['Vencimiento', fmtFecha(prestamo.fechaFin)],
    ['Intereses de mora', 'Tasa máxima legal'],
  ] : [
    ['Monto prestado', fmt(montoInt)],
    ['Tasa de interés', `${formatearTasa(prestamo.tasaInteres)}%`],
    ['Total a pagar', fmt(totalInt)],
    ['Cuota', fmt(Math.round(prestamo.cuotaDiaria))],
    ['Frecuencia', FREQ_LABEL[prestamo.frecuencia] || prestamo.frecuencia],
    ['Plazo', `${prestamo.diasPlazo} días`],
    ['Fecha de inicio', fmtFecha(prestamo.fechaInicio)],
    ['Vencimiento', fmtFecha(prestamo.fechaFin)],
  ]
  const anchoCol = W / 2
  resumen.forEach(([rot, valor], i) => {
    const x = L + (i % 2) * anchoCol
    const yy = y + Math.floor(i / 2) * 20
    doc.font(F.texto).fontSize(TIPO.tabla).fillColor(COLOR.ink3)
    hoja.escribir(rot, x, yy, { width: anchoCol * 0.52 })
    doc.font(F.cifraFuerte).fontSize(TIPO.tabla).fillColor(COLOR.ink)
    hoja.escribir(valor, x + anchoCol * 0.52, yy, { width: anchoCol * 0.42, ellipsis: true })
    if (i % 2 === 0) {
      doc.moveTo(L, yy + 15).lineTo(R, yy + 15).lineWidth(0.5).strokeColor(COLOR.borderSoft).stroke()
    }
  })
  y += Math.ceil(resumen.length / 2) * 20 + 26

  /* LAS DOS FIRMAS MIDEN LO MISMO, con imagen o sin ella. Antes la firma del
     deudor empujaba `y` 65 puntos cuando venia como imagen y la caja del
     acreedor quedaba a otra altura: dos rayas desalineadas en un documento que
     va a un juzgado. */
  const ALTO_FIRMA = 64
  y = hoja.sitio(y, ALTO_FIRMA + 46)
  const colW = W / 2 - 12
  const xDer = L + colW + 24

  if (firmaBuffer) {
    try { doc.image(firmaBuffer, L, y + 4, { fit: [colW - 10, ALTO_FIRMA - 10] }) } catch {}
  }
  y += ALTO_FIRMA

  const rayaFirma = (x, titulo, nombre, extra) => {
    doc.moveTo(x, y).lineTo(x + colW, y).lineWidth(0.5).strokeColor(COLOR.ink4).stroke()
    doc.font(F.fuerte).fontSize(TIPO.tabla).fillColor(COLOR.ink2)
    hoja.escribir(titulo, x, y + 6, { width: colW })
    doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink4)
    // `height` obliga a UN renglon: un nombre de negocio largo se repartia en
    // dos y el segundo caia justo donde va la cedula.
    hoja.escribir(nombre, x, y + 19, { width: colW, height: 11, ellipsis: true })
    if (extra) hoja.escribir(extra, x, y + 30, { width: colW, ellipsis: true })
  }

  rayaFirma(L, 'Firma del deudor', cliente.nombre || '',
    cliente.cedula && !cliente.cedula.startsWith('SIN-') ? `C.C. ${cliente.cedula}` : '')
  rayaFirma(xDer, 'Firma del acreedor', org?.nombre || '', '')

  const buffer = await hoja.cerrar()
  /* Por letras, no por unidades de UTF-16: `slice(0, 30)` partía un emoji por la
     mitad. El resto (tildes, emojis, comillas) lo resuelve `respuestaPdf`. */
  const nombreArchivo = `pagare-${Array.from((cliente.nombre || 'cliente').trim().replace(/\s+/g, '-')).slice(0, 30).join('')}.pdf`
  return respuestaPdf(buffer, nombreArchivo)
}
