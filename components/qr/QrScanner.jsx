'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import jsQR from 'jsqr'

function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

export default function QrScanner({ open, onClose, onClientDetected }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const [mode, setMode] = useState('loading')
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  const android = typeof navigator !== 'undefined' && isAndroid()

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
    if (file) {
      await processImageFile(file)
    } else if (android) {
      onClose()
    }
  }, [processImageFile, android, onClose])

  // Android: auto-open native camera immediately
  useEffect(() => {
    if (!open || !android) return
    setMode('android-waiting')
    const timer = setTimeout(() => {
      cameraInputRef.current?.click()
    }, 150)
    return () => clearTimeout(timer)
  }, [open, android])

  // iPhone/desktop: live camera via getUserMedia
  useEffect(() => {
    if (!open || android) {
      if (!android) {
        stopCamera()
        setMode('loading')
        setError(null)
        setProcessing(false)
      }
      return
    }

    let cancelled = false

    async function tryLiveCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMode('photo')
        return
      }

      const constraintSets = [
        { video: { facingMode: { ideal: 'environment' } } },
        { video: { facingMode: 'environment' } },
        { video: true },
      ]

      let stream = null
      for (const constraints of constraintSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          break
        } catch {
          continue
        }
      }

      if (!stream) {
        if (!cancelled) setMode('photo')
        return
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) { stream.getTracks().forEach(t => t.stop()); return }

      video.srcObject = stream

      try {
        await video.play()
      } catch {
        stream.getTracks().forEach(t => t.stop())
        if (!cancelled) setMode('photo')
        return
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
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
    }

    tryLiveCamera()
    return () => { cancelled = true; stopCamera() }
  }, [open, android, stopCamera, handleDetected, decodeImageData])

  const showVideo = !android && (mode === 'loading' || mode === 'live')

  return (
    <Modal open={open} onClose={() => { stopCamera(); onClose() }} title="Escanear QR" size="sm">
      <div className="flex flex-col items-center gap-4">

        {/* Hidden inputs for Android native camera */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {/* iPhone/desktop: live video */}
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

        {!android && mode === 'live' && (
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

        {/* Android: processing / buttons fallback */}
        {android && (
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
                {mode === 'android-waiting' && !error && (
                  <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin w-8 h-8" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Abriendo camara...</p>
                  </div>
                )}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-12 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 w-full"
                  style={{ background: 'var(--color-accent)', color: '#18181b' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Tomar foto del QR
                </button>
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-10 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 w-full"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  Elegir de galeria
                </button>
              </div>
            )}
          </>
        )}

        {/* iPhone/desktop: photo fallback when getUserMedia fails */}
        {!android && mode === 'photo' && (
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
                <label
                  className="h-12 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer w-full"
                  style={{ background: 'var(--color-accent)', color: '#18181b' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Tomar foto del QR
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                </label>
                <label
                  className="h-10 px-4 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-pointer w-full"
                  style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  Elegir de galeria
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
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
