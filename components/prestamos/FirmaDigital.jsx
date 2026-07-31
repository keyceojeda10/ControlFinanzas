'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Firma } from '@/components/pantallas/Pagare'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/i18n'

function formatFecha(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

const FREQ_LABEL = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }

async function generarComprobante(prestamo) {
  const p = prestamo
  const cliente = p.cliente || {}
  const pagos = (p.pagos || []).filter(x => !['recargo', 'descuento'].includes(x.tipo))
  const completado = p.estado === 'completado'

  const w = 800
  const lineH = 28

  // Load firma image first so we know its height
  let firmaImg = null
  if (p.firmaUrl) {
    try {
      firmaImg = await new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = p.firmaUrl
      })
    } catch {}
  }

  const pagosToShow = pagos.slice(0, 50)
  const headerH = 280
  const desgH = 8 * lineH + 40
  const pagosH = pagosToShow.length > 0 ? 60 + pagosToShow.length * lineH + (pagos.length > 50 ? lineH : 0) : 0
  const firmaDrawH = firmaImg ? 150 : 40
  const totalH = headerH + desgH + pagosH + firmaDrawH + 100

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = totalH
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, totalH)

  let y = 40

  // Title
  ctx.fillStyle = 'var(--cf-ink)'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Comprobante de préstamo', 40, y += 30)

  if (completado) {
    ctx.fillStyle = '#16a34a'
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillText('CANCELADO', w - 160, y)
  }

  y += 15
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()

  // Client data
  y += 30
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('DATOS DEL CLIENTE', 40, y)

  ctx.fillStyle = 'var(--cf-ink)'
  ctx.font = '15px system-ui, sans-serif'
  y += 26; ctx.fillText(`Nombre: ${cliente.nombre || '—'}`, 40, y)
  y += 24; ctx.fillText(`Cédula: ${cliente.cedula && !cliente.cedula.startsWith('SIN-') ? cliente.cedula : '—'}`, 40, y)
  y += 24; ctx.fillText(`Teléfono: ${cliente.telefono || '—'}`, 40, y)

  y += 20
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()

  // Loan details
  y += 25
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('DESGLOSE DEL PRESTAMO', 40, y)

  const rows = [
    ['Monto prestado', formatMoney(p.montoPrestado)],
    ['Total a pagar', formatMoney(p.totalAPagar)],
    ['Cuota', formatMoney(p.cuotaDiaria)],
    ['Frecuencia', FREQ_LABEL[p.frecuencia] || p.frecuencia],
    ['Fecha inicio', formatFecha(p.fechaInicio)],
    ['Fecha fin', formatFecha(p.fechaFin)],
    ['Total pagado', formatMoney(p.totalPagado ?? 0)],
    ['Saldo pendiente', formatMoney(p.saldoPendiente ?? 0)],
  ]

  y += 8
  rows.forEach(([label, value]) => {
    y += lineH
    ctx.fillStyle = '#555555'
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillText(label, 40, y)
    ctx.fillStyle = 'var(--cf-ink)'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(value, w - 40, y)
    ctx.textAlign = 'left'
  })

  // Pagos
  if (pagosToShow.length > 0) {
    y += 30
    ctx.strokeStyle = '#e5e5e5'
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()
    y += 25
    ctx.fillStyle = '#666666'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText(`HISTORIAL DE PAGOS (${pagos.length})`, 40, y)

    y += 8
    pagosToShow.forEach((pago) => {
      y += lineH
      ctx.fillStyle = '#555555'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(formatFecha(pago.fechaPago), 40, y)
      ctx.fillStyle = 'var(--cf-ink)'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(formatMoney(pago.montoPagado), w - 40, y)
      ctx.textAlign = 'left'
    })
    if (pagos.length > 50) {
      y += lineH
      ctx.fillStyle = '#999999'
      ctx.font = 'italic 12px system-ui, sans-serif'
      ctx.fillText(`... y ${pagos.length - 50} pagos mas`, 40, y)
    }
  }

  // Firma
  y += 30
  ctx.strokeStyle = '#e5e5e5'
  ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke()
  y += 25
  ctx.fillStyle = '#666666'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('FIRMA DEL CLIENTE', 40, y)

  if (firmaImg) {
    const firmaW = 300
    const fH = (firmaImg.height / firmaImg.width) * firmaW
    y += 15
    ctx.strokeStyle = '#e5e5e5'
    ctx.strokeRect(38, y - 2, firmaW + 4, fH + 4)
    ctx.drawImage(firmaImg, 40, y, firmaW, fH)
  } else {
    y += 20
    ctx.fillStyle = '#999999'
    ctx.font = 'italic 13px system-ui, sans-serif'
    ctx.fillText('Sin firma', 40, y)
  }

  return canvas
}

