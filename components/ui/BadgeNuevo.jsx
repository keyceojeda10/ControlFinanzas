// components/ui/BadgeNuevo.jsx
// Wrapper que envuelve una card y le agrega un borde verde brillante + un
// chip "Nuevo" si la fecha es de hoy en la zona horaria del usuario.
// No tapa ningun contenido — el efecto vive en el borde y un chip flotante
// pegado a la esquina inferior derecha del borde.
'use client'

import { useCountry } from '@/hooks/useCountry'
import { isHoy } from '@/lib/i18n'

export default function BadgeNuevo({ fecha, children, className = '' }) {
  const { country } = useCountry()
  const esNuevo = fecha && isHoy(fecha, country)

  if (!esNuevo) return children ?? null

  return (
    <div className={`relative mb-3 ${className}`}>
      {/* Aro animado pulsante alrededor del card */}
      <div
        aria-hidden="true"
        className="absolute -inset-0.5 rounded-[20px] pointer-events-none animate-pulse"
        style={{
          background: 'transparent',
          border: '2px solid color-mix(in srgb, var(--color-success) 70%, transparent)',
          boxShadow:
            '0 0 12px color-mix(in srgb, var(--color-success) 45%, transparent),' +
            ' inset 0 0 8px color-mix(in srgb, var(--color-success) 12%, transparent)',
          animationDuration: '2.4s',
        }}
      />
      {children}
      {/* Chip "Nuevo" en la esquina inferior izquierda, fuera del flujo */}
      <span
        className="absolute -bottom-2 left-3 z-10 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full pointer-events-none"
        style={{
          background: 'var(--color-bg-base)',
          color: 'var(--color-success)',
          border: '1px solid color-mix(in srgb, var(--color-success) 60%, transparent)',
          boxShadow: '0 0 8px color-mix(in srgb, var(--color-success) 40%, transparent)',
        }}
      >
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--color-success)' }}
        />
        Nuevo
      </span>
    </div>
  )
}
