'use client'

import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { iniciarAutoSync, obtenerPagosPendientes, sincronizarPagos } from '@/lib/offline'

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, syncing: false })

export function useOffline() {
  return useContext(OfflineContext)
}

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncResult, setSyncResult]     = useState(null)

  // Track online/offline
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

  const manualSync = async () => {
    if (!navigator.onLine) return
    const result = await sincronizarPagos()
    if (result.synced > 0 || result.failed > 0) {
      setSyncResult(result)
      refreshPending()
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, refreshPending, manualSync }}>
      {children}

      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-[#ef4444] text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01" />
          </svg>
          Sin conexión — los pagos se guardarán localmente
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