export default function FirmaDigital({ prestamo, onSave }) {
  const prestamoId = prestamo?.id
  const firmaUrl = prestamo?.firmaUrl

  const [modalFirmar, setModalFirmar] = useState(false)
  // QUE ESTA FIRMANDO. Va en la cabecera del recuadro, en una linea: recibio
  // tanto, devuelve tanto, en tantas cuotas. Un pagare que no dice las cifras
  // encima de la firma no zanja nada despues.
  const resumenFirma = [
    prestamo?.montoPrestado > 0 ? `Recibió ${formatMoney(prestamo.montoPrestado)}` : null,
    prestamo?.totalAPagar > 0 ? `devuelve ${formatMoney(prestamo.totalAPagar)}` : null,
    prestamo?.cuotaDiaria > 0 ? `cuota ${formatMoney(prestamo.cuotaDiaria)}` : null,
  ].filter(Boolean).join(' · ')
  const [modalVer, setModalVer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [descargandoPagare, setDescargandoPagare] = useState(false)
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef(null)

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'var(--cf-ink)'
  }, [])

  useEffect(() => {
    if (modalFirmar) {
      setTimeout(setupCanvas, 50)
      setHasStrokes(false)
    }
  }, [modalFirmar, setupCanvas])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX ?? e.clientX) - rect.left,
      y: (touch?.clientY ?? e.clientY) - rect.top,
    }
  }

  const startDraw = (e) => { e.preventDefault(); isDrawing.current = true; lastPoint.current = getPoint(e) }
  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const point = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPoint.current = point
    if (!hasStrokes) setHasStrokes(true)
  }
  const endDraw = () => { isDrawing.current = false; lastPoint.current = null }

  const limpiar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  const guardar = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    setSaving(true)
    try {
      const firma = canvas.toDataURL('image/png')
      const res = await fetch(`/api/prestamos/${prestamoId}/firma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onSave?.(data.firmaUrl)
      setModalFirmar(false)
    } catch {
      alert('Error al guardar la firma')
    } finally {
      setSaving(false)
    }
  }

  const descargarPagare = async () => {
    if (!prestamoId) return
    setDescargandoPagare(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/pagare`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `pagare-${prestamo.cliente?.nombre?.replace(/\s+/g, '-') || prestamoId}.pdf`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al generar el pagare')
    } finally {
      setDescargandoPagare(false)
    }
  }

  const descargarComprobante = async () => {
    if (!prestamo) return
    setDescargando(true)
    try {
      const canvas = await generarComprobante(prestamo)
      const link = document.createElement('a')
      link.download = `comprobante-prestamo-${prestamo.cliente?.nombre?.replace(/\s+/g, '-') || prestamoId}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      alert('Error al generar comprobante')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      {/* Card visible */}
      <div
        className="w-full rounded-[12px] border overflow-hidden"
        style={{
          background: firmaUrl
            ? 'color-mix(in srgb, var(--cf-green-dark) 5%, var(--cf-card))'
            : 'var(--cf-card)',
          borderColor: firmaUrl
            ? 'color-mix(in srgb, var(--cf-green-dark) 20%, var(--cf-border))'
            : 'var(--cf-border)',
        }}
      >
        {/* Header */}
        <div className="p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: firmaUrl ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' : 'color-mix(in srgb, var(--cf-ink-3) 10%, transparent)' }}
          >
            <svg className="w-4 h-4" style={{ color: firmaUrl ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Firma del cliente</p>
            {!firmaUrl && (
              <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>Sin firma</p>
            )}
          </div>
        </div>

        {/* Firma visible */}
        {firmaUrl && (
          <button
            type="button"
            onClick={() => setModalVer(true)}
            className="w-full px-3 pb-2"
          >
            <div className="rounded-[10px] overflow-hidden w-full border" style={{ background: '#ffffff', borderColor: 'var(--cf-border)', height: 80 }}>
              <img src={firmaUrl} alt="Firma" className="h-full w-auto object-contain mx-auto" />
            </div>
          </button>
        )}

        {/* Botones */}
        <div className="px-3 pb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setModalFirmar(true)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] text-[11px] font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--cf-ink-2)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
            {firmaUrl ? 'Modificar' : 'Firmar'}
          </button>
          <button
            type="button"
            onClick={descargarPagare}
            disabled={descargandoPagare}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] text-[11px] font-medium transition-colors"
            style={{
              background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
              color: 'var(--cf-gold)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            {descargandoPagare ? 'Generando...' : 'Pagaré'}
          </button>
          <button
            type="button"
            onClick={descargarComprobante}
            disabled={descargando}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[8px] text-[11px] font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--cf-ink-2)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {descargando ? 'Generando...' : 'Comprobante'}
          </button>
        </div>
      </div>

      {/* Modal ver firma ampliada */}
      <Modal open={modalVer} onClose={() => setModalVer(false)} title="Firma del cliente">
        {firmaUrl && (
          <div className="rounded-[12px] overflow-hidden border" style={{ background: '#ffffff', borderColor: 'var(--cf-border)' }}>
            <img src={firmaUrl} alt="Firma" className="w-full object-contain" style={{ maxHeight: 300 }} />
          </div>
        )}
      </Modal>

      {/* Modal firmar/re-firmar */}
      {/* -- T18-02, MONTADA --
          El recuadro era un cuadro blanco con «Firmar aqui» en gris y dos
          botones iguales debajo. `Firma` le pone lo que un papel tiene y una
          caja no: LA LINEA sobre la que se firma, el rotulo «Firma del
          cliente», y la fecha y la hora al lado — que es lo que convierte un
          garabato en algo fechado.

          Y el titular dice el nombre: «Firma aqui, Steven Olmos». Se lo enseña
          el cobrador al cliente, y un «Firma del cliente» generico no confirma
          a quien se le esta pidiendo.

          El `canvas` va por la ranura `children`: el trazo que dibuja la lamina
          es de mentira, aqui la firma es de verdad. */}
      <Modal open={modalFirmar} onClose={() => setModalFirmar(false)}>
        <div style={{ height: 'min(70vh, 460px)' }}>
          <Firma
            nombre={prestamo?.cliente?.nombre ?? 'aquí'}
            resumen={resumenFirma}
            fecha={new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            hora={new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
            onBorrar={limpiar}
            onListo={guardar}
            guardando={saving}
            puedeGuardar={hasStrokes}
          >
            <canvas
              ref={canvasRef}
              className="touch-none"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                cursor: 'crosshair', background: 'transparent',
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </Firma>
        </div>
      </Modal>
    </>
  )
}
