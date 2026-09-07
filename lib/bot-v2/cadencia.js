// lib/bot-v2/cadencia.js — Reglas de cadencia de seguimientos del bot.
// Modulo PURO (sin prisma ni red) para poder testearlo.
//
// El problema medido en produccion (26 jul 2026): el bot mandaba hasta 4 mensajes
// seguidos en una sola tarde sin que el lead contestara (29% de los leads), y el
// cron terminaba marcandolos no_interesado. La secuencia real de un lead:
//   18:26 link -> 20:31 "pudo registrarse?" -> 22:30 otra pregunta
// (el webhook agenda 2h tras el link y el sender reintentaba a 1,5h).

// Espera para reintentar dentro de la ventana de 24h. Estaba en 1,5h.
export const REINTENTO_EN_VENTANA_MS = 4 * 3600 * 1000

// Tope duro de mensajes seguidos del bot sin una sola respuesta del lead. Al
// llegar al tope se espacia a dias aunque la ventana siga abierta.
export const MAX_RACHA_SIN_RESPUESTA = 2

// Cuantos mensajes seguidos del bot hay al final del historial, sin respuesta del
// lead en medio.
export function rachaSinRespuesta(historial) {
  const h = Array.isArray(historial) ? historial : []
  let n = 0
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i]?.rol === 'lead') break
    if (h[i]?.rol === 'bot') n++
  }
  return n
}

// Cuantas veces se le devuelve el intento a un mismo lead cuando Meta rechaza el
// mensaje por throttle, antes de rendirse.
//
// Devolver el intento SIEMPRE creaba un bucle sin salida: se reprogramaba a 24h,
// al dia siguiente rebotaba igual, se devolvia el intento otra vez y el lead
// nunca agotaba sus seguimientos. Medido en produccion (1 ago 2026): 83 personas
// rebotaron mas de una vez y se les enviaron 134 mensajes que Meta ya habia
// bloqueado. El peor caso llevaba 5 rebotes en 5 dias con el contador en CERO.
//
// Insistirle a alguien que Meta marco como saturado no solo se pierde: castiga la
// reputacion del numero, y eso si afecta la entrega de TODOS los demas.
export const MAX_REBOTES_THROTTLE = 2

/* ══ HAY REBOTES QUE NO TIENEN VUELTA ══════════════════════════════════════
 *
 * Medido sobre 30 dias de produccion (29 ago 2026), mirando si el mensaje
 * SIGUIENTE a un rebote llegaba:
 *
 *     131049 calidad ............ 222 reintentos → 121 llegaron ... 55 %
 *     otros ...................... 43 reintentos →  38 llegaron ... 88 %
 *     131026 no entregable ...... 105 reintentos →  15 llegaron ... 14 %
 *     130472 experimento ......... 19 reintentos →   0 llegaron .... 0 %
 *
 * El 130472 —«el numero esta en un experimento de Meta»— NO se recupera
 * NUNCA. Diecinueve reintentos, cero aciertos. Cada uno es un rebote mas que
 * Meta apunta contra la reputacion del numero, y esa reputacion decide la
 * entrega de TODOS los demas mensajes. Insistir ahi es pagar sin comprar.
 *
 * Por eso este codigo se planta al PRIMER rebote, no al segundo.
 */
/* 130472: el número está en un experimento de Meta. 131050: la persona
   bloqueó los mensajes de marketing de esta cuenta. Ninguno de los dos cambia
   con un reintento; insistir gasta plantillas y reputación del número. */
export const CODIGOS_SIN_VUELTA = new Set([130472, 131050])

/**
 * Que hacer cuando Meta rechaza un mensaje por throttle o politica.
 * @param {number} rebotes - throttles acumulados de ESA persona, INCLUIDO el actual
 * @param {number|null} codigo - el codigo que devolvio Meta en ESTE rebote
 * @returns {'devolver-intento'|'dejar-de-insistir'}
 */
export function accionTrasThrottle(rebotes, codigo = null) {
  if (codigo != null && CODIGOS_SIN_VUELTA.has(Number(codigo))) return 'dejar-de-insistir'
  const n = Number(rebotes) || 0
  return n >= MAX_REBOTES_THROTTLE ? 'dejar-de-insistir' : 'devolver-intento'
}

/**
 * Decide si el proximo seguimiento va el mismo dia (horas) o se espacia a dias.
 * @param {Array} historial - mensajes previos (antes del que se acaba de enviar)
 * @param {boolean} ventanaAbierta - el lead escribio hace menos de 24h
 * @returns {boolean} true = reintentar en REINTENTO_EN_VENTANA_MS
 */
export function reintentarEnVentana(historial, ventanaAbierta) {
  if (!ventanaAbierta) return false
  // +1 por el mensaje que se acaba de enviar y aun no esta en el historial.
  const racha = rachaSinRespuesta(historial) + 1
  return racha < MAX_RACHA_SIN_RESPUESTA
}
