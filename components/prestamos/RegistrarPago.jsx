'use client'
// components/prestamos/RegistrarPago.jsx - Modal de registro de pago

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { formatCOP } from '@/lib/calculos'

export default function RegistrarPago({ prestamoId, cuotaDiaria, saldoPendiente, open, onClose, onSuccess }) {
  const [monto,   setMonto]   = useState(String(Math.round(cuotaDiaria ?? 0)))
  const [tipo,    setTipo]    = useState('completo')
  const [nota,    setNota]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async () => {
    const m = Number(monto)
    if (!m || m <= 0) { setError('Ingresa un monto válido'); return }
    if (m > saldoPendiente) {
      setError(`El monto no puede superar el saldo: ${formatCOP(saldoPendiente)}`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ montoPagado: m, tipo, nota }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrar el pago'); return }

      onSuccess?.(data)
      onClose?.()
      setMonto(String(Math.round(cuotaDiaria ?? 0)))
      setTipo('completo')
      setNota('')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading}>Confirmar pago</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-[#64748b]">Cuota diaria</span>
          <span className="font-semibold text-[#f1f5f9]">{formatCOP(cuotaDiaria)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#64748b]">Saldo pendiente</span>
          <span className="font-semibold text-[#f1f5f9]">{formatCOP(saldoPendiente)}</span>
        </div>

        <div className="border-t border-[#2a3245] pt-4 space-y-4">
          <Input
            label="Monto del pago *"
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError('') }}
            prefix="$"
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#94a3b8]">Tipo de pago</span>
            <div className="flex gap-2">
              {['completo', 'parcial'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={[
                    'flex-1 h-9 rounded-[10px] border text-sm font-medium transition-all capitalize cursor-pointer',
                    tipo === t
                      ? 'bg-[rgba(59,130,246,0.15)] border-[#3b82f6] text-[#3b82f6]'
                      : 'bg-transparent border-[#2a3245] text-[#94a3b8] hover:bg-[#222a3d]',
                  ].join(' ')}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Nota (opcional)"
            placeholder="Ej: Pago en efectivo"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
