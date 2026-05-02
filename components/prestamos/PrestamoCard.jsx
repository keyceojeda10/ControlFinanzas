// components/prestamos/PrestamoCard.jsx - Card tipo "cuenta bancaria"
// Inspirado en Mercury / Revolut: saldo en grande arriba, micro-stats abajo,
// progress bar central con marca del % real, sparkline opcional de pagos.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatCOP, formatFechaCobroRelativa } from '@/lib/calculos'
import OfflineBadge from '@/components/offline/OfflineBadge'

const COLOR_OK     = 'var(--color-accent)'    // dorado — al dia
const COLOR_HOT    = '#f97316'                // naranja — vencido pocos dias
const COLOR_CRIT   = 'var(--color-danger)'    // rojo — mora seria
const COLOR_DONE   = 'var(--color-success)'   // verde — completado
const COLOR_OFF    = '#64748b'                // gris — cancelado

function moodColor(p) {
  if (p.estado === 'completado') return COLOR_DONE
  if (p.estado === 'cancelado')  return COLOR_OFF
  if (p.diasMora > 7)            return COLOR_CRIT
  if (p.diasMora > 0)            return COLOR_HOT
  return COLOR_OK
}

function moodLabel(p) {
  if (p.estado === 'completado') return 'Completado'
  if (p.estado === 'cancelado')  return 'Cancelado'
  if (p.diasMora > 7)            return `${p.diasMora}d en mora`
  if (p.diasMora > 0)            return `${p.diasMora}d vencido`
  if (p.pagoHoy)                 return 'Pagó hoy'
  return 'Al día'
}

export default function PrestamoCard({ prestamo: p }) {
  const color           = moodColor(p)
  const label           = moodLabel(p)
  const porcentaje      = Math.max(0, Math.min(100, p.porcentajePagado ?? 0))
  const pagado          = (p.totalAPagar ?? 0) - (p.saldoPendiente ?? 0)
  const enMora          = p.diasMora > 0
  const tieneProximo    = p.estado === 'activo' && p.proximoCobro
  const proximoLabel    = tieneProximo ? formatFechaCobroRelativa(p.proximoCobro) : null
  const inicial         = p.cliente?.nombre?.[0]?.toUpperCase() ?? '?'

  return (
    <Card
      as={Link}
      href={`/prestamos/${p.id}`}
      glowColor={color}
      padding={false}
      className="block px-4 py-4 transition-all duration-200 group hover:scale-[1.005]"
    >
      {/* Top: cliente + estado mood + offline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
            style={{
              background: `color-mix(in srgb, ${color} 18%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            }}
          >
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
              {p.cliente?.nombre}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">CC {p.cliente?.cedula}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <OfflineBadge id={p.id} />
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: `color-mix(in srgb, ${color} 15%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        </div>
      </div>

      {/* Saldo en grande tipo balance bancario */}
      <div className="mb-3">
        <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Saldo pendiente</p>
        <p
          className="font-mono-display font-bold leading-none tracking-tight"
          style={{
            color: enMora ? color : 'var(--color-text-primary)',
            fontSize: 'clamp(22px, 6vw, 28px)',
            textShadow: enMora ? `0 0 24px color-mix(in srgb, ${color} 25%, transparent)` : 'none',
          }}
        >
          {formatCOP(p.saldoPendiente)}
        </p>
      </div>

      {/* Progress bar con marca % */}
      <div className="mb-3">
        <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--color-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100
                ? `linear-gradient(90deg, ${COLOR_DONE}, ${COLOR_DONE})`
                : `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, transparent), ${color})`,
              boxShadow: porcentaje > 5 ? `0 0 10px color-mix(in srgb, ${color} 50%, transparent)` : 'none',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <span><span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span> pagado</span>
          <span>de {formatCOP(p.totalAPagar)}</span>
        </div>
      </div>

      {/* Footer: micro-stats en 3 columnas */}
      <div
        className="grid grid-cols-3 gap-2 pt-3"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div>
          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Pagado</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: 'var(--color-success)' }}>
            {formatCOP(pagado)}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Cuota</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {formatCOP(p.cuotaDiaria)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Próx. cobro</p>
          <p
            className="text-[12px] font-semibold mt-0.5 capitalize truncate"
            style={{ color: enMora ? color : 'var(--color-text-primary)' }}
            title={proximoLabel || '—'}
          >
            {proximoLabel || '—'}
          </p>
        </div>
      </div>
    </Card>
  )
}
