'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import jsQR from 'jsqr'

export default function QrScanner({ open, onClose, onClientDetected }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)
  const [mode, setMode] = useState('loading')
  const [cameraError, setCameraError] = useState(null)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  const stopCamera = useCallback(() => {
    if (scannerRef.current) {
      clearInterval(scannerRef.current)
      scannerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const extractClientId = useCallback((url) => {
    const match = url.match(/\/qr\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
  }, [])

  const handleDetected = useCallback((url) => {
    const clientId = extractClientId(url)
    if (!clientId) return false
    stopCamera()
    onClose()
    onClientDetected?.(clientId)
    return true
  }, [onClose, stopCamera, onClientDetected, extractClientId])

  const decodeImageData = useCallback((data, w, h) => {
    const code = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' })
    if (code?.data && code.data.includes('/qr/')) return code.data
    return null
  }, [])

  const processImageFile = useCallback(async (file) => {
    if (!file) return
    setError(null)
    setProcessing(true)

    try {
      const img = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)

      let found = false
      if (typeof globalThis.BarcodeDetector !== 'undefined') {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(img)
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            found = handleDetected(barcodes[0].rawValue)
          }
        } catch {}
      }

      if (!found) {
        let result = decodeImageData(imageData.data, img.width, img.height)
        if (!result && (img.width > 1000 || img.height > 1000)) {
          const scale = 800 / Math.max(img.width, img.height)
          const sw = Math.round(img.width * scale)
          const sh = Math.round(img.height * scale)
          canvas.width = sw
          canvas.height = sh
          ctx.drawImage(img, 0, 0, sw, sh)
          const smallData = ctx.getImageData(0, 0, sw, sh)
          result = decodeImageData(smallData.data, sw, sh)
        }
        if (result) {
          handleDetected(result)
        } else {
          setError('No se encontro un QR valido. Intenta de nuevo.')
          setTimeout(() => setError(null), 4000)
        }
      }
    } catch {
      setError('No se pudo leer la imagen')
      setTimeout(() => setError(null), 4000)
    } finally {
      setProcessing(false)
    }
  }, [handleDetected, decodeImageData])

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await processImageFile(file)
  }, [processImageFile])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('api')
      setMode('photo')
      return
    }

    setMode('loading')
    setCameraError(null)

    let permState = null
    try {
      const ps = await navigator.permissions.query({ name: 'camera' })
      permState = ps.state
    } catch {}

    const constraintSets = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: 'environment' } },
      { video: true },
    ]

    let stream = null
    let lastError = null
    for (const constraints of constraintSets) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
        break
      } catch (err) {
        lastError = err
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') break
        continue
      }
    }

    if (!stream) {
      const errorName = lastError?.name || 'unknown'
      setCameraError(permState === 'prompt' && (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError')
        ? 'pwa-prompt-blocked'
        : errorName)
      setMode('photo')
      return
    }

    streamRef.current = stream
    const video = videoRef.current
    if (!video) { stream.getTracks().forEach(t => t.stop()); return }

    video.srcObject = stream

    try {
      await video.play()
    } catch {
      stream.getTracks().forEach(t => t.stop())
      setCameraError('play')
      setMode('photo')
      return
    }

    setMode('live')

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    let detector = null
    if (typeof globalThis.BarcodeDetector !== 'undefined') {
      try { detector = new BarcodeDetector({ formats: ['qr_code'] }) } catch {}
    }

    scannerRef.current = setInterval(async () => {
      if (!video || video.readyState < 2) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      canvas.width = vw
      canvas.height = vh
      ctx.drawImage(video, 0, 0, vw, vh)

      try {
        if (detector) {
          const barcodes = await detector.detect(video)
          if (barcodes.length > 0 && barcodes[0].rawValue?.includes('/qr/')) {
            handleDetected(barcodes[0].rawValue)
            return
          }
        }
        const imgData = ctx.getImageData(0, 0, vw, vh)
        const result = decodeImageData(imgData.data, vw, vh)
        if (result) handleDetected(result)
      } catch {}
    }, 250)
  }, [stopCamera, handleDetected, decodeImageData])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setMode('loading')
      setError(null)
      setCameraError(null)
      setProcessing(false)
      return
    }
    startCamera()
    return () => stopCamera()
  }, [open, stopCamera, startCamera])

  const showVideo = mode === 'loading' || mode === 'live'

  const pwaBlocked = cameraError === 'pwa-prompt-blocked'
  const permissionHelp = cameraError === 'NotAllowedError' || cameraError === 'PermissionDeniedError'
  const cameraInUse = cameraError === 'NotReadableError'
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

  function getErrorMessage() {
    if (pwaBlocked || permissionHelp) {
      return null
    }
    if (cameraInUse) {
      return 'La camara esta siendo usada por otra app. Cierra la otra app e intenta de nuevo.'
    }
    return 'No se pudo acceder a la camara. Intenta cerrar otras apps que usen la camara.'
  }

  function openInChrome() {
    const url = window.location.href
    window.open(url, '_blank')
  }

  function handleRetry() {
    stopCamera()
    startCamera()
  }

  return (
    <Modal open={open} onClose={() => { stopCamera(); onClose() }} title="Escanear QR" size="sm">
      <div className="flex flex-col items-center gap-4">

        {/* Live video scanner - same for ALL devices */}
        {showVideo && (
          <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden" style={{ background: '#000' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              autoPlay
              muted
              style={{ opacity: mode === 'live' ? 1 : 0 }}
            />
            {mode === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin w-8 h-8" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Iniciando camara...</p>
              </div>
            )}
            {mode === 'live' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 rounded-2xl" style={{ borderColor: 'var(--color-accent)' }}>
                  <div className="w-full h-0.5 animate-scan-line" style={{ background: 'var(--color-accent)', opacity: 0.7 }} />
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'live' && (
          <>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Apunta la camara al QR del cliente
            </p>
            <label
              className="h-9 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              Elegir de galeria
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </>
        )}

        {/* Camera failed - show specific error + fallback */}
        {mode === 'photo' && (
          <>
            {processing ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <svg className="animate-spin w-10 h-10" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Leyendo QR...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 w-full">
                {error && (
                  <p className="text-sm text-center mb-1" style={{ color: 'var(--color-danger)' }}>{error}</p>
                )}

                {/* Permission tutorial for Android */}
                {(pwaBlocked || permissionHelp) && isAndroid ? (
                  <div className="w-full flex flex-col gap-3">
                    <div className="w-full rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        Revisa estos pasos:
                      </p>
                      <ol className="text-xs leading-relaxed space-y-2 pl-4" style={{ color: 'var(--color-text-secondary)', listStyle: 'decimal' }}>
                        <li>Baja la <strong>cortina de notificaciones</strong> (desliza desde arriba) y verifica que el icono de <strong>Camara</strong> NO este tachado. Si esta tachado, tocalo para activarlo.</li>
                        <li>Ve a <strong>Ajustes &gt; Aplicaciones &gt; Chrome &gt; Permisos &gt; Camara</strong> y ponlo en <strong>Permitir</strong> (no "Preguntar").</li>
                        <li>En Chrome, toca el <strong>candado</strong> en la barra de direcciones &gt; <strong>Permisos</strong> &gt; <strong>Camara</strong> &gt; <strong>Permitir</strong>.</li>
                      </ol>
                      <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-tertiary, rgba(0,0,0,0.35))' }}>
                        Solo necesitas hacerlo una vez. Despues funciona siempre.
                      </p>
                    </div>

                    <button
                      onClick={openInChrome}
                      className="h-11 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 w-full"
                      style={{ background: 'var(--color-accent)', color: '#18181b' }}
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Abrir en Chrome
                    </button>

                    <button
                      onClick={handleRetry}
                      className="h-10 px-5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 w-full"
                      style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      Ya di permiso, intentar de nuevo
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-full rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {getErrorMessage()}
                      </p>
                      {cameraError && (
                        <p className="text-[10px] mt-1.5 font-mono" style={{ color: 'var(--color-text-tertiary, rgba(0,0,0,0.35))' }}>
                          Error: {cameraError}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleRetry}
                      className="h-11 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 w-full"
                      style={{ background: 'var(--color-accent)', color: '#18181b' }}
                    >
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      Intentar de nuevo
                    </button>
                  </>
                )}

                {/* Photo fallback */}
                <div className="flex items-center gap-3 w-full">
                  <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary, rgba(0,0,0,0.35))' }}>o usa una foto</span>
                  <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                </div>

                <div className="flex gap-2 w-full">
                  <label
                    className="flex-1 h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    Camara
                    <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                  </label>
                  <label
                    className="flex-1 h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    Galeria
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes scan-line {
          0% { transform: translateY(0); }
          100% { transform: translateY(192px); }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}</style>
    </Modal>
  )
}
