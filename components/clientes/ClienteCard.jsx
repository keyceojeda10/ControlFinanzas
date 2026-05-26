// components/clientes/ClienteCard.jsx
// Card de cliente: nombre visible completo, estado, progreso financiero.
// Layout vertical para que el nombre nunca se trunque en movil.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/calculos'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'

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
  if (c.pagoHoy)                return 'Pago hoy'
  return 'Al dia'
}

export default function ClienteCard({ cliente, actions }) {
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
      className="block px-4 py-3.5 transition-all duration-200 group hover:scale-[1.005]"
    >
      {/* Fila 1: Avatar + Nombre + Badge + Kebab */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
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
              title="Pago hoy"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight line-clamp-1">
            {cliente.nombre}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-[var(--color-text-muted)]">CC {cliente.cedula}</p>
            {cliente.grupoCobro && (
              <span
                className="inline-flex items-center gap-1 text-[9px] px-1 rounded"
                style={{
                  color: cliente.grupoCobro.color || 'var(--color-accent)',
                  background: `${cliente.grupoCobro.color || 'var(--color-accent)'}14`,
                }}
              >
                <span className="w-1 h-1 rounded-full" style={{ background: cliente.grupoCobro.color || 'var(--color-accent)' }} />
                {cliente.grupoCobro.nombre}
              </span>
            )}
          </div>
        </div>

        <span
          className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            background: `${color}26`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: color }} />
          {label}
        </span>

        {actions?.length > 0 && <CardActionMenu actions={actions} />}
      </div>

      {/* Fila 2: Datos financieros (solo si tiene prestamo) */}
      {tienePrestamo && (
        <div className="mt-2.5 ml-[52px]">
          {/* Saldo + info prestamos */}
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {cliente.prestamosActivos} prestamo{cliente.prestamosActivos > 1 ? 's' : ''}
              {cliente.proximoCobroLabel && (
                <> · <span style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-secondary)' }}>{cliente.proximoCobroLabel}</span></>
              )}
            </p>
            {saldoTotal > 0 && (
              <p
                className="text-[13px] font-mono-display font-bold leading-none"
                style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-primary)' }}
              >
                {formatCOP(saldoTotal)}
              </p>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${porcentaje}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                }}
              />
            </div>
            <span className="shrink-0 text-[10px] font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span>
          </div>
        </div>
      )}
    </Card>
  )
}
