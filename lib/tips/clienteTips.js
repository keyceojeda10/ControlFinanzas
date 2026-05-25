// lib/tips/clienteTips.js — Generador de tips para detalle de cliente (logica pura, sin API)

export function generarTipCliente(cliente, prestamosActivos = []) {
  if (!cliente) return null

  // Mora alta en algun prestamo
  const maxMora = Math.max(0, ...prestamosActivos.map(p => p?.diasMora ?? 0))
  if (maxMora > 7) {
    return `Este cliente lleva ${maxMora} dias en mora — considera contacto directo para evitar acumulacion.`
  }

  // Multiples prestamos activos
  if (prestamosActivos.length > 1) {
    const total = prestamosActivos.reduce((acc, p) => acc + (p?.saldoPendiente ?? 0), 0)
    return `${prestamosActivos.length} prestamos activos por $${Math.round(total).toLocaleString('es-CO')} — monitorear capacidad de pago.`
  }

  // Buen historial — cerca de terminar
  if (prestamosActivos.length === 1) {
    const p = prestamosActivos[0]
    const pct = p?.porcentajePagado ?? 0
    if (pct >= 75) {
      return `Lleva ${pct}% pagado en su prestamo activo — cliente con buen historial de pago.`
    }
  }

  // Sin prestamos activos
  if (prestamosActivos.length === 0 && cliente.estado !== 'eliminado') {
    return 'Cliente sin prestamos activos — potencial para nuevo credito si tiene buen historial.'
  }

  return null
}
