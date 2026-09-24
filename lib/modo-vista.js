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

/* El error que tiran las cinco funciones de encolado en vista, marcado con
   `soloLectura: true`. Las pantallas que lo atrapan muestran SU texto solo
   cuando trae esta marca; cualquier otro fallo (por ejemplo un
   QuotaExceededError de IndexedDB en un Android barato) sigue con el texto de
   siempre de cada pantalla — mostrar la excepción cruda a un cobrador real
   sería peor que el genérico que había antes. */
export function errorEnVista() {
  const err = new Error(MENSAJE_EN_VISTA)
  err.soloLectura = true
  return err
}

export function marcarSoloLectura(v) {
  try { v ? localStorage.setItem(CLAVE, '1') : localStorage.removeItem(CLAVE) } catch {}
}

export function estaEnSoloLectura() {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}
