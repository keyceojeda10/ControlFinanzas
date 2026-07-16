'use client'

import { useState, useEffect, useCallback } from 'react'
import { isStandalone, getDeviceType, InstallGuideModal } from '@/components/layout/InstallButton'

const DISMISS_KEY = 'cf-install-banner-dismissed'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) return

    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < DISMISS_MS) return

    setVisible(true)

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === 'accepted') setVisible(false)
      return
    }
    setShowGuide(true)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }, [])

  if (!visible) return null

  const device = typeof window !== 'undefined' ? getDeviceType() : 'desktop'
  const isPhone = device === 'ios' || device === 'android'

  return (
    <>
      <div
        className="rounded-[16px] p-4 flex items-start gap-3"
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card))',
          border: '1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))',
        }}
      >
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {isPhone ? 'Instala la app en tu celular' : 'Instala la app en tu computador'}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Accede mas rapido desde tu {isPhone ? 'pantalla de inicio' : 'escritorio'} y usala sin internet
          </p>

          <div className="flex gap-2 mt-2.5">
            <button
              onClick={dismiss}
              className="text-[11px] px-3 py-1.5 rounded-[8px] transition-colors"
              style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}
            >
              Ahora no
            </button>
            <button
              onClick={handleInstall}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] transition-colors"
              style={{ color: 'var(--color-bg-base)', background: 'var(--color-accent)' }}
            >
              {isPhone ? 'Ver como instalar' : 'Instalar'}
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-[8px] transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {showGuide && <InstallGuideModal onClose={() => setShowGuide(false)} />}
    </>
  )
}
