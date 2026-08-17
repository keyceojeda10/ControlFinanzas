'use client'

import { useState, useMemo } from 'react'
import MoneyInput from '@/components/ui/MoneyInput'
import { Input } from '@/components/ui/Input'
import { calcularPrestamo } from '@/lib/calculos'
import { soloDecimal } from '@/lib/i18n'
import ResumenCalculo from '@/components/prestamos/ResumenCalculo'
import Avatar from '@/components/ui/Avatar'
import { useCountry } from '@/hooks/useCountry'

const getLocalDate = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const FRECUENCIAS = [
  { value: 'diario',    label: 'Diario' },
  { value: 'semanal',   label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual',   label: 'Mensual' },
]

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const DEFAULT_PLAZO    = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }

const METODOS = [
  {
    value: 'fijo',
    label: 'Interés fijo por período',
    desc: 'El interés se calcula sobre el capital inicial por cada período (semana, mes...). El más usado en Colombia.',
    ejemplo: 'Prestas $500k al 20% mensual → cobras $100k de interés fijo cada mes.',
    color: 'var(--cf-gold)',
    bg: 'rgba(245,197,24,0.1)',
  },
  {
    value: 'saldo',
    label: 'Interés sobre saldo',
    desc: 'El interés se recalcula sobre lo que queda por pagar. La cuota inicial es mayor pero va bajando.',
    ejemplo: 'Amortización tipo banco. Ideal para montos altos o clientes grandes.',
    color: 'var(--cf-ink-2)',
    bg: 'rgba(59,130,246,0.1)',
  },
  {
    value: 'unico',
    label: 'Interés único al inicio',
    desc: 'El interés se cobra una sola vez al entregar el dinero. El cliente devuelve el capital en cuotas.',
    ejemplo: 'Prestas $500k al 20% → se cobran $100k al inicio, quedan $400k netos.',
    color: 'var(--cf-green-dark)',
    bg: 'rgba(34,197,94,0.1)',
  },
  {
    value: 'solo_interes',
    label: 'Solo interés (globo)',
    desc: 'El cliente paga solo intereses en cada cuota y devuelve todo el capital al final.',
    ejemplo: 'Prestas $500k al 20% mensual → cuotas de $100k de interés, al final paga los $500k.',
    color: 'var(--cf-ink-2)',
    bg: 'rgba(168,85,247,0.1)',
  },
  {
    value: 'lineal',
    label: 'Cuota decreciente (lineal)',
    desc: 'Capital fijo en cada cuota más interés sobre el saldo. La cuota baja período a período.',
    ejemplo: 'Similar a créditos de vehículo. Las primeras cuotas son las más altas.',
    color: 'var(--cf-gold-dark)',
    bg: 'rgba(249,115,22,0.1)',
  },
  {
    value: 'lineal_dinamico',
    label: 'Decreciente dinámico',
    desc: 'Cuota que se ajusta al pago real del cliente',
    ejemplo: '10% mensual → $700K → $650K → ...',
    color: 'var(--cf-ink-2)',
    bg: 'rgba(6,182,212,0.1)',
  },
  {
    value: 'manual',
    label: 'Cuota manual (personalizada)',
    desc: 'Tú fijas el valor de la cuota. El sistema calcula el total automáticamente.',
    ejemplo: 'Útil cuando negociaste una cuota específica con el cliente.',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.1)',
  },
]

