/* ══ EL MARCADOR QUE CABE (21 nov 2026) ═══════════════════════════════════════
 *
 * El dueño: «la mayoría de los buscadores sale con el texto de adentro cortado,
 * ¿cómo hacemos sin quitar información y que los textos se vean completos?».
 *
 * Medí todas las pantallas en el espejo y a 360 px solo se cortaba uno. En su
 * teléfono, la mayoría. La diferencia es el teléfono: con el texto agrandado en
 * Android (accesibilidad) la pantalla mide menos de 360 «px de página», y las
 * hojas (lupa, filtros) no salen en una medición de pantallas. Ninguna lista de
 * textos cortos aguanta eso: cada campo tiene que mirarse a sí mismo.
 *
 * Así que el MARCADOR (el texto gris de adentro) baja un punto de letra, dentro
 * de la escala cerrada (16 → 15 → 14 → 13), hasta que entra. Lo que la persona
 * ESCRIBE sigue a 16: con menos, el iPhone hace zoom al tocar el campo.
 * Si ni a 13 cabe, se queda en 13 (lo más que se lee) y el campo lo dice en
 * `title`.
 */

export const TAMANOS_MARCADOR = [15, 14, 13]

/** El tamaño de letra con el que cabe el marcador, o null si cabe a su tamaño.
 *  `medir(px)` devuelve el ancho del texto a ese tamaño; `hay`, el hueco. */
export function tamanoQueCabe({ base, hay, medir }) {
  if (!(hay > 0) || !(base > 0)) return null
  if (medir(base) <= hay + 0.5) return null
  for (const t of TAMANOS_MARCADOR) {
    if (t >= base) continue
    if (medir(t) <= hay + 0.5) return t
  }
  return TAMANOS_MARCADOR[TAMANOS_MARCADOR.length - 1] < base ? TAMANOS_MARCADOR[TAMANOS_MARCADOR.length - 1] : null
}

const TIPOS = new Set(['', 'text', 'search', 'email', 'tel', 'number', 'url', 'password'])
export const esCampoConMarcador = (el) =>
  el?.tagName === 'INPUT' && TIPOS.has((el.getAttribute('type') || '').toLowerCase()) && !!el.placeholder
