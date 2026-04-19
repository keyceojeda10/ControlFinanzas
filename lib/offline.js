// lib/offline.js — IndexedDB offline queue + sync manager
// Stores pending payments when offline, syncs when back online

const DB_NAME    = 'cf-offline'
const DB_VERSION = 4
const STORE_PAGOS       = 'pagos_pendientes'
const STORE_CACHE       = 'data_cache'
const STORE_ORDENES     = 'ordenes_pendientes'
const STORE_CLIENTES    = 'clientes_pendientes'
const STORE_PRESTAMOS   = 'prestamos_pendientes'
const STORE_ID_MAP      = 'id_map' // offline temp id -> real id
const STORE_MUTACIONES  = 'mutaciones_pendientes' // updates a entidades existentes

// Registra un Background Sync para que el browser reintente cuando haya red.
// Silencioso si la API no existe o falla (algunos browsers no la soportan).
async function registrarBackgroundSync() {
  try {
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!reg || !('sync' in reg)) return
    await reg.sync.register('cf-sync-pending')
  } catch {}
}

// ─── IndexedDB setup ────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_PAGOS)) {
        const store = db.createObjectStore(STORE_PAGOS, { keyPath: 'id', autoIncrement: true })
        store.createIndex('prestamoId', 'prestamoId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_ORDENES)) {
        db.createObjectStore(STORE_ORDENES, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(STORE_CLIENTES)) {
        db.createObjectStore(STORE_CLIENTES, { keyPath: 'tempId' })
      }
      if (!db.objectStoreNames.contains(STORE_PRESTAMOS)) {
        db.createObjectStore(STORE_PRESTAMOS, { keyPath: 'tempId' })
      }
      if (!db.objectStoreNames.contains(STORE_ID_MAP)) {
        db.createObjectStore(STORE_ID_MAP, { keyPath: 'tempId' })
      }
      if (!db.objectStoreNames.contains(STORE_MUTACIONES)) {
        const store = db.createObjectStore(STORE_MUTACIONES, { keyPath: 'id', autoIncrement: true })
        store.createIndex('entityId', 'entityId', { unique: false })
        store.createIndex('tipo', 'tipo', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── Pending payments queue ─────────────────────────────────

export async function guardarPagoPendiente(pago) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    const store = tx.objectStore(STORE_PAGOS)
    store.add({
      ...pago,
      createdAt: new Date().toISOString(),
      synced: false,
    })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
  registrarBackgroundSync()
}

export async function obtenerPagosPendientes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readonly')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.getAll()
    // Excluir sincronizados y los que fallaron permanentemente (4xx)
    req.onsuccess = () => resolve(req.result.filter((p) => !p.synced && !p.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

// Pagos que fallaron permanentemente — para mostrar al usuario
export async function obtenerPagosFallidos() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readonly')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result.filter((p) => p.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

export async function eliminarPagoFallido(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    tx.objectStore(STORE_PAGOS).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

async function marcarPagoFallidoPermanente(id, errorMsg) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.get(id)
    req.onsuccess = () => {
      const pago = req.result
      if (pago) {
        pago.failedPermanent = true
        pago.errorMsg = errorMsg || 'Error desconocido'
        store.put(pago)
      }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function incrementarIntentoFallido(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.get(id)
    req.onsuccess = () => {
      const pago = req.result
      if (pago) {
        pago.intentos = (pago.intentos || 0) + 1
        store.put(pago)
      }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function marcarPagoSincronizado(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.get(id)
    req.onsuccess = () => {
      const pago = req.result
      if (pago) {
        pago.synced = true
        store.put(pago)
      }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function eliminarPagosSincronizados() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PAGOS, 'readwrite')
    const store = tx.objectStore(STORE_PAGOS)
    const req = store.getAll()
    req.onsuccess = () => {
      for (const pago of req.result) {
        if (pago.synced) store.delete(pago.id)
      }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Data cache (for offline reads) ─────────────────────────

export async function guardarEnCache(key, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readwrite')
    const store = tx.objectStore(STORE_CACHE)
    store.put({ key, data, updatedAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function leerDeCache(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CACHE, 'readonly')
    const store = tx.objectStore(STORE_CACHE)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result?.data ?? null)
    req.onerror   = () => reject(req.error)
  })
}

// ─── Sync manager ───────────────────────────────────────────

let syncing = false
let syncingStartedAt = 0
const SYNC_LOCK_KEY = 'cf-sync-lock'
const SYNC_LOCK_TTL = 30_000 // 30s
const SYNC_IN_MEMORY_TTL = 60_000 // 60s — si lleva más, asumir colgado
const FETCH_TIMEOUT_MS = 20_000 // 20s por request
const MAX_INTENTOS = 5 // Tras 5 intentos fallidos de red, marcar permanente

// Fetch con timeout — AbortController aborta si tarda más que ms
function fetchConTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(timer))
}

// Lock cross-tab usando localStorage (previene syncs concurrentes en múltiples tabs)
function adquirirLockSync() {
  try {
    const ahora = Date.now()
    const lock = localStorage.getItem(SYNC_LOCK_KEY)
    if (lock) {
      const lockTime = parseInt(lock, 10)
      if (!isNaN(lockTime) && ahora - lockTime < SYNC_LOCK_TTL) return false
    }
    localStorage.setItem(SYNC_LOCK_KEY, String(ahora))
    return true
  } catch { return true }
}

function liberarLockSync() {
  try { localStorage.removeItem(SYNC_LOCK_KEY) } catch {}
}

export async function sincronizarPagos() {
  // Auto-liberar si el flag lleva demasiado tiempo (sincro colgada)
  if (syncing && Date.now() - syncingStartedAt > SYNC_IN_MEMORY_TTL) {
    syncing = false
  }
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 }
  if (!adquirirLockSync()) return { synced: 0, failed: 0 }
  syncing = true
  syncingStartedAt = Date.now()

  try {

  const pendientes = await obtenerPagosPendientes()
  let synced = 0
  let failed = 0

  for (const pago of pendientes) {
    try {
      const res = await fetchConTimeout(`/api/prestamos/${pago.prestamoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPagado: pago.montoPagado,
          tipo:        pago.tipo,
          nota:        pago.nota ? `${pago.nota} [offline: ${pago.createdAt}]` : `[offline: ${pago.createdAt}]`,
          diasAbonados: pago.diasAbonados,
          metodoPago:  pago.metodoPago,
          plataforma:  pago.plataforma,
        }),
      })
      if (res.ok) {
        await marcarPagoSincronizado(pago.id)
        synced++
      } else if (res.status >= 400 && res.status < 500) {
        // Error del cliente (préstamo completado, no existe, validación) — marcar permanente
        let errorMsg = `HTTP ${res.status}`
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch {}
        await marcarPagoFallidoPermanente(pago.id, errorMsg)
        failed++
      } else {
        // 5xx — reintento temporal
        await incrementarIntentoFallido(pago.id)
        if ((pago.intentos || 0) + 1 >= MAX_INTENTOS) {
          await marcarPagoFallidoPermanente(pago.id, `Fallaron ${MAX_INTENTOS} intentos`)
        }
        failed++
      }
    } catch {
      // Error de red — reintento
      await incrementarIntentoFallido(pago.id)
      failed++
    }
  }

  // Clean up synced entries
  if (synced > 0) await eliminarPagosSincronizados()

  return { synced, failed, total: pendientes.length }
  } finally {
    syncing = false
    syncingStartedAt = 0
    liberarLockSync()
  }
}

// ─── Limpieza total (para logout) ──────────────────────────
// Borra TODA la base IndexedDB offline. Previene fuga de datos entre
// sesiones cuando dos cobradores comparten el mismo dispositivo.
export async function limpiarDatosOffline() {
  try {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror   = () => resolve()
      req.onblocked = () => resolve()
    })
  } catch {}
  try { localStorage.removeItem(SYNC_LOCK_KEY) } catch {}
}

// ─── Pending route order queue ──────────────────────────────

export async function guardarOrdenPendiente(rutaId, clienteIds) {
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDENES, 'readwrite')
    const store = tx.objectStore(STORE_ORDENES)
    // Delete any previous pending order for this route (only latest matters)
    const req = store.getAll()
    req.onsuccess = () => {
      for (const entry of req.result) {
        if (entry.rutaId === rutaId) store.delete(entry.id)
      }
      store.add({ rutaId, clienteIds, createdAt: new Date().toISOString() })
    }
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })

  // Also update the offline read cache so reloads show the new order
  try {
    const ruta = await leerDeCache(`sync:ruta:${rutaId}`)
    if (ruta && ruta.clientes) {
      const clienteMap = new Map(ruta.clientes.map((c) => [c.id, c]))
      const reordered = clienteIds.map((cid) => clienteMap.get(cid)).filter(Boolean)
      // Add any clients not in clienteIds at the end (safety)
      for (const c of ruta.clientes) {
        if (!clienteIds.includes(c.id)) reordered.push(c)
      }
      ruta.clientes = reordered
      await guardarEnCache(`sync:ruta:${rutaId}`, ruta)
    }
  } catch { /* best-effort cache update */ }

  registrarBackgroundSync()
}

let syncingOrdenes = false
let syncingOrdenesStartedAt = 0
const SYNC_ORDENES_LOCK_KEY = 'cf-sync-ordenes-lock'

function adquirirLockOrdenes() {
  try {
    const ahora = Date.now()
    const lock = localStorage.getItem(SYNC_ORDENES_LOCK_KEY)
    if (lock) {
      const lockTime = parseInt(lock, 10)
      if (!isNaN(lockTime) && ahora - lockTime < SYNC_LOCK_TTL) return false
    }
    localStorage.setItem(SYNC_ORDENES_LOCK_KEY, String(ahora))
    return true
  } catch { return true }
}

function liberarLockOrdenes() {
  try { localStorage.removeItem(SYNC_ORDENES_LOCK_KEY) } catch {}
}

export async function sincronizarOrdenes() {
  if (syncingOrdenes && Date.now() - syncingOrdenesStartedAt > SYNC_IN_MEMORY_TTL) {
    syncingOrdenes = false
  }
  if (syncingOrdenes || !navigator.onLine) return { synced: 0, failed: 0 }
  if (!adquirirLockOrdenes()) return { synced: 0, failed: 0 }
  syncingOrdenes = true
  syncingOrdenesStartedAt = Date.now()
  try {
  const db = await openDB()
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ORDENES, 'readonly')
    const req = tx.objectStore(STORE_ORDENES).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  let synced = 0, failed = 0
  for (const entry of entries) {
    try {
      const res = await fetchConTimeout(`/api/rutas/${entry.rutaId}/reordenar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIds: entry.clienteIds }),
      })
      if (res.ok) {
        const delDb = await openDB()
        await new Promise((resolve) => {
          const tx = delDb.transaction(STORE_ORDENES, 'readwrite')
          tx.objectStore(STORE_ORDENES).delete(entry.id)
          tx.oncomplete = () => resolve()
        })
        synced++
      } else { failed++ }
    } catch { failed++ }
  }
  return { synced, failed }
  } finally {
    syncingOrdenes = false
    syncingOrdenesStartedAt = 0
    liberarLockOrdenes()
  }
}

// ─── Offline creation queue: clientes + prestamos ───────────
// Temp IDs permiten crear préstamo offline referenciando un cliente también
// creado offline; al sincronizar, reemplazamos temp → real ID.

export function generarTempId(prefijo = 'offline') {
  return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function esTempId(id) {
  return typeof id === 'string' && id.startsWith('offline-')
}

// Resolver un tempId a su ID real (si ya se sincronizó). Retorna null si no.
export async function resolverTempId(tempId) {
  if (!esTempId(tempId)) return null
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_ID_MAP, 'readonly')
    const req = tx.objectStore(STORE_ID_MAP).get(tempId)
    req.onsuccess = () => resolve(req.result?.realId ?? null)
    req.onerror   = () => resolve(null)
  })
}

async function mapaIdSet(tempId, realId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ID_MAP, 'readwrite')
    tx.objectStore(STORE_ID_MAP).put({ tempId, realId, createdAt: new Date().toISOString() })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

async function mapaIdGet(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ID_MAP, 'readonly')
    const req = tx.objectStore(STORE_ID_MAP).get(tempId)
    req.onsuccess = () => resolve(req.result?.realId ?? null)
    req.onerror   = () => reject(req.error)
  })
}

