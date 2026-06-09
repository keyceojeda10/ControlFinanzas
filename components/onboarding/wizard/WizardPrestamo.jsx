'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { calcularPrestamo } from '@/lib/calculos'
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
    label: 'Interés fijo por periodo',
    desc: 'El interés se calcula sobre el capital inicial por cada periodo (semana, mes...). El más usado en Colombia.',
    ejemplo: 'Prestas $500k al 20% mensual → cobras $100k de interés fijo cada mes.',
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.1)',
  },
  {
    value: 'saldo',
    label: 'Interés sobre saldo',
    desc: 'El interés se recalcula sobre lo que queda por pagar. La cuota inicial es mayor pero va bajando.',
    ejemplo: 'Amortización tipo banco. Ideal para montos altos o clientes grandes.',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
  },
  {
    value: 'unico',
    label: 'Interés único al inicio',
    desc: 'El interés se cobra una sola vez al entregar el dinero. El cliente devuelve el capital en cuotas.',
    ejemplo: 'Prestas $500k al 20% → se cobran $100k al inicio, quedan $400k netos.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
  },
]

export default function WizardPrestamo({ cliente, onComplete, modoDemo = false }) {
  const { formatMoney } = useCountry()
  const [monto,        setMonto]        = useState(modoDemo ? '500000' : '')
  const [tasa,         setTasa]         = useState('20')
  const [plazoUnidades,setPlazoUnidades]= useState('30')
  const [frecuencia,   setFrecuencia]   = useState('diario')
  const [metodo,       setMetodo]       = useState('fijo')
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
    try {
      return calcularPrestamo({ montoPrestado: m, tasaInteres: t, diasPlazo: p, fechaInicio, frecuencia, modoInteres: metodo })
    } catch { return null }
  }, [monto, tasa, plazo, fechaInicio, frecuencia, metodo])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!monto || Number(monto) <= 0) { setError('Ingresa el monto del préstamo'); return }
    if (!calculo) { setError('Verifica los datos del préstamo'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: cliente.id,
          montoPrestado: Number(monto),
          tasaInteres: Number(tasa),
          diasPlazo: Number(plazo),
          fechaInicio,
          frecuencia,
          modoInteres: metodo,
          esDemo: modoDemo,
        }),
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
        esDemo: modoDemo,
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
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-xl font-bold mb-1.5" style={{ color: '#f0f0f5' }}>
          {modoDemo ? 'Préstamo de ejemplo' : 'Crea el préstamo'}
        </h2>
        <div className="flex items-center justify-center gap-2">
          <Avatar nombre={cliente.nombre} size={22} fontSize={8} />
          <span className="text-sm font-medium" style={{ color: '#f5c518' }}>{cliente.nombre}</span>
        </div>
      </div>

      {modoDemo && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-4"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#a78bfa" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px]" style={{ color: '#a78bfa' }}>
            Modo demo — este préstamo se borrará automáticamente al finalizar.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="rounded-[16px] p-5 space-y-4"
          style={{ background: '#0f0f18', border: '1px solid #1e1e2e' }}>

          {/* Monto */}
          <Input
            label="Monto a prestar"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 500000"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError('') }}
            prefix="$"
          />

          {/* Tasa + Plazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label="Tasa de interés (%)"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                placeholder="20"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                suffix="%"
              />
              <p className="text-[10px] mt-1 px-0.5" style={{ color: '#555570' }}>20% mensual es lo más común</p>
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
                <p className="text-[10px] mt-1 px-0.5" style={{ color: '#555570' }}>= {plazo} días</p>
              )}
            </div>
          </div>

          {/* Frecuencia de cobro */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] mb-1.5" style={{ color: '#555570' }}>¿Cada cuánto cobras?</p>
            <div className="grid grid-cols-4 gap-2">
              {FRECUENCIAS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrecuenciaChange(f.value)}
                  className="h-9 rounded-[10px] border text-[12px] font-medium transition-all cursor-pointer"
                  style={frecuencia === f.value
                    ? { background: 'rgba(245,197,24,0.15)', border: '1px solid #f5c518', color: '#f5c518' }
                    : { background: 'transparent', border: '1px solid #222230', color: '#666680' }
                  }>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Método de interés */}
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
                    : { background: '#0f0f18', border: '1px solid #1e1e2e' }
                  }>
                  <div className="flex items-start gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: m.color }} />
                    <p className="text-[13px] font-semibold" style={{ color: metodo === m.value ? m.color : '#ddddef' }}>
                      {m.label}
                    </p>
                    {metodo === m.value && (
                      <svg className="w-3.5 h-3.5 ml-auto shrink-0 mt-0.5" fill="none" stroke={m.color} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed mb-1.5 pl-4" style={{ color: '#666680' }}>{m.desc}</p>
                  <p className="text-[10px] pl-4" style={{ color: '#444458', fontStyle: 'italic' }}>{m.ejemplo}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resumen en tiempo real */}
        <ResumenCalculo calculo={calculo} visible={!!calculo} />

        {!calculo && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(245,197,24,0.05)', border: '1px solid rgba(245,197,24,0.12)' }}>
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] leading-relaxed" style={{ color: '#555570' }}>
              Ingresa el monto para ver el resumen del préstamo en tiempo real.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: modoDemo ? '#a78bfa' : '#f5c518', color: modoDemo ? '#fff' : '#111' }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (modoDemo ? 'Ver cómo funciona' : 'Crear préstamo')}
        </button>
      </form>
    </div>
  )
}
