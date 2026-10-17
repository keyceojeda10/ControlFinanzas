// lib/dinero/deshacer-abono.js — ¿Se puede anular este abono a capital?
//
// En un préstamo con tabla (sobre saldo, decreciente, globo…) un abono a
// capital REHACE las cuotas futuras desde el saldo y recalcula la deuda total.
// Eso no se puede deshacer con una fórmula: se deshace con la foto que el abono
// guardó de cómo estaba todo (`Pago.tablaAntes`, desde el 15 oct 2026).
//
// Lo que pasaba: anular usaba la fórmula de los préstamos SIN tabla
// (monto × tasa × meses restantes) y la tabla rehecha se quedaba. Crediya, Jhon
// Arteaga: el abono de $26.500 bajó la deuda $101.390; anularlo devolvió $1.199.
// El cliente quedó debiendo $100.191 menos, y le prestaron $600.000 para
// cobrarle $597.088.
//
// Puro: vitest lo prueba solo.

/** Por qué NO se puede anular ahora (texto para la persona), o null si se puede. */
export function motivoParaNoDeshacerAbono(pago, prestamo) {
  const cuando = (x) => new Date(x?.createdAt ?? x?.fechaPago ?? 0).getTime()
  const despues = (prestamo?.pagos ?? []).filter((p) => p.id !== pago.id && cuando(p) > cuando(pago))
  // El abono siguiente se calculó sobre la tabla que dejó éste: hay que ir en orden.
  if (despues.some((p) => p.tipo === 'capital')) {
    return 'Este préstamo tiene un abono a capital más reciente. Anule primero ese y después este.'
  }
  // En el lineal dinámico cada cobro rehace la tabla: la foto ya no sirve.
  if (prestamo?.modoInteres === 'lineal_dinamico' && despues.length > 0) {
    return 'Después de este abono hubo más cobros, y en este tipo de préstamo cada cobro rehace las cuotas. Anule primero los cobros más recientes.'
  }
  if (!Array.isArray(pago?.tablaAntes?.filas)) {
    return 'Este abono se registró antes de que la app guardara cómo estaban las cuotas. Para anularlo sin dañar la deuda, escríbanos y lo hacemos nosotros.'
  }
  return null
}

/* ══ ANULAR UNA LIQUIDACIÓN (cerrar anticipado) ═════════════════════════════
 * Liquidar baja `totalAPagar` hasta lo pagado y apunta el resto como «Interés
 * perdonado». Anular borraba el pago y nada más: el préstamo revivía debiendo
 * MENOS (lo perdonado se perdía) y el apunte seguía en el libro. Desde el 17 oct
 * 2026 la liquidación guarda en `tablaAntes` el total de antes, el período que
 * asentó (en un abierto) y lo perdonado. Sin esa foto no se anula: devolver una
 * deuda adivinada es peor que pedir ayuda. (DETALLES-PRESTAMOS #7.) */
export function motivoParaNoDeshacerLiquidacion(pago) {
  const foto = pago?.tablaAntes
  if (!foto || typeof foto.totalAPagar !== 'number') {
    return 'Este cierre se registró antes de que la app guardara cuánto debía. Para anularlo sin dañar la deuda, escríbanos y lo hacemos nosotros.'
  }
  return null
}
