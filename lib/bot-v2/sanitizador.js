// lib/bot-v2/sanitizador.js — Limpieza post-AI del mensaje antes de enviarlo.
// Ultima linea de defensa contra alucinaciones.

import { NO_EXISTE, PRECIOS_VALIDOS, EXTRAS } from './producto.js'

const NOMBRES_PROHIBIDOS = [
  'Daniela', 'Carlos', 'Lucas', 'Maria', 'María', 'Andrea', 'Sofia', 'Sofía',
  'Juan', 'Pedro', 'Santiago', 'Camilo', 'Valentina', 'Laura', 'Diana',
  'Paola', 'Angela', 'Ángela', 'Natalia', 'Monica', 'Mónica',
]

const REGEX_NOMBRE = new RegExp(
  `\\b(?:soy|me llamo|mi nombre es|le habla|le escribe|soy la|soy el)\\s+(?:${NOMBRES_PROHIBIDOS.join('|')})\\b`, 'gi'
)

const REGEX_BLACKLIST = new RegExp(
  NO_EXISTE.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi'
)

export function sanitizar(mensaje) {
  if (!mensaje) return 'Quedo atento si necesita algo.'
  let m = String(mensaje).trim()

  // Quitar caracteres no-latinos
  m = m.replace(/[^\x00-\x7F -ɏḀ-ỿ -⁯←-➿\u{1F300}-\u{1FAFF}]/gu, '')

  // Quitar emojis decorativos
  m = m.replace(/[\u{1F330}-\u{1F33E}\u{1F338}\u{1F339}\u{1F33F}-\u{1F340}\u{1F490}\u{2764}\u{1F493}-\u{1F49F}\u{1F525}\u{1F31F}\u{2728}\u{2B50}\u{1F31E}\u{1F308}\u{1F389}\u{1F38A}\u{1F680}\u{1F4A5}\u{1F4A8}\u{1F4AB}\u{1F4A1}\u{1F337}\u{1F33A}-\u{1F33C}\u{1F940}\u{1FA77}\u{2763}]/gu, '')

  // Corregir 15 dias -> 14 dias
  m = m.replace(/\b15 d[ií]as\b/gi, '14 días')

  // Eliminar nombres propios
  m = m.replace(REGEX_NOMBRE, '')

  // Eliminar menciones de cosas que no existen
  m = m.replace(REGEX_BLACKLIST, '')
  // Limpiar comas huerfanas que quedan despues de borrar items de la blacklist
  m = m.replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').replace(/\(\s*,/g, '(').replace(/,\s*\)/g, ')').replace(/:\s*,/g, ':').replace(/,\s*y\s*,/g, ' y ')

  // Eliminar frases sobre precio variable
  m = m.replace(/(?:depende|var[ií]a|seg[uú]n) (?:del? |la )?(?:n[uú]mero|cantidad) de clientes/gi, '')

  // Eliminar testimonios inventados
  m = m.replace(/(?:un|otro|cierto|alg[uú]n) (?:prestamista|cliente|usuario)[\s\S]{0,250}?(?:me |nos )(?:cont[oó]|dijo|escribi[oó])[\s\S]{0,200}?(?:[.!?\n]|$)/gi, '')
  m = m.replace(/(?:un|otro) (?:prestamista|cliente|usuario) (?:me |nos )?(?:cont[oó]|dijo|coment[oó])[\s\S]{0,200}?(?:[.!?\n]|$)/gi, '')

  // Eliminar porcentajes inventados
  m = m.replace(/(?:reducir|ahorrar|mejorar|aumentar|duplicar) (?:hasta |un |en )?\d+\s*%/gi, '')

  // Eliminar cupones/codigos/promociones inventadas
  m = m.replace(/c[oó]digo\s+(?:de\s+)?(?:descuento|promoci[oó]n|bienvenida|regalo)?["']?\w*["']?/gi, '')
  m = m.replace(/cup[oó]n\s*(?:de\s+)?(?:descuento|bienvenida|regalo)?["']?\w*["']?/gi, '')
  m = m.replace(/(?:le\s+)?(?:damos|regalamos|ofrecemos|doy|regalo)\s+(?:un\s+)?(?:cup[oó]n|bono|descuento|regalo|c[oó]digo)[^.!\n]*/gi, '')
  m = m.replace(/(?:promoci[oó]n|oferta)\s+(?:especial|exclusiva|de\s+(?:lanzamiento|bienvenida))[^.!\n]*/gi, '')
  m = m.replace(/(?:registro|inscripci[oó]n)\s+(?:es\s+)?(?:completamente\s+)?(?:gratu[ií]t[oa]|sin\s+costo|sin\s+costo\s+alguno|free)/gi, '')
  m = m.replace(/(?:sin\s+costo\s+alguno|completamente\s+gratis|totalmente\s+gratis)/gi, '')
  m = m.replace(/(?:le\s+)?(?:regalo|regalamos|damos)\s+(?:\d+\s+)?(?:d[ií]as?\s+)?(?:extra|adicionales?|m[aá]s|gratis)/gi, '')

  // Corregir precios inventados: reemplazar montos tipo "$XX.000" que no sean precios reales
  const preciosConocidos = new Set([...PRECIOS_VALIDOS, EXTRAS.cobradorExtra, EXTRAS.rutaExtra])
  // Tambien tolerar multiplos de precios conocidos (trimestrales, anuales, con descuento)
  const esMultiploPrecio = (num) => {
    for (const p of preciosConocidos) {
      if (num === p) return true
      // Trimestral con 10% desc: precio * 3 * 0.9
      if (Math.abs(num - p * 3 * 0.9) < 500) return true
      // Anual (10 meses): precio * 10
      if (num === p * 10) return true
      // Semestral: precio * 6
      if (num === p * 6) return true
    }
    return false
  }
  m = m.replace(/\$\s?([\d.]+)/g, (match, numStr) => {
    const num = parseInt(numStr.replace(/\./g, ''), 10)
    if (num >= 10000 && !esMultiploPrecio(num)) {
      return '$39.000'
    }
    return match
  })

  // Eliminar promesas de enviar archivos (el bot no puede adjuntar nada)
  m = m.replace(/(?:le |aca le |aqui le |ya le |ya se lo )?(?:comparto|envio|envío|mando|paso|dejo|adjunto) (?:el |un |la |las |los |unas )?(?:video|imagen|foto|captura|archivo|documento|PDF|guia|tutorial)[^\n.!?]*[.!?\n]?/gi, '')

  // Quitar markdown
  m = m.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
  m = m.replace(/^[-•]\s/gm, '')
  m = m.replace(/^\d+\.\s/gm, '')

  // Corregir genero: "quedo atenta" -> "quedo atento"
  m = m.replace(/quedo atenta/gi, 'quedo atento')

  // Eliminar instrucciones tecnicas sobre cupones/codigos (ej: "le pone GRATIS14")
  m = m.replace(/(?:donde dice|en la parte|le pone|escrib[ae]|ingres[ae]|ponga)\s+["']?(?:cup[oó]n|c[oó]digo|descuento)["']?[^.!\n]*/gi, '')
  m = m.replace(/\b[A-Z]{3,}\d{1,4}\b/g, '')

  // Limpiar espacios
  m = m.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim()

  if (!m.replace(/[\s\n]/g, '')) {
    m = 'Quedo atento si necesita algo.'
  }

  return m
}

// Detectar si el AI genero algo prohibido (para logging)
export function detectarViolaciones(mensaje) {
  const violaciones = []
  const m = (mensaje || '').toLowerCase()

  if (REGEX_BLACKLIST.test(mensaje)) violaciones.push('mencion_funcion_inexistente')
  if (REGEX_NOMBRE.test(mensaje)) violaciones.push('nombre_propio')
  if (/depende.*n[uú]mero.*clientes/i.test(m)) violaciones.push('precio_variable')
  if (/\b15 d[ií]as\b/i.test(m)) violaciones.push('15_dias')
  if (/descarg[aue].*(?:app|aplicaci)/i.test(m)) violaciones.push('descargar_app')
  if (/(?:comparto|envio|envío|mando|paso|adjunto)\s+(?:el |un |la )?(?:video|imagen|foto|captura|archivo|documento)/i.test(m)) violaciones.push('promesa_envio_archivo')
  if (/recordatorio.{0,20}autom[aá]tic/i.test(m) || /aviso.{0,20}autom[aá]tic.{0,20}pago/i.test(m) || /envia.{0,20}recordatorio/i.test(m)) violaciones.push('recordatorio_inventado')
  if (/quedo atenta/i.test(m)) violaciones.push('genero_femenino')
  if (/cup[oó]n|c[oó]digo\s+de\s+descuento|promoci[oó]n\s+especial|oferta\s+(?:especial|exclusiva|de\s+lanzamiento)/i.test(m)) violaciones.push('promocion_inventada')
  if (/(?:registro|inscripci[oó]n)\s+(?:es\s+)?(?:completamente\s+)?(?:gratu[ií]t|sin\s+costo|free)/i.test(m)) violaciones.push('registro_gratuito_inventado')
  if (/(?:le\s+)?(?:regalo|regalamos|damos)\s+(?:\d+\s+)?(?:d[ií]as?\s+)?(?:extra|adicionales?|m[aá]s)/i.test(m)) violaciones.push('regalo_inventado')

  const preciosConocidos2 = new Set([...PRECIOS_VALIDOS, EXTRAS.cobradorExtra, EXTRAS.rutaExtra])
  const esMultiploPrecio2 = (num) => {
    for (const p of preciosConocidos2) {
      if (num === p) return true
      if (Math.abs(num - p * 3 * 0.9) < 500) return true
      if (num === p * 10) return true
      if (num === p * 6) return true
    }
    return false
  }
  const preciosEnMensaje = m.match(/\$\s?([\d.]+)/g) || []
  for (const p of preciosEnMensaje) {
    const num = parseInt(p.replace(/[$.\s]/g, ''), 10)
    if (num >= 10000 && !esMultiploPrecio2(num)) violaciones.push('precio_inventado')
  }

  return violaciones
}
