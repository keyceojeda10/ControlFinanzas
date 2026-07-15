// components/clientes/ClienteCard.jsx
// Tarjeta premium vertical de cliente — glassmorphism moderno.
// Formato portrait: gradiente vibrante arriba, avatar flotando sobre
// borde del panel glass, nombre grande debajo, stats con iconos color.
// Sin sombras. Limpia.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'
import CardActionMenu from '@/components/ui/CardActionMenu'
import { NuevoChip } from '@/components/ui/BadgeNuevo'

const GRADIENTS = {
  ok:   'linear-gradient(145deg, #e8a010 0%, #d4880a 40%, #c07008 100%)',
  nuevo:'linear-gradient(145deg, #16a34a 0%, #0d9044 40%, #047857 100%)',
  hot:  'linear-gradient(145deg, #ea580c 0%, #dc4010 40%, #c02020 100%)',
  crit: 'linear-gradient(145deg, #dc2626 0%, #b91c1c 40%, #991b1b 100%)',
  off:  'linear-gradient(145deg, #475569 0%, #374151 40%, #1f2937 100%)',
  done: 'linear-gradient(145deg, #059669 0%, #047857 40%, #065f46 100%)',
}

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
      style={{ background: gradient }}
    >
      {/* Zona gradiente superior — espacio para glows + badges */}
      <div className="relative px-4 pt-4 pb-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute w-[160px] h-[160px] rounded-full opacity-25 blur-[60px]"
            style={{ background: 'white', top: '-40px', right: '-30px' }} />
          <div className="absolute w-[120px] h-[120px] rounded-full opacity-15 blur-[50px]"
            style={{ background: accent, bottom: '-20px', left: '10%' }} />
        </div>

        {/* Badges + actions */}
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'white' }} />
              {label}
            </span>
            {cliente.tieneClavo && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.35)', color: 'white', border: '1px solid rgba(239,68,68,0.4)' }}>
                Perdido
              </span>
            )}
            {cliente.grupoCobro && (
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {cliente.grupoCobro.nombre}
              </span>
            )}
            {esNuevo && <NuevoChip />}
          </div>
          {actions?.length > 0 && <CardActionMenu actions={actions} />}
        </div>
      </div>

      {/* Panel glass — ocupa mitad inferior, avatar flota sobre el borde */}
      <div className="relative mx-2.5 mb-2.5">
        {/* Avatar flotante sobre el borde */}
        <div className="absolute -top-8 left-4 z-10">
          <Avatar
            nombre={cliente.nombre}
            fotoUrl={cliente.fotoUrl}
            size={56}
            fontSize={20}
            style={{ border: '3px solid rgba(255,255,255,0.35)' }}
          />
          {cliente.pagoHoy && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: '#22c55e', border: '2px solid rgba(255,255,255,0.4)' }}
            >
              <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          )}
        </div>

        <div
          className="rounded-[12px] pt-9 pb-4 px-4"
          style={{
            background: 'rgba(0,0,0,0.32)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Nombre grande + cedula */}
          <p className="text-[18px] font-bold truncate leading-tight" style={{ color: 'white' }}>
            {cliente.nombre}
          </p>
          {cliente.cedula && !cliente.cedula.startsWith('SIN-') && (
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>CC {cliente.cedula}</p>
          )}
          {cliente.creadoPor && (
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-2.5 h-2.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{cliente.creadoPor.nombre || 'Cobrador'}</span>
            </div>
          )}

          {tienePrestamo ? (
            <>
              {/* Stats con iconos de color — fila horizontal */}
              <div className="flex items-center gap-4 mt-4 mb-3">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill={accent}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.96-3.12 3.19z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Saldo</p>
                    <p className="text-[13px] font-mono-display font-bold leading-tight truncate" style={{ color: 'white' }}>
                      {formatMoney(saldoTotal)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#818cf8">
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                  </svg>
                  <div>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{cliente.prestamosActivos === 1 ? 'Prestamo' : 'Prestamos'}</p>
                    <p className="text-[13px] font-mono-display font-bold leading-tight" style={{ color: 'white' }}>
                      {cliente.prestamosActivos}
                    </p>
                  </div>
                </div>

                {cliente.diasMoraMax > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#fb7185">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <div>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Mora</p>
                      <p className="text-[13px] font-mono-display font-bold leading-tight" style={{ color: '#fb7185' }}>
                        {cliente.diasMoraMax}d
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra progreso */}
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(porcentaje, 2)}%`, background: accent }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] mt-1.5">
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span className="font-mono-display font-bold" style={{ color: accent }}>{porcentaje}%</span> pagado
                </span>
                {cliente.proximoCobroLabel && (
                  <span className="capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {cliente.diasMoraMax > 0 ? 'Vencido' : 'Cobro'}: {cliente.proximoCobroLabel}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] mt-4 py-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Sin prestamos activos</p>
          )}

          {(cliente.lineasCreditoActivas ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <svg className="w-3 h-3" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {cliente.lineasCreditoActivas > 1 ? `${cliente.lineasCreditoActivas} lineas credito` : 'Linea credito'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
