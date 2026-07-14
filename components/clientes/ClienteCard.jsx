// components/clientes/ClienteCard.jsx
// Tarjeta de perfil del cliente — identidad limpia, datos financieros claros.
// NO usa paletas de tarjeta de credito (eso es para prestamos).

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

const COLOR_OK   = 'var(--color-accent)'
const COLOR_HOT  = '#f97316'
const COLOR_CRIT = 'var(--color-danger)'
const COLOR_OFF  = '#64748b'
const COLOR_DONE = 'var(--color-success)'

function moodColor(c) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return COLOR_OFF
  if (c.diasMoraMax > 7) return COLOR_CRIT
  if (c.estado === 'mora' || c.diasMoraMax > 0) return COLOR_HOT
  if (c.pagoHoy) return COLOR_DONE
  return COLOR_OK
}

function moodLabel(c) {
  if (c.estado === 'cancelado') return 'Cancelado'
  if (c.estado === 'inactivo')  return 'Inactivo'
  if (c.diasMoraMax > 7)        return `${c.diasMoraMax}d en mora`
  if (c.estado === 'mora' || c.diasMoraMax > 0) return `${c.diasMoraMax || ''}d vencido`.trim()
  if (c.pagoHoy)                return 'Pago hoy'
  return 'Al dia'
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
      padding={false}
      hoverable
      glowColor={color}
      className="block group relative overflow-hidden"
    >
      {/* Barra superior de estado */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }} />

      <div className="px-4 py-3.5">
        {/* Identidad: avatar grande + nombre + cedula + badge estado */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={44}
              fontSize={15}
              style={{ border: `2.5px solid color-mix(in srgb, ${color} 40%, var(--color-border))` }}
            />
            {cliente.pagoHoy && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: 'var(--color-success)', border: '2px solid var(--color-bg-card)' }}
              >
                <svg className="w-2 h-2" fill="white" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>
              {cliente.nombre}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>CC {cliente.cedula}</span>
              )}
              {cliente.creadoPor && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {cliente.creadoPor.nombre || 'Cobrador'}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {cliente.tieneClavo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
                Perdido
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 26%, transparent)` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {label}
            </span>
            {esNuevo && <NuevoChip />}
            {actions?.length > 0 && <CardActionMenu actions={actions} />}
          </div>
        </div>

        {/* Badges opcionales */}
        {(cliente.grupoCobro || (cliente.lineasCreditoActivas ?? 0) > 0) && (
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {cliente.grupoCobro && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: cliente.grupoCobro.color || 'var(--color-accent)',
                  background: `color-mix(in srgb, ${cliente.grupoCobro.color || 'var(--color-accent)'} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${cliente.grupoCobro.color || 'var(--color-accent)'} 22%, transparent)`,
                }}>
                <span className="w-1 h-1 rounded-full" style={{ background: cliente.grupoCobro.color || 'var(--color-accent)' }} />
                {cliente.grupoCobro.nombre}
              </span>
            )}
            {(cliente.lineasCreditoActivas ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ color: 'var(--color-purple)', background: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-purple) 20%, transparent)' }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas` : 'Linea credito'}
              </span>
            )}
          </div>
        )}

        {/* Datos financieros */}
        {tienePrestamo ? (
          <div className="rounded-[12px] px-3.5 py-3" style={{
            background: `color-mix(in srgb, ${color} 6%, var(--color-bg-surface))`,
            border: `1px solid color-mix(in srgb, ${color} 14%, var(--color-border))`,
          }}>
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                  Saldo pendiente
                </p>
                <p className="text-[20px] font-mono-display font-bold leading-none mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {formatMoney(saldoTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {cliente.prestamosActivos} prestamo{cliente.prestamosActivos > 1 ? 's' : ''}
                </p>
                {cliente.proximoCobroLabel && (
                  <p className="text-[11px] font-semibold mt-0.5 capitalize" style={{ color: cliente.diasMoraMax > 0 ? COLOR_CRIT : 'var(--color-text-secondary)' }}>
                    {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-text-muted) 15%, transparent)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(porcentaje, 2)}%`, background: color }}
              />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-mono-display font-bold" style={{ color }}>{porcentaje}%</span> pagado
            </p>
          </div>
        ) : (
          <div className="rounded-[10px] px-3 py-2" style={{ background: 'var(--color-bg-hover)' }}>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sin prestamos activos</p>
          </div>
        )}
      </div>
    </Card>
  )
}
