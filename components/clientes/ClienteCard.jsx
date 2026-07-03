// components/clientes/ClienteCard.jsx
// Card de cliente con jerarquia visual clara.
// Nombre completo siempre visible, datos financieros etiquetados y separados.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'
import CardWaves from '@/components/ui/CardWaves'
import { CARD_PALETTES, moodKeyCliente } from '@/components/ui/tarjetaCredito'

const COLOR_OK     = 'var(--color-accent)'
const COLOR_HOT    = '#f97316'
const COLOR_CRIT   = 'var(--color-danger)'
const COLOR_OFF    = '#64748b'

function moodColor(c) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return COLOR_OFF
  if (c.diasMoraMax > 7) return COLOR_CRIT
  if (c.estado === 'mora' || c.diasMoraMax > 0) return COLOR_HOT
  return COLOR_OK
}

function moodLabel(c) {
  if (c.estado === 'cancelado') return 'Cancelado'
  if (c.estado === 'inactivo')  return 'Inactivo'
  if (c.diasMoraMax > 7)        return `${c.diasMoraMax}d en mora`
  if (c.estado === 'mora' || c.diasMoraMax > 0) return `${c.diasMoraMax || ''}d vencido`.trim()
  if (c.pagoHoy)                return 'Pagó hoy'
  return 'Al día'
}

export default function ClienteCard({ cliente, actions, esNuevo }) {
  const color = moodColor(cliente)
  const label = moodLabel(cliente)
  const saldoTotal = Number(cliente.saldoPendienteTotal ?? 0)
  const tienePrestamo = (cliente.prestamosActivos ?? 0) > 0
  const porcentaje = Math.max(0, Math.min(100, cliente.porcentajePagadoPromedio ?? 0))

  return (
    <Card
      as={Link}
      href={`/clientes/${cliente.id}`}
      glowColor={color}
      padding={false}
      hoverable
      className="block px-4 py-3.5 group"
    >
      {/* ── Seccion superior: identidad del cliente ── */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0 mt-0.5">
          <Avatar
            nombre={cliente.nombre}
            fotoUrl={cliente.fotoUrl}
            size={40}
            fontSize={14}
            style={cliente.fotoUrl ? { border: `2px solid ${color}` } : undefined}
          />
          {cliente.pagoHoy && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
              style={{ background: 'var(--color-success)', border: '2px solid var(--color-bg-card)' }}
            />
          )}
        </div>

        {/* Nombre + Cedula */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">
            {cliente.nombre}
          </p>
          {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">CC {cliente.cedula}</p>
          )}
        </div>

        {/* Badges apilados a la derecha */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: `color-mix(in srgb, ${color} 13%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 21%, transparent)`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
          {cliente.grupoCobro && (
            <span
              className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                color: cliente.grupoCobro.color || 'var(--color-accent)',
                background: `${cliente.grupoCobro.color || 'var(--color-accent)'}14`,
                border: `1px solid ${cliente.grupoCobro.color || 'var(--color-accent)'}30`,
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: cliente.grupoCobro.color || 'var(--color-accent)' }} />
              {cliente.grupoCobro.nombre}
            </span>
          )}
          {cliente.creadoPor && (
            <span
              className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                color: 'var(--color-text-secondary)',
                background: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border)',
              }}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {cliente.creadoPor.nombre || 'Cobrador'}
            </span>
          )}
          {esNuevo && <NuevoChip />}
          {(cliente.lineasCreditoActivas ?? 0) > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                color: '#8b5cf6',
                background: '#8b5cf614',
                border: '1px solid #8b5cf630',
              }}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas` : 'Linea credito'}
            </span>
          )}
        </div>

        {/* Kebab menu */}
        {actions?.length > 0 && <CardActionMenu actions={actions} />}
      </div>

      {/* ── Seccion financiera: tarjeta pastel del estado (solo si tiene prestamo) ──
          Superficie suave + tinta profunda + olas sutiles. Reactiva: al dia
          champan, nuevo azul lavanda, vencido durazno, mora rosa, off gris. */}
      {tienePrestamo && (() => {
        const P = CARD_PALETTES[moodKeyCliente(cliente, esNuevo)]
        return (
          <div
            className="mt-3 relative overflow-hidden rounded-[14px] px-4 py-3.5"
            style={{
              background: P.grad,
              border: `1px solid ${P.border}`,
              boxShadow: P.shadow,
            }}
          >
            <CardWaves tint={P.waves} />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: P.sub }}>
                    Saldo pendiente
                  </p>
                  <p className="text-[22px] font-mono-display font-bold leading-none mt-1" style={{ color: P.ink }}>
                    {formatMoney(saldoTotal)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium" style={{ color: P.sub }}>
                    {cliente.prestamosActivos} préstamo{cliente.prestamosActivos > 1 ? 's' : ''}
                  </p>
                  {cliente.proximoCobroLabel && (
                    <p className="text-[10px] font-semibold mt-0.5 capitalize" style={{ color: cliente.diasMoraMax > 0 ? P.accent : P.ink }}>
                      {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ background: P.track }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(porcentaje, 2)}%`, background: P.accent }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px]">
                <span style={{ color: P.sub }}>
                  <span className="font-mono-display font-bold" style={{ color: P.accent }}>{porcentaje}%</span> pagado
                </span>
              </div>
            </div>
          </div>
        )
      })()}
    </Card>
  )
}
