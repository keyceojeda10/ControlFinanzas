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
import { useCardPalettes, moodKeyPrestamo } from '@/components/ui/tarjetaCredito'

function moodLabel(p, esNuevo) {
  if (p.estado === 'completado') return 'Completado'
  if (p.estado === 'cancelado')  return 'Cancelado'
  if (p.diasMora > 7)            return `${p.diasMora}d en mora`
  if (p.diasMora > 0)            return `${p.diasMora}d vencido`
  if (p.pagoHoy)                 return 'Pagó hoy'
  if (esNuevo)                   return 'Nuevo'
  return 'Al día'
}

const MODO_TAG = {
  fijo: 'Cuota fija', unico: 'De una vez', solo_interes: 'Globo',
  saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente',
  lineal_dinamico: 'Dinamico', proporcional: 'Proporcional',
}

export default function PrestamoCard({ prestamo: p, actions, esNuevo }) {
  const { palettes, pagado: pagadoColor } = useCardPalettes()
  const P               = palettes[moodKeyPrestamo(p, esNuevo)]
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
      {P.sheen && P.sheen !== 'none' && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen, transform: 'scaleX(-1)', opacity: 0.5 }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute w-[3px] h-[3px] rounded-full" style={{ background: `${P.accent}50`, top: '12%', right: '18%' }} />
            <div className="absolute w-[2px] h-[2px] rounded-full" style={{ background: `${P.accent}40`, top: '35%', right: '8%' }} />
            <div className="absolute w-[2px] h-[2px] rounded-full" style={{ background: `${P.accent}35`, bottom: '20%', right: '25%' }} />
            <div className="absolute w-[3px] h-[3px] rounded-full" style={{ background: `${P.accent}30`, bottom: '35%', left: '12%' }} />
            <div className="absolute w-[2px] h-[2px] rounded-full" style={{ background: `${P.accent}45`, top: '60%', right: '40%' }} />
          </div>
        </>
      )}

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
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {p.cliente?.cedula && !p.cliente.cedula.startsWith('SIN-') && (
                  <span className="text-[10px]" style={{ color: P.sub }}>CC {p.cliente.cedula}</span>
                )}
                {p.creadoPorNombre && (
                  <>
                    {p.cliente?.cedula && !p.cliente.cedula.startsWith('SIN-') && (
                      <span className="text-[10px]" style={{ color: P.sub }}>·</span>
                    )}
                    <span className="text-[10px] flex items-center gap-0.5" style={{ color: P.sub }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      {p.creadoPorNombre}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col items-end gap-1">
              <OfflineBadge id={p.id} />
              {p.esClavo && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
                >Perdido</span>
              )}
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
              {p.modoInteres && MODO_TAG[p.modoInteres] && (
                <span
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: `color-mix(in srgb, ${P.ink} 8%, transparent)`, color: P.sub, border: `1px solid color-mix(in srgb, ${P.ink} 14%, transparent)` }}
                >
                  {MODO_TAG[p.modoInteres]}
                </span>
              )}
              {esNuevo && label !== 'Nuevo' && <NuevoChip />}
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

        {/* Footer */}
        <div className="relative pt-3 mt-1">
          <div
            className="absolute top-0 left-[10%] right-[10%] h-px"
            style={{ background: `linear-gradient(90deg, transparent, ${P.accent}33, transparent)` }}
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Pagado</p>
              <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: pagadoColor }}>
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
      </div>
    </Card>
  )
}
