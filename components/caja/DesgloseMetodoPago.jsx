'use client'

import { formatMoney } from '@/lib/i18n'

const COLORES = {
  efectivo: 'var(--color-success)',
  transferencia: 'var(--color-info)',
}

export default function DesgloseMetodoPago({ items }) {
  if (!items || items.length <= 1) return null

  const total = items.reduce((a, i) => a + i.monto, 0)
  if (total <= 0) return null

  return (
    <div
      className="mb-3 rounded-[12px] overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Barra apilada */}
      <div className="flex h-2 mx-3 mt-3 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-alt)' }}>
        {items.map((item) => {
          const pct = total > 0 ? (item.monto / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={item.label}
              style={{
                width: `${pct}%`,
                background: item.tipo === 'efectivo' ? COLORES.efectivo : COLORES.transferencia,
                minWidth: pct > 0 ? 4 : 0,
              }}
            />
          )
        })}
      </div>

      {/* Filas */}
      <div className="px-3 py-2 space-y-1.5">
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.monto / total) * 100) : 0
          const color = item.tipo === 'efectivo' ? COLORES.efectivo : COLORES.transferencia
          return (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.label}
                </span>
                <span className="text-[10px] font-semibold shrink-0" style={{ color }}>
                  {pct}%
                </span>
              </div>
              <span className="text-[12px] font-bold font-mono-display shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(item.monto)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
