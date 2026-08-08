// lib/fetch-timeout.js — Timeout global para fetch a /api/
//
// Se instala al IMPORTAR el modulo (nivel de modulo, no useEffect).
// Esto garantiza que CUALQUIER fetch a /api/ tenga timeout desde el
// primer render, eliminando skeletons colgados cuando hay "limbo"
// (navigator.onLine=true pero sin internet real).
//
// El OfflineProvider importa este archivo y usa installFetchTimeout()
// para registrar el callback de mutation-sync (que depende de state).

import { ultimoEstadoConexion } from '@/lib/connectivity'

const TIMEOUT_LARGO_MS  = 45_000
const TIMEOUT_NORMAL_MS = 8_000
const TIMEOUT_LIMBO_MS  = 1_500
/* ── ⚠ LEER FOTOS NO CABE EN NINGUNO DE LOS DE ARRIBA ────────────────────────
   Treinta fotos de cartulina son treinta llamadas a Gemini Vision de cuatro en
   cuatro: minuto y medio largo con buena conexión. Con el presupuesto normal de
   8 s, la subida se abortaba SIEMPRE — y el navegador dice «signal is aborted
   without reason», que no señala a ningún sitio.

   Lo vi probando el lote en el espejo: la petición llegaba al servidor, Gemini
   respondía bien y la pantalla decía que no había internet. Sin este renglón, la
   función entera es inusable para cualquiera.

   Va AQUÍ y no con un `signal` propio en la pantalla a propósito: los
   presupuestos de tiempo se declaran todos en este archivo, y la siguiente
   pantalla que lea fotos heredaría el fallo si cada una llevara el suyo. */
const TIMEOUT_LECTURA_MS = 180_000

const esSyncMasivo = (u) => u.includes('/api/offline/sync')
/** Las que llaman a Gemini Vision: leer-cartulina y leer-cartulinas-lote. */
const esLecturaDeFotos = (u) => u.includes('/api/herramientas/leer-cartulina')

// AUTENTICACION: nunca se le aplica el presupuesto corto del limbo.
//
// Para cualquier otra pantalla, fallar rapido es mejor que colgarse: el usuario
// SIGUE DENTRO de la app y puede reintentar. En login no hay degradacion
// elegante posible — si la peticion se aborta, la persona se queda FUERA y sin
// forma de entrar. Mismo criterio que la excepcion del sync masivo.
const esAuth = (u) => u.includes('/api/auth/')

let _originalFetch = null
let _onMutationSuccess = null

/**
 * Limpia el temporizador cuando la promesa termine, PASE LO QUE PASE, sin dejar
 * una rama de rechazo suelta.
 *
 * `promesa.finally(cb)` devuelve una promesa NUEVA que hereda el rechazo del
 * original. Como nadie la escucha, cada fetch abortado o caido producia un
 * "unhandled rejection" — y en desarrollo eso es el overlay rojo de Next
 * gritando AbortError aunque la pantalla que hizo el fetch lo hubiera capturado
 * perfectamente.
 *
 * `.then(cb, cb)` con los DOS manejadores devuelve una promesa que se cumple,
 * asi que no queda nada sin escuchar.
 */
export function limpiarAlTerminar(promesa, limpiar) {
  promesa.then(limpiar, limpiar)
  return promesa
}

function _patchedFetch(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
  const opts = args[1] || {}
  const method = (opts.method || 'GET').toUpperCase()

  const esApi = url.startsWith('/api/') || url.includes('/api/')
  let result
  if (esApi && !opts.signal) {
    const ctrl = new AbortController()
    const enLimbo = method === 'GET' && !esSyncMasivo(url) && !esAuth(url)
      && !esLecturaDeFotos(url)
      && ultimoEstadoConexion() === false
    const ms = esLecturaDeFotos(url)
      ? TIMEOUT_LECTURA_MS
      : esSyncMasivo(url)
        ? TIMEOUT_LARGO_MS
        : enLimbo ? TIMEOUT_LIMBO_MS : TIMEOUT_NORMAL_MS
    const timer = setTimeout(() => ctrl.abort(), ms)
    result = _originalFetch.apply(this, [args[0], { ...opts, signal: ctrl.signal }])
    limpiarAlTerminar(result, () => clearTimeout(timer))
  } else {
    result = _originalFetch.apply(this, args)
  }

  result.then((response) => {
    const isReorder = url.includes('/reordenar')
    if (url.startsWith('/api/') && method !== 'GET' && response.ok && !isReorder) {
      _onMutationSuccess?.()
    }
  }).catch(() => {})

  return result
}

if (typeof window !== 'undefined' && !_originalFetch) {
  _originalFetch = window.fetch
  window.fetch = _patchedFetch
}

export function setMutationCallback(cb) {
  _onMutationSuccess = cb
}

export function getOriginalFetch() {
  return _originalFetch || (typeof window !== 'undefined' ? window.fetch : fetch)
}
