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

/* ══ EL CALCO LARGO ═══════════════════════════════════════════════════════
 *
 * `esRepetido` solo mira el parecido en mensajes de 12 palabras o menos, a
 * proposito: no queria descartar una respuesta larga y util por compartir
 * palabras. Pero el fallo que reporto el dueño es justo el contrario — el bot
 * mandandole a Luis TRES VECES el mismo parrafo de 50 palabras:
 *
 *   «Control Finanzas le deja ver al segundo cuanto cobro cada cobrador en la
 *    calle, con GPS en tiempo real... Puede probarlo gratis 14 dias...»
 *
 * hasta que el lead contesto **«No me has dicho nada»**. Y tenia razon: tres
 * mensajes con cero informacion nueva.
 *
 * Medido sobre 510 conversaciones reales: **110 (21,6%) tienen al menos un
 * calco largo**, 136 en total.
 *
 * ⚠ Esto NO devuelve un texto de repuesto. Un parrafo de venta no se sustituye
 * por una frase enlatada: se le pide al modelo que lo diga de otra forma, que
 * es lo que hace `agente.js` con esta señal. Aqui solo se DETECTA. */
const MIN_PALABRAS_LARGO = 12

export function esCalcoLargo(mensaje, historial = []) {
  const norm = normalizar(mensaje)
  if (!norm) return false
  if (norm.split(' ').length <= MIN_PALABRAS_LARGO) return false
  for (const previo of mensajesBotRecientes(historial)) {
    if (previo.split(' ').length <= MIN_PALABRAS_LARGO) continue
    if (parecido(norm, previo) >= UMBRAL_PARECIDO) return true
  }
  return false
}

/* ══ DUDAS ABIERTAS ═══════════════════════════════════════════════════════
 *
 * El bot no puede despedirse mientras el lead acaba de decir que no entiende.
 * De los chats reales, y son textuales:
 *
 *   «Si Ok si tengo unas dudas pero me parece muy interesante»
 *      -> «Perfecto Alex, cuando tenga las dudas me escribe»
 *   «Ok No entiendo»  ·  «Y como funciona No nada»
 *   «Todas solo se que puedo ver cobros en segundos»  -> «cualquier cosa me avisa»
 *
 * Son 7 conversaciones de 510. Pocas, pero es el peor momento posible: el lead
 * esta pidiendo que le expliquen y se le cierra la puerta. */
export function tieneDudasAbiertas(textoLead) {
  return /tengo dudas|unas dudas|algunas dudas|todas|no entiendo|no comprendo|no me queda claro|no me has dicho|no me ha dicho|c[oó]mo funciona|como funciona|explic|m[aá]s informaci|mas info/i
    .test(textoLead || '')
}

export function esDespedida(mensaje) {
  return /cualquier cosa me (avisa|escribe)|quedo atent|me escribe o llama|que le vaya bien|me cuenta cuando quiera|aqui estoy si necesita|quedo pendiente/i
    .test(mensaje || '')
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
