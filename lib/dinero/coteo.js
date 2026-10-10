/* ── EL COTEO: LO QUE DE VERDAD RECOGIÓ EL COBRADOR ─────────────────────────
 *
 * «Pongo 912.000 y me pongo y le resto los abonos de abajo. Pero me toca ir con
 *  el calculador. Y pues la verdad entre 10 rutas, 9 rutas, se quema tiempo
 *  uno.» — PRESTA MIL, 9 oct 2026, con la caja de DIEGO #8 delante: cobró
 *  $912.000, y $340.000 eran abonos de clientes que ese mismo día renovaron.
 *
 * El abono puesto para renovar sube «lo cobrado» sin que entre plata nueva
 * («así suben el cobro, pero lo suben de mentiras»). El coteo es lo cobrado
 * MENOS esos abonos: 912.000 − 340.000 = 572.000.
 *
 * ⚠ NO CAMBIA LA CAJA. Los abonos siguen sumados en «Cobró» y en «Tiene que
 *   entregar»: el coteo es una cifra aparte, para controlar al cobrador, y no
 *   entra en ninguna resta. Las dos cajas siguen diciendo lo mismo.
 *
 * Una sola regla para la ficha del cobrador y para la lista de cobradores: si
 * cada una la escribiera por su lado, el mismo día darían dos coteos. */

/** Los cobros hechos sobre una cartulina que se renovó (o financió) en el día. */
export function cobrosDeRenovadas(cobros = [], renovaciones = []) {
  const renovadas = new Set(renovaciones.map((r) => r?.renovadoDeId).filter(Boolean))
  if (renovadas.size === 0) return []
  return cobros.filter((p) => renovadas.has(p?.prestamoId))
}

/** Lo cobrado menos los abonos al renovar, con las dos cifras a la vista. */
export function coteo(cobrado = 0, abonosAlRenovar = 0) {
  const c = Math.round(Number(cobrado) || 0)
  const a = Math.round(Number(abonosAlRenovar) || 0)
  return { cobrado: c, abonosAlRenovar: a, monto: c - a }
}
