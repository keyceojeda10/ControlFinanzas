// lib/offline.js — IndexedDB offline queue + sync manager
// Stores pending payments when offline, syncs when back online

const DB_NAME    = 'cf-offline'
const DB_VERSION = 2
const STORE_PAGOS    = 'pagos_pendientes'
const STORE_CACHE    = 'data_cache'
const STORE_ORDENES  = 'ordenes_pendientes'

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
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── Pending payments queue ─────────────────────────────────

export async function guardarPagoPendiente(pago) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
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

// ─── Auto-sync safety net (periodic) ──────────────────────
// OfflineProvider handles online/offline events and initial sync.
// This interval is a safety net for edge cases.

export function iniciarAutoSync() {
  if (typeof window === 'undefined') return

  setInterval(() => {
    if (navigator.onLine) {
      sincronizarPagos()
      sincronizarOrdenes()
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

  // Store everything in IndexedDB
  const promises = []

  // Store full clientes array (for list page)
  promises.push(guardarEnCache('sync:clientes', data.clientes))

  // Store each cliente individually (for detail pages)
  for (const c of data.clientes) {
    promises.push(guardarEnCache(`sync:cliente:${c.id}`, c))
    // Store each prestamo individually too
    for (const p of c.prestamos) {
      promises.push(guardarEnCache(`sync:prestamo:${p.id}`, { ...p, cliente: { id: c.id, nombre: c.nombre, cedula: c.cedula, telefono: c.telefono, rutaId: c.rutaId || c.ruta?.id } }))
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

  // Store sync metadata
  promises.push(guardarEnCache('sync:meta', {
    syncedAt: data.syncedAt,
    totalClientes: data.clientes.length,
    totalPrestamos: data.clientes.reduce((s, c) => s + c.prestamos.length, 0),
    totalRutas: data.rutas.length,
  }))

  await Promise.all(promises)

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
    if (prestamo) {
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
