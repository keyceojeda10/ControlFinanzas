'use client'
// components/prestamos/RenovarPrestamo.jsx — Modal de renovación de préstamo

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { calcularPrestamo } from '@/lib/calculos'
import { useCountry } from '@/hooks/useCountry'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const LABEL_PERIODO    = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }
const LABEL_PLAZO      = { diario: 'Plazo (días)', semanal: 'Plazo (semanas)', quincenal: 'Plazo (quincenas)', mensual: 'Plazo (meses)' }
const DEFAULT_PLAZO    = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }

// Convierte diasPlazo de DB a unidades de la frecuencia (para mostrar en el input)
function diasAUnidades(dias, frecuencia) {
  const d = DIAS_POR_PERIODO[frecuencia] || 1
  return String(Math.round((Number(dias) || 30) / d))
}

export default function RenovarPrestamo({
  prestamoId,
  saldoPendiente,
  prestamoAnterior,
  clienteNombre,
  montoMaximoPrestamo,
  open,
  onClose,
}) {
  const router = useRouter()
  const { formatMoney } = useCountry()

  const saldo = Math.max(0, Number(saldoPendiente) || 0)
  const freqInicial = prestamoAnterior?.frecuencia ?? 'diario'
  // Dos campos sincronizados: lo que entrega de mas (en mano) y el total que queda debiendo.
  const [entrega,     setEntrega]     = useState('')  // dinero nuevo que recibe el cliente
  const [monto,       setMonto]       = useState('')  // total nuevo = saldo + entrega
  const [tasa,        setTasa]        = useState(String(prestamoAnterior?.tasaInteres ?? '20'))
  // plazoUnidades: en unidades de la frecuencia (semanas, quincenas, etc.), NO en días
  const [plazoUnidades, setPlazoUnidades] = useState(
    prestamoAnterior?.diasPlazo
      ? diasAUnidades(prestamoAnterior.diasPlazo, freqInicial)
      : DEFAULT_PLAZO[freqInicial] ?? '30'
  )
  const [frecuencia,  setFrecuencia]  = useState(freqInicial)
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [seguro,      setSeguro]      = useState(false)
  const [montoSeguro, setMontoSeguro] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const montoNum = Number(monto) || 0
  const montoSeguroNum = seguro ? (Number(montoSeguro) || 0) : 0
  const diferencia = Math.max(0, montoNum - saldo)
  // diasPlazo real = unidades × días por periodo
  const diasPlazo = (Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1)

  const handleFrecuenciaChange = (f) => {
    setFrecuencia(f)
    setPlazoUnidades(DEFAULT_PLAZO[f] ?? '30')
  }

  // Al cambiar "entrega": total = saldo + entrega
  const onChangeEntrega = (v) => {
    setEntrega(v)
    const e = Number(v) || 0
    setMonto(String(Math.round(saldo + e)))
  }
  // Al cambiar "total": entrega = total - saldo
  const onChangeMonto = (v) => {
    setMonto(v)
    const t = Number(v) || 0
    setEntrega(String(Math.max(0, Math.round(t - saldo))))
  }

  const modoHeredado = ['fijo', 'unico', 'saldo', 'manual'].includes(prestamoAnterior?.modoInteres)
    ? prestamoAnterior.modoInteres : 'fijo'

  const calculo = useMemo(() => {
    if (!montoNum || !tasa || !diasPlazo) return null
    try {
      return calcularPrestamo({
        montoPrestado: montoNum,
        tasaInteres:   Number(tasa),
        diasPlazo,
        fechaInicio,
        frecuencia,
        modoInteres:   modoHeredado,
      })
    } catch { return null }
  }, [montoNum, tasa, diasPlazo, fechaInicio, frecuencia, modoHeredado])

  const handleSubmit = async () => {
    if (montoNum <= 0) { setError('Ingresa cuánto le entregas o el total'); return }
    if (montoNum < saldo) {
      setError(`El total debe cubrir al menos el saldo actual (${formatMoney(saldo)})`)
      return
    }
    if (!tasa || Number(tasa) < 0) { setError('Tasa inválida'); return }
    if (!plazoUnidades || diasPlazo <= 0) { setError('Plazo inválido'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPrestado: montoNum,
          tasaInteres:   Number(tasa),
          diasPlazo,
          fechaInicio,
          frecuencia,
          modoInteres:   modoHeredado,
          ...(seguro && montoSeguroNum > 0 && { seguro: true, montoSeguro: montoSeguroNum }),
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
    setEntrega('')
    setSeguro(false)
    setMontoSeguro('')
    setError('')
    setPlazoUnidades(DEFAULT_PLAZO[frecuencia] ?? '30')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Renovar / prestar más">
      <div className="space-y-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          Préstale más a este cliente. El saldo que ya debe se suma al nuevo crédito y se recalcula el interés. Recibe en mano solo lo nuevo.
        </p>

        {/* Saldo actual que se absorbe */}
        <div className="px-3 py-2.5 rounded-[10px] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-muted)]">Saldo actual (se suma al nuevo)</span>
            <span className="text-sm font-semibold text-[var(--color-accent)] font-mono-display">
              {formatMoney(saldo)}
            </span>
          </div>
          {clienteNombre && (
            <p className="text-[10px] text-[#666] mt-0.5">{clienteNombre}</p>
          )}
        </div>

        {/* Dos campos sincronizados: entrega (en mano) y total que queda debiendo */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Le entregas (en mano)"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={entrega}
            onChange={(e) => onChangeEntrega(e.target.value)}
            prefix="$"
          />
          <Input
            label="Queda debiendo (total) *"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={monto}
            onChange={(e) => onChangeMonto(e.target.value)}
            prefix="$"
          />
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] -mt-2">
          Escribe lo que le entregas de más o el total que quedará debiendo; el otro se calcula solo.
        </p>

        {/* Tasa / Plazo */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tasa (%)"
            type="number"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
          <div>
            <Input
              label={LABEL_PLAZO[frecuencia]}
              type="number"
              inputMode="numeric"
              value={plazoUnidades}
              onChange={(e) => setPlazoUnidades(e.target.value)}
            />
            {frecuencia !== 'diario' && plazoUnidades && (
              <p className="text-[10px] mt-1 px-0.5 text-[var(--color-text-muted)]">= {diasPlazo} días</p>
            )}
          </div>
        </div>

        {/* Frecuencia */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-1.5">
            Frecuencia
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {['diario', 'semanal', 'quincenal', 'mensual'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleFrecuenciaChange(f)}
                className={[
                  'h-9 rounded-[10px] border text-xs font-medium capitalize transition-all cursor-pointer',
                  frecuencia === f
                    ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[var(--color-accent)]'
                    : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)]',
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

        {/* Seguro opcional (se suma al total, igual que al crear) */}
        <div className="rounded-[12px] border border-[var(--color-border)] p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={seguro}
              onChange={(e) => setSeguro(e.target.checked)}
              className="w-4 h-4 accent-[#6366f1]"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Cobrar seguro</span>
          </label>
          {seguro && (
            <div className="mt-2.5">
              <Input
                label="Monto del seguro"
                type="number"
                inputMode="numeric"
                placeholder="Ej: 10.000"
                value={montoSeguro}
                onChange={(e) => setMontoSeguro(e.target.value)}
                prefix="$"
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Se cobra el seguro del nuevo préstamo, igual que en un préstamo nuevo.</p>
            </div>
          )}
        </div>

        {/* Preview: diferencia a entregar + nueva cuota */}
        {montoNum > 0 && (
          <div className="rounded-[12px] border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.06)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-muted)]">A entregar al cliente</span>
              <span className="text-base font-bold text-[var(--color-success)] font-mono-display">
                {formatMoney(diferencia)}
              </span>
            </div>
            {calculo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">Nueva cuota {frecuencia}</span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono-display">
                    {formatMoney(calculo.cuotaDiaria)}
                  </span>
                </div>
                {calculo.ultimaCuota && calculo.ultimaCuota !== calculo.cuotaDiaria && calculo.numPeriodos > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Última cuota (ajuste)</span>
                    <span className="text-sm font-semibold text-[#8b95a5] font-mono-display">
                      {formatMoney(calculo.ultimaCuota)}
                    </span>
                  </div>
                )}
                {montoSeguroNum > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)]">Seguro</span>
                    <span className="text-sm font-semibold font-mono-display" style={{ color: '#6366f1' }}>
                      {formatMoney(montoSeguroNum)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">Total a pagar</span>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] font-mono-display">
                    {formatMoney(calculo.totalAPagar + montoSeguroNum)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
            Supera el tope de {formatMoney(montoMaximoPrestamo)} para este cliente
          </p>
        )}

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo}
            className="flex-1"
          >
            Renovar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
