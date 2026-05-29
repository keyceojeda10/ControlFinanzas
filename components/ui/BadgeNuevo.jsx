// components/ui/BadgeNuevo.jsx
// Badge "Nuevo" con halo pulsante para entidades creadas hoy en la zona
// horaria del usuario. Llama la atencion sin ser invasivo. Sin emojis.
'use client'

import { useCountry } from '@/hooks/useCountry'
import { isHoy } from '@/lib/i18n'

export default function BadgeNuevo({ fecha, className = '' }) {
  const { country } = useCountry()
  if (!fecha || !isHoy(fecha, country)) return null
  return (
    <span className={`relative inline-flex ${className}`}>
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full animate-ping"
        style={{
          background: 'color-mix(in srgb, var(--color-success) 35%, transparent)',
          animationDuration: '1.8s',
        }}
      />
      <span
        className="relative inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--color-success) 18%, var(--color-bg-surface))',
          color: 'var(--color-success)',
          border: '1px solid color-mix(in srgb, var(--color-success) 50%, transparent)',
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
    </span>
  )
}
