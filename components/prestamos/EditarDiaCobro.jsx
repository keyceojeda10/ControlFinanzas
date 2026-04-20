'use client'
// components/prestamos/EditarDiaCobro.jsx — Modal para fijar/quitar el dia de cobro ancla

import { useState, useEffect } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { encolarMutacion } from '@/lib/offline'

const DIAS_SEMANA = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
]

export default function EditarDiaCobro({ prestamoId, prestamo, open, onClose, onSuccess }) {
  const frecuencia = prestamo?.frecuencia || 'diario'
  const esSemana = frecuencia === 'semanal' || frecuencia === 'quincenal'
  const esMes = frecuencia === 'mensual'

  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (esSemana) setValor(prestamo?.diaCobroSemana != null ? String(prestamo.diaCobroSemana) : '')
    else if (esMes) setValor(prestamo?.diaCobroMes != null ? String(prestamo.diaCobroMes) : '')
    else setValor('')
  }, [open, esSemana, esMes, prestamo?.diaCobroSemana, prestamo?.diaCobroMes])

  const handleClose = () => { setError(''); onClose?.() }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const payload = { modo: 'diaCobro' }
    if (esSemana) payload.diaCobroSemana = valor === '' ? null : Number(valor)
    else if (esMes) payload.diaCobroMes = valor === '' ? null : Number(valor)

    // Offline: encolar y salir
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await encolarMutacion({
          tipo: 'prestamo.update',
          entityId: prestamoId,
          payload,
          baseUpdatedAt: prestamo?.updatedAt,
        })
        try { sessionStorage.setItem('cf-toast', 'Día de cobro actualizado. Se sincronizará al volver online.') } catch {}
        onSuccess?.()
        handleClose()
      } catch {
        setError('No se pudo guardar offline.')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          await encolarMutacion({ tipo: 'prestamo.update', entityId: prestamoId, payload, baseUpdatedAt: prestamo?.updatedAt })
          try { sessionStorage.setItem('cf-toast', 'Día de cobro actualizado. Se sincronizará al volver online.') } catch {}
          onSuccess?.()
          handleClose()
          return
        } catch {}
      }
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!esSemana && !esMes) {
    return (
      <Modal open={open} onClose={handleClose} title="Día de cobro">
        <p className="text-sm text-[var(--color-text-muted)]">
          La frecuencia diaria no admite un día fijo de cobro.
        </p>
        <div className="pt-3">
          <Button variant="secondary" onClick={handleClose} className="w-full">Cerrar</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={handleClose} title="Día de cobro">
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)] leading-snug">
          {esSemana
            ? 'Fija el día de la semana en que siempre se cobra. Aunque se atrase un pago, el próximo cobro caerá en ese día.'
            : 'Fija el día del mes en que siempre se cobra. Si el mes no tiene ese día, se cobra el último día disponible.'}
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
            {esSemana ? 'Día de la semana' : 'Día del mes'}
          </label>
          <select
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-10 px-2 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
          >
            <option value="">Sin día fijo (corre según inicio)</option>
            {esSemana
              ? DIAS_SEMANA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)
              : Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
          </select>
        </div>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}
