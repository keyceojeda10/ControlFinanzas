// components/clientes/ClienteCard.jsx
// Card de cliente con info financiera al frente: saldo total, próximo cobro,
// progreso. Mood color según estado/mora. Avatar con anillo.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/calculos'

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

export default function ClienteCard({ cliente }) {
  const color = moodColor(cliente)
  const label = moodLabel(cliente)
  const inicial = cliente.nombre?.[0]?.toUpperCase() ?? '?'
  const tieneFoto = !!cliente.fotoUrl
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
      <div className="flex items-center gap-3">
        {/* Avatar con anillo del color del estado */}
        <div className="relative shrink-0">
          {tieneFoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cliente.fotoUrl}
              alt={cliente.nombre}
              className="w-11 h-11 rounded-full object-cover"
              style={{ border: `2px solid ${color}` }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold"
              style={{
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
                color,
                border: `2px solid color-mix(in srgb, ${color} 40%, transparent)`,
              }}
            >
              {inicial}
            </div>
          )}
          {cliente.pagoHoy && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
              style={{ background: 'var(--color-success)', border: '2px solid var(--color-bg-card)' }}
              title="Pagó hoy"
            />
          )}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate leading-tight">
              {cliente.nombre}
            </p>
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
              }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: color }} />
              {label}
            </span>
          </div>

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

          {/* Progreso si tiene préstamo activo */}
          {tienePrestamo && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {cliente.prestamosActivos} préstamo{cliente.prestamosActivos > 1 ? 's' : ''}
                  {cliente.proximoCobroLabel && (
                    <> · <span style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-secondary)' }} className="capitalize">{cliente.proximoCobroLabel}</span></>
                  )}
                </span>
                <span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${porcentaje}%`,
                    background: `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, transparent), ${color})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Saldo total si hay préstamo */}
        {tienePrestamo && saldoTotal > 0 && (
          <div className="text-right shrink-0 ml-1">
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Debe</p>
            <p
              className="text-[15px] font-mono-display font-bold leading-none mt-0.5"
              style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-primary)' }}
            >
              {formatCOP(saldoTotal)}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
