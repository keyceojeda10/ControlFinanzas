// lib/bot-v2/anti-repeticion.js — Evita que el bot conteste con un calco de lo
// que acaba de decir. En chats reales salia "Perfecto, cualquier cosa me avisa."
// dos y tres veces seguidas, casi identico, y eso delata al bot justo al final
// de la conversacion, que es donde se cierra la venta.
//
// Modulo puro (sin imports) para poder testearlo aislado.

// Cierres cortos e intercambiables. Se usa el primero que no se haya dicho ya.
export const CIERRES_SUAVES = [
  'Listo, quedo atento.',
  'Perfecto, cualquier cosa me escribe.',
  'Vale, me cuenta cuando quiera.',
  'De una. Aqui estoy si necesita algo.',
  'Listo pues, que le vaya bien.',
]

// Cuantos mensajes del bot hacia atras se revisan.
const VENTANA = 3
// Un mensaje "corto" es un cierre/muletilla; solo a esos se les aplica el
// parecido difuso. Los mensajes largos con contenido no se tocan.
const MAX_PALABRAS_CIERRE = 12
const UMBRAL_PARECIDO = 0.6

export function normalizar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Jaccard sobre palabras: cuanto se solapan dos frases.
function parecido(a, b) {
  const A = new Set(a.split(' ').filter(Boolean))
  const B = new Set(b.split(' ').filter(Boolean))
  if (!A.size || !B.size) return 0
  let comunes = 0
  for (const p of A) if (B.has(p)) comunes++
  return comunes / (A.size + B.size - comunes)
}

function mensajesBotRecientes(historial = []) {
  return historial
    .filter(m => m.rol === 'bot')
    .slice(-VENTANA)
    .map(m => normalizar(m.texto))
    .filter(Boolean)
}

/**
 * ¿El mensaje es un calco de algo que el bot ya dijo hace poco?
 * Identico siempre cuenta. El parecido difuso solo aplica a mensajes cortos,
 * para no descartar una respuesta larga y util que casualmente comparte palabras.
 */
export function esRepetido(mensaje, historial = []) {
  const norm = normalizar(mensaje)
  if (!norm) return false
  const palabras = norm.split(' ').length
  for (const previo of mensajesBotRecientes(historial)) {
    if (previo === norm) return true
    if (palabras <= MAX_PALABRAS_CIERRE &&
        previo.split(' ').length <= MAX_PALABRAS_CIERRE &&
        parecido(norm, previo) >= UMBRAL_PARECIDO) {
      return true
    }
  }
  return false
}

/**
 * Devuelve el mensaje tal cual, o —si es un calco— un cierre distinto que
 * tampoco se haya usado en la ventana reciente.
 */
export function variarSiRepetido(mensaje, historial = []) {
  if (!esRepetido(mensaje, historial)) return mensaje
  const usados = mensajesBotRecientes(historial)
  const libre = CIERRES_SUAVES.find(c => {
    const n = normalizar(c)
    return !usados.some(u => u === n || parecido(n, u) >= UMBRAL_PARECIDO)
  })
  return libre || CIERRES_SUAVES[CIERRES_SUAVES.length - 1]
}
