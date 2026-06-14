'use client'
// components/visitas/ReagendarVisitaModal.jsx — Bottom sheet para reagendar visita de cobro

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const MOTIVOS = [
  { value: 'no_estaba', label: 'No estaba en casa' },
  { value: 'negocio_cerrado', label: 'Negocio cerrado' },
  { value: 'no_tenia_dinero', label: 'No tenia dinero' },
  { value: 'pidio_plazo', label: 'Pidio plazo' },
  { value: 'otro', label: 'Otro' },
]

function calcularProximoDiaHabil() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  // Skip Saturday and Sunday
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function formatFechaLocal(date) {
  return date.toISOString().split('T')[0]
}

function formatFechaDisplay(date) {
  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ReagendarVisitaModal({ open, onClose, clienteId, clienteNombre, prestamoId, rutaId, onSuccess }) {
  const [motivo, setMotivo] = useState('')
  const [motivoDetalle, setMotivoDetalle] = useState('')
  const [fechaOpcion, setFechaOpcion] = useState('')
  const [fechaCustom, setFechaCustom] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hoy = new Date()
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)
  const proximoHabil = calcularProximoDiaHabil()

  const fechaOpciones = [
    { value: 'hoy', label: 'Hoy mas tarde', date: hoy },
    { value: 'manana', label: `Manana (${formatFechaDisplay(manana)})`, date: manana },
    { value: 'proximo_habil', label: `Próx. día habil (${formatFechaDisplay(proximoHabil)})`, date: proximoHabil },
    { value: 'custom', label: 'Fecha especifica', date: null },
  ]

  const getFechaReagendada = () => {
    if (fechaOpcion === 'custom' && fechaCustom) return fechaCustom
    const opcion = fechaOpciones.find(o => o.value === fechaOpcion)
    return opcion?.date ? formatFechaLocal(opcion.date) : null
  }

  const handleSubmit = async () => {
    if (!motivo) { setError('Selecciona un motivo'); return }
    if (!fechaOpcion) { setError('Selecciona una fecha'); return }
    if (fechaOpcion === 'custom' && !fechaCustom) { setError('Selecciona una fecha'); return }

    const fecha = getFechaReagendada()
    if (!fecha) { setError('Fecha inválida'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          prestamoId: prestamoId || null,
          rutaId: rutaId || null,
          fechaOriginal: formatFechaLocal(hoy),
          fechaReagendada: fecha,
          motivo,
          motivoDetalle: motivo === 'otro' ? motivoDetalle : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al reagendar')
      }

      onSuccess?.()
      handleClose()
    } catch (err) {
      setError(err.message || 'Error al reagendar visita')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMotivo('')
    setMotivoDetalle('')
    setFechaOpcion('')
    setFechaCustom('')
    setError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Reagendar visita"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>Reagendar visita</Button>
        </>
      }
    >
      <div className="space-y-5">
        {clienteNombre && (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {clienteNombre}
          </p>
        )}

        {error && (
          <div className="text-xs rounded-[8px] px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
            {error}
          </div>
        )}

        {/* Motivo */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Motivo
          </label>
          <div className="space-y-1.5">
            {MOTIVOS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setMotivo(m.value); setError('') }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left text-[13px] transition-colors"
                style={{
                  background: motivo === m.value ? 'rgba(245,197,24,0.08)' : 'var(--color-bg-base)',
                  border: `1px solid ${motivo === m.value ? 'rgba(245,197,24,0.35)' : 'var(--color-border)'}`,
                  color: motivo === m.value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                }}
              >
                <span className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{
                  border: `2px solid ${motivo === m.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                  {motivo === m.value && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />}
                </span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Detalle (solo para "otro") */}
        {motivo === 'otro' && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Detalle
            </label>
            <textarea
              value={motivoDetalle}
              onChange={e => setMotivoDetalle(e.target.value)}
              rows={2}
              placeholder="Describe el motivo..."
              className="cf-input w-full text-sm resize-none"
            />
          </div>
        )}

        {/* Fecha */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Reagendar para
          </label>
          <div className="grid grid-cols-2 gap-2">
            {fechaOpciones.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { setFechaOpcion(o.value); setError('') }}
                className="px-3 py-2.5 rounded-[10px] text-[12px] font-medium text-center transition-colors"
                style={{
                  background: fechaOpcion === o.value ? 'rgba(245,197,24,0.08)' : 'var(--color-bg-base)',
                  border: `1px solid ${fechaOpcion === o.value ? 'rgba(245,197,24,0.35)' : 'var(--color-border)'}`,
                  color: fechaOpcion === o.value ? 'var(--color-accent)' : 'var(--color-text-primary)',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {fechaOpcion === 'custom' && (
            <input
              type="date"
              value={fechaCustom}
              onChange={e => setFechaCustom(e.target.value)}
              min={formatFechaLocal(hoy)}
              className="cf-input w-full mt-2 text-sm"
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
