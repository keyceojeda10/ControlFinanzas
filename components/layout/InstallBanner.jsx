'use client'

import { useState, useEffect, useCallback } from 'react'
import { isStandalone, getDeviceType, InstallGuideModal } from '@/components/layout/InstallButton'
import FranjaAviso from '@/components/armazon/FranjaAviso'

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
      {/* ── De tarjeta de 240px a franja de una línea ──
          Era publicidad de la propia app ocupando un tercio del teléfono EN LA
          PANTALLA MÁS IMPORTANTE, por encima de las cifras del negocio. Un
          promotor no puede tapar la respuesta que el dueño vino a buscar.

          La lógica no cambia: sigue sin salir en modo instalado, sigue
          aplazándose 7 días y sigue abriendo la guía si el navegador no ofrece
          el diálogo nativo. Lo que cambia es cuánto sitio se toma para pedirlo. */}
      <FranjaAviso
        icono={
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v11m0 0l-4-4m4 4l4-4" />
          </svg>
        }
        accion={isPhone ? 'Ver cómo' : 'Instalar'}
        onAccion={handleInstall}
        onCerrar={dismiss}
      >
        Instálala y úsala sin internet
      </FranjaAviso>

      {showGuide && <InstallGuideModal onClose={() => setShowGuide(false)} />}
    </>
  )
}
