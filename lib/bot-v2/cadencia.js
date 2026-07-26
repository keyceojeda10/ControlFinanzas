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
