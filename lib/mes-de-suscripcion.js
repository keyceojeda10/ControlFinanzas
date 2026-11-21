/* ══ EL MES DEL PLAN ES UN MES, NO 30 DÍAS (21 nov 2026) ════════════════════
 *
 * El cobro sumaba 30 días a cada renovación mensual, así que el día de pago se
 * corría: 28 nov → 28 dic → 27 ene → 26 feb… Soluciones Díaz paga su plan los
 * 28 por acuerdo con el dueño, y el dueño: «tendría sentido que fuera un mes
 * completo, no 30 días… sería un poco más justo».
 *
 * La regla, la misma que ya usan los préstamos («mensual = mismo día del mes»,
 * con el día de Bogotá):
 *   · mensual que vence del 1 al 28 → el mismo día del mes siguiente, a la misma
 *     hora. Todos los meses tienen esos días: el día no se corre nunca.
 *   · mensual que vence el 29, 30 o 31 → 30 días, como antes. Llevarlo al último
 *     día de febrero lo dejaría en el 28 para siempre (no hay dónde guardar que
 *     era 31), y eso sí sería cambiarle el día a alguien sin que lo pidiera.
 *   · trimestral, semestral y anual → sus días de siempre.
 */
const BOGOTA_MS = 5 * 3600000
const DIAS = { mensual: 30, trimestral: 90, semestral: 180, anual: 365 }

/** El vencimiento que sigue a `base` tras pagar un `periodo`. No muta `base`. */
export function sumarPeriodo(base, periodo = 'mensual') {
  const b = new Date(base)
  if (periodo === 'mensual') {
    const local = new Date(b.getTime() - BOGOTA_MS) // campos UTC = reloj de Bogotá
    if (local.getUTCDate() <= 28) {
      local.setUTCMonth(local.getUTCMonth() + 1)
      return new Date(local.getTime() + BOGOTA_MS)
    }
  }
  const r = new Date(b)
  r.setDate(r.getDate() + (DIAS[periodo] ?? 30))
  return r
}
