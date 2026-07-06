'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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

function DownloadIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function UserIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

const TOAST_DURATION = 5000
const TOAST_COOLDOWN_KEY = 'cf-toast-last-shown'
const TOAST_COOLDOWN_MS = 48 * 60 * 60 * 1000
const DISMISS_COOLDOWN_MS = 48 * 60 * 60 * 1000

export default function NotificationsCenter({ size = 'md' }) {
  const { isOnline, pendingCount, failedDetails, openSyncDrawer } = useOffline()
  const { esOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installable, setInstallable] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(true)
  const [pushPermission, setPushPermission] = useState('default')
  const [pushDismissed, setPushDismissed] = useState(true)
  const [panelPos, setPanelPos] = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [procesando, setProcesando] = useState(null)
  const [notifInApp, setNotifInApp] = useState([])
  const [notifNoLeidas, setNotifNoLeidas] = useState(0)

  // Toast state
  const [toast, setToast] = useState(null)       // { icon, title, message, phase }
  const [toastPhase, setToastPhase] = useState('hidden') // hidden | entering | visible | absorbing | absorbed
  const [bellPulse, setBellPulse] = useState(false)

  const ref = useRef(null)
  const btnRef = useRef(null)
  const toastTimerRef = useRef(null)
  const toastShownRef = useRef(false)

  const failedTotal =
    (failedDetails?.pagos?.length || 0) +
    (failedDetails?.clientes?.length || 0) +
    (failedDetails?.prestamos?.length || 0) +
    (failedDetails?.mutaciones?.length || 0)

  // ─── Install prompt ───
  useEffect(() => {
    if (isStandalone()) return
    const dismissedAt = localStorage.getItem('cf-install-dismissed')
    const recentlyDismissed = dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_COOLDOWN_MS
    setInstallDismissed(!!recentlyDismissed)

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setInstallable(true) }
    window.addEventListener('beforeinstallprompt', handler)
    const timer = setTimeout(() => setInstallable(true), 1500)
    return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(timer) }
  }, [])

  // ─── Push permission ───
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    setPushPermission(Notification.permission)
    const dismissedAt = localStorage.getItem('cf-push-dismissed')
    const recentlyDismissed = dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_COOLDOWN_MS
    setPushDismissed(!!recentlyDismissed)
  }, [open])

  // ─── Click outside ───
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── Solicitudes ───
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

  // ─── Notificaciones in-app ───
  const fetchNotifCount = async () => {
    try {
      const res = await fetch('/api/notificaciones?count=1')
      if (!res.ok) return
      const data = await res.json()
      setNotifNoLeidas(data.count || 0)
    } catch {}
  }

  const fetchNotificaciones = async () => {
    try {
      const res = await fetch('/api/notificaciones')
      if (!res.ok) return
      const data = await res.json()
      setNotifInApp(data)
      setNotifNoLeidas(data.filter(n => !n.leida).length)
    } catch {}
  }

  useEffect(() => {
    fetchNotifCount()
    const interval = setInterval(fetchNotifCount, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) fetchNotificaciones()
  }, [open])

  const marcarLeida = async (id) => {
    setNotifInApp(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setNotifNoLeidas(prev => Math.max(0, prev - 1))
    try { await fetch('/api/notificaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }) } catch {}
  }

  const marcarTodasLeidas = async () => {
    setNotifInApp(prev => prev.map(n => ({ ...n, leida: true })))
    setNotifNoLeidas(0)
    try { await fetch('/api/notificaciones', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marcarTodasLeidas: true }) }) } catch {}
  }

  // ─── Solicitudes actions ───
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

  // ─── Install / Push actions ───
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

  const dismissPush = () => {
    localStorage.setItem('cf-push-dismissed', String(Date.now()))
    setPushDismissed(true)
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

  const canInstall = installable && !isStandalone()
  const canPush = pushPermission === 'default'
  const showInstallToast = canInstall && !installDismissed
  const showPushToast = canPush && !pushDismissed
  const showSyncItem = !isOnline || pendingCount > 0 || failedTotal > 0
  const showSolicitudesItem = esOwner && solicitudes.length > 0

  const total = (canInstall ? 1 : 0) + (canPush ? 1 : 0) + (showSyncItem ? 1 : 0) + solicitudes.length + notifNoLeidas

  // ─── Toast logic ───
  const pickToast = useCallback(() => {
    if (showInstallToast) {
      return { icon: 'download', title: 'Instala la app', message: 'Accede más rápido y úsala sin internet' }
    }
    if (showPushToast) {
      return { icon: 'bell', title: 'Activa notificaciones', message: 'Recibe alertas de pagos, mora y vencimientos' }
    }
    if (notifNoLeidas > 0) {
      const first = notifInApp.find(n => !n.leida)
      if (first) return { icon: 'user', title: first.titulo, message: first.mensaje }
      return { icon: 'bell', title: `${notifNoLeidas} notificaciones`, message: 'Tienes avisos sin leer' }
    }
    return null
  }, [showInstallToast, showPushToast, notifNoLeidas, notifInApp])

  useEffect(() => {
    if (toastShownRef.current || open) return

    const lastShown = localStorage.getItem(TOAST_COOLDOWN_KEY)
    if (lastShown && Date.now() - parseInt(lastShown) < TOAST_COOLDOWN_MS) return

    const candidate = pickToast()
    if (!candidate || total === 0) return

    toastShownRef.current = true
    const delay = setTimeout(() => {
      setToast(candidate)
      setToastPhase('entering')
      localStorage.setItem(TOAST_COOLDOWN_KEY, String(Date.now()))

      setTimeout(() => setToastPhase('visible'), 50)

      toastTimerRef.current = setTimeout(() => {
        absorb()
      }, TOAST_DURATION)
    }, 1200)

    return () => clearTimeout(delay)
  }, [total, open, pickToast])

  const absorb = useCallback(() => {
    clearTimeout(toastTimerRef.current)
    setToastPhase('absorbing')
    setTimeout(() => {
      setToastPhase('absorbed')
      setBellPulse(true)
      setTimeout(() => {
        setToast(null)
        setToastPhase('hidden')
        setBellPulse(false)
      }, 400)
    }, 500)
  }, [])

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimerRef.current)
    setToastPhase('absorbing')
    setTimeout(() => {
      setToast(null)
      setToastPhase('hidden')
    }, 500)
  }, [])

  const handleToastClick = useCallback(() => {
    clearTimeout(toastTimerRef.current)
    setToast(null)
    setToastPhase('hidden')
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const panelWidth = 256
      const margin = 16
      let left = rect.right - panelWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))
      const panelMaxHeight = 360
      const espacioAbajo = window.innerHeight - rect.bottom
      const pos = espacioAbajo < panelMaxHeight + margin
        ? { bottom: window.innerHeight - rect.top + 8, left }
        : { top: rect.bottom + 8, left }
      setPanelPos(pos)
    }
    setOpen(true)
  }, [])

  if (showInstallGuide) return <InstallGuideModal onClose={() => setShowInstallGuide(false)} />

  const togglePanel = () => {
    if (toast) {
      clearTimeout(toastTimerRef.current)
      setToast(null)
      setToastPhase('hidden')
    }
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const panelWidth = 256
      const panelMaxHeight = 360
      const margin = 16
      let left = rect.right - panelWidth
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

      const espacioAbajo = window.innerHeight - rect.bottom
      const pos = espacioAbajo < panelMaxHeight + margin
        ? { bottom: window.innerHeight - rect.top + 8, left }
        : { top: rect.bottom + 8, left }

      setPanelPos(pos)
    }
    setOpen((v) => !v)
  }

  const toastIcon = toast?.icon === 'download' ? <DownloadIcon className="w-4 h-4" />
    : toast?.icon === 'user' ? <UserIcon className="w-4 h-4" />
    : <BellIcon className="w-4 h-4" />

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={togglePanel}
        aria-label="Notificaciones"
        className={`relative flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-bg-hover)] ${size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'} ${bellPulse ? 'cf-bell-pulse' : ''}`}
        style={{ color: 'var(--color-text-muted)' }}
      >
        <BellIcon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} />
        {total > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--color-accent)', color: '#1a1a2e' }}>
            {total}
          </span>
        )}
      </button>

      {/* ── Toast popup ── */}
      {toast && (
        <div
          onClick={handleToastClick}
          className={`cf-notif-toast cf-notif-toast--${toastPhase}`}
          style={{
            position: 'fixed',
            top: 72,
            right: 16,
            left: 16,
            maxWidth: 360,
            marginLeft: 'auto',
            marginRight: 'auto',
            zIndex: 60,
            cursor: 'pointer',
          }}
        >
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
              {toastIcon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{toast.title}</p>
              <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{toast.message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast() }}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full mt-0.5"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Cerrar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {open && panelPos && (
        <div
          className="fixed w-64 max-w-[calc(100vw-2rem)] max-h-[360px] overflow-y-auto rounded-[12px] shadow-2xl z-50 glass-strong"
          style={{
            border: '1px solid var(--color-border)',
            left: panelPos.left,
            ...(panelPos.bottom != null ? { bottom: panelPos.bottom } : { top: panelPos.top }),
          }}
        >
          <div className="px-4 py-3 sticky top-0 glass-strong" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Notificaciones</p>
          </div>

          {total === 0 && notifInApp.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Todo al dia. No hay avisos pendientes.</p>
            </div>
          )}

          <div className="py-1">
            {notifInApp.length > 0 && (
              <>
                {notifNoLeidas > 0 && (
                  <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{notifNoLeidas} sin leer</p>
                    <button onClick={marcarTodasLeidas} className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>Marcar todas</button>
                  </div>
                )}
                {notifInApp.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.leida) marcarLeida(n.id)
                      if (n.datos) {
                        try {
                          const d = JSON.parse(n.datos)
                          if (d.clienteId) {
                            window.location.href = `/clientes/${d.clienteId}`
                            setOpen(false)
                          }
                        } catch {}
                      }
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cf-menu-item"
                    style={{ borderBottom: '1px solid var(--color-border)', opacity: n.leida ? 0.6 : 1 }}
                  >
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: n.leida ? 'var(--color-bg-hover)' : 'var(--color-accent-soft)' }}>
                      <UserIcon className="w-4 h-4" style={{ color: n.leida ? 'var(--color-text-muted)' : 'var(--color-accent)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{n.titulo}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{n.mensaje}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(n.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.leida && (
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: 'var(--color-accent)' }} />
                    )}
                  </button>
                ))}
              </>
            )}

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
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Toca para ver el detalle de sincronizacion</p>
                </div>
              </button>
            )}

            {canInstall && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-soft)' }}>
                  <DownloadIcon className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Instala la app</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Accede más rápido y úsala sin internet</p>
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

            {canPush && (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                  <BellIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>Activar notificaciones</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Recibe alertas de pagos, mora y vencimientos</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={dismissPush} className="text-[11px] px-2.5 py-1 rounded-full transition-colors" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
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
