'use client'
// components/prestamos/AjusteSaldo.jsx — Modal de recargo/descuento

import { useState } from 'react'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { formatCOP } from '@/lib/calculos'

const CONFIG = {
  recargo: {
    titulo: 'Agregar recargo',
    descripcion: 'Suma un monto al saldo del préstamo (multa, artículo extra, etc.)',
    color: '#f97316',
    signo: '+',
    placeholder: 'Ej: Multa por 5 días de atraso',
    boton: 'Aplicar recargo',
  },
  descuento: {
    titulo: 'Aplicar descuento',
    descripcion: 'Resta un monto del saldo del préstamo (pago anticipado, devolución, etc.)',
    color: '#22c55e',
    signo: '−',
    placeholder: 'Ej: Descuento por pago anticipado 1 mes',
    boton: 'Aplicar descuento',
  },
}

export default function AjusteSaldo({
  prestamoId,
  saldoPendiente,
  totalAPagar,
  tipoAjuste,
  open,
  onClose,
  onSuccess,
}) {
  const [monto, setMonto]           = useState('')
  const [nota, setNota]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const cfg = CONFIG[tipoAjuste] || CONFIG.recargo
  const montoNum = Number(monto) || 0

  const nuevoSaldo = tipoAjuste === 'recargo'
    ? saldoPendiente + montoNum
    : Math.max(0, saldoPendiente - montoNum)

  const handleSubmit = async () => {
    if (montoNum <= 0) { setError('Ingresa un monto válido'); return }
    if (!nota.trim()) { setError('El motivo es obligatorio'); return }
    if (tipoAjuste === 'descuento' && montoNum > saldoPendiente) {
      setError(`No puede superar el saldo pendiente (${formatCOP(saldoPendiente)})`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPagado: montoNum,
          tipo: tipoAjuste,
          nota: nota.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al aplicar ajuste')
      }
      const prestamoActualizado = await res.json()
      onSuccess?.(prestamoActualizado)
      handleClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMonto('')
    setNota('')
    setError('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title={cfg.titulo}>
      <div className="space-y-4">
        <p className="text-xs text-[#888888]">{cfg.descripcion}</p>

        {/* Saldo actual */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-[#111111] border border-[#2a2a2a]">
          <span className="text-xs text-[#888888]">Saldo actual</span>
          <span className="text-sm font-semibold text-white font-mono-display">
            {formatCOP(saldoPendiente)}
          </span>
        </div>

        {/* Monto */}
        <Input
          label="Monto del ajuste"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          prefix="$"
        />

        {/* Motivo */}
        <div>
          <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
            Motivo (obligatorio)
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={cfg.placeholder}
            rows={2}
            className="w-full rounded-[10px] border border-[#2a2a2a] bg-[#111111] px-3 py-2.5 text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#f5c518] transition-colors resize-none"
          />
        </div>

        {/* Preview del impacto */}
        {montoNum > 0 && (
          <div
            className="px-3 py-2.5 rounded-[10px] border"
            style={{
              background: `${cfg.color}08`,
              borderColor: `${cfg.color}20`,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#888888]">
                {tipoAjuste === 'recargo' ? 'Recargo' : 'Descuento'}
              </span>
              <span className="text-sm font-semibold font-mono-display" style={{ color: cfg.color }}>
                {cfg.signo}{formatCOP(montoNum)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888888]">Nuevo saldo</span>
              <span className="text-sm font-bold text-white font-mono-display">
                {formatCOP(nuevoSaldo)}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-[#ef4444]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {cfg.boton}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
