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
    fijo:   'Fijo (clásico)',
    unico:  'Interés único',
    saldo:  'Sobre saldo',
    manual: 'Manual',
    lineal: 'Cuota decreciente',
    lineal_dinamico: 'Decreciente dinámico',
    solo_interes: 'Solo interés (globo)',
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
    <div className="border border-[var(--color-border)] rounded-[12px] p-4 space-y-3" style={{ background: 'var(--color-bg-card)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
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
            <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
            <p
              className="text-base font-bold leading-tight font-mono-display"
              style={{ color: value === '$0' || value === '—' ? '#64748b' : accent }}
            >
              {value ?? '—'}
            </p>
            {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
          </div>
        ))}
      </div>
      {['lineal', 'lineal_dinamico', 'solo_interes'].includes(modoInteres) && (
        <TablaAmortizacion tabla={calculo?.tablaAmortizacion} frecuencia={frecuencia} />
      )}
    </div>
  )
}
