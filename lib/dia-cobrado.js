// lib/dia-cobrado.js
//
// «Llevas hoy» cuando el cobro NO viene de un recorrido de ruta (la ficha del
// préstamo, la lista de clientes o de préstamos, el QR). En la ruta la cifra
// sale de la propia ruta; aquí sale del resumen del INICIO, así que dice lo
// mismo que la persona ve al abrir la app:
//
//   · `cobros.hoy`: lo cobrado hoy, sin recargos ni descuentos (no son plata que
//     entra) y, para un cobrador, solo de sus rutas.
//   · `prestamos.esperadoHoy`: lo que tocaba cobrar hoy, con la misma regla.
//
// Se pide DESPUÉS de guardar el pago, así que `cobros.hoy` ya lo incluye: lo que
// llevaba antes es eso menos este pago. Si no llega, «Llevas hoy» no se pinta.

export async function cargarDiaCobrado(monto) {
  try {
    const r = await fetch('/api/dashboard/resumen', { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    if (d?.offline) return null
    const ahora = Math.round(Number(d?.cobros?.hoy))
    if (!Number.isFinite(ahora)) return null
    const meta = Math.round(Number(d?.prestamos?.esperadoHoy) || 0)
    return { antes: Math.max(0, ahora - Math.round(Number(monto) || 0)), ahora, meta }
  } catch { return null }
}
