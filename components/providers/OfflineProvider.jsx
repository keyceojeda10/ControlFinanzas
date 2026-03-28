'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { iniciarAutoSync, obtenerPagosPendientes, sincronizarPagos, sincronizarTodo, obtenerSyncMeta } from '@/lib/offline'

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, syncing: false, syncMeta: null })

export function useOffline() {
  return useContext(OfflineContext)
}

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncResult, setSyncResult]     = useState(null)
  const [syncMeta, setSyncMeta]         = useState(null)
  const [bulkSyncing, setBulkSyncing]   = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)

  // Track online/offline + re-sync when coming back online
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline = () => {
      setIsOnline(true)
      // Re-sync everything when internet comes back
      setTimeout(async () => {
        try {
          // First upload pending payments
          const payResult = await sincronizarPagos()
          if (payResult.synced > 0) {
            setSyncResult(payResult)
            refreshPending()
            setTimeout(() => setSyncResult(null), 5000)
          }
          // Then download fresh data
          setBulkSyncing(true)
          const result = await sincronizarTodo(() => {})
          setSyncMeta({
            syncedAt: result.syncedAt,
            totalClientes: result.clientes,
            totalPrestamos: result.prestamos,
            totalRutas: result.rutas,
          })
        } catch { /* silent */ }
        finally { setBulkSyncing(false) }
      }, 2000)
    }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refreshPending])

  // Track pending payments count
  const refreshPending = useCallback(async () => {
    try {
      const pending = await obtenerPagosPendientes()
      setPendingCount(pending.length)
    } catch { /* ignore */ }
  }, [])

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Start auto-sync and listen for sync events
  useEffect(() => {
    iniciarAutoSync()

    const onSync = (e) => {
      setSyncResult(e.detail)
      refreshPending()
      setTimeout(() => setSyncResult(null), 5000)
    }
    window.addEventListener('offlineSync', onSync)
    return () => window.removeEventListener('offlineSync', onSync)
  }, [refreshPending])

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

  // Load sync meta on mount + AUTO-SYNC silently in background
  useEffect(() => {
    obtenerSyncMeta().then((meta) => { if (meta) setSyncMeta(meta) }).catch(() => {})

    // Auto-sync on app open: download all data in background
    // so the user never has to press a button
    const autoSync = async () => {
      if (!navigator.onLine || bulkSyncing) return
      setBulkSyncing(true)
      try {
        const result = await sincronizarTodo(() => {})
        setSyncMeta({
          syncedAt: result.syncedAt,
          totalClientes: result.clientes,
          totalPrestamos: result.prestamos,
          totalRutas: result.rutas,
        })
      } catch { /* silent fail */ }
      finally { setBulkSyncing(false) }
    }

    // Run after a short delay so the page loads first
    const timeout = setTimeout(autoSync, 3000)
    return () => clearTimeout(timeout)
  }, [])

  // ─── Offline navigation: force full-page loads when offline ───
  // Next.js client-side navigation fetches RSC payloads from server,
  // which fails offline and crashes the router. By forcing full-page
  // loads (window.location.href), the SW serves cached HTML instead.
  // We intercept BOTH <a> clicks AND router.push() (via history.pushState).
  useEffect(() => {
    const DASHBOARD_ROUTES = ['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja', '/cobradores', '/reportes', '/configuracion']

    const isDashboardRoute = (pathname) =>
      DASHBOARD_ROUTES.some((r) => pathname.startsWith(r))

    // 1) Intercept <a> tag clicks (captures Next.js Link clicks)
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
    const result = await sincronizarPagos()
    if (result.synced > 0 || result.failed > 0) {
      setSyncResult(result)
      refreshPending()
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  // Bulk sync: download everything for offline
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
    <OfflineContext.Provider value={{ isOnline, pendingCount, refreshPending, manualSync, syncMeta, startBulkSync, bulkSyncing, bulkProgress }}>
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
