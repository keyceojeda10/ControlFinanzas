/**
 * LA NOTA DEL CRÉDITO (15 nov 2026).
 *
 * Soporte de un cliente: «una nota que coloque uno ahí cuando se hace el
 * crédito … cuando le va a cobrar ahí aparece la nota. O cuando la plataforma
 * le dice fulano ya le venció el crédito, ahí le aparece la nota que uno le
 * puso». Ejemplos suyos: «paga los 20», «le prestó 100 pero dijo que le dejara
 * un mes muerto porque no iba a estar en el país».
 *
 * Es del PRÉSTAMO, no del cliente: cada negocio con la misma persona se pacta
 * distinto. (El cliente ya tiene sus `notas`, que dicen cómo ubicarlo.)
 */
export const NOTA_MAX = 500

/** El aviso de atraso con la nota detrás: «…cuando la plataforma le dice
 *  fulano ya le venció el crédito, ahí le aparece la nota». Corta a 140 para
 *  que el aviso siga leyéndose de un vistazo. */
export function conNota(mensaje, nota) {
  const n = typeof nota === 'string' ? nota.trim() : ''
  if (!n) return mensaje
  return `${mensaje} Tu nota: «${n.length > 140 ? `${n.slice(0, 139)}…` : n}»`
}

/** La nota limpia para guardar: recortada, o `null` si quedó vacía. */
export function limpiarNota(v) {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, NOTA_MAX)
  return t || null
}