// ─ CLIENTES pendientes ─

export async function guardarClientePendiente(cliente) {
  const tempId = generarTempId('offline-cliente')
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readwrite')
    tx.objectStore(STORE_CLIENTES).add({
      tempId,
      payload: cliente,
      createdAt: new Date().toISOString(),
      synced: false,
      intentos: 0,
    })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })

  // Cache optimista: inyectar en sync:clientes y sync:cliente:<tempId>
  try {
    const lista = (await leerDeCache('sync:clientes')) || []
    const nuevo = {
      id: tempId,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      direccion: cliente.direccion || null,
      referencia: cliente.referencia || null,
      notas: cliente.notas || null,
      rutaId: cliente.rutaId || null,
      grupoCobroId: cliente.grupoCobroId || null,
      latitud: cliente.latitud ?? null,
      longitud: cliente.longitud ?? null,
      prestamos: [],
      offline: true,
    }
    await guardarEnCache('sync:clientes', [nuevo, ...lista])
    await guardarEnCache(`sync:cliente:${tempId}`, nuevo)
  } catch {}

  registrarBackgroundSync()
  return tempId
}

export async function obtenerClientesPendientes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readonly')
    const req = tx.objectStore(STORE_CLIENTES).getAll()
    req.onsuccess = () => resolve(req.result.filter(c => !c.synced && !c.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

async function marcarClienteSincronizado(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readwrite')
    const store = tx.objectStore(STORE_CLIENTES)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const c = req.result
      if (c) { c.synced = true; store.put(c) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function marcarClienteFalloPermanente(tempId, errorMsg) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readwrite')
    const store = tx.objectStore(STORE_CLIENTES)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const c = req.result
      if (c) { c.failedPermanent = true; c.errorMsg = errorMsg || 'Error'; store.put(c) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function incrementarIntentoCliente(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readwrite')
    const store = tx.objectStore(STORE_CLIENTES)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const c = req.result
      if (c) { c.intentos = (c.intentos || 0) + 1; store.put(c) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

export async function obtenerClientesFallidos() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readonly')
    const req = tx.objectStore(STORE_CLIENTES).getAll()
    req.onsuccess = () => resolve(req.result.filter(c => c.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

export async function eliminarClienteFallido(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIENTES, 'readwrite')
    tx.objectStore(STORE_CLIENTES).delete(tempId)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

// ─ PRESTAMOS pendientes ─

export async function guardarPrestamoPendiente(prestamo) {
  const tempId = generarTempId('offline-prestamo')
  const db = await openDB()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readwrite')
    tx.objectStore(STORE_PRESTAMOS).add({
      tempId,
      payload: prestamo, // puede tener clienteId = tempId de cliente offline
      createdAt: new Date().toISOString(),
      synced: false,
      intentos: 0,
    })
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })

  // Cache optimista
  try {
    const cuota = Number(prestamo.cuotaManual) || Math.round(
      (Number(prestamo.montoPrestado) * (1 + Number(prestamo.tasaInteres || 0) / 100 * (Number(prestamo.diasPlazo) / 30))) /
      Math.max(1, Number(prestamo.diasPlazo))
    )
    const totalAPagar = Math.round(
      Number(prestamo.montoPrestado) * (1 + Number(prestamo.tasaInteres || 0) / 100 * (Number(prestamo.diasPlazo) / 30))
    )
    const nuevo = {
      id: tempId,
      clienteId: prestamo.clienteId,
      montoPrestado: Number(prestamo.montoPrestado),
      tasaInteres: Number(prestamo.tasaInteres || 0),
      diasPlazo: Number(prestamo.diasPlazo),
      fechaInicio: prestamo.fechaInicio,
      frecuencia: prestamo.frecuencia || 'diario',
      totalAPagar,
      totalPagado: Number(prestamo.yaAbonado) || 0,
      saldoPendiente: Math.max(0, totalAPagar - (Number(prestamo.yaAbonado) || 0)),
      cuotaDiaria: cuota,
      estado: 'activo',
      pagos: [],
      offline: true,
    }
    await guardarEnCache(`sync:prestamo:${tempId}`, nuevo)

    // Agregar al cliente (sync:cliente:<clienteId>)
    const cliente = await leerDeCache(`sync:cliente:${prestamo.clienteId}`)
    if (cliente) {
      cliente.prestamos = [nuevo, ...(cliente.prestamos || [])]
      await guardarEnCache(`sync:cliente:${prestamo.clienteId}`, cliente)
      // Propagar también a sync:clientes
      const lista = (await leerDeCache('sync:clientes')) || []
      const idx = lista.findIndex(c => c.id === prestamo.clienteId)
      if (idx >= 0) {
        lista[idx] = cliente
        await guardarEnCache('sync:clientes', lista)
      }
    }
  } catch {}

  registrarBackgroundSync()
  return tempId
}

export async function obtenerPrestamosPendientes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readonly')
    const req = tx.objectStore(STORE_PRESTAMOS).getAll()
    req.onsuccess = () => resolve(req.result.filter(p => !p.synced && !p.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

export async function obtenerPrestamosFallidos() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readonly')
    const req = tx.objectStore(STORE_PRESTAMOS).getAll()
    req.onsuccess = () => resolve(req.result.filter(p => p.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

export async function eliminarPrestamoFallido(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readwrite')
    tx.objectStore(STORE_PRESTAMOS).delete(tempId)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

async function marcarPrestamoCreadoSincronizado(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readwrite')
    const store = tx.objectStore(STORE_PRESTAMOS)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const p = req.result
      if (p) { p.synced = true; store.put(p) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function marcarPrestamoCreadoFalloPermanente(tempId, errorMsg) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readwrite')
    const store = tx.objectStore(STORE_PRESTAMOS)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const p = req.result
      if (p) { p.failedPermanent = true; p.errorMsg = errorMsg || 'Error'; store.put(p) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function incrementarIntentoPrestamo(tempId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRESTAMOS, 'readwrite')
    const store = tx.objectStore(STORE_PRESTAMOS)
    const req = store.get(tempId)
    req.onsuccess = () => {
      const p = req.result
      if (p) { p.intentos = (p.intentos || 0) + 1; store.put(p) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

// ─ Sync coordinator: clientes primero, luego prestamos ─

let syncingCreaciones = false
let syncingCreacionesStartedAt = 0
const SYNC_CREACIONES_LOCK_KEY = 'cf-sync-creaciones-lock'

function adquirirLockCreaciones() {
  try {
    const ahora = Date.now()
    const lock = localStorage.getItem(SYNC_CREACIONES_LOCK_KEY)
    if (lock) {
      const lockTime = parseInt(lock, 10)
      if (!isNaN(lockTime) && ahora - lockTime < SYNC_LOCK_TTL) return false
    }
    localStorage.setItem(SYNC_CREACIONES_LOCK_KEY, String(ahora))
    return true
  } catch { return true }
}

function liberarLockCreaciones() {
  try { localStorage.removeItem(SYNC_CREACIONES_LOCK_KEY) } catch {}
}

// ─ MUTACIONES pendientes (updates a entidades existentes) ─
// Tipos soportados: 'cliente.update', 'prestamo.update', 'prestamo.cerrar'

let syncingMutaciones = false
let syncingMutacionesStartedAt = 0
const SYNC_MUTACIONES_LOCK_KEY = 'cf-sync-mutaciones-lock'

function adquirirLockMutaciones() {
  try {
    const ahora = Date.now()
    const lock = localStorage.getItem(SYNC_MUTACIONES_LOCK_KEY)
    if (lock) {
      const lockTime = parseInt(lock, 10)
      if (!isNaN(lockTime) && ahora - lockTime < SYNC_LOCK_TTL) return false
    }
    localStorage.setItem(SYNC_MUTACIONES_LOCK_KEY, String(ahora))
    return true
  } catch { return true }
}

function liberarLockMutaciones() {
  try { localStorage.removeItem(SYNC_MUTACIONES_LOCK_KEY) } catch {}
}

// Aplicar optimistic update al cache local segun tipo de mutacion
async function aplicarMutacionOptimista(tipo, entityId, payload) {
  try {
    if (tipo === 'cliente.update') {
      const cliente = await leerDeCache(`sync:cliente:${entityId}`)
      if (cliente) {
        const merged = { ...cliente, ...payload, id: cliente.id }
        await guardarEnCache(`sync:cliente:${entityId}`, merged)
      }
      const lista = (await leerDeCache('sync:clientes')) || []
      const idx = lista.findIndex(c => c.id === entityId)
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...payload, id: lista[idx].id }
        await guardarEnCache('sync:clientes', lista)
      }
    } else if (tipo === 'prestamo.update' || tipo === 'prestamo.cerrar') {
      const prestamo = await leerDeCache(`sync:prestamo:${entityId}`)
      const patch = tipo === 'prestamo.cerrar'
        ? { estado: payload.estado || 'completado' }
        : payload
      if (prestamo) {
        const merged = { ...prestamo, ...patch, id: prestamo.id }
        await guardarEnCache(`sync:prestamo:${entityId}`, merged)
      }
      const lista = (await leerDeCache('sync:prestamos')) || []
      const idx = lista.findIndex(p => p.id === entityId)
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...patch, id: lista[idx].id }
        await guardarEnCache('sync:prestamos', lista)
      }
      // Actualizar tambien dentro del cliente padre si existe
      if (prestamo?.clienteId) {
        const cli = await leerDeCache(`sync:cliente:${prestamo.clienteId}`)
        if (cli?.prestamos) {
          const pidx = cli.prestamos.findIndex(pp => pp.id === entityId)
          if (pidx >= 0) {
            cli.prestamos[pidx] = { ...cli.prestamos[pidx], ...patch }
            await guardarEnCache(`sync:cliente:${prestamo.clienteId}`, cli)
          }
        }
      }
    }
  } catch {}
}

export async function encolarMutacion({ tipo, entityId, payload, baseUpdatedAt }) {
  if (!tipo || !entityId) throw new Error('tipo y entityId son requeridos')
  const db = await openDB()

  // Si no viene baseUpdatedAt, intentar leerlo del cache local para detectar
  // conflictos si otro dispositivo edito la misma entidad antes de sincronizar.
  let baseAt = baseUpdatedAt || null
  if (!baseAt) {
    try {
      if (tipo === 'cliente.update') {
        const c = await leerDeCache(`sync:cliente:${entityId}`)
        baseAt = c?.updatedAt || null
      } else if (tipo === 'prestamo.update' || tipo === 'prestamo.cerrar') {
        const p = await leerDeCache(`sync:prestamo:${entityId}`)
        baseAt = p?.updatedAt || null
      }
    } catch {}
  }

  // Coalescer: si existe una mutacion pendiente no-synced del mismo tipo para
  // el mismo entityId, hacer merge del payload en lugar de crear una nueva.
  // Esto evita acumular ruido cuando el usuario edita varias veces antes de volver online.
  const existente = await new Promise((resolve) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readonly')
    const req = tx.objectStore(STORE_MUTACIONES).getAll()
    req.onsuccess = () => {
      const m = (req.result || []).find(x =>
        !x.synced && !x.failedPermanent && x.tipo === tipo && x.entityId === entityId
      )
      resolve(m || null)
    }
    req.onerror = () => resolve(null)
  })

  if (existente) {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
      const store = tx.objectStore(STORE_MUTACIONES)
      existente.payload = { ...existente.payload, ...payload }
      existente.intentos = 0
      delete existente.error
      store.put(existente)
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
    })
    await aplicarMutacionOptimista(tipo, entityId, payload)
    registrarBackgroundSync()
    return existente.id
  }

  const record = {
    tipo,
    entityId,
    payload,
    baseUpdatedAt: baseAt,
    dependsOnTempId: esTempId(entityId) ? entityId : null,
    createdAt: new Date().toISOString(),
    intentos: 0,
    synced: false,
  }

  const id = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
    const req = tx.objectStore(STORE_MUTACIONES).add(record)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })

  await aplicarMutacionOptimista(tipo, entityId, payload)
  registrarBackgroundSync()
  return id
}

export async function obtenerMutacionesPendientes() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readonly')
    const req = tx.objectStore(STORE_MUTACIONES).getAll()
    req.onsuccess = () => resolve(
      (req.result || [])
        .filter(m => !m.synced && !m.failedPermanent)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    )
    req.onerror   = () => reject(req.error)
  })
}

export async function obtenerMutacionesFallidas() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readonly')
    const req = tx.objectStore(STORE_MUTACIONES).getAll()
    req.onsuccess = () => resolve((req.result || []).filter(m => m.failedPermanent))
    req.onerror   = () => reject(req.error)
  })
}

export async function eliminarMutacion(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
    tx.objectStore(STORE_MUTACIONES).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

export async function reintentarMutacion(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
    const store = tx.objectStore(STORE_MUTACIONES)
    const req = store.get(id)
    req.onsuccess = () => {
      const m = req.result
      if (m) {
        m.intentos = 0
        m.failedPermanent = false
        delete m.error
        store.put(m)
      }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function actualizarMutacion(id, patch) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
    const store = tx.objectStore(STORE_MUTACIONES)
    const req = store.get(id)
    req.onsuccess = () => {
      const m = req.result
      if (m) { Object.assign(m, patch); store.put(m) }
      tx.oncomplete = () => resolve()
    }
    tx.onerror = () => reject(tx.error)
  })
}

async function purgarMutacionesSincronizadas() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_MUTACIONES, 'readwrite')
    const store = tx.objectStore(STORE_MUTACIONES)
    const req = store.getAll()
    const LIMITE_DIAS_FALLIDAS = 30 * 24 * 60 * 60 * 1000
    req.onsuccess = () => {
      const ahora = Date.now()
      for (const m of (req.result || [])) {
        if (m.synced) { store.delete(m.id); continue }
        if (m.failedPermanent && m.createdAt) {
          const age = ahora - new Date(m.createdAt).getTime()
          if (age > LIMITE_DIAS_FALLIDAS) store.delete(m.id)
        }
      }
      tx.oncomplete = () => resolve()
    }
    req.onerror = () => resolve()
  })
}

