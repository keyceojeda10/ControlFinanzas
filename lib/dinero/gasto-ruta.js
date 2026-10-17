// lib/dinero/gasto-ruta.js — La ruta a la que se le carga un gasto.
//
// La primera ruta activa del cobrador. Sin esto, el gasto baja el capital
// global pero NO el saldoCapital de la ruta, y la caja del cobrador (modo
// capital=efectivo) queda sin descontar el gasto. Lo usan aprobar un gasto
// (`/api/gastos/[id]`) y el gasto que anota el dueño, que nace aprobado
// (`/api/gastos`).
export async function rutaDelGasto(client, organizationId, cobradorId) {
  if (!cobradorId) return null
  const ruta = await client.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true },
  })
  return ruta?.id || null
}
