'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'

export default function QrScanner({ open, onClose }) {
  const router = useRouter()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const scannerRef = useRef(null)
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

  const handleDetected = useCallback((url) => {
    stopCamera()
    onClose()
    const match = url.match(/\/qr\/([a-zA-Z0-9_-]+)/)
    if (match) {
      router.push(`/qr/${match[1]}`)
    } else if (url.startsWith('/') || url.includes(window.location.origin)) {
      const path = url.replace(window.location.origin, '')
      router.push(path)
    }
  }, [router, onClose, stopCamera])

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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setScanning(true)

        if ('BarcodeDetector' in window) {
          const detector = new BarcodeDetector({ formats: ['qr_code'] })
          scannerRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                const val = barcodes[0].rawValue
                if (val && (val.includes('/qr/') || val.includes(window.location.origin))) {
                  handleDetected(val)
                }
              }
            } catch {}
          }, 300)
        } else {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          scannerRef.current = setInterval(() => {
            if (!videoRef.current || videoRef.current.readyState < 2) return
            canvas.width = videoRef.current.videoWidth
            canvas.height = videoRef.current.videoHeight
            ctx.drawImage(videoRef.current, 0, 0)
          }, 500)
        }
      } catch {
        if (!cancelled) setError('No se pudo acceder a la camara. Verifica los permisos.')
      }
    }

    startCamera()
    return () => { cancelled = true; stopCamera() }
  }, [open, stopCamera, handleDetected])

  const handleFileInput = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if ('BarcodeDetector' in window) {
      const img = await createImageBitmap(file)
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      const barcodes = await detector.detect(img)
      if (barcodes.length > 0) {
        handleDetected(barcodes[0].rawValue)
      } else {
        setError('No se encontro un QR valido en la imagen')
        setTimeout(() => setError(null), 3000)
      }
    }
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