export async function sincronizarMutaciones() {
  if (syncingMutaciones && Date.now() - syncingMutacionesStartedAt > SYNC_IN_MEMORY_TTL) {
    syncingMutaciones = false
  }
  if (syncingMutaciones || !navigator.onLine) return { synced: 0, failed: 0 }
  if (!adquirirLockMutaciones()) return { synced: 0, failed: 0 }
  syncingMutaciones = true
  syncingMutacionesStartedAt = Date.now()

  let synced = 0, failed = 0
  try {
    const pendientes = await obtenerMutacionesPendientes()
    for (const m of pendientes) {
      try {
        // Resolver entityId si apunta a un tempId
        let realId = m.entityId
        if (esTempId(realId)) {
          const mapped = await mapaIdGet(realId)
          if (!mapped) {
            // Padre aun no creado: esperar siguiente ronda
            failed++
            continue
          }
          realId = mapped
        }

        let url = ''
        let body = m.payload
        if (m.tipo === 'cliente.update') {
          url = `/api/clientes/${realId}`
        } else if (m.tipo === 'prestamo.update') {
          url = `/api/prestamos/${realId}`
        } else if (m.tipo === 'prestamo.cerrar') {
          url = `/api/prestamos/${realId}`
          body = { estado: m.payload?.estado || 'completado' }
        } else {
          await actualizarMutacion(m.id, { failedPermanent: true, error: `Tipo desconocido: ${m.tipo}` })
          failed++
          continue
        }

        const headers = {
          'Content-Type': 'application/json',
          'X-Mutation-Id': String(m.id),
        }
        if (m.baseUpdatedAt) headers['X-If-Unmodified-Since'] = m.baseUpdatedAt

        const res = await fetchConTimeout(url, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        })

        if (res.ok) {
          await actualizarMutacion(m.id, { synced: true })
          synced++
        } else if (res.status === 412) {
          // Conflicto: la entidad fue modificada en el servidor despues de
          // que el usuario comenzo a editar offline. Marcar como fallido
          // permanente con mensaje claro para que decida manualmente.
          await actualizarMutacion(m.id, {
            failedPermanent: true,
            error: 'Conflicto: el registro fue modificado en el servidor. Revisa los cambios.',
          })
          failed++
        } else if (res.status === 404 || res.status === 409 || (res.status >= 400 && res.status < 500)) {
          let errorMsg = `HTTP ${res.status}`
          try { const d = await res.json(); errorMsg = d.error || errorMsg } catch {}
          await actualizarMutacion(m.id, { failedPermanent: true, error: errorMsg })
          failed++
        } else {
          const nuevoIntentos = (m.intentos || 0) + 1
          if (nuevoIntentos >= MAX_INTENTOS) {
            await actualizarMutacion(m.id, { failedPermanent: true, error: `Fallaron ${MAX_INTENTOS} intentos` })
          } else {
            await actualizarMutacion(m.id, { intentos: nuevoIntentos })
          }
          failed++
        }
      } catch {
        await actualizarMutacion(m.id, { intentos: (m.intentos || 0) + 1 })
        failed++
      }
    }
    await purgarMutacionesSincronizadas()
    return { synced, failed }
  } finally {
    syncingMutaciones = false
    syncingMutacionesStartedAt = 0
    liberarLockMutaciones()
  }
}

