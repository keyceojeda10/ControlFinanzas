// components/prestamos/PrestamoCard.jsx - Card tipo "cuenta bancaria"
// Inspirado en Mercury / Revolut: saldo en grande arriba, micro-stats abajo,
// progress bar central con marca del % real, sparkline opcional de pagos.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import OfflineBadge from '@/components/offline/OfflineBadge'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

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

export default function PrestamoCard({ prestamo: p, actions, esNuevo }) {
  const color           = moodColor(p)
  const label           = moodLabel(p)
  const porcentaje      = Math.max(0, Math.min(100, p.porcentajePagado ?? 0))
  const pagado          = (p.totalAPagar ?? 0) - (p.saldoPendiente ?? 0)
  const enMora          = p.diasMora > 0
  const tieneProximo    = p.estado === 'activo' && p.proximoCobro
  const proximoLabel    = tieneProximo ? formatFechaCobroRelativa(p.proximoCobro) : null

  return (
    <Card
      as={Link}
      href={`/prestamos/${p.id}`}
      glowColor={color}
      padding={false}
      hoverable
      className="block px-4 py-4 group"
    >
      {/* Top: cliente + estado mood + offline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            nombre={p.cliente?.nombre}
            fotoUrl={p.cliente?.fotoUrl}
            size={32}
            fontSize={12}
            style={p.cliente?.fotoUrl ? { border: `1px solid ${color}` } : undefined}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
              {p.cliente?.nombre}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">CC {p.cliente?.cedula}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end gap-1">
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
            {esNuevo && <NuevoChip />}
          </div>
          {actions?.length > 0 && <CardActionMenu actions={actions} />}
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
          {formatMoney(p.saldoPendiente)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: 'var(--color-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100
                ? COLOR_DONE
                : `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span><span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span> pagado</span>
          <span>de {formatMoney(p.totalAPagar)}</span>
        </div>
      </div>

      {/* Footer: micro-stats */}
      <div className="grid grid-cols-3 gap-1.5 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="rounded-[8px] px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)' }}>
          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Pagado</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: 'var(--color-success)' }}>
            {formatMoney(pagado)}
          </p>
        </div>
        <div className="rounded-[8px] px-2 py-1.5" style={{ background: 'color-mix(in srgb, var(--color-text-primary) 5%, transparent)' }}>
          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Cuota</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {formatMoney(p.cuotaDiaria)}
          </p>
        </div>
        <div className="rounded-[8px] px-2 py-1.5 text-right" style={{ background: enMora ? `color-mix(in srgb, ${color} 8%, transparent)` : 'color-mix(in srgb, var(--color-info) 8%, transparent)' }}>
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
