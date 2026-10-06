/* EL NÚMERO DE CADA CRÉDITO DENTRO DE SU CLIENTE (6 oct 2026).
 *
 * La regla que ya usaba la ficha: la posición entre TODOS los préstamos del
 * cliente por fecha de creación, #1 el más antiguo. Vive aquí para que las
 * plantillas de WhatsApp y el comprobante digan el mismo número que la app:
 * «si un cliente tiene varios créditos y paga uno, no sabe cuál está pagando»
 * (soporte, 6 oct 2026). Sin Prisma: recibe las filas ya leídas.
 */

/** @param {Array<{ id: string, clienteId: string, createdAt: Date|string }>} prestamos
 *  @returns {Map<string, { numero: number, de: number }>} */
export function numerarPorCliente(prestamos = []) {
  const porCliente = new Map()
  for (const p of prestamos) {
    if (!p?.id || !p?.clienteId) continue
    if (!porCliente.has(p.clienteId)) porCliente.set(p.clienteId, [])
    porCliente.get(p.clienteId).push(p)
  }
  const m = new Map()
  for (const lista of porCliente.values()) {
    lista.sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || String(a.id).localeCompare(String(b.id)))
    lista.forEach((p, i) => m.set(p.id, { numero: i + 1, de: lista.length }))
  }
  return m
}

/** Lee de la base los préstamos de esos clientes (solo id, cliente y fecha) y los numera. */
export async function numerosDeClientes(db, { organizationId, clienteIds }) {
  const ids = [...new Set((clienteIds ?? []).filter(Boolean))]
  if (ids.length === 0) return new Map()
  const filas = await db.prestamo.findMany({
    where: { organizationId, clienteId: { in: ids } },
    select: { id: true, clienteId: true, createdAt: true },
  })
  return numerarPorCliente(filas)
}

/** Los dos campos que viajan con el préstamo: `numeroCliente` y `creditosCliente`. */
export function camposDeNumero(numeros, prestamoId) {
  const n = numeros.get(prestamoId)
  return n ? { numeroCliente: n.numero, creditosCliente: n.de } : {}
}
