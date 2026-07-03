// components/prestamos/PrestamoCard.jsx - Tarjeta premium oscura.
// Carbon calido con profundidad; el ESTADO del prestamo se expresa via acento:
// saldo, glow superior, borde, pill de estado y barra de progreso toman el
// mood color (dorado al dia / naranja vencido / rojo mora / verde completado).
// Todos los datos se conservan.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import OfflineBadge from '@/components/offline/OfflineBadge'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'
import { CARD_SURFACE as S, CARD_ACCENTS, cardBackground, cardBorder, moodKeyPrestamo } from '@/components/ui/tarjetaCredito'

function moodLabel(p) {
  if (p.estado === 'completado') return 'Completado'
  if (p.estado === 'cancelado')  return 'Cancelado'
  if (p.diasMora > 7)            return `${p.diasMora}d en mora`
  if (p.diasMora > 0)            return `${p.diasMora}d vencido`
  if (p.pagoHoy)                 return 'Pagó hoy'
  return 'Al día'
}

export default function PrestamoCard({ prestamo: p, actions, esNuevo }) {
  const accent          = CARD_ACCENTS[moodKeyPrestamo(p)].color
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
      padding={false}
      hoverable
      className="block px-4 py-4 group"
      style={{
        background: cardBackground(accent),
        border: cardBorder(accent),
        boxShadow: S.shadow,
      }}
    >
      {/* Top: cliente + estado mood + offline */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            nombre={p.cliente?.nombre}
            fotoUrl={p.cliente?.fotoUrl}
            size={34}
            fontSize={12}
            style={{ border: `2px solid color-mix(in srgb, ${accent} 55%, transparent)` }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate leading-tight" style={{ color: S.ink }}>
              {p.cliente?.nombre}
            </p>
            {p.cliente?.cedula && !p.cliente.cedula.startsWith('SIN-') && (
              <p className="text-[10px] mt-0.5" style={{ color: S.faint }}>CC {p.cliente.cedula}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <OfflineBadge id={p.id} />
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                color: accent,
                border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {label}
            </span>
            {esNuevo && <NuevoChip />}
          </div>
          {actions?.length > 0 && <CardActionMenu actions={actions} />}
        </div>
      </div>

      {/* Saldo en grande — el acento colorea el numero */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: S.sub }}>
          Saldo pendiente
        </p>
        <p
          className="font-mono-display font-bold leading-none tracking-tight"
          style={{ color: accent, fontSize: 'clamp(24px, 6.5vw, 30px)' }}
        >
          {formatMoney(p.saldoPendiente)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-[6px] rounded-full overflow-hidden" style={{ background: S.track }}>
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${porcentaje}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 65%, transparent), ${accent})`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-1.5">
          <span style={{ color: S.sub }}>
            <span className="font-mono-display font-bold" style={{ color: accent }}>{porcentaje}%</span> pagado
          </span>
          <span style={{ color: S.sub }}>de {formatMoney(p.totalAPagar)}</span>
        </div>
      </div>

      {/* Footer: micro-stats */}
      <div className="grid grid-cols-3 gap-1.5 pt-3" style={{ borderTop: `1px solid ${S.track}` }}>
        <div className="rounded-[8px] px-2 py-1.5" style={{ background: S.cell }}>
          <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: S.faint }}>Pagado</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: '#34d399' }}>
            {formatMoney(pagado)}
          </p>
        </div>
        <div className="rounded-[8px] px-2 py-1.5" style={{ background: S.cell }}>
          <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: S.faint }}>Cuota</p>
          <p className="text-[12px] font-mono-display font-semibold mt-0.5" style={{ color: S.ink }}>
            {formatMoney(p.cuotaDiaria)}
          </p>
        </div>
        <div className="rounded-[8px] px-2 py-1.5 text-right" style={{ background: S.cell }}>
          <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: S.faint }}>Próx. cobro</p>
          <p
            className="text-[12px] font-semibold mt-0.5 capitalize truncate"
            style={{ color: enMora ? accent : S.ink }}
            title={proximoLabel || '—'}
          >
            {proximoLabel || '—'}
          </p>
        </div>
      </div>
    </Card>
  )
}
