// components/clientes/ClienteCard.jsx
// Ficha de perfil del cliente — identidad centrada en la persona.
// Avatar dominante, nombre grande, datos financieros como ficha de contacto.
// Usa paletas pastel por mood pero estructura tipo perfil, NO tarjeta de credito.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'
import { useCardPalettes, moodKeyCliente } from '@/components/ui/tarjetaCredito'

function moodLabel(c) {
  if (c.estado === 'cancelado') return 'Cancelado'
  if (c.estado === 'inactivo')  return 'Inactivo'
  if (c.diasMoraMax > 7)        return `${c.diasMoraMax}d mora`
  if (c.estado === 'mora' || c.diasMoraMax > 0) return `${c.diasMoraMax || ''}d vencido`.trim()
  if (c.pagoHoy)                return 'Pago hoy'
  return 'Al dia'
}

export default function ClienteCard({ cliente, actions, esNuevo }) {
  const { palettes } = useCardPalettes()
  const P = palettes[moodKeyCliente(cliente, esNuevo)]
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
      className="block group relative overflow-hidden"
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
      }}
    >
      <div className="relative px-4 pt-4 pb-3.5">
        {/* Perfil: avatar grande centrado + nombre */}
        <div className="flex flex-col items-center text-center mb-3">
          <div className="relative mb-2">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={56}
              fontSize={20}
              style={{
                border: `3px solid color-mix(in srgb, ${P.accent} 40%, transparent)`,
                boxShadow: `0 4px 12px color-mix(in srgb, ${P.accent} 20%, transparent)`,
              }}
            />
            {cliente.pagoHoy && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: P.accent, border: '2px solid color-mix(in srgb, var(--color-bg-card) 30%, transparent)' }}
              >
                <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <p className="text-[16px] font-bold leading-tight truncate w-full" style={{ color: P.ink }}>
            {cliente.nombre}
          </p>
          {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
            <p className="text-[11px] mt-0.5" style={{ color: P.sub }}>CC {cliente.cedula}</p>
          )}
        </div>

        {/* Badges en linea: estado + grupo + cobrador + clavo + nuevo */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap mb-3">
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

          {cliente.tieneClavo && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
              Perdido
            </span>
          )}

          {cliente.grupoCobro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                color: P.accent,
                background: `color-mix(in srgb, ${P.accent} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${P.accent} 18%, transparent)`,
              }}>
              <span className="w-1 h-1 rounded-full" style={{ background: P.accent }} />
              {cliente.grupoCobro.nombre}
            </span>
          )}

          {esNuevo && <NuevoChip />}
        </div>

        {/* Separador sutil */}
        <div className="h-px w-full mb-3" style={{ background: `color-mix(in srgb, ${P.ink} 10%, transparent)` }} />

        {/* Datos financieros — layout de ficha */}
        {tienePrestamo ? (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.sub }}>Saldo</p>
                <p className="text-[17px] font-mono-display font-bold leading-none mt-0.5" style={{ color: P.ink }}>
                  {formatMoney(saldoTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.sub }}>Prestamos</p>
                <p className="text-[17px] font-mono-display font-bold leading-none mt-0.5" style={{ color: P.ink }}>
                  {cliente.prestamosActivos}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-2.5">
              <div className="h-[4px] rounded-full overflow-hidden" style={{ background: P.track }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(porcentaje, 2)}%`, background: P.accent }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px]" style={{ color: P.sub }}>
                  <span className="font-mono-display font-bold" style={{ color: P.accent }}>{porcentaje}%</span> pagado
                </p>
                {cliente.proximoCobroLabel && (
                  <p className="text-[10px] font-medium capitalize" style={{ color: cliente.diasMoraMax > 0 ? P.accent : P.sub }}>
                    {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-1">
            <p className="text-[11px]" style={{ color: P.sub }}>Sin prestamos activos</p>
          </div>
        )}

        {/* Footer: cobrador + linea credito */}
        {(cliente.creadoPor || (cliente.lineasCreditoActivas ?? 0) > 0) && (
          <div className="flex items-center justify-center gap-2 mt-2.5 pt-2.5 flex-wrap" style={{ borderTop: `1px solid color-mix(in srgb, ${P.ink} 8%, transparent)` }}>
            {cliente.creadoPor && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: P.sub }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                {cliente.creadoPor.nombre || 'Cobrador'}
              </span>
            )}
            {(cliente.lineasCreditoActivas ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: P.sub }}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas` : 'Linea credito'}
              </span>
            )}
          </div>
        )}

        {/* Action menu */}
        {actions?.length > 0 && (
          <div className="absolute top-3 right-3">
            <CardActionMenu actions={actions} />
          </div>
        )}
      </div>
    </Card>
  )
}
