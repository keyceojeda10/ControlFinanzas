// components/clientes/ClienteCard.jsx
// Ficha premium de cliente — perfil de contacto con datos financieros.
// Mismo nivel de craft que PrestamoCard (waves, sheen, paletas) pero
// estructura de perfil: avatar grande izquierda, nombre prominente,
// datos financieros como dashboard personal del cliente.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'
import CardWaves from '@/components/ui/CardWaves'
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
            <div className="absolute w-[3px] h-[3px] rounded-full" style={{ background: `${P.accent}50`, top: '15%', right: '12%' }} />
            <div className="absolute w-[2px] h-[2px] rounded-full" style={{ background: `${P.accent}40`, top: '45%', right: '6%' }} />
            <div className="absolute w-[2px] h-[2px] rounded-full" style={{ background: `${P.accent}35`, bottom: '25%', left: '8%' }} />
          </div>
        </>
      )}

      <div className="relative">
        {/* Perfil: avatar grande + identidad + badges */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={48}
              fontSize={17}
              style={{
                border: `2.5px solid color-mix(in srgb, ${P.ink} 20%, transparent)`,
                boxShadow: `0 4px 12px color-mix(in srgb, ${P.accent} 18%, transparent)`,
              }}
            />
            {cliente.pagoHoy && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: P.accent, border: '2px solid rgba(255,255,255,0.5)' }}
              >
                <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold truncate leading-tight" style={{ color: P.ink }}>
              {cliente.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                <span className="text-[10px]" style={{ color: P.sub }}>CC {cliente.cedula}</span>
              )}
              {cliente.creadoPor && (
                <>
                  {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                    <span className="text-[10px]" style={{ color: P.sub }}>·</span>
                  )}
                  <span className="text-[10px] flex items-center gap-0.5" style={{ color: P.sub }}>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {cliente.creadoPor.nombre || 'Cobrador'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col items-end gap-1">
              {cliente.tieneClavo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
                  Perdido
                </span>
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
              {cliente.grupoCobro && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    color: P.accent,
                    background: `color-mix(in srgb, ${P.accent} 10%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${P.accent} 18%, transparent)`,
                  }}>
                  {cliente.grupoCobro.nombre}
                </span>
              )}
              {(cliente.lineasCreditoActivas ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    color: P.sub,
                    background: `color-mix(in srgb, ${P.ink} 8%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${P.ink} 14%, transparent)`,
                  }}>
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas` : 'Linea'}
                </span>
              )}
              {esNuevo && <NuevoChip />}
            </div>
            {actions?.length > 0 && <CardActionMenu actions={actions} />}
          </div>
        </div>

        {/* Datos financieros del cliente */}
        {tienePrestamo ? (
          <>
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: P.sub }}>
                Deuda total
              </p>
              <p
                className="font-mono-display font-bold leading-none tracking-tight"
                style={{ color: P.ink, fontSize: 'clamp(22px, 6vw, 28px)' }}
              >
                {formatMoney(saldoTotal)}
              </p>
            </div>

            {/* Barra de progreso */}
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
                <span style={{ color: P.sub }}>
                  {cliente.prestamosActivos} prestamo{cliente.prestamosActivos > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Footer — separador gradient + proximo cobro */}
            <div className="relative pt-3">
              <div
                className="absolute top-0 left-[10%] right-[10%] h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${P.accent}33, transparent)` }}
              />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Proximo cobro</p>
                  <p
                    className="text-[13px] font-bold mt-0.5 capitalize truncate"
                    style={{ color: cliente.diasMoraMax > 0 ? P.accent : P.ink }}
                  >
                    {cliente.proximoCobroLabel || '—'}
                  </p>
                </div>
                {cliente.diasMoraMax > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Mora</p>
                    <p className="text-[13px] font-mono-display font-bold mt-0.5" style={{ color: P.accent }}>
                      {cliente.diasMoraMax}d
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="pt-2">
            <p className="text-[11px]" style={{ color: P.sub }}>Sin prestamos activos</p>
          </div>
        )}
      </div>
    </Card>
  )
}
