'use client'
// components/prestamos/RenovarPrestamo.jsx — Modal de renovación de préstamo

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { calcularPrestamo, formatCOP } from '@/lib/calculos'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

export default function RenovarPrestamo({
  prestamoId,
  saldoPendiente,
  prestamoAnterior,     // para heredar tasa/plazo/frecuencia como defaults
  clienteNombre,
  open,
  onClose,
}) {
  const router = useRouter()

  const [monto,       setMonto]       = useState('')
  const [tasa,        setTasa]        = useState(String(prestamoAnterior?.tasaInteres ?? '20'))
  const [plazo,       setPlazo]       = useState(String(prestamoAnterior?.diasPlazo ?? '30'))
  const [frecuencia,  setFrecuencia]  = useState(prestamoAnterior?.frecuencia ?? 'diario')
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const montoNum = Number(monto) || 0
  const diferencia = Math.max(0, montoNum - saldoPendiente)

  const calculo = useMemo(() => {
    if (!montoNum || !tasa || !plazo) return null
    try {
      return calcularPrestamo({
        montoPrestado: montoNum,
        tasaInteres:   Number(tasa),
        diasPlazo:     Number(plazo),
        fechaInicio,
        frecuencia,
      })
    } catch { return null }
  }, [montoNum, tasa, plazo, fechaInicio, frecuencia])

  const handleSubmit = async () => {
    if (montoNum <= 0) { setError('Ingresa el nuevo monto'); return }
    if (montoNum < saldoPendiente) {
      setError(`El monto debe cubrir al menos el saldo pendiente (${formatCOP(saldoPendiente)})`)
      return
    }
    if (!tasa || Number(tasa) < 0) { setError('Tasa inválida'); return }
    if (!plazo || Number(plazo) <= 0) { setError('Plazo inválido'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPrestado: montoNum,
          tasaInteres:   Number(tasa),
          diasPlazo:     Number(plazo),
          fechaInicio,
          frecuencia,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al renovar')
      }
      const { id: nuevoId } = await res.json()
      handleClose()
      router.push(`/prestamos/${nuevoId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMonto('')
    setError('')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Renovar préstamo">
      <div className="space-y-4">
        <p className="text-xs text-[#888888]">
          Liquida el saldo actual y crea un préstamo nuevo. El cliente recibe solo la diferencia.
        </p>

        {/* Saldo a liquidar */}
        <div className="px-3 py-2.5 rounded-[10px] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#888888]">Saldo a liquidar</span>
            <span className="text-sm font-semibold text-[#f5c518] font-mono-display">
              {formatCOP(saldoPendiente)}
            </span>
          </div>
          {clienteNombre && (
            <p className="text-[10px] text-[#666] mt-0.5">{clienteNombre}</p>
          )}
        </div>

        {/* Nuevo monto */}
        <Input
          label="Nuevo monto del préstamo *"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          prefix="$"
        />

        {/* Tasa / Plazo */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tasa (%)"
            type="number"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
          <Input
            label="Plazo (días)"
            type="number"
            inputMode="numeric"
            value={plazo}
            onChange={(e) => setPlazo(e.target.value)}
          />
        </div>

        {/* Frecuencia */}
        <div>
          <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
            Frecuencia
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {['diario', 'semanal', 'quincenal', 'mensual'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrecuencia(f)}
                className={[
                  'h-9 rounded-[10px] border text-xs font-medium capitalize transition-all cursor-pointer',
                  frecuencia === f
                    ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[#f5c518]'
                    : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a]',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Fecha inicio */}
        <Input
          label="Fecha de inicio"
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
        />

        {/* Preview: diferencia a entregar + nueva cuota */}
        {montoNum > 0 && (
          <div className="rounded-[12px] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888888]">A entregar al cliente</span>
              <span className="text-base font-bold text-[#22c55e] font-mono-display">
                {formatCOP(diferencia)}
              </span>
            </div>
            {calculo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#888888]">Nueva cuota {frecuencia}</span>
                  <span className="text-sm font-semibold text-white font-mono-display">
                    {formatCOP(calculo.cuotaDiaria)}
                  </span>
                </div>
                {calculo.ultimaCuota && calculo.ultimaCuota !== calculo.cuotaDiaria && calculo.numPeriodos > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#888888]">Última cuota (ajuste)</span>
                    <span className="text-sm font-semibold text-[#8b95a5] font-mono-display">
                      {formatCOP(calculo.ultimaCuota)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#888888]">Total a pagar</span>
                  <span className="text-sm font-semibold text-white font-mono-display">
                    {formatCOP(calculo.totalAPagar)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[#ef4444]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            Renovar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
