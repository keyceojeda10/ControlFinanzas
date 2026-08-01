'use client'

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '@/components/ui/Modal'

export default function QrClienteModal({ open, onClose, cliente }) {
  const qrRef = useRef(null)

  if (!cliente) return null

  const qrUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/qr/${cliente.id}`

  const handleDescargar = async () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const size = 800
    canvas.width = size
    canvas.height = size + 120
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      ctx.fillStyle = '#18181b'
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(cliente.nombre, size / 2, size + 50)
      ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#71717a'
      ctx.fillText('Escanea para cobrar', size / 2, size + 85)

      const link = document.createElement('a')
      link.download = `QR-${cliente.nombre.replace(/\s+/g, '-')}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleCompartir = async () => {
    if (!navigator.share) {
      handleDescargar()
      return
    }
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const size = 800
    canvas.width = size
    canvas.height = size + 120
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = async () => {
      ctx.drawImage(img, 0, 0, size, size)
      ctx.fillStyle = '#18181b'
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(cliente.nombre, size / 2, size + 50)
      ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillStyle = '#71717a'
      ctx.fillText('Escanea para cobrar', size / 2, size + 85)

      canvas.toBlob(async (blob) => {
        const file = new File([blob], `QR-${cliente.nombre.replace(/\s+/g, '-')}.png`, { type: 'image/png' })
        try {
          await navigator.share({ files: [file], title: `QR de ${cliente.nombre}` })
        } catch {}
      }, 'image/png')
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const handleImprimir = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>QR ${cliente.nombre}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,system-ui,sans-serif}
      h2{margin:24px 0 4px;font-size:24px}p{color:#666;font-size:16px;margin:0}@media print{body{padding:0}}</style></head>
      <body>${svgData}<h2>${cliente.nombre}</h2><p>Escanea para cobrar</p>
      <script>setTimeout(()=>{window.print();window.close()},400)<\/script></body></html>`)
    win.document.close()
  }

  return (
    <Modal open={open} onClose={onClose} title={`QR de ${cliente.nombre}`} size="sm">
      <div className="flex flex-col items-center gap-5">
        <div
          ref={qrRef}
          className="rounded-2xl p-5"
          style={{ background: '#ffffff' }}
        >
          <QRCodeSVG
            value={qrUrl}
            size={240}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={4}
          />
        </div>

        <p className="text-sm text-center" style={{ color: 'var(--cf-ink-2)' }}>
          Imprime o comparte este QR. Al escanearlo, el cobrador va directo al perfil y puede cobrar al instante.
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={handleDescargar}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--cf-surface)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Descargar
          </button>
          <button
            onClick={handleImprimir}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--cf-surface)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Imprimir
          </button>
          <button
            onClick={handleCompartir}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--cf-gold)', color: '#18181b' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Compartir
          </button>
        </div>
      </div>
    </Modal>
  )
}
