'use client'

import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react'
import { iniciarAutoSync, obtenerPagosPendientes, obtenerPagosFallidos, eliminarPagoFallido, sincronizarPagos, sincronizarOrdenes, sincronizarTodo, obtenerSyncMeta } from '@/lib/offline'

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, syncing: false, syncMeta: null, lastSyncedAt: 0 })

export function useOffline() {
  return useContext(OfflineContext)
}

const MUTATION_SYNC_DELAY = 3000 // 3s after a mutation
const MIN_AUTO_SYNC_GAP_MS = 20_000

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedPayments, setFailedPayments] = useState([])
  const [syncResult, setSyncResult]     = useState(null)
  const [syncMeta, setSyncMeta]         = useState(null)
  const [bulkSyncing, setBulkSyncing]   = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)
  // Counter that increments after every successful sync — pages watch this to refetch
  const [lastSyncedAt, setLastSyncedAt] = useState(0)
  const syncingRef = useRef(false)
  const syncingStartedAtRef = useRef(0)
  const lastAutoSyncAtRef = useRef(0)

  // Safety: liberar syncingRef si lleva demasiado tiempo (sincro colgada)
  const SYNCING_REF_TTL_MS = 75_000 // 75s — mas que timeout interno de sincronizarTodo
  const checkStaleLock = () => {
    if (syncingRef.current && Date.now() - syncingStartedAtRef.current > SYNCING_REF_TTL_MS) {
      syncingRef.current = false
      syncingStartedAtRef.current = 0
      setBulkSyncing(false)
      setBulkProgress(null)
    }
  }

  // Sync pending payments FIRST, then download fresh data.
  // By default we also notify pages so visible data stays up to date.
  const syncPendingThenFull = useCallback(async ({ silent = true, signalPages = true } = {}) => {
    if (!navigator.onLine) return
    try {
      // STEP 1: Sync pending payments AND pending orders to server FIRST
      const payResult = await sincronizarPagos()
      const ordResult = await sincronizarOrdenes()
      const totalSynced = payResult.synced + ordResult.synced
      const totalFailed = payResult.failed + ordResult.failed
      if (totalSynced > 0) {
        setSyncResult({ synced: totalSynced, failed: totalFailed })
        setTimeout(() => setSyncResult(null), 5000)
      }
    } catch { /* silent */ }

    // STEP 2: Now download fresh data from server (includes synced payments)
    checkStaleLock()
    if (syncingRef.current) return
    syncingRef.current = true
    syncingStartedAtRef.current = Date.now()
    if (!silent) setBulkSyncing(true)
    try {
      const result = await sincronizarTodo(silent ? () => {} : (p) => setBulkProgress(p))
      setSyncMeta({
        syncedAt: result.syncedAt,
        totalClientes: result.clientes,
        totalPrestamos: result.prestamos,
        totalRutas: result.rutas,
      })
      if (signalPages || totalSynced > 0) {
        setLastSyncedAt(Date.now())
      }
      if (!silent) {
        setBulkProgress({ step: 'done', message: `${result.clientes} clientes sincronizados` })
        setTimeout(() => setBulkProgress(null), 3000)
      }
    } catch { /* silent */ }
    finally {
      syncingRef.current = false
      syncingStartedAtRef.current = 0
      if (!silent) setBulkSyncing(false)
    }

    // STEP 3: Refresh pending count + failed payments
    try {
      const [pending, failed] = await Promise.all([
        obtenerPagosPendientes(),
        obtenerPagosFallidos(),
      ])
      setPendingCount(pending.length)
      setFailedPayments(failed)
    } catch { /* ignore */ }
  }, [])

  const requestAutoSync = useCallback(() => {
    if (!navigator.onLine) return
    checkStaleLock()
    if (syncingRef.current) return
    const now = Date.now()
    if (now - lastAutoSyncAtRef.current < MIN_AUTO_SYNC_GAP_MS) return
    lastAutoSyncAtRef.current = now
    // Silent means no blocking UI toast, but pages still refresh with fresh data.
    syncPendingThenFull({ silent: true, signalPages: true })
  }, [syncPendingThenFull])

  // Track pending payments count (MUST be defined before useEffects that reference it)
  const refreshPending = useCallback(async () => {
    try {
      const [pending, failed] = await Promise.all([
        obtenerPagosPendientes(),
        obtenerPagosFallidos(),
      ])
      setPendingCount(pending.length)
      setFailedPayments(failed)
    } catch { /* ignore */ }
  }, [])

  const descartarPagoFallido = useCallback(async (id) => {
    await eliminarPagoFallido(id)
    refreshPending()
  }, [refreshPending])

  // Track online/offline + re-sync when coming back online
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => {
      setIsOnline(true)
      setTimeout(() => syncPendingThenFull({ silent: false, signalPages: true }), 2000)
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

  // ─── AUTO-SYNC: on mount + periodic + visibility change ───
  useEffect(() => {
    obtenerSyncMeta().then((meta) => { if (meta) setSyncMeta(meta) }).catch(() => {})

    // Sync shortly after app open.
    const initialTimeout = setTimeout(() => requestAutoSync(), 3000)

    // Keep offline data fresh continuously while online.
    const periodicSync = setInterval(() => {
      requestAutoSync()
    }, 90 * 1000)

    // Sync when user returns to the tab/app (e.g. from WhatsApp, another tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestAutoSync()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Sync when window regains focus (covers PWA returning from background)
    const handleFocus = () => {
      requestAutoSync()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(periodicSync)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [requestAutoSync])

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
        // Skip reorder — it saves directly and the sync could overwrite correct order
        const isReorder = url.includes('/reordenar')
        if (url.startsWith('/api/') && method !== 'GET' && response.ok && !isReorder) {
          // Debounce: if multiple mutations happen quickly, only sync once
          if (mutationTimeout) clearTimeout(mutationTimeout)
          mutationTimeout = setTimeout(() => syncPendingThenFull({ silent: true, signalPages: false }), MUTATION_SYNC_DELAY)
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
    await syncPendingThenFull({ silent: false, signalPages: true })
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
    <OfflineContext.Provider value={{ isOnline, pendingCount, failedPayments, descartarPagoFallido, refreshPending, manualSync, syncMeta, startBulkSync, bulkSyncing, bulkProgress, lastSyncedAt }}>
      {children}

      {/* Offline indicator — small pill, bottom-right, above BottomNav */}
      {!isOnline && (
        <div className="fixed bottom-[80px] right-4 z-[9998] bg-[rgba(15,15,22,0.85)] text-[var(--color-danger)] px-2.5 py-1.5 text-[10px] font-semibold rounded-full flex items-center gap-1.5 shadow-lg border border-[rgba(248,113,113,0.2)] backdrop-blur-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] animate-pulse" />
          Offline
        </div>
      )}
      {isOnline && bulkSyncing && (
        <div className="fixed bottom-[80px] right-4 z-[9998] bg-[rgba(15,15,22,0.85)] text-[var(--color-success)] px-2.5 py-1.5 text-[10px] font-semibold rounded-full flex items-center gap-1.5 shadow-lg border border-[rgba(52,211,153,0.2)] backdrop-blur-xl">
          <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sync...
        </div>
      )}

      {/* Failed payments warning (permanente) */}
      {failedPayments.length > 0 && isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9998] bg-[rgba(239,68,68,0.95)] text-[var(--color-text-primary)] text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg max-w-[90vw]">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">
            {failedPayments.length} pago{failedPayments.length > 1 ? 's' : ''} no sincronizado{failedPayments.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => failedPayments.forEach(p => descartarPagoFallido(p.id))}
            className="underline flex-shrink-0"
          >
            Descartar
          </button>
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
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-4 py-2.5 rounded-[12px] shadow-xl flex items-center gap-2">
          {syncResult.synced > 0 && (
            <span className="text-[var(--color-success)]">{syncResult.synced} pago{syncResult.synced > 1 ? 's' : ''} sincronizado{syncResult.synced > 1 ? 's' : ''}</span>
          )}
          {syncResult.failed > 0 && (
            <span className="text-[var(--color-danger)]">{syncResult.failed} fallido{syncResult.failed > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

    </OfflineContext.Provider>
  )
}
