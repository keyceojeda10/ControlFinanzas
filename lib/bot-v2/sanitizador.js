// lib/bot-v2/sanitizador.js — Limpieza post-AI del mensaje antes de enviarlo.
// Ultima linea de defensa contra alucinaciones.

import { NO_EXISTE } from './producto.js'

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

  // Eliminar frases sobre precio variable
  m = m.replace(/(?:depende|var[ií]a|seg[uú]n) (?:del? |la )?(?:n[uú]mero|cantidad) de clientes/gi, '')

  // Eliminar testimonios inventados
  m = m.replace(/(?:un|otro|cierto|alg[uú]n) (?:prestamista|cliente|usuario)[\s\S]{0,250}?(?:me |nos )(?:cont[oó]|dijo|escribi[oó])[\s\S]{0,200}?(?:[.!?\n]|$)/gi, '')
  m = m.replace(/(?:un|otro) (?:prestamista|cliente|usuario) (?:me |nos )?(?:cont[oó]|dijo|coment[oó])[\s\S]{0,200}?(?:[.!?\n]|$)/gi, '')

  // Eliminar porcentajes inventados
  m = m.replace(/(?:reducir|ahorrar|mejorar|aumentar|duplicar) (?:hasta |un |en )?\d+\s*%/gi, '')

  // Eliminar cupones/codigos
  m = m.replace(/c[oó]digo\s+["']?\w+["']?/gi, '')
  m = m.replace(/cup[oó]n\s+["']?\w+["']?/gi, '')

  // Quitar markdown
  m = m.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
  m = m.replace(/^[-•]\s/gm, '')
  m = m.replace(/^\d+\.\s/gm, '')

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

  return violaciones
}
