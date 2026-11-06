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
//
// ⚠ «PRIMERO» ES EN EL TIEMPO, NO ARRIBA EN LA PANTALLA (6 nov 2026). La ficha
// pone lo más nuevo arriba, así que el prestamista la lee DE ABAJO HACIA ARRIBA:
// el pago de abajo es el primero que se hizo. La primera versión de esta regla
// ponía el interés arriba también dentro del día, y en una lista de lo más nuevo
// arriba eso lo deja DESPUÉS del capital. Juan Carlos (Inversiones Jk), con la
// ficha de Angélica Leguia delante: «primero me sale capital y después interés;
// un prestamista nunca cobra capital y después interés». Antes del 4 nov se veía
// bien por casualidad —el capital se anota después, y su hora lo subía—; con las
// fechas cambiadas a mano (las dos a las 12:00) quedaba al azar.
//
// Así que el orden de dentro del día se invierte con el de los días: de lo más
// nuevo arriba, el capital va encima del interés. Leído de abajo arriba, o en un
// historial de lo más viejo arriba, siempre sale interés → capital.

const RANGO = { intereses: 0, completo: 1, parcial: 1, capital: 2 }
const HORA_MS = 60 * 60 * 1000

const diaDe = (fecha, offsetHoras) =>
  new Date(new Date(fecha).getTime() - Math.abs(offsetHoras) * HORA_MS).toISOString().slice(0, 10)

/**
 * Comparador para `Array.sort`. `reciente: true` pone lo más nuevo arriba (la
 * ficha): los días y, dentro del día, el capital encima del interés.
 */
export function compararPagos(a, b, { reciente = false, offsetHoras = 5 } = {}) {
  const da = diaDe(a.fechaPago, offsetHoras)
  const db = diaDe(b.fechaPago, offsetHoras)
  if (da !== db) return (da < db ? -1 : 1) * (reciente ? -1 : 1)
  const ra = RANGO[a.tipo] ?? 3
  const rb = RANGO[b.tipo] ?? 3
  if (ra !== rb) return (ra - rb) * (reciente ? -1 : 1)
  const ha = new Date(a.fechaPago) - new Date(b.fechaPago)
  return reciente ? -ha : ha
}

/** Copia ordenada; no toca la lista que llega. */
export const pagosEnOrden = (pagos, opciones) => [...(pagos ?? [])].sort((a, b) => compararPagos(a, b, opciones))
