// components/ui/BadgeNuevo.jsx
// Wrapper que envuelve una card y le agrega un glow verde sutil
// + un chip "NUEVO" dentro de la card si la fecha es de hoy.
'use client'

import { useCountry } from '@/hooks/useCountry'
import { isHoy } from '@/lib/i18n'

export default function BadgeNuevo({ fecha, children, className = '' }) {
  const { country } = useCountry()
  const esNuevo = fecha && isHoy(fecha, country)

  if (!esNuevo) return children ?? null

  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden="true"
        className="absolute -inset-px rounded-[17px] pointer-events-none animate-pulse"
        style={{
          background: 'transparent',
          boxShadow:
            '0 0 10px color-mix(in srgb, var(--cf-green-dark) 35%, transparent),' +
            ' inset 0 0 6px color-mix(in srgb, var(--cf-green-dark) 10%, transparent)',
          animationDuration: '2.4s',
        }}
      />
      {children}
    </div>
  )
}

export function NuevoChip() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full shrink-0"
      style={{
        color: 'var(--cf-green-dark)',
        background: 'color-mix(in srgb, var(--cf-green-dark) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--cf-green-dark) 30%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        className="w-1 h-1 rounded-full"
        style={{ background: 'var(--cf-green-dark)' }}
      />
      Nuevo
    </span>
  )
}
