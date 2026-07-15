// components/clientes/ClienteCard.jsx
// Tarjeta minimalista de cliente — estilo fintech premium (PayPal/Revolut).
// Fondo limpio del tema, acento de color solo en status, tipografia clara,
// mucho espacio, sin gradientes ni efectos. Profesional y legible.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

const STATUS_COLORS = {
  ok:   '#22c55e',
  nuevo:'#3b82f6',
  hot:  '#f59e0b',
  crit: '#ef4444',
  off:  '#94a3b8',
}

function moodKey(c, esNuevo) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return 'off'
  if (c.diasMoraMax > 7) return 'crit'
  if (c.estado === 'mora' || c.diasMoraMax > 0) return 'hot'
  if (esNuevo) return 'nuevo'
  return 'ok'
}

function moodLabel(c) {
  if (c.estado === 'cancelado') return 'Cancelado'
  if (c.estado === 'inactivo')  return 'Inactivo'
  if (c.diasMoraMax > 7)        return `${c.diasMoraMax}d mora`
  if (c.estado === 'mora' || c.diasMoraMax > 0) return `${c.diasMoraMax || ''}d vencido`.trim()
  if (c.pagoHoy)                return 'Pago hoy'
  return 'Al dia'
}

export default function ClienteCard({ cliente, actions, esNuevo }) {
  const mood = moodKey(cliente, esNuevo)
  const statusColor = STATUS_COLORS[mood]
  const label = moodLabel(cliente)
  const saldoTotal = Number(cliente.saldoPendienteTotal ?? 0)
  const tienePrestamo = (cliente.prestamosActivos ?? 0) > 0
  const porcentaje = Math.max(0, Math.min(100, cliente.porcentajePagadoPromedio ?? 0))

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="block rounded-[16px] overflow-hidden transition-transform hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Accent stripe superior */}
      <div className="h-[3px]" style={{ background: statusColor }} />

      <div className="p-4">
        {/* Header: avatar + identidad + status */}
        <div className="flex items-start gap-3 mb-4">
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={46}
              fontSize={16}
              style={{ border: `2px solid color-mix(in srgb, ${statusColor} 30%, var(--color-border))` }}
            />
            {cliente.pagoHoy && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: '#22c55e', border: '2px solid var(--color-bg-card)' }}
              >
                <svg className="w-2 h-2" fill="white" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {cliente.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>CC {cliente.cedula}</span>
              )}
              {cliente.creadoPor && (
                <>
                  {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                    <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                  )}
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {cliente.creadoPor.nombre || 'Cobrador'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                color: statusColor,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
              {label}
            </span>
            {cliente.tieneClavo && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)' }}>
                Perdido
              </span>
            )}
            {cliente.grupoCobro && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' }}>
                {cliente.grupoCobro.nombre}
              </span>
            )}
            {esNuevo && <NuevoChip />}
          </div>
        </div>

        {tienePrestamo ? (
          <>
            {/* Monto principal */}
            <div className="mb-3">
              <p className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Deuda total
              </p>
              <p className="text-[24px] font-mono-display font-bold leading-none tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(saldoTotal)}
              </p>
            </div>

            {/* Barra de progreso */}
            <div className="mb-3">
              <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(porcentaje, 2)}%`, background: statusColor }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-semibold" style={{ color: statusColor }}>{porcentaje}%</span> pagado
                </span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {cliente.prestamosActivos} {cliente.prestamosActivos === 1 ? 'prestamo' : 'prestamos'}
                </span>
              </div>
            </div>

            {/* Info row */}
            {(cliente.proximoCobroLabel || cliente.diasMoraMax > 0) && (
              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                {cliente.proximoCobroLabel && (
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      {cliente.diasMoraMax > 0 ? 'Vencido' : 'Proximo cobro'}
                    </p>
                    <p className="text-[13px] font-semibold capitalize" style={{ color: cliente.diasMoraMax > 0 ? statusColor : 'var(--color-text-primary)' }}>
                      {cliente.proximoCobroLabel}
                    </p>
                  </div>
                )}
                {cliente.diasMoraMax > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Mora</p>
                    <p className="text-[13px] font-mono-display font-semibold" style={{ color: statusColor }}>
                      {cliente.diasMoraMax} dias
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>Sin prestamos activos</p>
        )}

        {(cliente.lineasCreditoActivas ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas credito` : 'Linea credito'}
            </span>
          </div>
        )}
      </div>

      {actions?.length > 0 && (
        <div className="absolute top-4 right-3">
          <CardActionMenu actions={actions} />
        </div>
      )}
    </Link>
  )
}
