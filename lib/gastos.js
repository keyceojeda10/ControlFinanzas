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

const valida = (v) => v != null && v !== '' && !Number.isNaN(new Date(v).getTime())

/**
 * La hora de un gasto en una lista que YA es de un día (la caja): «8:41 a. m.».
 * Si se anotó otro día, «anotado el 19 de oct, 8:41 a. m.» —la hora de hoy
 * pegada al día de ayer diría algo que no pasó—. Sin hora conocida, `null`: la
 * fila va sin hora, nunca con el mediodía guardado.
 */
export function horaGasto({ fecha, anotadoEn } = {}) {
  if (!valida(fecha) || !valida(anotadoEn)) return null
  const hora = horaCorta(anotadoEn)
  const diaAnotado = diaCorto(anotadoEn)
  return diaAnotado === diaCorto(fecha) ? hora : `anotado el ${diaAnotado}, ${hora}`
}

/**
 * «19 de oct, 8:41 a. m.» — el día sale de `fecha` (el día del gasto) y la hora
 * de `anotadoEn` (cuándo se escribió). Sin `anotadoEn`, solo el día.
 *
 * Si se anotó otro día —el cobrador puede anotar lo de ayer—, se dicen las dos
 * cosas: «18 de oct · anotado el 19 de oct, 8:41 a. m.».
 */
export function cuandoGasto({ fecha, anotadoEn } = {}) {
  if (!valida(fecha)) return '—'
  const dia = diaCorto(fecha)
  const hora = horaGasto({ fecha, anotadoEn })
  if (!hora) return dia
  return hora.startsWith('anotado') ? `${dia} · ${hora}` : `${dia}, ${hora}`
}

/* ══ LOS MOVIMIENTOS DE CAPITAL DE UN GASTO ════════════════════════════════
 *
 * Desde el 17 ago 2026 el asiento de un gasto —y el reverso cuando se rechaza o
 * se borra— lleva como `createdAt` la `fecha` del gasto (`/api/gastos/[id]`:
 * «LA FECHA DEL GASTO, NO LA DE HOY»), así la conciliación cuadra día contra
 * día. Ese instante es el MEDIODÍA de Bogotá, así que Capital → Movimientos
 * decía «12:00 p. m.» en todos (QA, 19 oct 2026, #26).
 *
 * Los de antes de esa fecha guardan la hora de verdad de cuando se aprobaron y
 * se dejan como están. Medido en el espejo: 919 asientos de gasto al mediodía
 * (900 con su gasto vivo, 19 de gastos ya borrados) y 778 viejos con hora real.
 *
 * - El asiento del gasto (`tipo: 'gasto'`): la hora en que se ANOTÓ el gasto,
 *   del id del gasto (`referenciaId`), como en la lista de Gastos. Si el gasto
 *   se borró, su id sigue diciendo cuándo nació.
 * - El reverso (`ajuste`): la de cuando se asentó él, de su propio id.
 */
const MEDIODIA_UTC_HORA = 17 // `T12:00:00-05:00`, como lo guarda `POST /api/gastos`

/** ¿Este instante es el mediodía con que se guarda el día de un gasto? */
export function esMediodiaDeGasto(v) {
  if (!valida(v)) return false
  const d = new Date(v)
  return d.getUTCHours() === MEDIODIA_UTC_HORA && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}

/**
 * Cómo se dice el «cuándo» de un movimiento de capital que es de un gasto y
 * lleva la fecha del gasto. `null` si no es el caso: el llamador sigue con su
 * formato de siempre, que para esos movimientos ya es una hora de verdad.
 */
export function cuandoMovimientoDeGasto(m, ahora = new Date()) {
  if (!m || m.referenciaTipo !== 'gasto' || !esMediodiaDeGasto(m.createdAt)) return null
  const idDelMomento = m.tipo === 'gasto' ? m.referenciaId : m.id
  return cuandoGasto({ fecha: m.createdAt, anotadoEn: anotadoEnDelId(idDelMomento, m.createdAt, ahora) })
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
