// lib/adaptadores/avisos.js — cuál de los avisos se ve arriba.
//
// LA REGLA DEL DISEÑADOR, literal: «una sola franja de aviso, la de mayor
// prioridad, y el resto a la campana. El orden lo decide EL DINERO EN JUEGO, no
// el negocio de la app: primero lo que impide cobrar —una ruta con $4.5M y sin
// cobrador—, después lo que caduca, y al final lo cómodo (instalar la app,
// verificar el correo). Hoy los cuatro se apilan y empujan el patrimonio fuera
// de la pantalla; lo primero que ve el dueño al abrir es que le van a cobrar la
// suscripción.»
//
// Ese último detalle es el que duele: cuatro franjas ámbar seguidas no son
// cuatro avisos, son una pared. Y cuando todo está en ámbar, nada lo está.

/**
 * De más a menos dinero en juego. El número es solo el orden; lo que importa es
 * la lista y su porqué.
 *
 *  1 · IMPIDE COBRAR — una ruta sin cobrador es plata parada en la calle.
 *  2 · CADUCA        — la suscripción, los límites del plan: tienen fecha.
 *  3 · CÓMODO        — instalar la app, verificar el correo. No pierdes un peso
 *                      por no hacerlo hoy, así que no puede abrir la pantalla.
 */
export const PRIORIDAD = {
  sinRuta: 1,
  suscripcion: 2,
  limitePlan: 2,
  verificarCorreo: 3,
  instalarApp: 3,
}

export function pesoDe(id) {
  return PRIORIDAD[id] ?? 99
}

/**
 * @param avisos [{ id, ... }] — solo los que de verdad aplican ahora.
 * @returns { principal, resto, cuantosMas }
 *
 * `principal` es el único que se pinta como franja. `resto` va a la campana.
 */
export function ordenarAvisos(avisos = []) {
  const vivos = (avisos || []).filter(Boolean)
  // Estable dentro del mismo peso: dos avisos igual de urgentes no deben
  // bailar de sitio entre recargas — un aviso que cambia de posición se lee
  // como un aviso nuevo.
  const ordenados = vivos
    .map((a, i) => ({ a, i }))
    .sort((x, y) => pesoDe(x.a.id) - pesoDe(y.a.id) || x.i - y.i)
    .map(({ a }) => a)

  const [principal = null, ...resto] = ordenados
  return {
    principal,
    resto,
    cuantosMas: resto.length,
    // «Hay 2 avisos más de la app» — el número, no un «ver todo» sin cifra:
    // sin saber cuántos son, nadie abre la campana.
    textoResto: resto.length
      ? `Hay ${resto.length} aviso${resto.length === 1 ? '' : 's'} más de la app`
      : null,
  }
}
