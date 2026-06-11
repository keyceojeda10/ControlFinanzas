// components/prestamos/ResumenCalculo.jsx - Panel de resumen en tiempo real

import { formatMoney } from '@/lib/i18n'
import TablaAmortizacion from './TablaAmortizacion'

const fmt = (v) => formatMoney(v)

const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ResumenCalculo({ calculo, visible = true }) {
    if (!visible) return null

  const { totalAPagar, cuotaDiaria, ultimaCuota, totalInteres, fechaFin, frecuencia, numPeriodos, modoInteres } = calculo ?? {}

  const labelModo = {
    fijo:   'Fijo (clasico)',
    unico:  'Interes unico',
    saldo:  'Sobre saldo',
    manual: 'Manual',
    lineal: 'Cuota decreciente',
    proporcional: 'Proporcional',
  }[modoInteres]

  const labelCuota = {
    diario:    'Cuota diaria',
    semanal:   'Cuota semanal',
    quincenal: 'Cuota quincenal',
    mensual:   'Cuota mensual',
  }[frecuencia] ?? 'Cuota'

  const tieneUltimaCuotaDiferente = ultimaCuota && cuotaDiaria && ultimaCuota !== cuotaDiaria && numPeriodos > 1

  const items = [
    { label: 'Total a pagar',  value: fmt(totalAPagar),  accent: 'var(--color-accent)' },
    { label: labelCuota,       value: fmt(cuotaDiaria),  accent: 'var(--color-success)',
      sub: tieneUltimaCuotaDiferente ? `Última cuota: ${fmt(ultimaCuota)}` : null },
    { label: 'Total interés',  value: fmt(totalInteres), accent: 'var(--color-warning)' },
    { label: 'Fecha de cierre', value: fmtFecha(fechaFin), accent: 'var(--color-purple)' },
  ]

  return (
    <div className="bg-[#161b27] border border-[var(--color-border)] rounded-[14px] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#8b95a5] uppercase tracking-wide">
          Resumen del préstamo
        </p>
        {labelModo && (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', color: 'var(--color-accent)' }}>
            {labelModo}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ label, value, accent, sub }) => (
          <div
            key={label}
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[10px] px-3 py-2.5"
          >
            <p className="text-[10px] text-[#8b95a5] mb-0.5">{label}</p>
            <p
              className="text-base font-bold leading-tight font-mono-display"
              style={{ color: value === '$0' || value === '—' ? '#64748b' : accent }}
            >
              {value ?? '—'}
            </p>
            {sub && <p className="text-[10px] text-[#8b95a5] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>
      {modoInteres === 'lineal' && (
        <TablaAmortizacion tabla={calculo?.tablaAmortizacion} frecuencia={frecuencia} />
      )}
    </div>
  )
}
