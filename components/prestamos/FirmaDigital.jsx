'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export default function FirmaDigital({ prestamoId, firmaUrl, onSave }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
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
    ctx.strokeStyle = '#ffffff'
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(setupCanvas, 50)
      setHasStrokes(false)
    }
  }, [open, setupCanvas])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    const x = (touch?.clientX ?? e.clientX) - rect.left
    const y = (touch?.clientY ?? e.clientY) - rect.top
    return { x, y }
  }

  const startDraw = (e) => {
    e.preventDefault()
    isDrawing.current = true
    lastPoint.current = getPoint(e)
  }

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

  const endDraw = () => {
    isDrawing.current = false
    lastPoint.current = null
  }

  const limpiar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
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
      setOpen(false)
    } catch {
      alert('Error al guardar la firma')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Boton / preview */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[14px] border p-3 flex items-center gap-3 text-left transition-colors active:scale-[0.99]"
        style={{
          background: firmaUrl
            ? 'color-mix(in srgb, var(--color-success) 5%, var(--color-bg-card))'
            : 'var(--color-bg-card)',
          borderColor: firmaUrl
            ? 'color-mix(in srgb, var(--color-success) 20%, var(--color-border))'
            : 'var(--color-border)',
        }}
      >
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: firmaUrl ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : 'color-mix(in srgb, var(--color-text-muted) 10%, transparent)' }}
        >
          <svg className="w-4 h-4" style={{ color: firmaUrl ? 'var(--color-success)' : 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Firma del cliente</p>
          {firmaUrl ? (
            <div className="mt-1 h-10 rounded-[8px] overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <img src={firmaUrl} alt="Firma" className="h-full w-auto object-contain mx-auto" style={{ filter: 'brightness(1.2)' }} />
            </div>
          ) : (
            <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Toca para firmar</p>
          )}
        </div>
        <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Modal canvas */}
      <Modal open={open} onClose={() => setOpen(false)} title="Firma del cliente">
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            El cliente firma con el dedo sobre el recuadro.
          </p>
          <div className="relative rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: '#1a1a1a' }}>
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: 200, cursor: 'crosshair' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasStrokes && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-[#555]">Firmar aqui</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={limpiar} className="flex-1">Limpiar</Button>
            <Button onClick={guardar} loading={saving} disabled={!hasStrokes} className="flex-1">Guardar firma</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
