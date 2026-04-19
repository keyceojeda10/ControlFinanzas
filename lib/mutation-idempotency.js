// Idempotencia ligera para mutaciones offline (X-Mutation-Id).
// In-memory LRU con TTL — suficiente para evitar doble-aplicacion cuando el
// cliente offline reintenta dentro de minutos. No cubre reinicio del servidor,
// pero ese caso es raro y el worst-case es last-write-wins (ya es nuestra regla).

const TTL_MS = 60 * 60 * 1000 // 1 hora
const MAX_ENTRIES = 5000

const store = new Map() // key -> { response, expiresAt }

function cleanup() {
  const now = Date.now()
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k)
  }
  while (store.size > MAX_ENTRIES) {
    const firstKey = store.keys().next().value
    if (firstKey === undefined) break
    store.delete(firstKey)
  }
}

export function getCachedMutation(key) {
  if (!key) return null
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    store.delete(key)
    return null
  }
  return entry.response
}

export function setCachedMutation(key, response) {
  if (!key) return
  cleanup()
  store.set(key, { response, expiresAt: Date.now() + TTL_MS })
}

// Compone la key con el user/org + mutation id para evitar colisiones cross-tenant
export function buildMutationKey(session, mutationId, entityId) {
  const org = session?.user?.organizationId || 'anon'
  const usr = session?.user?.id || 'anon'
  return `${org}:${usr}:${entityId}:${mutationId}`
}
