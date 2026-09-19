// lib/prestamo-entregado.js
//
// Lo que dice la pantalla de «Préstamo entregado», armado en un solo sitio para
// que crear y renovar digan lo mismo del mismo préstamo.
//
// Todo sale del préstamo TAL COMO LO DEVUELVE EL SERVIDOR (`GET /api/prestamos/[id]`):
// `proximoCobro` con los días sin cobro y festivos ya aplicados —las fechas
// tienen un solo calendario, ver la memoria `fechas_un_solo_calendario`—,
// `cuotasPendientes` y `cuotaDiaria`. Aquí no se calcula ninguna fecha ni cuota.

import { formatFechaCobroRelativa } from '@/lib/calculos'

const FRECUENCIA = {
  diario: ['diaria', 'diarias'],
  semanal: ['semanal', 'semanales'],
  quincenal: ['quincenal', 'quincenales'],
  mensual: ['mensual', 'mensuales'],
}

/* En estos modos la cuota cambia de un período a otro (decreciente, sobre
   saldo, interés): «24 cuotas de $X» sería falso. Se dice solo la primera. */
const CUOTA_VARIABLE = ['lineal', 'lineal_dinamico', 'saldo', 'solo_interes']

/**
 * ¿El total del préstamo trae la ganancia adentro? En globo y en el préstamo
 * abierto (los dos `solo_interes`) el interés se devenga período a período y el
 * total no lo incluye: enseñar «+$0 de ganancia» sería mentira.
 */
export function totalTraeGanancia(modoInteres) {
  return modoInteres !== 'solo_interes'
}

/** «24 cuotas diarias de $25.000 · la primera mañana.» */
export function planDelPrestamo(p, formatear) {
  if (!p) return null
  const [uno, varios] = FRECUENCIA[p.frecuencia] ?? ['', '']
  const cuando = formatFechaCobroRelativa(p.proximoCobro)
  const primera = !cuando ? null : (['Hoy', 'Mañana'].includes(cuando) ? cuando.toLowerCase() : `el ${cuando}`)
  const n = Math.round(Number(p.cuotasPendientes) || 0)
  const cuota = Math.round(Number(p.cuotaDiaria) || 0)
  if (CUOTA_VARIABLE.includes(p.modoInteres) || !n || !cuota) {
    if (!primera) return null
    return `La primera cuota se cobra ${primera}${cuota > 0 ? `: ${formatear(cuota)}` : ''}.`
  }
  return `${n} ${n === 1 ? `cuota ${uno}` : `cuotas ${varios}`} de ${formatear(cuota)}${primera ? ` · la primera ${primera}` : ''}.`
}

/**
 * La cartera activa de ESTA persona, la misma cifra que su inicio
 * (`saldoPorCobrar` del resumen). Se pide DESPUÉS de crear, así que ya incluye
 * el préstamo nuevo. `null` si no llega: la pantalla no inventa el renglón.
 *
 * ⚠ `desde`: el `createdAt` del préstamo. El service worker puede devolver la
 * copia guardada si la red falla, y esa copia es de ANTES del préstamo: con ella
 * «antes y después» saldrían corridos justo lo prestado. Si el resumen es más
 * viejo que el préstamo, no se usa. Se compara con el reloj del SERVIDOR en los
 * dos lados (`createdAt` y `generatedAt`): con la hora del teléfono, uno mal
 * puesto de hora descartaría siempre la cifra.
 */
export async function cargarCarteraActiva(desde = 0) {
  try {
    const r = await fetch('/api/dashboard/resumen', { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    if (d?.offline || (desde && new Date(d?.generatedAt ?? 0).getTime() < desde - 2000)) return null
    const v = d?.prestamos?.saldoPorCobrar ?? d?.prestamos?.carteraActiva
    return Number.isFinite(v) ? Math.round(v) : null
  } catch { return null }
}
