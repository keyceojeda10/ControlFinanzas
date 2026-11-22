/* ══ HOY, AYER, LA SEMANA Y EL MES DEL PANEL, EN HORA DE BOGOTÁ (22 nov 2026) ══
 *
 * El dueño: «vi ayer en la plataforma que solamente hubo un registro, me parece
 * raro». Hubo dos (2:38 p. m. y 10:59 p. m.). El panel cortaba el día con
 * `new Date(y, m, d)`, que en el servidor (UTC) es medianoche UTC = 7 p. m. en
 * Bogotá: todo lo de después de las 7 de la noche caía en el día siguiente.
 *
 * Mismas fronteras que `admin/inicio` y que la caja: 05:00Z.
 */
const DIA = 86400000
const OFFSET = 5 * 3600000 // Bogotá, UTC−5, sin horario de verano

export function fronterasBogota(ahora = new Date()) {
  const local = new Date(new Date(ahora).getTime() - OFFSET) // reloj de Bogotá en campos UTC
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate()
  const inicioHoy = new Date(Date.UTC(y, m, d) + OFFSET)
  const dow = local.getUTCDay() // 0 = domingo
  return {
    inicioHoy,
    inicioAyer: new Date(inicioHoy.getTime() - DIA),
    inicioSemanaLunes: new Date(inicioHoy.getTime() - ((dow + 6) % 7) * DIA),
    inicioSemanaDomingo: new Date(inicioHoy.getTime() - dow * DIA),
    inicioMes: new Date(Date.UTC(y, m, 1) + OFFSET),
  }
}
