import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

const STATUS = {
  ok:    { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.18)' },
  nuevo: { color: 'var(--color-info)', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)' },
  hot:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)' },
  crit:  { color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.22)' },
  off:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)',border: 'rgba(148,163,184,0.18)' },
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
  const S = STATUS[mood]
  const label = moodLabel(cliente)
  const saldoTotal = Number(cliente.saldoPendienteTotal ?? 0)
  const tienePrestamo = (cliente.prestamosActivos ?? 0) > 0
  const porcentaje = Math.max(0, Math.min(100, cliente.porcentajePagadoPromedio ?? 0))

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="block rounded-[16px] overflow-hidden relative transition-all duration-200 hover:scale-[1.015] active:scale-[0.985]"
      style={{
        background: `linear-gradient(135deg, var(--color-bg-card), ${S.bg})`,
        border: `1px solid ${S.border}`,
        boxShadow: `0 2px 8px ${S.border}`,
      }}
    >
      <div className="px-3.5 py-3.5">
        {/* Header: avatar + nombre + status + menu */}
        <div className="flex items-start gap-2.5 mb-3">
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={42}
              fontSize={15}
              style={{
                border: `2px solid ${S.color}`,
                boxShadow: `0 0 0 2px var(--color-bg-card)`,
              }}
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
            <p className="text-[15px] font-bold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
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

          <div className="flex items-start gap-1 shrink-0">
            <div className="flex flex-col items-end gap-1">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${S.color} 15%, transparent)`,
                  color: S.color,
                  border: `1px solid color-mix(in srgb, ${S.color} 25%, transparent)`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: S.color }} />
                {label}
              </span>
              {cliente.tieneClavo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                    color: 'var(--color-danger)',
                    border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                  }}>
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
            {actions?.length > 0 && <CardActionMenu actions={actions} />}
          </div>
        </div>

        {tienePrestamo ? (
          <>
            {/* Monto */}
            <div className="mb-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Deuda total
              </p>
              <p className="text-[22px] font-mono-display font-bold leading-none tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(saldoTotal)}
              </p>
            </div>

            {/* Progreso */}
            <div className="mb-2.5">
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: `color-mix(in srgb, ${S.color} 12%, var(--color-bg-hover))` }}>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(porcentaje, 2)}%`, background: S.color }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-mono-display font-bold" style={{ color: S.color }}>{porcentaje}%</span> pagado
                </span>
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {cliente.prestamosActivos} {cliente.prestamosActivos === 1 ? 'prestamo' : 'prestamos'}
                </span>
              </div>
            </div>

            {/* Footer */}
            {(cliente.proximoCobroLabel || cliente.diasMoraMax > 0) && (
              <div
                className="flex items-center justify-between pt-2.5"
                style={{ borderTop: `1px solid ${S.border}` }}
              >
                {cliente.proximoCobroLabel && (
                  <span className="text-[12px] font-semibold capitalize" style={{ color: cliente.diasMoraMax > 0 ? S.color : 'var(--color-text-secondary)' }}>
                    {cliente.proximoCobroLabel}
                  </span>
                )}
                {cliente.diasMoraMax > 0 && (
                  <span className="text-[12px] font-mono-display font-bold" style={{ color: S.color }}>
                    {cliente.diasMoraMax}d mora
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>Sin prestamos activos</p>
        )}

        {(cliente.lineasCreditoActivas ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${S.border}` }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas credito` : 'Linea credito'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
