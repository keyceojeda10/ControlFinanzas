// lib/offline.js — IndexedDB offline queue + sync manager
// Stores pending payments when offline, syncs when back online

const DB_NAME    = 'cf-offline'
const DB_VERSION = 1
const STORE_PAGOS   = 'pagos_pendientes'
const STORE_CACHE   = 'data_cache'

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
    req.onsuccess = () => resolve(req.result.filter((p) => !p.synced))
    req.onerror   = () => reject(req.error)
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

export async function sincronizarPagos() {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 }
  syncing = true

  const pendientes = await obtenerPagosPendientes()
  let synced = 0
  let failed = 0

  for (const pago of pendientes) {
    try {
      const res = await fetch(`/api/prestamos/${pago.prestamoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPagado: pago.montoPagado,
          tipo:        pago.tipo,
          nota:        pago.nota ? `${pago.nota} [offline: ${pago.createdAt}]` : `[offline: ${pago.createdAt}]`,
          diasAbonados: pago.diasAbonados,
        }),
      })
      if (res.ok) {
        await marcarPagoSincronizado(pago.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  // Clean up synced entries
  if (synced > 0) await eliminarPagosSincronizados()

  syncing = false
  return { synced, failed, total: pendientes.length }
}

// ─── Auto-sync safety net (periodic) ──────────────────────
// OfflineProvider handles online/offline events and initial sync.
// This interval is a safety net for edge cases.

export function iniciarAutoSync() {
  if (typeof window === 'undefined') return

  setInterval(() => {
    if (navigator.onLine) sincronizarPagos()
  }, 30000)
}

// ─── BULK SYNC: download everything for offline use ──────

export async function sincronizarTodo(onProgress) {
  onProgress?.({ step: 'downloading', message: 'Descargando datos...' })

  const res = await fetch('/api/offline/sync')
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
      prestamo.totalPagado = (prestamo.totalPagado || 0) + monto
      prestamo.saldoPendiente = Math.max(0, (prestamo.saldoPendiente || 0) - monto)
      prestamo.porcentajePagado = prestamo.totalAPagar > 0
        ? Math.round((prestamo.totalPagado / prestamo.totalAPagar) * 100)
        : 0
      prestamo.pagoHoy = true
      if (!prestamo.pagos) prestamo.pagos = []
      prestamo.pagos.unshift({
        id: `offline-${Date.now()}`,
        montoPagado: monto,
        tipo: pagoData.tipo || 'completo',
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
    }
  } catch {
    // Best-effort writeback — don't crash if it fails
  }
}
