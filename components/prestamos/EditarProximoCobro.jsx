'use client'

import { useState, useEffect } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export default function EditarProximoCobro({ prestamoId, prestamo, open, onClose, onSuccess }) {
  const [fecha, setFecha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (prestamo?.proximoCobroManual) {
      setFecha(new Date(prestamo.proximoCobroManual).toISOString().slice(0, 10))
    } else {
      const hoy = new Date(Date.now() - 5 * 60 * 60 * 1000)
      setFecha(hoy.toISOString().slice(0, 10))
    }
  }, [open, prestamo?.proximoCobroManual])

  const handleClose = () => { setError(''); onClose?.() }

  const handleSubmit = async () => {
    if (!fecha) { setError('Selecciona una fecha'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'proximoCobro', proximoCobro: fecha }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRestaurar = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'proximoCobro', proximoCobro: null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al restaurar')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Cambiar fecha de cobro">
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)] leading-snug">
          Cambia la fecha del próximo cobro manualmente. Al registrar un pago, la fecha vuelve a calcularse automáticamente.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
            Próximo cobro
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 px-3 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
          />
        </div>

        {prestamo?.proximoCobroManual && (
          <button
            type="button"
            onClick={handleRestaurar}
            disabled={loading}
            className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-1"
          >
            Restaurar fecha automática
          </button>
        )}

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}
