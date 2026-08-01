// lib/adaptadores/narrativa.js — la frase que interpreta el día.
//
// Vivía dentro de app/(dashboard)/dashboard/page.jsx, un archivo de 2.000
// líneas, sin una sola prueba. Sale aquí porque LLEVA DENTRO UN ARREGLO CARO:
// compara contra AYER A ESTA MISMA HORA, no contra el día completo de ayer.
//
// Comparar la mañana contra 24 horas enteras daba negativo siempre antes del
// cierre: a las 10am salía «94% menos que ayer» todos los días, con lo que la
// alarma sonaba a diario y dejaba de significar nada. Es exactamente el tipo de
// detalle que se pierde en una migración si nadie lo escribe.
//
// Su trabajo es INTERPRETAR, no informar: las cifras ya están arriba. Si no
// tiene nada que decir devuelve null, y la línea no se pinta — una frase de
// relleno todos los días enseña a saltársela.

/** Por debajo de esto la diferencia con ayer es ruido, no una señal. */
export const UMBRAL_RITMO = 15

export function generarNarrativa({
  recaudadoHoy = 0,
  recaudadoAyer = 0,
  recaudadoAyerAEstaHora = 0,
  esperadoHoy = 0,
  sparkline7d,
  formatear = (n) => String(n),
} = {}) {
  if (!recaudadoHoy && !recaudadoAyer) return null

  // 1 · Contra ayer a esta hora. Es lo único comparable de verdad.
  if (recaudadoAyerAEstaHora > 0) {
    const pct = Math.round(((recaudadoHoy - recaudadoAyerAEstaHora) / recaudadoAyerAEstaHora) * 100)
    if (pct > UMBRAL_RITMO) return `Vas a buen ritmo: ${pct}% más que ayer a esta hora`
    if (pct < -UMBRAL_RITMO) return `${Math.abs(pct)}% menos que ayer a esta hora`
  }

  // 2 · Contra la meta del día.
  if (esperadoHoy > 0) {
    const pctMeta = (recaudadoHoy / esperadoHoy) * 100
    if (pctMeta >= 100) return 'Meta del día cumplida'
    if (pctMeta >= 75) return `Falta poco: ${formatear(esperadoHoy - recaudadoHoy)} para tu meta`
    if (pctMeta >= 40) return `Vas en ${Math.round(pctMeta)}% de tu meta del día`
  }

  // 3 · El mejor día de la semana, si hoy lo es.
  if (Array.isArray(sparkline7d) && sparkline7d.length === 7) {
    const max = Math.max(...sparkline7d)
    if (sparkline7d[6] > 0 && sparkline7d[6] === max) return 'Tu mejor día de la semana'
  }

  return null
}
