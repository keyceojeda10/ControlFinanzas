'use client'

import { useState, useEffect } from 'react'

// Detect if app is already installed (standalone mode)
function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

// Detect iOS
function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

export default function InstallButton({ variant = 'mobile' }) {
  const [showButton, setShowButton] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone()) return

    // Check if user previously dismissed (persist for 7 days)
    const dismissedAt = localStorage.getItem('cf-install-dismissed')
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      return
    }

    // For iOS: always show the button (since beforeinstallprompt doesn't fire)
    if (isIOS()) {
      setShowButton(true)
      return
    }

    // For Android/Chrome: listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Also show after 5 seconds on any mobile browser (fallback)
    const timer = setTimeout(() => {
      if (/Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setShowButton(true)
      }
    }, 5000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowButton(false)
      }
      setDeferredPrompt(null)
      return
    }

    // iOS or browser without beforeinstallprompt
    if (isIOS()) {
      setShowIOSGuide(true)
      return
    }

    // Fallback: show generic instructions
    setShowIOSGuide(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowButton(false)
    localStorage.setItem('cf-install-dismissed', Date.now().toString())
  }

  if (!showButton || dismissed) return null

  // iOS instructions modal
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4" onClick={() => setShowIOSGuide(false)}>
        <div
          className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-[20px] p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Instalar Control Finanzas</h3>
            <button onClick={() => setShowIOSGuide(false)} className="text-[#888] hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isIOS() ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold shrink-0">1</div>
                <div>
                  <p className="text-sm text-white">Toca el boton de <strong>Compartir</strong></p>
                  <p className="text-xs text-[#888]">El icono de cuadrado con flecha hacia arriba en la barra de Safari</p>
                  <div className="mt-1.5 flex items-center justify-center w-8 h-8 bg-[#2a2a2a] rounded-lg">
                    <svg className="w-5 h-5 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold shrink-0">2</div>
                <div>
                  <p className="text-sm text-white">Selecciona <strong>&quot;Agregar a pantalla de inicio&quot;</strong></p>
                  <p className="text-xs text-[#888]">Desplaza hacia abajo en el menu si no lo ves</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold shrink-0">3</div>
                <div>
                  <p className="text-sm text-white">Toca <strong>&quot;Agregar&quot;</strong></p>
                  <p className="text-xs text-[#888]">La app aparecera en tu pantalla de inicio como una app nativa</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#ccc]">Abre el menu de tu navegador (tres puntos) y selecciona <strong className="text-white">&quot;Instalar app&quot;</strong> o <strong className="text-white">&quot;Agregar a pantalla de inicio&quot;</strong>.</p>
            </div>
          )}

          <button
            onClick={() => setShowIOSGuide(false)}
            className="w-full mt-5 py-2.5 rounded-[10px] bg-[#f5c518] text-[#0a0a0a] text-sm font-semibold hover:bg-[#f0b800] transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    )
  }

  // Mobile variant: subtle pill in header area
  if (variant === 'mobile') {
    return (
      <button
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] hover:bg-[rgba(245,197,24,0.15)] transition-colors"
        title="Instalar app"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-[11px] font-medium">App</span>
      </button>
    )
  }

  // Desktop variant: subtle link in sidebar
  return (
    <button
      onClick={handleInstall}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm text-[#888888] hover:bg-[rgba(245,197,24,0.08)] hover:text-[#f5c518] transition-all duration-150"
      title="Instalar app offline"
    >
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Instalar app
    </button>
  )
}
