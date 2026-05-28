// components/clientes/ClienteCard.jsx
// Card de cliente con jerarquia visual clara.
// Nombre completo siempre visible, datos financieros etiquetados y separados.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { useCountry } from '@/hooks/useCountry'

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
  const { formatMoney } = useCountry()
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
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">CC {cliente.cedula}</p>
        </div>

        {/* Badges apilados a la derecha */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              background: `${color}20`,
              color,
              border: `1px solid ${color}35`,
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
        </div>

        {/* Kebab menu */}
        {actions?.length > 0 && <CardActionMenu actions={actions} />}
      </div>

      {/* ── Seccion financiera (solo si tiene prestamo) ── */}
      {tienePrestamo && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Fila: Saldo + Info prestamo */}
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Saldo pendiente</p>
              <p
                className="text-[18px] font-mono-display font-bold leading-none mt-1"
                style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-primary)' }}
              >
                {formatMoney(saldoTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {cliente.prestamosActivos} prestamo{cliente.prestamosActivos > 1 ? 's' : ''}
              </p>
              {cliente.proximoCobroLabel && (
                <p
                  className="text-[10px] font-medium mt-0.5 capitalize"
                  style={{ color: cliente.diasMoraMax > 0 ? color : 'var(--color-text-secondary)' }}
                >
                  {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                </p>
              )}
            </div>
          </div>

          {/* Barra de progreso */}
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-[var(--color-text-muted)]">Progreso</span>
              <span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(porcentaje, 2)}%`,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
