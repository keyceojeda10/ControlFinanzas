/* ── EL MRR: LO QUE ENTRA POR MES, NO EL ÚLTIMO PAGO (2 nov 2026) ─────────────
 *
 * Los tres paneles (Inicio, Usuarios y Negocio) sumaban el `montoCOP` de la
 * suscripción como si fuera mensual. Pero un trimestral paga 3 meses de una vez
 * y un semestral 6: medido el 2 nov, el panel decía $3.321.500 y lo que entra
 * por mes era ≈ $2.683.000 (un semestral de $300.000, trimestrales de
 * $213.300, $159.000 y dos de $105.300 contados enteros cada mes).
 *
 * Cuántos meses cubre se lee del LIBRO (`PagoSuscripcion.periodo` del último
 * pago): la suscripción no lo guarda, y su `fechaInicio` no sirve porque una
 * renovación alarga la misma fila.
 */

export const MESES_PERIODO_PAGO = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }

/** Lo que vale al mes un pago de `monto` que cubre `periodo`. */
export function mensualDe(monto, periodo = 'mensual') {
  return Math.round((Number(monto) || 0) / (MESES_PERIODO_PAGO[periodo] ?? 1))
}

/** El periodo del último pago de cada negocio: Map(organizationId → periodo). */
export async function periodosDelUltimoPago(prisma, ids = []) {
  const mapa = new Map()
  if (!ids.length) return mapa
  const pagos = await prisma.pagoSuscripcion.findMany({
    where: { organizationId: { in: ids }, montoCOP: { gt: 2000 } },
    orderBy: { fecha: 'desc' },
    select: { organizationId: true, periodo: true },
  })
  for (const p of pagos) if (!mapa.has(p.organizationId)) mapa.set(p.organizationId, p.periodo)
  return mapa
}
