'use client'
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
const LABEL_PLAZO      = { diario: 'Plazo (días)', semanal: 'Plazo (semanas)', quincenal: 'Plazo (quincenas)', mensual: 'Plazo (meses)' }
const DEFAULT_PLAZO    = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }

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

  const [monto,       setMonto]       = useState('')
  const [tasa,        setTasa]        = useState(String(prestamoAnterior?.tasaInteres ?? '20'))
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
  const [masOpciones, setMasOpciones] = useState(false)

  const montoNum = Number(monto) || 0
  const montoSeguroNum = seguro ? (Number(montoSeguro) || 0) : 0
  const enMano = Math.max(0, montoNum - saldo)
  const diasPlazo = (Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1)

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
    if (montoNum <= 0) { setError('Ingresa el total del nuevo prestamo'); return }
    if (montoNum < saldo) {
      setError(`El total debe cubrir al menos el saldo actual (${formatMoney(saldo)})`)
      return
    }
    if (!tasa || Number(tasa) < 0) { setError('Tasa invalida'); return }
    if (!plazoUnidades || diasPlazo <= 0) { setError('Plazo invalido'); return }

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
    setSeguro(false)
    setMontoSeguro('')
    setError('')
    setMasOpciones(false)
    setPlazoUnidades(DEFAULT_PLAZO[frecuencia] ?? '30')
    onClose?.()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Renovar prestamo">
      <div className="space-y-4">

        {/* Saldo actual */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.2)' }}>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Saldo pendiente actual</span>
          </div>
          <p className="text-xl font-bold font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatMoney(saldo)}</p>
          {clienteNombre && <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{clienteNombre}</p>}
        </div>

        {/* Input principal */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
            Total del nuevo prestamo
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>$</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={formatMoney(saldo * 2).replace(/[^0-9.,]/g, '')}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              className="w-full h-14 pl-7 pr-3 text-xl font-bold rounded-xl outline-none font-mono-display"
              style={{
                background: 'var(--color-bg-surface)',
                border: '2px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Incluye lo que ya debe. Ejemplo: debe {formatMoney(saldo)} y le prestas {formatMoney(saldo)} mas = total {formatMoney(saldo * 2)}
          </p>
        </div>

        {/* Desglose automatico */}
        {montoNum > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'var(--color-bg-surface)' }}>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Saldo absorbido</span>
              </div>
              <span className="text-sm font-semibold font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                {formatMoney(Math.min(saldo, montoNum))}
              </span>
            </div>
            <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>Le entregas en mano</span>
              </div>
              <span className="text-lg font-bold font-mono-display text-green-500">
                {formatMoney(enMano)}
              </span>
            </div>
          </div>
        )}

        {montoNum > 0 && montoNum < saldo && (
          <p className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
            El total debe ser al menos {formatMoney(saldo)} (el saldo actual)
          </p>
        )}

        {/* Tasa + Plazo */}
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
              <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--color-text-muted)' }}>= {diasPlazo} dias</p>
            )}
          </div>
        </div>

        {/* Frecuencia */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.05em] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Frecuencia de cobro
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {['diario', 'semanal', 'quincenal', 'mensual'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFrecuencia(f); setPlazoUnidades(DEFAULT_PLAZO[f] ?? '30') }}
                className="h-9 rounded-[10px] border text-xs font-medium capitalize transition-all cursor-pointer"
                style={frecuencia === f
                  ? { background: 'rgba(245,197,24,0.12)', borderColor: '#f5c518', color: 'var(--color-accent)' }
                  : { background: 'transparent', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mas opciones colapsable */}
        <button
          type="button"
          onClick={() => setMasOpciones(!masOpciones)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${masOpciones ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {masOpciones ? 'Menos opciones' : 'Mas opciones'}
        </button>

        {masOpciones && (
          <div className="space-y-3">
            <Input
              label="Fecha de inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
            <div className="rounded-xl p-3" style={{ border: '1px solid var(--color-border)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seguro}
                  onChange={(e) => setSeguro(e.target.checked)}
                  className="w-4 h-4 accent-[#6366f1]"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Cobrar seguro</span>
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview cuota */}
        {calculo && montoNum >= saldo && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cuota {frecuencia}</span>
              <span className="text-base font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(calculo.cuotaDiaria)}
              </span>
            </div>
            {calculo.ultimaCuota && calculo.ultimaCuota !== calculo.cuotaDiaria && calculo.numPeriodos > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ultima cuota (ajuste)</span>
                <span className="text-sm font-semibold font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
                  {formatMoney(calculo.ultimaCuota)}
                </span>
              </div>
            )}
            {montoSeguroNum > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Seguro</span>
                <span className="text-sm font-semibold font-mono-display" style={{ color: '#6366f1' }}>
                  {formatMoney(montoSeguroNum)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(34,197,94,0.15)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</span>
              <span className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(calculo.totalAPagar + montoSeguroNum)}
              </span>
            </div>
          </div>
        )}

        {montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo && (
          <p className="text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
            Supera el tope de {formatMoney(montoMaximoPrestamo)} para este cliente
          </p>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={(montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo) || (montoNum > 0 && montoNum < saldo)}
            className="flex-1"
          >
            Renovar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
