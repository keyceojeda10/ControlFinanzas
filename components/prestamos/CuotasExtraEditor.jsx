'use client'

import { useState } from 'react'
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'

const LABEL_PERIODO = {
  diario: 'Día',
  semanal: 'Semana',
  quincenal: 'Quincena',
  mensual: 'Mes',
}

export default function CuotasExtraEditor({ extras = [], onChange, numPeriodos, frecuencia = 'mensual', fechaInicio }) {
  const [agregando, setAgregando] = useState(false)
  const [periodo, setPeriodo] = useState('')
  const [monto, setMonto] = useState('')

  const labelPeriodo = LABEL_PERIODO[frecuencia] || 'Período'

  const calcFechaEsperada = (n) => {
    if (!fechaInicio) return null
    const base = new Date(fechaInicio)
    const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
    if (frecuencia === 'mensual') {
      base.setMonth(base.getMonth() + n)
    } else {
      base.setDate(base.getDate() + n * (diasPorPeriodo[frecuencia] || 30))
    }
    return base
  }

  const formatFecha = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
  }

  const handleAgregar = () => {
    const p = Number(periodo)
    const m = Number(String(monto).replace(/\D/g, ''))
    if (!p || p < 1 || p > numPeriodos || !m || m <= 0) return
    if (extras.some(e => e.numeroPeriodo === p)) return

    const nuevos = [...extras, { numeroPeriodo: p, monto: m }].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
    onChange(nuevos)
    setPeriodo('')
    setMonto('')
    setAgregando(false)
  }

  const handleEliminar = (numeroPeriodo) => {
    onChange(extras.filter(e => e.numeroPeriodo !== numeroPeriodo))
  }

  const totalExtras = extras.reduce((a, e) => a + e.monto, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
          Cuotas extra
        </label>
        {!agregando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer"
            style={{ color: 'var(--cf-gold)', background: 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' }}
          >
            + Agregar cuota extra
          </button>
        )}
      </div>

      <p className="text-[10px] mb-3 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
        Programa abonos extra en meses especificos. Las cuotas regulares bajan automaticamente.
      </p>

      {extras.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {extras.map((e) => {
            const fecha = calcFechaEsperada(e.numeroPeriodo)
            return (
              <div
                key={e.numeroPeriodo}
                className="flex items-center justify-between rounded-[10px] px-3 py-2"
                style={{ background: 'color-mix(in srgb, var(--cf-gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold w-16" style={{ color: 'var(--cf-gold)' }}>
                    {labelPeriodo} {e.numeroPeriodo}
                  </span>
                  {fecha && (
                    <span className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>
                      ({formatFecha(fecha)})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                    +{formatMoney(e.monto)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEliminar(e.numeroPeriodo)}
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                    style={{ color: 'var(--cf-ink-3)', background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)' }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
          <p className="text-[10px] font-medium text-right" style={{ color: 'var(--cf-gold)' }}>
            Total cuotas extra: {formatMoney(totalExtras)}
          </p>
        </div>
      )}

      {agregando && (
        <div className="rounded-[12px] p-3 space-y-3 mb-2" style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--cf-ink-3)' }}>
                {labelPeriodo} #
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full h-9 rounded-[8px] px-2 text-sm"
                style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
              >
                <option value="">Seleccionar</option>
                {Array.from({ length: numPeriodos }, (_, i) => i + 1)
                  .filter(n => !extras.some(e => e.numeroPeriodo === n))
                  .map(n => {
                    const fecha = calcFechaEsperada(n)
                    return (
                      <option key={n} value={n}>
                        {labelPeriodo} {n}{fecha ? ` (${formatFecha(fecha)})` : ''}
                      </option>
                    )
                  })}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--cf-ink-3)' }}>
                Abono extra
              </label>
              <MoneyInput
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej: 500.000"
                className="h-9"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAgregando(false); setPeriodo(''); setMonto('') }}
              className="flex-1 h-8 rounded-[8px] text-[12px] font-medium cursor-pointer"
              style={{ color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAgregar}
              disabled={!periodo || !Number(String(monto).replace(/\D/g, ''))}
              className="flex-1 h-8 rounded-[8px] text-[12px] font-bold cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--cf-gold)', color: '#111' }}
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
