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

const esSyncMasivo = (u) => u.includes('/api/offline/sync')

let _originalFetch = null
let _onMutationSuccess = null

function _patchedFetch(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
  const opts = args[1] || {}
  const method = (opts.method || 'GET').toUpperCase()

  const esApi = url.startsWith('/api/') || url.includes('/api/')
  let result
  if (esApi && !opts.signal) {
    const ctrl = new AbortController()
    const enLimbo = method === 'GET' && !esSyncMasivo(url) && ultimoEstadoConexion() === false
    const ms = esSyncMasivo(url)
      ? TIMEOUT_LARGO_MS
      : enLimbo ? TIMEOUT_LIMBO_MS : TIMEOUT_NORMAL_MS
    const timer = setTimeout(() => ctrl.abort(), ms)
    result = _originalFetch.apply(this, [args[0], { ...opts, signal: ctrl.signal }])
    result.finally(() => clearTimeout(timer))
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
