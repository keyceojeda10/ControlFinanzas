/* ── EL INTERÉS EN PESOS, EN UN PRÉSTAMO SIN VENCIMIENTO ────────────────────
 *
 * «Le presté 1.500.000. Paga 170.000 de interés mensual, solo interés […] me
 *  pide el porcentaje y yo no quiero ponerme a buscar el número: 11,333 %»
 *  — Hector Cano, 9 oct 2026. Con 11,3 % el sistema le daba $169.500, y no hay
 *  porcentaje de dos decimales que dé $170.000 (11,33 % son $169.950).
 *
 * En un préstamo abierto el interés de cada período es `monto × tasa`, así que
 * la tasa que da un interés exacto en pesos es `interés ÷ monto`. Se guarda con
 * todos sus decimales (`tasaInteres` es Float) para que la cuota salga al peso,
 * y se ENSEÑA redondeada con `formatearTasa`. Si el cliente abona a capital, el
 * interés baja en la misma proporción, igual que con un porcentaje escrito.
 */
export function tasaParaInteres(monto, interes) {
  const m = Number(monto)
  const i = Number(interes)
  if (!(m > 0) || !(i > 0)) return null
  return (i / m) * 100
}

/** El interés de cada período con esa tasa: la misma cuenta que `calcularPrestamo`. */
export function interesDelPeriodo(monto, tasa) {
  return Math.round(Number(monto) * (Number(tasa) / 100))
}
