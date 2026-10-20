/* ── CUÁNDO SE RENOVÓ CADA PRÉSTAMO CERRADO ──
 *
 * Al renovar, el préstamo viejo se marca `completado` y el nuevo guarda
 * `renovadoDeId`; el viejo no guarda nada de su cierre. Sin esto, su tarjeta
 * decía «Pagado», «Ya pagó $0», «terminado 25 oct» —la fecha en que DEBÍA
 * terminar, aún sin llegar— y «Capital afuera $100.000», capital que ya había
 * pasado al préstamo nuevo. Oscar (CREDITOS E y M, 20 oct 2026): «¿por qué sale
 * así, en dos partes?».
 *
 * Devuelve Map(idDelViejo → fecha del préstamo que lo renovó). */
export async function renovacionesDe(prisma, { organizationId, ids }) {
  const fechas = new Map()
  if (!ids?.length) return fechas
  const nuevos = await prisma.prestamo.findMany({
    where: { organizationId, renovadoDeId: { in: ids } },
    select: { renovadoDeId: true, createdAt: true },
  })
  for (const n of nuevos) {
    const antes = fechas.get(n.renovadoDeId)
    if (!antes || n.createdAt < antes) fechas.set(n.renovadoDeId, n.createdAt)
  }
  return fechas
}
