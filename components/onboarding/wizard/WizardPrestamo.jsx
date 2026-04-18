'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { calcularPrestamo, formatCOP } from '@/lib/calculos'
import ResumenCalculo from '@/components/prestamos/ResumenCalculo'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const FRECUENCIAS = [
  { value: 'diario', label: 'Diario' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
]

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const DEFAULT_PLAZO = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }

export default function WizardPrestamo({ cliente, onComplete }) {
  const [monto, setMonto] = useState('')
  const [tasa, setTasa] = useState('20')
  const [plazoUnidades, setPlazoUnidades] = useState('30')
  const [frecuencia, setFrecuencia] = useState('diario')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const plazo = String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
  const fechaInicio = hoyISO()

  const handleFrecuenciaChange = (freq) => {
    setFrecuencia(freq)
    setPlazoUnidades(DEFAULT_PLAZO[freq] || '30')
  }

  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(plazo)
    if (!m || (tasa === '' || tasa == null) || !p) return null
    return calcularPrestamo({ montoPrestado: m, tasaInteres: t, diasPlazo: p, fechaInicio, frecuencia })
  }, [monto, tasa, plazo, fechaInicio, frecuencia])

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
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el prestamo'); return }

      onComplete({
        id: data.id,
        montoPrestado: Number(monto),
        totalAPagar: calculo.totalAPagar,
        cuotaDiaria: calculo.cuotaDiaria,
        frecuencia,
      })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Crea un préstamo</h2>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="w-6 h-6 rounded-full bg-[rgba(245,197,24,0.2)] flex items-center justify-center">
            <span className="text-[var(--color-accent)] text-[9px] font-bold">{cliente.nombre?.[0]?.toUpperCase()}</span>
          </div>
          <span className="text-sm text-[var(--color-accent)] font-medium">{cliente.nombre}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-5 space-y-4">
          {/* Monto */}
          <Input
            label="Monto prestado (COP)"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 500000"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setError('') }}
            prefix="$"
          />

          {/* Tasa + Plazo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
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
              <p className="text-[10px] text-[var(--color-text-muted)] leading-snug px-0.5">20% es lo común</p>
            </div>
            <div className="flex flex-col gap-1">
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
                  frecuencia === 'diario'    ? 'días' :
                  frecuencia === 'semanal'   ? 'sem.' :
                  frecuencia === 'quincenal' ? 'quinc.' :
                  'meses'
                }
              />
              {frecuencia !== 'diario' && plazoUnidades && (
                <p className="text-[10px] text-[var(--color-text-muted)] leading-snug px-0.5">= {plazo} días</p>
              )}
            </div>
          </div>

          {/* Frecuencia */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">Frecuencia de cobro</p>
            <div className="grid grid-cols-4 gap-2">
              {FRECUENCIAS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrecuenciaChange(f.value)}
                  className={[
                    'h-9 rounded-[10px] border text-sm font-medium transition-all cursor-pointer',
                    frecuencia === f.value
                      ? 'bg-[rgba(245,197,24,0.15)] border-[#f5c518] text-[var(--color-accent)]'
                      : 'bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-surface)]',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resumen en tiempo real */}
        <ResumenCalculo calculo={calculo} visible={!!calculo} />

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-[12px] bg-[var(--color-accent)] text-[#111111] text-base font-bold transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : 'Crear prestamo'}
        </button>
      </form>
    </div>
  )
}
