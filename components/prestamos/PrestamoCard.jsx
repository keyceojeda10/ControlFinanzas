// components/prestamos/PrestamoCard.jsx - Tarjeta pastel premium (v4).
// Superficie suave del color del estado + tinta profunda + olas sutiles
// (estilo tarjeta fintech). Reactiva de verdad: al dia champan, nuevo azul
// lavanda, vencido durazno, mora rosa, completado menta, cancelado gris.
// Todos los datos se conservan.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import OfflineBadge from '@/components/offline/OfflineBadge'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'
import CardWaves from '@/components/ui/CardWaves'
import { CARD_PALETTES, PALETTE_PAGADO, moodKeyPrestamo } from '@/components/ui/tarjetaCredito'

function moodLabel(p, esNuevo) {
  if (p.estado === 'completado') return 'Completado'
  if (p.estado === 'cancelado')  return 'Cancelado'
  if (p.diasMora > 7)            return `${p.diasMora}d en mora`
  if (p.diasMora > 0)            return `${p.diasMora}d vencido`
  if (p.pagoHoy)                 return 'Pagó hoy'
  if (esNuevo)                   return 'Nuevo'
  return 'Al día'
}

export default function PrestamoCard({ prestamo: p, actions, esNuevo }) {
  const P               = CARD_PALETTES[moodKeyPrestamo(p, esNuevo)]
  const label           = moodLabel(p, esNuevo)
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
      className="block px-4 py-4 group relative overflow-hidden"
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
      }}
    >
      <CardWaves tint={P.waves} />

      <div className="relative">
        {/* Top: cliente | estado */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              nombre={p.cliente?.nombre}
              fotoUrl={p.cliente?.fotoUrl}
              size={34}
              fontSize={12}
              style={{ border: `2px solid color-mix(in srgb, ${P.ink} 20%, transparent)` }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: P.ink }}>
                {p.cliente?.nombre}
              </p>
              {p.cliente?.cedula && !p.cliente.cedula.startsWith('SIN-') && (
                <p className="text-[10px] mt-0.5" style={{ color: P.sub }}>CC {p.cliente.cedula}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col items-end gap-1">
              <OfflineBadge id={p.id} />
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  background: `color-mix(in srgb, ${P.accent} 14%, transparent)`,
                  color: P.accent,
                  border: `1px solid color-mix(in srgb, ${P.accent} 26%, transparent)`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: P.accent }} />
                {label}
              </span>
              {esNuevo && <NuevoChip />}
            </div>
            {actions?.length > 0 && <CardActionMenu actions={actions} />}
          </div>
        </div>

        {/* Saldo en grande — tinta profunda, como el balance de la referencia */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: P.sub }}>
            Saldo pendiente
          </p>
          <p
            className="font-mono-display font-bold leading-none tracking-tight"
            style={{ color: P.ink, fontSize: 'clamp(24px, 6.5vw, 30px)' }}
          >
            {formatMoney(p.saldoPendiente)}
          </p>
        </div>

        {/* Progreso fino */}
        <div className="mb-3">
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: P.track }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${porcentaje}%`, background: P.accent }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1.5">
            <span style={{ color: P.sub }}>
              <span className="font-mono-display font-bold" style={{ color: P.accent }}>{porcentaje}%</span> pagado
            </span>
            <span style={{ color: P.sub }}>de {formatMoney(p.totalAPagar)}</span>
          </div>
        </div>

        {/* Footer: 3 columnas limpias, sin celdas — aire de tarjeta fisica */}
        <div
          className="grid grid-cols-3 gap-2 pt-2.5"
          style={{ borderTop: `1px solid ${P.track}` }}
        >
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Pagado</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: PALETTE_PAGADO }}>
              {formatMoney(pagado)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Cuota</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
              {formatMoney(p.cuotaDiaria)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Próx. cobro</p>
            <p
              className="text-[12px] font-bold mt-0.5 capitalize truncate"
              style={{ color: enMora ? P.accent : P.ink }}
              title={proximoLabel || '—'}
            >
              {proximoLabel || '—'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
