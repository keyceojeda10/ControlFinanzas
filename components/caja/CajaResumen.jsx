'use client'

import { formatMoney } from '@/lib/i18n'
import CardWaves from '@/components/ui/CardWaves'

const COLOR_TASA = (t) => (t >= 80 ? 'var(--color-success)' : t >= 50 ? 'var(--color-accent)' : 'var(--color-danger)')

export default function CajaResumen({ hero, cards = [], detalle = [] }) {
  const heroColor = hero?.color || (hero?.valor >= 0 ? '#22c55e' : '#ef4444')
  const tasa = hero?.tasa || 0
  const pct = Math.min(100, Math.max(0, tasa))

  return (
    <div
      className="relative rounded-[20px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 16%, var(--color-bg-card)) 0%, var(--color-bg-card) 65%)`,
        border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
      }}
    >
      <CardWaves tint={`color-mix(in srgb, ${heroColor} 12%, transparent)`} />
      {/* Orbe decorativo */}
      <div
        className="absolute -top-14 -right-14 w-44 h-44 rounded-full pointer-events-none opacity-[0.10]"
        style={{ background: `radial-gradient(circle, ${heroColor}, transparent 70%)` }}
      />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              {hero?.label || 'Efectivo en caja'}
            </p>
            <p
              className="font-mono-display font-extrabold leading-none tracking-tight mt-1"
              style={{ color: heroColor, fontSize: 'clamp(30px, 8vw, 44px)' }}
            >
              {formatMoney(hero?.valor || 0)}
            </p>
            {hero?.subtitulo && (
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>{hero.subtitulo}</p>
            )}
          </div>

          {/* Donut de tasa de recaudo */}
          {tasa > 0 && (
            <div className="shrink-0 relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" stroke="var(--color-border)" />
                <circle
                  cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                  stroke={COLOR_TASA(tasa)}
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 0.942} 100`}
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </svg>
              <span className="absolute text-[11px] font-bold" style={{ color: COLOR_TASA(tasa) }}>
                {tasa}%
              </span>
            </div>
          )}
        </div>

        {/* Grid de metricas secundarias */}
        {cards.length > 0 && (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4"
            style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 12%, transparent)` }}
          >
            {cards.map((c, i) => (
              <div
                key={i}
                className="rounded-[12px] px-3 py-2.5"
                style={{ background: `color-mix(in srgb, ${c.color || 'var(--color-info)'} 14%, transparent)` }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{c.label}</p>
                <p className="text-[15px] font-bold font-mono-display mt-0.5" style={{ color: c.color || 'var(--color-text-primary)' }}>
                  {c.signo === '-' && c.valor > 0 ? '-' : c.signo === '+' && c.valor > 0 ? '+' : ''}{formatMoney(c.valor || 0)}
                  {c.sub ? <span className="text-[9px] text-[var(--color-text-muted)] ml-1">{c.sub}</span> : null}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Detalle opcional */}
        {detalle.length > 0 && (
          <details className="mt-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 12%, transparent)` }}>
            <summary className="cursor-pointer text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Ver detalle del calculo</summary>
            <div className="mt-2 space-y-1.5 text-[11px]">
              {detalle.map((d, i) => (
                <div key={i} className="flex justify-between">
                  <span style={{ color: 'var(--color-text-muted)' }}>{d.label}</span>
                  <span className="font-semibold font-mono-display" style={{ color: d.color || 'var(--color-text-primary)' }}>{formatMoney(d.valor || 0)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
