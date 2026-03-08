'use client'
// components/gastos/ReportarGasto.jsx

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCOP } from '@/lib/calculos'

const TIPOS_GASTO = [
  { value: 'gasolina', label: '⛽ Gasolina' },
  { value: 'llanta', label: '🔧 Pinchazo/Llanta' },
  { value: 'reparacion', label: '🔩 Reparación menor' },
  { value: 'otro', label: '📝 Otro' },
]

export default function ReportarGasto({ open, onClose, onSuccess }) {
  const [tipo, setTipo] = useState('gasolina')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const m = Number(monto)
    if (!m || m <= 0) { setError('Ingresa un monto válido'); return }

    setLoading(true)
    setError('')
    try {
      const desc = tipo === 'otro' ? descripcion : TIPOS_GASTO.find(t => t.value === tipo)?.label
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, monto: m }),
      })
      if (!res.ok) throw new Error('Error al reportar gasto')
      onSuccess?.()
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setTipo('gasolina')
    setMonto('')
    setDescripcion('')
    setError('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Reportar Gasto Menor">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-2">
            Tipo de gasto
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_GASTO.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={[
                  'h-10 rounded-[10px] border text-sm font-medium transition-all cursor-pointer',
                  tipo === t.value
                    ? 'bg-[rgba(245,197,24,0.15)] border-[#f5c518] text-[#f5c518]'
                    : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tipo === 'otro' && (
          <Input
            label="Descripción"
            placeholder="Describe el gasto"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        )}

        <Input
          label="Monto"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          prefix="$"
        />

        {error && <p className="text-sm text-[#ef4444]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            Reportar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
