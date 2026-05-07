// lib/asistente-cache.js — Cache en memoria para contexto del asistente IA
// TTL de 5 minutos por orgId para evitar consultas repetidas a la BD

const _cache = new Map()
const TTL = 5 * 60 * 1000

export function getCachedContexto(orgId) {
  const entry = _cache.get(orgId)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) {
    _cache.delete(orgId)
    return null
  }
  return entry.data
}

export function setCachedContexto(orgId, data) {
  _cache.set(orgId, { data, ts: Date.now() })
}

export function clearCachedContexto(orgId) {
  _cache.delete(orgId)
}
