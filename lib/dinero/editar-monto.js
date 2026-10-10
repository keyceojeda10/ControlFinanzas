/* ── ⚠ EN UNA RENOVACIÓN, EL MONTO NO ES LO QUE SALIÓ EN BILLETES ──────────
 *
 * Editar el monto de un préstamo escribe una pareja en el libro: devuelve lo
 * que salió y saca lo nuevo. Se escribía con `montoPrestado`, y eso solo vale
 * en un préstamo nuevo. En una renovación el monto lleva DENTRO la deuda vieja
 * que se absorbió y que nunca salió del bolsillo de nadie.
 *
 * Subir el monto cuadraba por casualidad (la diferencia sí sale en billetes).
 * BAJARLO por debajo de lo absorbido inventaba plata: PRESTA MIL renovó a
 * $1.100.000 sin entregar un peso, lo bajó a $1.000.000, y el capital de la
 * ruta SUBIÓ $100.000 que no existían. Medido el 10 oct 2026: 5 de 11
 * renovaciones editadas, $566.000 de capital inventado en dos negocios.
 *
 * Con esto la pareja habla de billetes: antes salió `efectivoAnterior`, ahora
 * sale lo nuevo menos lo absorbido, y nunca menos de cero. Lo que se baje por
 * debajo de la deuda vieja es deuda que el cliente ya no debe, no plata que
 * vuelve. Y así «Prestó» de la caja (el desembolso más reciente) dice los
 * billetes que de verdad salieron. */
/* ⚠ LO ABSORBIDO NO SE PUEDE SACAR DEL MONTO CUANDO NO SALIÓ EFECTIVO.
 * Con billetes en mano es exacto: monto − efectivo. Pero con efectivo en cero
 * el monto pudo haberse bajado ya por debajo de la deuda vieja (sin asiento,
 * porque no se movió un billete), y entonces «monto − 0» se queda corto: la
 * prueba en el espejo sacó $150.000 al subir $50.000 por encima de lo absorbido.
 * Ahí manda lo que la renovación le quitó al préstamo viejo
 * (`totalAPagarPrevio − totalAPagar`), que coincide al peso en 787 de 805
 * renovaciones medidas; las otras perdonaron parte de la deuda al renovar. Y
 * nunca menos que el monto actual. */
export function parejaDeLaEdicion({ montoAnterior, montoNuevo, efectivoAnterior = null, esRenovacion = false, absorbidoDelViejo = null }) {
  const anterior = Number(montoAnterior) || 0
  const nuevo = Number(montoNuevo) || 0
  if (!esRenovacion || efectivoAnterior == null) return { devuelve: anterior, sale: nuevo, absorbido: 0 }
  const efectivo = Math.max(0, Number(efectivoAnterior) || 0)
  const absorbido = efectivo > 0
    ? Math.max(0, anterior - efectivo)
    : Math.max(anterior, Number(absorbidoDelViejo) || 0)
  return { devuelve: efectivo, sale: Math.max(0, nuevo - absorbido), absorbido }
}
