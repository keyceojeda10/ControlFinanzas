/* «VER COMO ESTE COBRADOR»: la marca de solo lectura EN ESTE TELÉFONO.
   Las sincronizaciones sin conexión corren solas y no leen la sesión: sin esta
   marca, los cobros pendientes del dueño se subirían con la cookie del
   cobrador, el portero los rechazaría y quedarían como fallidos. En
   localStorage (no sessionStorage): la app instalada pierde el sessionStorage
   al cerrarse y la cookie de vista dura hasta una hora. La encienden el botón
   «Ver como» y la franja; SesionTracker la iguala a la sesión en cada carga. */
const CLAVE = 'cf-solo-lectura'

// Lo que ve la persona cuando algo intenta ENCOLAR una escritura (pago,
// cliente, préstamo, orden o mutación) mientras el teléfono está en vista.
// La usan las cinco funciones de encolado de lib/offline.js y sus pantallas.
export const MENSAJE_EN_VISTA = 'Estás viendo como tu cobrador: desde aquí no se registra nada. Vuelve a tu cuenta.'

export function marcarSoloLectura(v) {
  try { v ? localStorage.setItem(CLAVE, '1') : localStorage.removeItem(CLAVE) } catch {}
}

export function estaEnSoloLectura() {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}
