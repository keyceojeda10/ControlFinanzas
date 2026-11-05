// lib/dinero/orden-de-pagos.js — EN QUÉ ORDEN SE LEEN LOS PAGOS DE UN PRÉSTAMO.
//
// Inversiones Jk, 5 nov 2026: «en el sistema siempre ha aparecido el interés de
// primero y capital después… eso sale así desordenado». El mismo día el cliente
// pagó el interés y abonó a capital; al cambiarles la fecha a mano los dos
// quedan a las 12:00 y el orden lo decidía el azar (o la hora en que se anotó
// cada uno, que no es la del pago).
//
// La regla: por DÍA (en la hora del país) y, dentro del mismo día, primero el
// interés, luego lo que cubre interés y capital, luego el capital. Es el orden
// en que el sistema aplica la plata, y el que la gente lee en su cuaderno.

const RANGO = { intereses: 0, completo: 1, parcial: 1, capital: 2 }
const HORA_MS = 60 * 60 * 1000

const diaDe = (fecha, offsetHoras) =>
  new Date(new Date(fecha).getTime() - Math.abs(offsetHoras) * HORA_MS).toISOString().slice(0, 10)

/**
 * Comparador para `Array.sort`. `reciente: true` pone los días más nuevos
 * arriba (la ficha); el orden DENTRO del día es siempre interés → capital.
 */
export function compararPagos(a, b, { reciente = false, offsetHoras = 5 } = {}) {
  const da = diaDe(a.fechaPago, offsetHoras)
  const db = diaDe(b.fechaPago, offsetHoras)
  if (da !== db) return (da < db ? -1 : 1) * (reciente ? -1 : 1)
  const ra = RANGO[a.tipo] ?? 3
  const rb = RANGO[b.tipo] ?? 3
  if (ra !== rb) return ra - rb
  const ha = new Date(a.fechaPago) - new Date(b.fechaPago)
  return reciente ? -ha : ha
}

/** Copia ordenada; no toca la lista que llega. */
export const pagosEnOrden = (pagos, opciones) => [...(pagos ?? [])].sort((a, b) => compararPagos(a, b, opciones))
