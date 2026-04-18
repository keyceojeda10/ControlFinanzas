'use client'

import { useState, useEffect } from 'react'

export default function NotificationPrompt() {
  const [show, setShow] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    // Only show if browser supports push and user hasn't decided
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'granted') {
      setSubscribed(true)
      return
    }
    if (Notification.permission === 'denied') return
    // Show prompt after 5 seconds
    const timer = setTimeout(() => setShow(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  const subscribe = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setShow(false); return }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setShow(false); return }

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

      setSubscribed(true)
      setShow(false)
    } catch (err) {
      console.error('[push] Error subscribing:', err)
      setShow(false)
    }
  }

  if (!show || subscribed) return null

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 max-w-xs">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Activar notificaciones</p>
            <p className="text-xs text-[#777] mt-0.5">Recibe alertas de pagos, mora y vencimientos.</p>
          </div>
          <button onClick={() => setShow(false)} className="text-[var(--color-text-muted)] hover:text-[#bbb]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShow(false)}
            className="flex-1 text-xs text-[var(--color-text-muted)] py-2 rounded-lg hover:bg-[#222] transition-colors"
          >
            Ahora no
          </button>
          <button
            onClick={subscribe}
            className="flex-1 text-xs font-semibold text-[#0a0a0a] bg-[var(--color-accent)] py-2 rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Activar
          </button>
        </div>
      </div>
    </div>
  )
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
