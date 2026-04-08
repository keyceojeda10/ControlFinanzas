'use client'
// components/prestamos/ModificarPlazo.jsx — Modal para extender o corregir fecha fin

import { useState, useEffect, useMemo } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { formatCOP } from '@/lib/calculos'

const toISODate = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 10)
}

const addDays = (fechaInicio, dias) => {
  const d = new Date(fechaInicio)
  d.setDate(d.getDate() + dias)
  return d
}

const diffDays = (desde, hasta) => {
  const ms = new Date(hasta) - new Date(desde)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export default function ModificarPlazo({
  prestamoId,
  prestamo,
  open,
  onClose,
  onSuccess,
}) {
  const [modo, setModo] = useState('extender') // 'extender' | 'corregir'
  const [diasExtra,   setDiasExtra]   = useState('')
  const [nuevaFecha,  setNuevaFecha]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const fechaInicio = prestamo?.fechaInicio
  const fechaFinActual = prestamo?.fechaFin
  const diasPlazoActual = prestamo?.diasPlazo || 0
  const cuotaActual = prestamo?.cuotaDiaria || 0
  const totalAPagar = prestamo?.totalAPagar || 0
  const frecuencia = prestamo?.frecuencia || 'diario'

  // Inicializar inputs cuando se abre
  useEffect(() => {
    if (open && fechaFinActual) {
      setNuevaFecha(toISODate(fechaFinActual))
      setDiasExtra('')
      setError('')
    }
  }, [open, fechaFinActual])

  // Cálculos del preview
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] || 1

  const preview = useMemo(() => {
    if (!nuevaFecha || !fechaInicio) return null
    const nuevoDiasPlazo = diffDays(fechaInicio, nuevaFecha)
    if (nuevoDiasPlazo <= 0) return null

    const totalPeriodosNuevos = Math.ceil(nuevoDiasPlazo / diasPorPeriodo)

    if (modo === 'extender') {
      const cuotaBase = totalAPagar / totalPeriodosNuevos
      const nuevaCuota = Math.max(50, Math.round(cuotaBase / 50) * 50)
      const nuevoTotal = nuevaCuota * totalPeriodosNuevos
      return {
        nuevoDiasPlazo,
        nuevaCuota,
        nuevoTotal,
        cuotaDelta: nuevaCuota - cuotaActual,
      }
    }
    return { nuevoDiasPlazo }
  }, [nuevaFecha, fechaInicio, modo, totalAPagar, cuotaActual, diasPorPeriodo])

  // Bidireccional: al cambiar días → actualiza fecha
  const handleDiasChange = (val) => {
    setDiasExtra(val)
    const dias = Number(val)
    if (!dias || !fechaFinActual) return
    const nueva = addDays(fechaFinActual, dias)
    setNuevaFecha(toISODate(nueva))
  }

  // Bidireccional: al cambiar fecha → actualiza días
  const handleFechaChange = (val) => {
    setNuevaFecha(val)
    if (!val || !fechaFinActual) return
    const dias = diffDays(fechaFinActual, val)
    setDiasExtra(dias > 0 ? String(dias) : '')
  }

  const handleSubmit = async () => {
    if (!nuevaFecha) { setError('Ingresa la nueva fecha'); return }
    if (preview && preview.nuevoDiasPlazo <= 0) {
      setError('La fecha debe ser posterior al inicio del préstamo')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo,
          fechaFin: nuevaFecha,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al modificar plazo')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setDiasExtra('')
    setError('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Modificar plazo">
      <div className="space-y-4">
        {/* Toggle de modo */}
        <div>
          <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
            ¿Qué quieres hacer?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModo('extender')}
              className={[
                'h-auto py-2.5 px-3 rounded-[10px] border text-left transition-all cursor-pointer',
                modo === 'extender'
                  ? 'bg-[rgba(245,197,24,0.1)] border-[#f5c518]'
                  : 'bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a]',
              ].join(' ')}
            >
              <div className={`text-xs font-semibold ${modo === 'extender' ? 'text-[#f5c518]' : 'text-white'}`}>
                Extender plazo
              </div>
              <div className="text-[10px] text-[#888888] mt-0.5 leading-tight">
                Dar más tiempo. Recalcula cuota.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo('corregir')}
              className={[
                'h-auto py-2.5 px-3 rounded-[10px] border text-left transition-all cursor-pointer',
                modo === 'corregir'
                  ? 'bg-[rgba(59,130,246,0.1)] border-[#3b82f6]'
                  : 'bg-transparent border-[#2a2a2a] hover:bg-[#1a1a1a]',
              ].join(' ')}
            >
              <div className={`text-xs font-semibold ${modo === 'corregir' ? 'text-[#3b82f6]' : 'text-white'}`}>
                Corregir fecha
              </div>
              <div className="text-[10px] text-[#888888] mt-0.5 leading-tight">
                Error al crear. No toca cuota.
              </div>
            </button>
          </div>
        </div>

        {/* Resumen actual */}
        <div className="px-3 py-2.5 rounded-[10px] bg-[#111111] border border-[#2a2a2a] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#888888]">Fecha fin actual</span>
            <span className="text-xs text-white font-mono-display">
              {fechaFinActual ? new Date(fechaFinActual).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#888888]">Cuota {frecuencia}</span>
            <span className="text-xs text-white font-mono-display">{formatCOP(cuotaActual)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#888888]">Plazo actual</span>
            <span className="text-xs text-white">{diasPlazoActual} días</span>
          </div>
        </div>

        {/* Inputs bidireccionales */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Días extra"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 15"
            value={diasExtra}
            onChange={(e) => handleDiasChange(e.target.value)}
          />
          <Input
            label="Nueva fecha fin"
            type="date"
            value={nuevaFecha}
            onChange={(e) => handleFechaChange(e.target.value)}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div
            className="rounded-[12px] border p-3 space-y-1.5"
            style={{
              background: modo === 'extender' ? 'rgba(245,197,24,0.06)' : 'rgba(59,130,246,0.06)',
              borderColor:  modo === 'extender' ? 'rgba(245,197,24,0.25)' : 'rgba(59,130,246,0.25)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#888888]">Nuevo plazo</span>
              <span className="text-xs font-semibold text-white">{preview.nuevoDiasPlazo} días</span>
            </div>
            {modo === 'extender' && preview.nuevaCuota != null && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#888888]">Nueva cuota {frecuencia}</span>
                  <span className="text-xs font-bold text-[#f5c518] font-mono-display">
                    {formatCOP(preview.nuevaCuota)}
                    {preview.cuotaDelta !== 0 && (
                      <span className={`ml-1 text-[9px] ${preview.cuotaDelta < 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        ({preview.cuotaDelta > 0 ? '+' : ''}{formatCOP(Math.abs(preview.cuotaDelta))})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#888888]">Total a pagar</span>
                  <span className="text-xs font-semibold text-white font-mono-display">
                    {formatCOP(preview.nuevoTotal)}
                  </span>
                </div>
              </>
            )}
            {modo === 'corregir' && (
              <p className="text-[10px] text-[#888888] leading-snug pt-1">
                Solo se actualizará la fecha. La cuota, el total y los pagos no cambian.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[#ef4444]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {modo === 'extender' ? 'Extender plazo' : 'Corregir fecha'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