export async function sincronizarCreaciones() {
  if (syncingCreaciones && Date.now() - syncingCreacionesStartedAt > SYNC_IN_MEMORY_TTL) {
    syncingCreaciones = false
  }
  if (syncingCreaciones || !navigator.onLine) return { synced: 0, failed: 0 }
  if (!adquirirLockCreaciones()) return { synced: 0, failed: 0 }
  syncingCreaciones = true
  syncingCreacionesStartedAt = Date.now()

  let synced = 0, failed = 0
  try {
    // 1) Sincronizar clientes primero
    const clientesPend = await obtenerClientesPendientes()
    for (const c of clientesPend) {
      try {
        const res = await fetchConTimeout('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Offline-Temp-Id': c.tempId },
          body: JSON.stringify({ ...c.payload, offlineTempId: c.tempId }),
        })
        if (res.ok) {
          const data = await res.json()
          await mapaIdSet(c.tempId, data.id)
          await marcarClienteSincronizado(c.tempId)
          synced++
        } else if (res.status === 409) {
          // Cedula duplicada — intentar recuperar el cliente existente para mapear
          let errorMsg = 'Cédula ya registrada'
          try {
            const data = await res.json()
            errorMsg = data.error || errorMsg
            if (data.existingId) {
              await mapaIdSet(c.tempId, data.existingId)
              await marcarClienteSincronizado(c.tempId)
              synced++
              continue
            }
          } catch {}
          await marcarClienteFalloPermanente(c.tempId, errorMsg)
          failed++
        } else if (res.status >= 400 && res.status < 500) {
          let errorMsg = `HTTP ${res.status}`
          try { const data = await res.json(); errorMsg = data.error || errorMsg } catch {}
          await marcarClienteFalloPermanente(c.tempId, errorMsg)
          failed++
        } else {
          await incrementarIntentoCliente(c.tempId)
          if ((c.intentos || 0) + 1 >= MAX_INTENTOS) {
            await marcarClienteFalloPermanente(c.tempId, `Fallaron ${MAX_INTENTOS} intentos`)
          }
          failed++
        }
      } catch {
        await incrementarIntentoCliente(c.tempId)
        failed++
      }
    }

    // 2) Sincronizar prestamos — resolver clienteId temp → real
    const prestamosPend = await obtenerPrestamosPendientes()
    for (const p of prestamosPend) {
      try {
        let clienteIdReal = p.payload.clienteId
        if (esTempId(clienteIdReal)) {
          const mapped = await mapaIdGet(clienteIdReal)
          if (!mapped) {
            // Cliente padre aún no sincronizado — esperar siguiente ronda
            failed++
            continue
          }
          clienteIdReal = mapped
        }
        const res = await fetchConTimeout('/api/prestamos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Offline-Temp-Id': p.tempId },
          body: JSON.stringify({ ...p.payload, clienteId: clienteIdReal, offlineTempId: p.tempId }),
        })
        if (res.ok) {
          const data = await res.json()
          await mapaIdSet(p.tempId, data.id)
          await marcarPrestamoCreadoSincronizado(p.tempId)
          synced++
        } else if (res.status >= 400 && res.status < 500) {
          let errorMsg = `HTTP ${res.status}`
          try { const data = await res.json(); errorMsg = data.error || errorMsg } catch {}
          // Si es capital insuficiente (necesita inyección interactiva), no marcar permanente
          if (res.status === 400 && errorMsg.toLowerCase().includes('capital')) {
            await incrementarIntentoPrestamo(p.tempId)
            if ((p.intentos || 0) + 1 >= MAX_INTENTOS) {
              await marcarPrestamoCreadoFalloPermanente(p.tempId, errorMsg)
            }
            failed++
          } else {
            await marcarPrestamoCreadoFalloPermanente(p.tempId, errorMsg)
            failed++
          }
        } else {
          await incrementarIntentoPrestamo(p.tempId)
          if ((p.intentos || 0) + 1 >= MAX_INTENTOS) {
            await marcarPrestamoCreadoFalloPermanente(p.tempId, `Fallaron ${MAX_INTENTOS} intentos`)
          }
          failed++
        }
      } catch {
        await incrementarIntentoPrestamo(p.tempId)
        failed++
      }
    }

    // Tras crear entidades, procesar mutaciones que dependan de esos tempIds
    try {
      const mutRes = await sincronizarMutaciones()
      synced += mutRes.synced
      failed += mutRes.failed
    } catch {}

    return { synced, failed }
  } finally {
    syncingCreaciones = false
    syncingCreacionesStartedAt = 0
    liberarLockCreaciones()
  }
}

