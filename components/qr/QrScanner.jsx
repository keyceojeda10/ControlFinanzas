'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import jsQR from 'jsqr'

export default function QrScanner({ open, onClose, onClientDetected }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)

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
    if (!clientId) return
    stopCamera()
    onClose()
    onClientDetected?.(clientId)
  }, [onClose, stopCamera, onClientDetected, extractClientId])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setError(null)
      setScanning(false)
      return
    }

    let cancelled = false

    async function startCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('no-media-devices')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        video.setAttribute('autoplay', 'true')
        await video.play()
        setScanning(true)

        const canvas = document.createElement('canvas')
        canvasRef.current = canvas
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        const hasBarcodeDetector = typeof globalThis.BarcodeDetector !== 'undefined'
        let detector = null
        if (hasBarcodeDetector) {
          try {
            detector = new BarcodeDetector({ formats: ['qr_code'] })
          } catch {
            detector = null
          }
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
              if (barcodes.length > 0) {
                const val = barcodes[0].rawValue
                if (val && val.includes('/qr/')) {
                  handleDetected(val)
                  return
                }
              }
            }

            const imageData = ctx.getImageData(0, 0, vw, vh)
            const code = jsQR(imageData.data, vw, vh, { inversionAttempts: 'dontInvert' })
            if (code?.data && code.data.includes('/qr/')) {
              handleDetected(code.data)
            }
          } catch {}
        }, 250)
      } catch (err) {
        if (cancelled) return
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Permiso de camara denegado. Activa el permiso en la configuracion del navegador.')
        } else {
          setError('No se pudo acceder a la camara. Verifica los permisos.')
        }
      }
    }

    startCamera()
    return () => { cancelled = true; stopCamera() }
  }, [open, stopCamera, handleDetected])

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    try {
      const img = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)

      const hasBarcodeDetector = typeof globalThis.BarcodeDetector !== 'undefined'
      let found = false

      if (hasBarcodeDetector) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] })
          const barcodes = await detector.detect(img)
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            found = true
            handleDetected(barcodes[0].rawValue)
          }
        } catch {}
      }

      if (!found) {
        const code = jsQR(imageData.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
        if (code?.data && code.data.includes('/qr/')) {
          handleDetected(code.data)
        } else {
          setError('No se encontro un QR valido en la imagen')
          setTimeout(() => setError(null), 3000)
        }
      }
    } catch {
      setError('No se pudo leer la imagen')
      setTimeout(() => setError(null), 3000)
    }

    e.target.value = ''
  }

  return (
    <Modal open={open} onClose={() => { stopCamera(); onClose() }} title="Escanear QR" size="sm">
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#f59e0b' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
            <label
              className="h-10 px-5 rounded-xl text-sm font-medium flex items-center gap-2 cursor-pointer"
              style={{ background: 'var(--color-accent)', color: '#18181b' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              Subir foto del QR
              <input type="file" accept="image/*" capture="environment" onChange={handleFileInput} className="hidden" />
            </label>
          </div>
        ) : (
          <>
            <div className="relative w-full aspect-square max-w-[320px] rounded-2xl overflow-hidden" style={{ background: '#000' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 rounded-2xl" style={{ borderColor: 'var(--color-accent)' }}>
                    <div className="w-full h-0.5 animate-scan-line" style={{ background: 'var(--color-accent)', opacity: 0.7 }} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
              Apunta la camara al QR del cliente
            </p>
            <label
              className="h-9 px-4 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer"
              style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              O subir foto del QR
              <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            </label>
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
