'use client'
// components/gastos/ReportarGasto.jsx

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCOP } from '@/lib/calculos'

const GASTO_ICONS = {
  gasolina: <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>,
  llanta: <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.684-5.684a7.5 7.5 0 1010.606 0l-2.298 2.298M14.5 9.5L16 8m-1.5 1.5L13 8" /></svg>,
  reparacion: <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  otro: <svg className="w-4 h-4 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
}

const TIPOS_GASTO = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'llanta', label: 'Pinchazo/Llanta' },
  { value: 'reparacion', label: 'Reparación menor' },
  { value: 'otro', label: 'Otro' },
]

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const fmtFecha = (fecha) => {
  if (!fecha || !FECHA_REGEX.test(fecha)) return 'hoy'
  return new Date(fecha + 'T12:00:00-05:00').toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

export default function ReportarGasto({ open, onClose, onSuccess, fecha }) {
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
        body: JSON.stringify({
          description: desc,
          monto: m,
          ...(FECHA_REGEX.test(fecha || '') ? { fecha } : {}),
        }),
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
        <div className="px-3 py-2 rounded-[10px] bg-[#111111] border border-[#2a2a2a]">
          <p className="text-[11px] text-[#888888]">Fecha del gasto</p>
          <p className="text-sm text-white font-semibold">{fmtFecha(fecha)}</p>
        </div>

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
                {GASTO_ICONS[t.value]}{t.label}
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
