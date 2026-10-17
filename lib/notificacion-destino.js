// lib/notificacion-destino.js — a dónde lleva tocar una notificación guardada.
//
// La comparten la campana (NotificationsCenter) y la pila de avisos: la regla
// estaba escrita dos veces, igual, y un arreglo en una se quedaba sin la otra.

/**
 * ⚠ EL RESUMEN DEL DÍA LLEVA A SU DÍA. Se guardaba con `/dashboard?resumen=1`,
 * sin fecha, y la pantalla se arma con el Inicio de HOY: la notificación del 14
 * abierta el 17 enseñaba el 17 (el dueño, 17 oct 2026). Las viejas ya guardaron
 * su `fecha` en los datos, así que también quedan bien.
 */
export function destinoDeNotificacion(n) {
  let d
  try { d = JSON.parse(n?.datos || '{}') } catch { return null }
  if (!d || typeof d !== 'object') return null
  if (n?.tipo === 'resumen_dia' && /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha || ''))) {
    return `/dashboard?resumen=${d.fecha}`
  }
  return d.href || (d.clienteId ? `/clientes/${d.clienteId}` : null)
}
