'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { iniciarAutoSync, obtenerPagosPendientes, sincronizarPagos, sincronizarTodo, obtenerSyncMeta } from '@/lib/offline'

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, syncing: false, syncMeta: null, lastSyncedAt: 0 })

export function useOffline() {
  return useContext(OfflineContext)
}

const MUTATION_SYNC_DELAY = 3000 // 3s after a mutation

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncResult, setSyncResult]     = useState(null)
  const [syncMeta, setSyncMeta]         = useState(null)
  const [bulkSyncing, setBulkSyncing]   = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)
  // Counter that increments after every successful sync — pages watch this to refetch
  const [lastSyncedAt, setLastSyncedAt] = useState(0)
  const syncingRef = useRef(false)

  // Sync pending payments FIRST, then download fresh data
  const syncPendingThenFull = useCallback(async (silent = true) => {
    if (!navigator.onLine) return
    try {
      // STEP 1: Always sync pending payments to server FIRST
      const payResult = await sincronizarPagos()
      if (payResult.synced > 0) {
        setSyncResult(payResult)
        setTimeout(() => setSyncResult(null), 5000)
      }
    } catch { /* silent */ }

    // STEP 2: Now download fresh data from server (includes synced payments)
    if (syncingRef.current) return
    syncingRef.current = true
    if (!silent) setBulkSyncing(true)
    try {
      const result = await sincronizarTodo(() => {})
      setSyncMeta({
        syncedAt: result.syncedAt,
        totalClientes: result.clientes,
        totalPrestamos: result.prestamos,
        totalRutas: result.rutas,
      })
      // Signal all pages to refetch their data
      setLastSyncedAt(Date.now())
    } catch { /* silent */ }
    finally {
      syncingRef.current = false
      if (!silent) setBulkSyncing(false)
    }

    // STEP 3: Refresh pending count
    try {
      const pending = await obtenerPagosPendientes()
      setPendingCount(pending.length)
    } catch { /* ignore */ }
  }, [])

  // Track pending payments count (MUST be defined before useEffects that reference it)
  const refreshPending = useCallback(async () => {
    try {
      const pending = await obtenerPagosPendientes()
      setPendingCount(pending.length)
    } catch { /* ignore */ }
  }, [])

  // Track online/offline + re-sync when coming back online
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => {
      setIsOnline(true)
      setTimeout(() => syncPendingThenFull(false), 2000)
    }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [syncPendingThenFull])

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Start auto-sync safety net (30s interval)
  useEffect(() => {
    iniciarAutoSync()
  }, [])

  useEffect(() => {
    refreshPending()
    const interval = setInterval(refreshPending, 10000)
    return () => clearInterval(interval)
  }, [refreshPending])

  // Listen for sync trigger from payment pages
  useEffect(() => {
    const onPaymentQueued = () => refreshPending()
    window.addEventListener('paymentQueued', onPaymentQueued)
    return () => window.removeEventListener('paymentQueued', onPaymentQueued)
  }, [refreshPending])

  // ─── AUTO-SYNC: on mount, sync pending payments FIRST, then full data ───
  useEffect(() => {
    obtenerSyncMeta().then((meta) => { if (meta) setSyncMeta(meta) }).catch(() => {})

    // Sync 3s after app open — payments first, then full data
    const initialTimeout = setTimeout(() => syncPendingThenFull(false), 3000)

    return () => clearTimeout(initialTimeout)
  }, [syncPendingThenFull])

  // ─── MUTATION SYNC: detect POST/PUT/DELETE to /api/ and re-sync ───
  useEffect(() => {
    const originalFetch = window.fetch
    let mutationTimeout = null

    window.fetch = function (...args) {
      const result = originalFetch.apply(this, args)

      result.then((response) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
        const method = (args[1]?.method || 'GET').toUpperCase()

        // Only trigger sync for mutations to our API (not external, not GET)
        if (url.startsWith('/api/') && method !== 'GET' && response.ok) {
          // Debounce: if multiple mutations happen quickly, only sync once
          if (mutationTimeout) clearTimeout(mutationTimeout)
          mutationTimeout = setTimeout(() => syncPendingThenFull(true), MUTATION_SYNC_DELAY)
        }
      }).catch(() => {})

      return result
    }

    return () => {
      window.fetch = originalFetch
      if (mutationTimeout) clearTimeout(mutationTimeout)
    }
  }, [syncPendingThenFull])

  // ─── Offline navigation: force full-page loads when offline ───
  useEffect(() => {
    const DASHBOARD_ROUTES = ['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja', '/cobradores', '/reportes', '/configuracion']

    const isDashboardRoute = (pathname) =>
      DASHBOARD_ROUTES.some((r) => pathname.startsWith(r))

    const handleClick = (e) => {
      if (navigator.onLine) return

      let el = e.target
      while (el && el.tagName !== 'A') el = el.parentElement
      if (!el || !el.href) return

      const url = new URL(el.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (!isDashboardRoute(url.pathname)) return

      e.preventDefault()
      e.stopPropagation()
      window.location.href = url.pathname + url.search
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  const manualSync = async () => {
    if (!navigator.onLine) return
    await syncPendingThenFull(false)
  }

  // Bulk sync: download everything for offline (manual trigger)
  const startBulkSync = async () => {
    if (bulkSyncing || !navigator.onLine) return
    setBulkSyncing(true)
    setBulkProgress({ step: 'downloading', message: 'Descargando datos...' })
    try {
      const result = await sincronizarTodo((progress) => setBulkProgress(progress))
      setSyncMeta({ syncedAt: result.syncedAt, totalClientes: result.clientes, totalPrestamos: result.prestamos, totalRutas: result.rutas })
      setBulkProgress({ step: 'done', message: `${result.clientes} clientes, ${result.prestamos} prestamos sincronizados` })
      setTimeout(() => setBulkProgress(null), 4000)
    } catch {
      setBulkProgress({ step: 'error', message: 'Error al sincronizar. Intenta de nuevo.' })
      setTimeout(() => setBulkProgress(null), 4000)
    } finally {
      setBulkSyncing(false)
    }
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, refreshPending, manualSync, syncMeta, startBulkSync, bulkSyncing, bulkProgress, lastSyncedAt }}>
      {children}

      {/* Connection status banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#ef4444] text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Sin conexion — modo offline activo
        </div>
      )}
      {isOnline && bulkSyncing && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#22c55e] text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sincronizando datos...
        </div>
      )}

      {/* Pending payments indicator */}
      {pendingCount > 0 && isOnline && (
        <button
          onClick={manualSync}
          className="fixed top-2 right-2 z-[9998] bg-[rgba(245,197,24,0.95)] text-[#0a0a0a] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg"
        >
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {pendingCount} pago{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''}
        </button>
      )}

      {/* Sync result toast */}
      {syncResult && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-[#1a1a1a] border border-[#2a2a2a] text-white text-xs px-4 py-2.5 rounded-[12px] shadow-xl flex items-center gap-2">
          {syncResult.synced > 0 && (
            <span className="text-[#22c55e]">{syncResult.synced} pago{syncResult.synced > 1 ? 's' : ''} sincronizado{syncResult.synced > 1 ? 's' : ''}</span>
          )}
          {syncResult.failed > 0 && (
            <span className="text-[#ef4444]">{syncResult.failed} fallido{syncResult.failed > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

    </OfflineContext.Provider>
  )
}
