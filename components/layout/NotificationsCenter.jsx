'use client'
// components/layout/NotificationsCenter.jsx
// Centro de notificaciones: agrupa avisos (instalar app, activar push, sync
// pendiente) en un panel desplegable detras de un icono de campana, en vez
// de banners flotantes que tapaban el boton de Lucas y estorbaban en movil.

import { useEffect, useRef, useState } from 'react'
import { useOffline } from '@/components/providers/OfflineProvider'
import { InstallGuideModal } from '@/components/layout/InstallButton'
import { useAuth } from '@/hooks/useAuth'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function BellIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  )
}

export default function NotificationsCenter({ size = 'md' }) {
  const { isOnline, pendingCount, failedDetails, openSyncDrawer } = useOffline()
  const { esOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installable, setInstallable] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(true)
  const [pushPermission, setPushPermission] = useState('default')
  const [panelPos, setPanelPos] = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [procesando, setProcesando] = useState(null)
  const ref = useRef(null)
  const btnRef = useRef(null)

  const failedTotal =
    (failedDetails?.pagos?.length || 0) +
    (failedDetails?.clientes?.length || 0) +
    (failedDetails?.prestamos?.length || 0) +
    (failedDetails?.mutaciones?.length || 0)

  useEffect(() => {
    if (isStandalone()) return
    const dismissedAt = localStorage.getItem('cf-install-dismissed')
    const recentlyDismissed = dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000
    setInstallDismissed(!!recentlyDismissed)

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setInstallable(true) }
    window.addEventListener('beforeinstallprompt', handler)
    // En navegadores sin beforeinstallprompt (iOS/Safari) igual mostramos la guia manual
    const timer = setTimeout(() => setInstallable(true), 1500)
    return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    setPushPermission(Notification.permission)
  }, [open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchSolicitudes = async () => {
    if (!esOwner) return
    try {
      const res = await fetch('/api/caja/solicitudes-reapertura')
      if (!res.ok) return
      const data = await res.json()
      setSolicitudes(data.solicitudes || [])
    } catch {}
  }

  useEffect(() => {
    fetchSolicitudes()
  }, [esOwner])

  const aprobarSolicitud = async (cierreId) => {
    setProcesando(cierreId)
    try {
      const res = await fetch('/api/caja/reabrir/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cierreId }),
      })
      if (res.ok) await fetchSolicitudes()
    } finally {
      setProcesando(null)
    }
  }

  const rechazarSolicitud = async (cierreId) => {
    setProcesando(cierreId)
    try {
      const res = await fetch('/api/caja/reabrir/rechazar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cierreId }),
      })
      if (res.ok) await fetchSolicitudes()
    } finally {
      setProcesando(null)
    }
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === 'accepted') { setInstallable(false); setOpen(false) }
      return
    }
    setShowInstallGuide(true)
  }

  const dismissInstall = () => {
    localStorage.setItem('cf-install-dismissed', String(Date.now()))
    setInstallDismissed(true)
  }

  const subscribePush = async () => {
    try {
      const permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const { endpoint, keys } = subscription.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, keys }),
      })
    } catch (err) {
      console.error('[push] Error subscribing:', err)
    }
  }

  const showInstallItem = installable && !installDismissed && !isStandalone()
  const showPushItem = pushPermission === 'default'
  const showSyncItem = !isOnline || pendingCount > 0 || failedTotal > 0
  const showSolicitudesItem = esOwner && solicitudes.length > 0

  const total = (showInstallItem ? 1 : 0) + (showPushItem ? 1 : 0) + (showSyncItem ? 1 : 0) + solicitudes.length

  if (showInstallGuide) return <InstallGuideModal onClose={() => setShowInstallGuide(false)} />

  const togglePanel = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const panelWidth = 256
      const panelMaxHeight = 360
      const margin = 16
      let left = rect.right - panelWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

      // Si no hay espacio suficiente debajo (ej. campana al final del sidebar,
      // pegada al borde inferior), abrir el panel hacia arriba en su lugar.
      const espacioAbajo = window.innerHeight - rect.bottom
      const pos = espacioAbajo < panelMaxHeight + margin
        ? { bottom: window.innerHeight - rect.top + 8, left }
        : { top: rect.bottom + 8, left }

      setPanelPos(pos)
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={togglePanel}
        aria-label="Notificaciones"
        className={`relative flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-bg-hover)] ${size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'}`}
        style={{ color: 'var(--color-text-muted)' }}
      >
        <BellIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--color-accent)', color: '#1a1a2e' }}>
            {total}
          </span>
        )}
      </button>

      {open && panelPos && (
        <div
          className="fixed w-64 max-w-[calc(100vw-2rem)] max-h-[360px] overflow-y-auto rounded-[14px] shadow-2xl z-50 glass-strong"
          style={{
            border: '1px solid var(--color-border)',
            left: panelPos.left,
            ...(panelPos.bottom != null ? { bottom: panelPos.bottom } : { top: panelPos.top }),
          }}
        >
          <div className="px-4 py-3 sticky top-0 glass-strong" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notificaciones</p>
          </div>

          {total === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Todo al día. No hay avisos pendientes.</p>
            </div>
          )}

          <div className="py-1">
            {showSolicitudesItem && solicitudes.map((s) => (
              <div key={s.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-warning-dim)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-warning)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {s.cobrador?.nombre || 'Cobrador'} solicita reabrir su caja
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Para seguir registrando abonos hoy</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => rechazarSolicitud(s.id)}
                      disabled={procesando === s.id}
                      className="text-[11px] px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                      style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => aprobarSolicitud(s.id)}
                      disabled={procesando === s.id}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                      style={{ color: '#1a1a2e', background: 'var(--color-success)' }}
                    >
                      Aprobar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {showSyncItem && (
              <button
                onClick={() => { openSyncDrawer?.(); setOpen(false) }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cf-menu-item"
              >
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: failedTotal > 0 ? 'var(--color-danger-dim)' : 'var(--color-warning-dim)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: failedTotal > 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {!isOnline ? 'Sin conexión' : failedTotal > 0 ? `${failedTotal} elementos fallidos` : `${pendingCount} pendientes por sincronizar`}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Toca para ver el detalle de sincronización</p>
                </div>
              </button>
            )}

            {showInstallItem && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-soft)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Instala la app</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Accede mas rápido y úsala sin internet</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={dismissInstall} className="text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
                      Ahora no
                    </button>
                    <button onClick={handleInstall} className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors" style={{ color: '#1a1a2e', background: 'var(--color-accent)' }}>
                      Instalar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPushItem && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                  <BellIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Activar notificaciones</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Recibe alertas de pagos, mora y vencimientos</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setOpen(false)} className="text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
                      Ahora no
                    </button>
                    <button onClick={subscribePush} className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors" style={{ color: '#1a1a2e', background: 'var(--color-accent)' }}>
                      Activar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