export default function WizardPrestamo({ cliente, onComplete, onSkip }) {
  const { formatMoney } = useCountry()
  const [monto,        setMonto]        = useState('')
  const [tasa,         setTasa]         = useState('20')
  const [plazoUnidades,setPlazoUnidades]= useState('30')
  const [frecuencia,   setFrecuencia]   = useState('diario')
  const [metodo,       setMetodo]       = useState('fijo')
  const [cuotaManual,  setCuotaManual]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showMetodos,  setShowMetodos]  = useState(false)

  const plazo      = String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
  const fechaInicio = getLocalDate()

  const handleFrecuenciaChange = (freq) => {
    setFrecuencia(freq)
    setPlazoUnidades(DEFAULT_PLAZO[freq] || '30')
  }

  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(plazo)
    if (!m || tasa === '' || !p) return null
    if (metodo === 'manual' && !Number(cuotaManual)) return null
    try {
      return calcularPrestamo({
        montoPrestado: m,
        tasaInteres: t,
        diasPlazo: p,
        fechaInicio,
        frecuencia,
        modoInteres: metodo,
        cuotaManual: metodo === 'manual' ? Number(cuotaManual) : undefined,
      })
    } catch { return null }
  }, [monto, tasa, plazo, fechaInicio, frecuencia, metodo, cuotaManual])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) { setError('Ingresa el monto del préstamo'); return }
    if (metodo === 'manual' && (!cuotaManual || Number(cuotaManual) <= 0)) { setError('Ingresa el valor de la cuota'); return }
    if (!calculo) { setError('Verifica los datos del préstamo'); return }

    setLoading(true)
    setError('')
    try {
      const body = {
        clienteId: cliente.id,
        montoPrestado: Number(monto),
        tasaInteres: Number(tasa),
        diasPlazo: Number(plazo),
        fechaInicio,
        frecuencia,
        modoInteres: metodo,
      }
      if (metodo === 'manual') body.cuotaManual = Number(cuotaManual)

      const res = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el préstamo'); return }
      onComplete({
        id: data.id,
        montoPrestado: Number(monto),
        totalAPagar:   calculo.totalAPagar,
        cuotaDiaria:   calculo.cuotaDiaria,
        frecuencia,
        metodo,
      })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const metodoActual = METODOS.find(m => m.value === metodo)

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--cf-ink)' }}>
          Crea el préstamo
        </h2>
        <div className="flex items-center justify-center gap-2">
          <Avatar nombre={cliente.nombre} size={22} fontSize={8} />
          <span className="text-sm font-medium" style={{ color: 'var(--cf-gold)' }}>{cliente.nombre}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--cf-red-dark)' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="rounded-[16px] p-5 space-y-4"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>

          <MoneyInput
            label="Monto a prestar"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError('') }}
          />

          {metodo !== 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Tasa de interés (%)"
                  type="text"
                  inputMode="decimal"
                  placeholder="20"
                  value={tasa}
                  onChange={(e) => setTasa(soloDecimal(e.target.value))}
                  suffix="%"
                />
                <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--cf-ink-3)' }}>20% mensual es lo más común</p>
              </div>
              <div>
                <Input
                  label={
                    frecuencia === 'diario'    ? 'Plazo (días)' :
                    frecuencia === 'semanal'   ? 'Plazo (semanas)' :
                    frecuencia === 'quincenal' ? 'Plazo (quincenas)' :
                    'Plazo (meses)'
                  }
                  type="number"
                  inputMode="numeric"
                  placeholder={DEFAULT_PLAZO[frecuencia]}
                  value={plazoUnidades}
                  onChange={(e) => setPlazoUnidades(e.target.value)}
                  suffix={
                    frecuencia === 'diario' ? 'días' :
                    frecuencia === 'semanal' ? 'sem.' :
                    frecuencia === 'quincenal' ? 'quinc.' : 'meses'
                  }
                />
                {frecuencia !== 'diario' && plazoUnidades && (
                  <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--cf-ink-3)' }}>= {plazo} días</p>
                )}
              </div>
            </div>
          )}

          {metodo === 'manual' && (
            <>
              <MoneyInput
                label="Valor de la cuota"
                value={cuotaManual}
                onChange={(e) => setCuotaManual(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label={
                    frecuencia === 'diario'    ? 'Plazo (días)' :
                    frecuencia === 'semanal'   ? 'Plazo (semanas)' :
                    frecuencia === 'quincenal' ? 'Plazo (quincenas)' :
                    'Plazo (meses)'
                  }
                  type="number"
                  inputMode="numeric"
                  placeholder={DEFAULT_PLAZO[frecuencia]}
                  value={plazoUnidades}
                  onChange={(e) => setPlazoUnidades(e.target.value)}
                  suffix={
                    frecuencia === 'diario' ? 'días' :
                    frecuencia === 'semanal' ? 'sem.' :
                    frecuencia === 'quincenal' ? 'quinc.' : 'meses'
                  }
                />
              </div>
            </>
          )}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>¿Cada cuánto cobras?</p>
            <div className="grid grid-cols-4 gap-2">
              {FRECUENCIAS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrecuenciaChange(f.value)}
                  className="h-9 rounded-[10px] border text-[12px] font-medium transition-all cursor-pointer"
                  style={frecuencia === f.value
                    ? { background: 'rgba(245,197,24,0.15)', border: '1px solid var(--cf-gold)', color: 'var(--cf-gold)' }
                    : { background: 'transparent', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-3)' }
                  }>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowMetodos(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[12px] transition-all cursor-pointer"
            style={{ background: metodoActual.bg, border: `1px solid ${metodoActual.color}33` }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: metodoActual.color }} />
              <span className="text-[12px] font-semibold" style={{ color: metodoActual.color }}>
                Método: {metodoActual.label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: metodoActual.color }}>Cambiar</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showMetodos ? 'rotate-180' : ''}`}
                fill="none" stroke={metodoActual.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {showMetodos && (
            <div className="mt-2 space-y-2">
              {METODOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setMetodo(m.value); setShowMetodos(false) }}
                  className="w-full text-left rounded-[12px] p-4 transition-all cursor-pointer"
                  style={metodo === m.value
                    ? { background: m.bg, border: `1px solid ${m.color}55` }
                    : { background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }
                  }>
                  <div className="flex items-start gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: m.color }} />
                    <p className="text-[13px] font-semibold" style={{ color: metodo === m.value ? m.color : 'var(--cf-ink)' }}>
                      {m.label}
                    </p>
                    {metodo === m.value && (
                      <svg className="w-3.5 h-3.5 ml-auto shrink-0 mt-0.5" fill="none" stroke={m.color} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed mb-1.5 pl-4" style={{ color: 'var(--cf-ink-3)' }}>{m.desc}</p>
                  <p className="text-[10px] pl-4" style={{ color: 'var(--cf-ink-3)', fontStyle: 'italic' }}>{m.ejemplo}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <ResumenCalculo
          calculo={calculo}
          visible={!!calculo}
          onCuotaQueCuadra={(v) => setCuotaManual(String(v))}
          onPlazoQueCuadra={(nn) => setPlazoUnidades(String(nn))}
        />

        {!calculo && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.12)' }}>
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="var(--cf-gold)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
              {metodo === 'manual'
                ? 'Ingresa el monto y la cuota para ver el resumen.'
                : 'Ingresa el monto para ver el resumen del préstamo en tiempo real.'
              }
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: 'var(--cf-gold)', color: '#111' }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Crear préstamo'}
        </button>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-[11px] text-center transition-colors cursor-pointer py-1"
            style={{ color: 'var(--cf-ink-3)' }}>
            Omitir por ahora
          </button>
        )}
      </form>
    </div>
  )
}
