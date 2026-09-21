/* LAS DOS PIEZAS DEL REPARTO QUE DEJÓ TORCIDAS LA RENOVACIÓN — 21 sep 2026.
 *
 * Viven aparte, sin importar nada, porque las usan `lib/dinero/reparto.js` y
 * `lib/calculos.js`, y ese par se importa mutuamente: meterlas en cualquiera de
 * los dos era un ciclo. La explicación larga, con las cifras de PRESTA MIL, está
 * en reparto.js encima de `totalDelReparto`.
 *
 * ⚠ SOLO PARA REPARTIR (qué parte de lo cobrado es interés y qué parte capital, y
 * cuánto capital sigue en la calle). NUNCA para la deuda: lo que el cliente debe,
 * lo que se liquida al renovar, el interés que se devenga y lo que se cobra salen
 * de `totalAPagar` y `montoPrestado`, que estas piezas no tocan. */

/** El total con el que se REPARTE: el pactado, si una renovación reescribió el de la deuda. */
export function totalDelReparto(prestamo) {
  const previo = Number(prestamo?.totalAPagarPrevio)
  return previo > 0 ? previo : (Number(prestamo?.totalAPagar) || 0)
}

/** El capital de verdad: lo prestado menos el interés que arrastró de la cartulina anterior. */
export function capitalDelPrestamo(prestamo) {
  const monto = Number(prestamo?.montoPrestado) || 0
  const arrastrado = Math.max(0, Number(prestamo?.interesArrastrado) || 0)
  return Math.max(0, monto - arrastrado)
}

/**
 * Qué parte del capital de la DEUDA es, en realidad, interés arrastrado: A / montoPrestado.
 *
 * Solo la usan los modos con tabla. La tabla del préstamo nuevo se construye
 * sobre la deuda entera, así que su columna «capital» mezcla la plata que salió
 * de la caja con el interés de la cartulina anterior. De cada peso que la tabla
 * llama capital, esta fracción es ganancia. (Sin tabla no hace falta: la
 * proporción de `fraccionDe` ya la lleva dentro al comparar contra el capital de
 * verdad.)
 */
export function fraccionArrastrada(prestamo) {
  const monto = Number(prestamo?.montoPrestado) || 0
  const arrastrado = Math.max(0, Number(prestamo?.interesArrastrado) || 0)
  if (monto <= 0 || arrastrado <= 0) return 0
  return Math.min(1, arrastrado / monto)
}

/** Los campos que un `select` de Prisma tiene que pedir para que el reparto no decida a ciegas. */
export const CAMPOS_DEL_REPARTO = { totalAPagarPrevio: true, interesArrastrado: true }
