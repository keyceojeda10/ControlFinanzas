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

/* ── LA CUOTA EN PESOS, EN CUALQUIER MODO DE CUOTA PAREJA ──────────────────
 *
 * «que la persona pudiera escoger el monto que le paga la cuota y que el
 *  sistema automáticamente calcule el porcentaje» — el dueño, 10 oct 2026.
 * El prestamista piensa «le presto 200 y me paga 10 diarios por 24 días».
 *
 * ⚠ NO SE DESPEJA CON UNA FÓRMULA POR MODO: se le pregunta al MOTOR. Cada modo
 *   lee el % distinto (mensual, del préstamo, por cobro, sobre saldo) y el
 *   clásico redondea la cuota hacia ARRIBA a la centena (`ceil100`): una tasa
 *   despejada a mano que diera 10.000,0001 saldría en 10.100. Así que se busca
 *   (bisección) la tasa MÁS ALTA cuya cuota no pasa de la escrita, usando el
 *   mismo `calcularPrestamo` que luego guarda el préstamo. Lo que el sistema
 *   calcule después no puede contradecirla, porque es la misma cuenta.
 *
 * `calcular(t)` devuelve el resultado de `calcularPrestamo` con la tasa `t` y
 * todo lo demás igual. Devuelve:
 *   · null — la cuota no alcanza ni con interés cero (no devuelve el capital),
 *   · { tasa, cuota, exacta } — `cuota` es la que de verdad sale; `exacta` dice
 *     si es la escrita (en el clásico, la que no va a la centena no lo es). */
export function tasaParaCuota(calcular, cuotaObjetivo, { monto = null, modo = null } = {}) {
  const objetivo = Math.round(Number(cuotaObjetivo) || 0)
  if (!(objetivo > 0) || typeof calcular !== 'function') return null
  const cuotaCon = (t) => Math.round(Number(calcular(t)?.cuotaDiaria) || 0)
  const totalCon = (t) => Math.round(Number(calcular(t)?.totalAPagar) || 0)
  /* En el globo la cuota ES el interés de cada período (monto × tasa): la tasa
     sale de dividir, exacta, igual que en el abierto. Si el motor no la
     confirma (primer período prorrateado), se busca como en los demás. */
  if (modo === 'solo_interes' && Number(monto) > 0) {
    const directa = tasaParaInteres(monto, objetivo)
    if (directa != null && cuotaCon(directa) === objetivo) return { tasa: directa, cuota: objetivo, exacta: true }
  }
  if (cuotaCon(0) > objetivo) return null
  let lo = 0
  let hi = 100
  for (let k = 0; k < 20 && cuotaCon(hi) <= objetivo; k++) hi *= 2
  if (cuotaCon(hi) <= objetivo) return { tasa: hi, cuota: cuotaCon(hi), exacta: cuotaCon(hi) === objetivo }
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (cuotaCon(mid) <= objetivo) lo = mid
    else hi = mid
  }
  const cuota = cuotaCon(lo)
  /* Varias tasas dan la misma cuota (el clásico la redondea a la centena). Se
     guarda la más corta —25 y no 25,0000003— pero SOLO si deja el total
     idéntico: en el francés 8,05 % da la misma cuota con la última $500 más
     baja, y eso ya no es el préstamo que él escribió. */
  const totalLo = totalCon(lo)
  for (let decimales = 0; decimales <= 10; decimales++) {
    const corta = Number(lo.toFixed(decimales))
    if (corta >= 0 && cuotaCon(corta) === cuota && totalCon(corta) === totalLo) return { tasa: corta, cuota, exacta: cuota === objetivo }
  }
  return { tasa: lo, cuota, exacta: cuota === objetivo }
}

/** El interés de cada período con esa tasa: la misma cuenta que `calcularPrestamo`. */
export function interesDelPeriodo(monto, tasa) {
  return Math.round(Number(monto) * (Number(tasa) / 100))
}