// ─── Auto-sync safety net (periodic) ──────────────────────
// OfflineProvider handles online/offline events and initial sync.
// This interval is a safety net for edge cases.

export function iniciarAutoSync() {
  if (typeof window === 'undefined') return

  setInterval(() => {
    if (navigator.onLine) {
      sincronizarPagos()
      sincronizarOrdenes()
      sincronizarCreaciones()
      sincronizarMutaciones()
    }
  }, 30000)
}

// ─── BULK SYNC: download everything for offline use ──────

export async function sincronizarTodo(onProgress) {
  onProgress?.({ step: 'downloading', message: 'Descargando datos...' })

  const res = await fetchConTimeout('/api/offline/sync', {}, 45_000) // 45s para payload grande
  if (!res.ok) throw new Error('Error al descargar datos')
  const data = await res.json()

  onProgress?.({ step: 'saving', message: 'Guardando en dispositivo...' })

  // Fix #7: guardar sync:meta PRIMERO — si el proceso se interrumpe a mitad,
  // al menos sabemos que hubo sync parcial y no pretendemos que no hay datos.
  await guardarEnCache('sync:meta', {
    syncedAt: data.syncedAt,
    totalClientes: data.clientes.length,
    totalPrestamos: data.clientes.reduce((s, c) => s + c.prestamos.length, 0),
    totalRutas: data.rutas.length,
  })

  // Store everything in IndexedDB
  const promises = []

  // Mergear: conservar clientes/préstamos offline pendientes (aún no sincronizados
  // al servidor) para que no "desaparezcan" durante el refresco de datos.
  let offlineClientesPend = []
  let offlinePrestamosPend = []
  try {
    offlineClientesPend = (await leerDeCache('sync:clientes') || []).filter(c => typeof c.id === 'string' && c.id.startsWith('offline-'))
  } catch {}

  // Store full clientes array (offline pendientes van al principio)
  promises.push(guardarEnCache('sync:clientes', [...offlineClientesPend, ...data.clientes]))

  // Store each cliente individually (for detail pages)
  for (const c of data.clientes) {
    promises.push(guardarEnCache(`sync:cliente:${c.id}`, c))
    // Store each prestamo individually too
    for (const p of c.prestamos) {
      promises.push(guardarEnCache(`sync:prestamo:${p.id}`, { ...p, cliente: { id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono, rutaId: c.rutaId || c.ruta?.id } }))
    }
  }
  // Conservar prestamos offline pendientes (pueden colgar de cliente offline o real)
  for (const cOff of offlineClientesPend) {
    for (const p of (cOff.prestamos || [])) {
      if (typeof p.id === 'string' && p.id.startsWith('offline-')) {
        offlinePrestamosPend.push(p.id)
      }
    }
  }

  // Store rutas
  promises.push(guardarEnCache('sync:rutas', data.rutas))
  for (const r of data.rutas) {
    promises.push(guardarEnCache(`sync:ruta:${r.id}`, r))
  }

  // Store dashboard
  promises.push(guardarEnCache('sync:dashboard', data.dashboard))

  // Store caja data
  if (data.caja) {
    promises.push(guardarEnCache('sync:caja', data.caja))
  }

  await Promise.all(promises)

  // Replay: re-aplicar mutaciones pendientes sobre cache recien descargado.
  // El servidor puede no haber persistido aun la mutacion (o la respuesta 5xx nos hizo
  // reintentar), y sin esto el usuario veria "revertidos" sus cambios offline.
  try {
    const pendientes = await obtenerMutacionesPendientes()
    for (const m of pendientes) {
      await aplicarMutacionOptimista(m.tipo, m.entityId, m.payload)
    }
  } catch {}

  // Pre-cache page HTML in Service Worker so navigation works offline
  onProgress?.({ step: 'caching', message: 'Preparando paginas...' })
  try {
    const pagesToCache = [
      '/dashboard',
      '/clientes',
      '/prestamos',
      '/caja',
      '/rutas',
    ]
    // Add individual client, prestamo and ruta pages
    for (const c of data.clientes) {
      pagesToCache.push(`/clientes/${c.id}`)
      for (const p of c.prestamos) {
        pagesToCache.push(`/prestamos/${p.id}`)
      }
    }
    for (const r of data.rutas) {
      pagesToCache.push(`/rutas/${r.id}`)
    }
    // Tell the SW to fetch and cache these pages
    const sw = navigator.serviceWorker?.controller
    if (sw) {
      sw.postMessage({ type: 'CACHE_PAGES', urls: pagesToCache })
    }
  } catch {}

  onProgress?.({ step: 'done', message: 'Listo para trabajar sin internet' })

  return {
    clientes: data.clientes.length,
    prestamos: data.clientes.reduce((s, c) => s + c.prestamos.length, 0),
    rutas: data.rutas.length,
    syncedAt: data.syncedAt,
  }
}

