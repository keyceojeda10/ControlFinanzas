'use client'
// components/caja/CajaResumen.jsx
// Resumen de caja UNIFICADO: una hero card grande ("Efectivo en caja") + un grid de
// métricas secundarias. Se usa igual para: caja general del día, caja general por rango,
// caja por cobrador (día o rango). Solo cambia el VOLUMEN de datos, no el diseño.
//
// Props:
//   hero:  { label, valor, subtitulo?, color?, tasa? }  — el número grande protagonista
//   cards: [{ label, valor, color?, signo?, sub? }]      — métricas secundarias (las que apliquen)
//   detalle?: [{ label, valor, color? }]                 — filas opcionales del "Ver detalle"

import { formatMoney } from '@/lib/i18n'

const COLOR_TASA = (t) => (t >= 80 ? 'var(--color-success)' : t >= 50 ? 'var(--color-accent)' : 'var(--color-danger)')

export default function CajaResumen({ hero, cards = [], detalle = [] }) {
  const heroColor = hero?.color || (hero?.valor >= 0 ? '#22c55e' : '#ef4444')

  return (
    <div
      className="cf-hero-card relative rounded-[20px] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--color-bg-card)) 100%)`,
        border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
        boxShadow: `0 8px 32px color-mix(in srgb, ${heroColor} 18%, transparent)`,
      }}
    >
      <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none hidden lg:block"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        {/* Header: label + tasa */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor, boxShadow: `0 0 12px ${heroColor}` }} />
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>
            {hero?.label || 'Efectivo en caja'}
          </p>
          {hero?.tasa > 0 && (
            <span className="ml-auto text-[11px] font-bold" style={{ color: COLOR_TASA(hero.tasa) }}>{hero.tasa}% cobrado</span>
          )}
        </div>

        {/* Número grande */}
        <p className="font-mono-display font-bold leading-none tracking-tight"
          style={{
            color: heroColor,
            fontSize: 'clamp(32px, 9vw, 44px)',
            textShadow: `0 0 30px color-mix(in srgb, ${heroColor} 25%, transparent)`,
          }}
        >
          {formatMoney(hero?.valor || 0)}
        </p>

        {hero?.subtitulo && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{hero.subtitulo}</p>
        )}

        {/* Grid de métricas secundarias */}
        {cards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-4"
            style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 15%, transparent)` }}>
            {cards.map((c, i) => (
              <div key={i} className="rounded-[10px] px-2.5 py-2"
                style={{ background: `color-mix(in srgb, ${c.color || 'var(--color-info)'} 10%, transparent)` }}>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{c.label}</p>
                <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: c.color || 'var(--color-text-primary)' }}>
                  {c.signo === '-' && c.valor > 0 ? '-' : c.signo === '+' && c.valor > 0 ? '+' : ''}{formatMoney(c.valor || 0)}
                  {c.sub ? <span className="text-[9px] text-[var(--color-text-muted)] ml-1">{c.sub}</span> : null}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Detalle opcional */}
        {detalle.length > 0 && (
          <details className="mt-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 15%, transparent)` }}>
            <summary className="cursor-pointer text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Ver detalle del cálculo</summary>
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
