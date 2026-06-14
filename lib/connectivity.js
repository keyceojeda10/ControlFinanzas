// lib/connectivity.js — Deteccion de conectividad REAL a internet.
//
// Problema: navigator.onLine solo dice si hay una interfaz de red conectada
// (WiFi/datos activos), NO si esa red llega a internet. En la calle el cobrador
// suele tener datos "conectados" pero sin paso real -> navigator.onLine = true
// pero los fetch cuelgan. La app queda en limbo (ni online ni offline).
//
// Solucion: ademas de navigator.onLine, hacer un ping ultraligero a /api/ping
// con timeout corto. Si la interfaz dice "online" pero el ping falla/tarda,
// la tratamos como OFFLINE (cargar de cache, mostrar estado offline).

const PING_URL = '/api/ping'
const PING_TIMEOUT_MS = 4000 // si el ping tarda mas de 4s en red mala, es "limbo"
const PING_CACHE_MS = 5000   // cachear el resultado 5s para no spamear la red

let _ultimoResultado = null
let _ultimoCheckAt = 0
let _enVuelo = null // promesa en curso para deduplicar checks concurrentes

// Verifica si hay internet REAL. Retorna boolean.
// - Si navigator.onLine es false -> false sin pingear (interfaz caida).
// - Si es true -> ping real (con cache de 5s).
export async function hayInternetReal({ forzar = false } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    _ultimoResultado = false
    _ultimoCheckAt = Date.now()
    return false
  }

  const ahora = Date.now()
  if (!forzar && _ultimoResultado !== null && ahora - _ultimoCheckAt < PING_CACHE_MS) {
    return _ultimoResultado
  }

  // Deduplicar: si ya hay un ping en vuelo, esperar ese mismo.
  if (_enVuelo) return _enVuelo

  _enVuelo = (async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS)
    let ok = false
    try {
      const res = await fetch(`${PING_URL}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal,
      })
      ok = res.ok
    } catch {
      ok = false // abort (timeout) o error de red -> sin internet real
    } finally {
      clearTimeout(timer)
    }
    _ultimoResultado = ok
    _ultimoCheckAt = Date.now()
    _enVuelo = null
    return ok
  })()

  return _enVuelo
}

// Invalida el cache (util tras eventos online/offline para forzar re-check).
export function invalidarCacheConexion() {
  _ultimoCheckAt = 0
  _ultimoResultado = null
}

// Lectura SINCRONA del ultimo estado conocido (sin pingear). Devuelve:
//   true  -> ultimo ping ok (hay internet)
//   false -> ultimo ping fallo (limbo / sin internet)  [reciente, < ventana]
//   null  -> sin info reciente (no asumir nada)
// Usado por el interceptor de fetch para decidir el timeout sin bloquear.
export function ultimoEstadoConexion() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (_ultimoResultado === null) return null
  if (Date.now() - _ultimoCheckAt > PING_CACHE_MS * 3) return null // muy viejo
  return _ultimoResultado
}
