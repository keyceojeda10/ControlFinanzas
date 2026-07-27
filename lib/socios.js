// lib/socios.js — Matematica del reparto de utilidades entre socios.
//
// Vive aparte de la ruta API para poder probarla sin base de datos: aca no hay
// consultas ni sesion, solo numeros. La regla de negocio que fija es cuanto le
// toca a cada socio de una utilidad, y que no se pierda ni se invente un peso.

/**
 * Porcentaje de participacion de un socio.
 *
 * La BASE define si el dueño participa, sin necesidad de un ajuste aparte:
 *  - con `metaSociedad` fijada, la base es la meta y los socios pueden sumar
 *    MENOS de 100%: la diferencia es del negocio (el dueño).
 *  - sin meta, la base es lo aportado entre todos los socios y suman 100%.
 */
export function porcentajeParticipacion(balanceNeto, base) {
  if (!base || base <= 0) return 0
  return Math.round((balanceNeto / base) * 10000) / 100
}

/**
 * Reparte `monto` entre los socios segun su balance.
 *
 * Dos pasos:
 *  1. Cuanto le toca AL CONJUNTO de socios = monto x (balances / base). Con meta
 *     fijada esto es menor al monto y el sobrante se queda en el negocio.
 *  2. Ese total se divide entre los socios por el metodo del RESIDUO MAYOR: se
 *     asigna la parte entera a cada uno y los pesos que sobran por el redondeo
 *     van a quienes tenian la fraccion mas alta. Asi la suma de las partes es
 *     EXACTAMENTE el total repartido — no queda un peso perdido ni sobrante.
 *
 * Devuelve `{ asignaciones, totalSocios }`, donde `monto - totalSocios` (menos el
 * fondo, si hay) es lo que se queda en el negocio.
 */
export function repartirExacto(monto, socios, base, totalBalances) {
  const vacio = { asignaciones: (socios || []).map((s) => ({ ...s, monto: 0 })), totalSocios: 0 }
  if (!Array.isArray(socios) || !socios.length) return { asignaciones: [], totalSocios: 0 }
  if (!(monto > 0) || !(base > 0) || !(totalBalances > 0)) return vacio

  // Con meta, los socios solo se llevan su peso sobre la meta. Sin meta,
  // Math.min hace que sea el monto completo.
  const totalSocios = Math.round(monto * (Math.min(totalBalances, base) / base))
  if (totalSocios <= 0) return vacio

  const crudos = socios.map((s, i) => {
    const exacto = (totalSocios * s.balanceNeto) / totalBalances
    const piso = Math.floor(exacto)
    return { id: s.id, orden: i, piso, resto: exacto - piso }
  })

  let faltante = totalSocios - crudos.reduce((acc, s) => acc + s.piso, 0)
  // Residuo mayor; el orden original desempata para que el resultado sea estable.
  crudos.sort((a, b) => (b.resto - a.resto) || (a.orden - b.orden))
  for (let i = 0; i < crudos.length && faltante > 0; i++, faltante--) crudos[i].piso++

  const porId = new Map(crudos.map((s) => [s.id, s.piso]))
  return {
    asignaciones: socios.map((s) => ({ ...s, monto: porId.get(s.id) || 0 })),
    totalSocios,
  }
}