// ─── Read synced data from IndexedDB ─────────────────────

export async function obtenerSyncMeta() {
  return leerDeCache('sync:meta')
}

export async function obtenerClientesOffline() {
  return (await leerDeCache('sync:clientes')) || []
}

export async function obtenerClienteOffline(id) {
  return leerDeCache(`sync:cliente:${id}`)
}

export async function obtenerPrestamosOffline() {
  const clientes = await obtenerClientesOffline()
  return clientes.flatMap((c) =>
    c.prestamos.map((p) => ({
      ...p,
      cliente: { id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono },
    }))
  )
}

export async function obtenerPrestamoOffline(id) {
  return leerDeCache(`sync:prestamo:${id}`)
}

export async function obtenerRutasOffline() {
  return (await leerDeCache('sync:rutas')) || []
}

export async function obtenerRutaOffline(id) {
  return leerDeCache(`sync:ruta:${id}`)
}

export async function obtenerDashboardOffline() {
  return leerDeCache('sync:dashboard')
}

// ─── Writeback: update offline data after registering a payment ───

export async function actualizarPrestamoOffline(prestamoId, pagoData) {
  try {
    // Update individual prestamo cache
    const prestamo = await leerDeCache(`sync:prestamo:${prestamoId}`)
    // Fix #8: si no hay prestamo en cache, no hay nada que actualizar — evita crashes
    // al tocar prestamo.cliente.id en el bloque de writeback del cliente/ruta.
    if (!prestamo) return
    {
      const monto = pagoData.montoPagado || 0
      const tipo = pagoData.tipo || 'completo'

      // Aplicar efectos según tipo — recargo/descuento modifican totalAPagar, no totalPagado
      if (tipo === 'recargo') {
        prestamo.totalAPagar = (prestamo.totalAPagar || 0) + monto
      } else if (tipo === 'descuento') {
        prestamo.totalAPagar = Math.max(prestamo.totalPagado || 0, (prestamo.totalAPagar || 0) - monto)
      } else {
        // completo, parcial, capital: cuentan como pago real
        prestamo.totalPagado = (prestamo.totalPagado || 0) + monto
        // capital además reduce totalAPagar por el ahorro proporcional de intereses
        if (tipo === 'capital' && Number(prestamo.tasaInteres) > 0 && Number(prestamo.diasPlazo) > 0 && prestamo.fechaInicio) {
          const inicio = new Date(prestamo.fechaInicio)
          const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000)
          if (!isNaN(inicio.getTime())) {
            const diasTrans = Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
            const diasRest = Math.max(0, Number(prestamo.diasPlazo) - diasTrans)
            const ahorro = Math.round(monto * (Number(prestamo.tasaInteres) / 100) * (diasRest / 30))
            if (!isNaN(ahorro) && ahorro >= 0) {
              prestamo.totalAPagar = Math.max(prestamo.totalPagado, (prestamo.totalAPagar || 0) - ahorro)
            }
          }
        }
      }

      prestamo.saldoPendiente = Math.max(0, (prestamo.totalAPagar || 0) - (prestamo.totalPagado || 0))
      prestamo.porcentajePagado = prestamo.totalAPagar > 0
        ? Math.round((prestamo.totalPagado / prestamo.totalAPagar) * 100)
        : 0
      // Solo marcar pagoHoy si no fue un ajuste
      if (!['recargo', 'descuento'].includes(tipo)) prestamo.pagoHoy = true
      if (!prestamo.pagos) prestamo.pagos = []
      prestamo.pagos.unshift({
        id: `offline-${Date.now()}`,
        montoPagado: monto,
        tipo,
        nota: pagoData.nota || '',
        fechaPago: new Date().toISOString(),
        offline: true,
      })
      if (prestamo.saldoPendiente <= 0) prestamo.estado = 'completado'
      await guardarEnCache(`sync:prestamo:${prestamoId}`, prestamo)
    }

    // Update the parent cliente cache
    const clienteId = prestamo?.cliente?.id
    if (clienteId) {
      const cliente = await leerDeCache(`sync:cliente:${clienteId}`)
      if (cliente && cliente.prestamos) {
        const idx = cliente.prestamos.findIndex((p) => p.id === prestamoId)
        if (idx >= 0 && prestamo) {
          const { pagos, cliente: _, ...prestamoSinPagos } = prestamo
          cliente.prestamos[idx] = { ...cliente.prestamos[idx], ...prestamoSinPagos }
        }
        await guardarEnCache(`sync:cliente:${clienteId}`, cliente)
      }

      // Update ruta cache so recaudadoHoy and pagoHoy reflect the payment
      const rutaId = cliente?.rutaId || cliente?.ruta?.id
      if (rutaId) {
        const rutaData = await leerDeCache(`sync:ruta:${rutaId}`)
        if (rutaData) {
          const monto = pagoData.montoPagado || 0
          rutaData.recaudadoHoy = (rutaData.recaudadoHoy || 0) + monto
          const clienteEnRuta = rutaData.clientes?.find(c => c.id === clienteId)
          if (clienteEnRuta && !clienteEnRuta.pagoHoy) {
            clienteEnRuta.pagoHoy = true
            if (rutaData.pendientesHoy > 0) rutaData.pendientesHoy--
          }
          // Update cartera
          rutaData.carteraTotal = Math.max(0, (rutaData.carteraTotal || 0) - monto)
          await guardarEnCache(`sync:ruta:${rutaId}`, rutaData)

          // Update rutas list too
          const rutasList = await leerDeCache('sync:rutas')
          if (rutasList) {
            const rIdx = rutasList.findIndex(r => r.id === rutaId)
            if (rIdx >= 0) {
              rutasList[rIdx].recaudadoHoy = rutaData.recaudadoHoy
              await guardarEnCache('sync:rutas', rutasList)
            }
          }
        }
      }
    }
  } catch {
    // Best-effort writeback — don't crash if it fails
  }
}
