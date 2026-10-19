// lib/gastos.js — cuándo se anotó un gasto y cómo se dice en la lista.
//
// ══ «12:00 P. M.» EN TODOS LOS GASTOS ══════════════════════════════════════
//
// `GastoMenor.fecha` se guarda a propósito al MEDIODÍA de Bogotá
// (`T12:00:00-05:00`, `POST /api/gastos`): es el DÍA al que pertenece el gasto,
// no el momento en que se anotó. La lista de Gastos le sacaba la hora a ese
// campo, así que todos decían «12:00 p. m.». Andrés echó gasolina y la anotó a
// las 8:41 de la mañana, y Sofía leía «Andrés Vargas · 19 de oct, 12:00 p. m.»
// (QA, 19 oct 2026, #26).
//
// La tabla no tiene `createdAt` —agregarla es un cambio de esquema que hay que
// aplicar a mano en producción antes del código—, pero el momento sí está: el
// `id` es un cuid v1 (`@default(cuid())`), y sus ocho caracteres después de la
// «c» son el instante de creación en milisegundos, en base 36. Contrastado en
// el espejo contra el registro de actividad `registrar_gasto` de cada gasto:
// 1.698 de 1.698 coinciden con menos de 2 segundos de diferencia.
//
// Si el id no tiene esa forma, o lo que sale no puede ser —antes del día del
// gasto, que no admite fechas futuras, o después de ahora—, NO hay hora: la
// lista enseña solo el día. Una hora inventada es peor que ninguna.

const CUID_V1 = /^c[0-9a-z]{24}$/
const HORA_MS = 60 * 60 * 1000

/**
 * El instante en que se anotó el gasto, sacado de su id. `null` si no se puede
 * saber con seguridad.
 *
 * @param {string} id      el id del gasto (cuid v1)
 * @param {Date|string} fecha  `GastoMenor.fecha` — el día del gasto, al mediodía
 * @param {Date} [ahora]
 * @returns {Date|null}
 */
export function anotadoEnDelId(id, fecha, ahora = new Date()) {
  if (typeof id !== 'string' || !CUID_V1.test(id)) return null
  const ms = parseInt(id.slice(1, 9), 36)
  if (!Number.isFinite(ms)) return null

  // No se anota un gasto antes de que empiece su día: el API rechaza fechas
  // futuras. El mediodía menos 12 h es el arranque del día; una hora de margen.
  const fechaMs = fecha ? new Date(fecha).getTime() : NaN
  if (Number.isFinite(fechaMs) && ms < fechaMs - 13 * HORA_MS) return null
  if (ms > ahora.getTime() + 5 * 60 * 1000) return null
  return new Date(ms)
}

const diaCorto = (v) => new Date(v).toLocaleDateString('es-CO', {
  day: 'numeric', month: 'short', timeZone: 'America/Bogota',
})
const horaCorta = (v) => new Date(v).toLocaleTimeString('es-CO', {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Bogota',
})

/**
 * «19 de oct, 8:41 a. m.» — el día sale de `fecha` (el día del gasto) y la hora
 * de `anotadoEn` (cuándo se escribió). Sin `anotadoEn`, solo el día.
 *
 * Si se anotó otro día —el cobrador puede anotar lo de ayer—, pegar la hora de
 * hoy al día de ayer diría algo que no pasó: se dicen las dos cosas.
 */
export function cuandoGasto({ fecha, anotadoEn } = {}) {
  if (!fecha) return '—'
  const dia = diaCorto(fecha)
  if (!anotadoEn || Number.isNaN(new Date(anotadoEn).getTime())) return dia
  const hora = horaCorta(anotadoEn)
  const diaAnotado = diaCorto(anotadoEn)
  return diaAnotado === dia ? `${dia}, ${hora}` : `${dia} · anotado el ${diaAnotado}, ${hora}`
}

/* ══ LA CIFRA DE ARRIBA NO DEPENDE DE LA PESTAÑA ═══════════════════════════
 *
 * La cabecera de Gastos decía «$X este mes» con la suma de la pestaña abierta:
 * Pendientes «$40.000 este mes», Aprobados «$15.000», Rechazados «$25.000» —
 * y de todos los tiempos, no del mes. Lo rechazado no salió de ningún lado
 * (QA, 19 oct 2026, #27). Ahora es lo APROBADO del mes en curso y lo dice; el
 * mes lo corta el servidor en Bogotá (`/api/gastos?periodo=mes`).
 *
 * `null` = todavía no se sabe: sin subtítulo antes que un $0 que no es. */
export function textoAprobadosMes(total, fmt) {
  if (total == null || !Number.isFinite(Number(total))) return undefined
  return total > 0 ? `${fmt(Math.round(total))} aprobados este mes` : 'nada aprobado este mes'
}
