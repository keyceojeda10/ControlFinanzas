// components/clientes/ClienteCard.jsx
// Tarjeta premium de cliente — perfil glassmorphism con gradiente vibrante.
// Inspirada en cards modernas tipo Adobe/Dribbble: fondo gradiente colorido,
// panel glass blur para datos, avatar flotante, stats con iconos.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

// Gradientes vibrantes por estado — cada mood tiene su propia atmosfera
const GRADIENTS = {
  ok:   'linear-gradient(135deg, #f5c518 0%, #e8a010 30%, #d4880a 60%, #c06a08 100%)',
  nuevo:'linear-gradient(135deg, #22c55e 0%, #16a34a 30%, #0d9044 60%, #047857 100%)',
  hot:  'linear-gradient(135deg, #f97316 0%, #ea580c 30%, #dc4010 60%, #c02020 100%)',
  crit: 'linear-gradient(135deg, #ef4444 0%, #dc2626 30%, #b91c1c 60%, #991b1b 100%)',
  off:  'linear-gradient(135deg, #64748b 0%, #475569 30%, #374151 60%, #1f2937 100%)',
  done: 'linear-gradient(135deg, #10b981 0%, #059669 30%, #047857 60%, #065f46 100%)',
}

// Colores de acento por estado para iconos/stats
const ACCENTS = {
  ok: '#f5c518', nuevo: '#34d399', hot: '#fb923c',
  crit: '#f87171', off: '#94a3b8', done: '#6ee7b7',
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
  const accent = ACCENTS[mood]
  const gradient = GRADIENTS[mood]
  const label = moodLabel(cliente)
  const saldoTotal = Number(cliente.saldoPendienteTotal ?? 0)
  const tienePrestamo = (cliente.prestamosActivos ?? 0) > 0
  const porcentaje = Math.max(0, Math.min(100, cliente.porcentajePagadoPromedio ?? 0))

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="block rounded-[16px] overflow-hidden group transition-transform hover:scale-[1.015] active:scale-[0.98]"
      style={{
        background: gradient,
        boxShadow: `0 8px 32px color-mix(in srgb, ${accent} 25%, transparent), 0 2px 8px rgba(0,0,0,0.15)`,
      }}
    >
      {/* Zona superior: gradiente puro con glow */}
      <div className="relative px-4 pt-4 pb-8">
        {/* Glow orbital sutil */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[140px] h-[140px] rounded-full opacity-30 blur-[50px]"
            style={{ background: accent, top: '-30px', right: '-20px' }} />
          <div className="absolute w-[100px] h-[100px] rounded-full opacity-20 blur-[40px]"
            style={{ background: 'white', bottom: '0', left: '20%' }} />
        </div>

        {/* Avatar + nombre */}
        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar
              nombre={cliente.nombre}
              fotoUrl={cliente.fotoUrl}
              size={52}
              fontSize={18}
              style={{
                border: '3px solid rgba(255,255,255,0.4)',
                boxShadow: `0 4px 16px rgba(0,0,0,0.25)`,
              }}
            />
            {cliente.pagoHoy && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: '#22c55e', border: '2px solid rgba(255,255,255,0.5)', boxShadow: '0 2px 6px rgba(34,197,94,0.4)' }}
              >
                <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-1">
            {/* Badge estado — pill glass */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: 'white',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'white' }} />
                {label}
              </span>
              {cliente.tieneClavo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: 'rgba(239,68,68,0.3)', color: 'white', border: '1px solid rgba(239,68,68,0.4)' }}>
                  Perdido
                </span>
              )}
              {cliente.grupoCobro && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.18)' }}>
                  {cliente.grupoCobro.nombre}
                </span>
              )}
              {esNuevo && <NuevoChip />}
            </div>

            <p className="text-[16px] font-bold truncate leading-tight" style={{ color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
              {cliente.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.75)' }}>CC {cliente.cedula}</span>
              )}
              {cliente.creadoPor && (
                <>
                  {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
                  )}
                  <span className="text-[10px] flex items-center gap-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {cliente.creadoPor.nombre || 'Cobrador'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action menu */}
          {actions?.length > 0 && (
            <div className="shrink-0">
              <CardActionMenu actions={actions} />
            </div>
          )}
        </div>
      </div>

      {/* Panel glass inferior — datos financieros */}
      <div
        className="relative mx-2 mb-2 rounded-[12px] px-3.5 py-3"
        style={{
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        {tienePrestamo ? (
          <>
            {/* Stats con iconos — estilo referencia */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              {/* Saldo */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${accent} 25%, transparent)` }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke={accent} strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Saldo</p>
                  <p className="text-[14px] font-mono-display font-bold leading-tight truncate" style={{ color: 'white' }}>
                    {formatMoney(saldoTotal)}
                  </p>
                </div>
              </div>

              {/* Prestamos */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, #818cf8 25%, transparent)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="#818cf8" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Prestamos</p>
                  <p className="text-[14px] font-mono-display font-bold leading-tight" style={{ color: 'white' }}>
                    {cliente.prestamosActivos}
                  </p>
                </div>
              </div>

              {/* Mora (solo si hay) */}
              {cliente.diasMoraMax > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, #f87171 25%, transparent)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="#f87171" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Mora</p>
                    <p className="text-[14px] font-mono-display font-bold leading-tight" style={{ color: '#f87171' }}>
                      {cliente.diasMoraMax}d
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Barra de progreso */}
            <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(porcentaje, 2)}%`, background: accent }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1.5">
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span className="font-mono-display font-bold" style={{ color: accent }}>{porcentaje}%</span> pagado
              </span>
              {cliente.proximoCobroLabel && (
                <span className="capitalize" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-center py-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Sin prestamos activos</p>
        )}

        {/* Linea de credito badge */}
        {(cliente.lineasCreditoActivas ?? 0) > 0 && (
          <div className="flex items-center justify-center mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas credito` : 'Linea credito activa'}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
