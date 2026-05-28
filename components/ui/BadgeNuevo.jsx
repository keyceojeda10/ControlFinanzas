// components/ui/BadgeNuevo.jsx
// Badge suave "Nuevo" que aparece si la entidad fue creada hoy en la
// zona horaria del usuario. Sin emojis (SVG estrella inline).
'use client'

import { useCountry } from '@/hooks/useCountry'
import { isHoy } from '@/lib/i18n'

export default function BadgeNuevo({ fecha, className = '' }) {
  const { country } = useCountry()
  if (!fecha || !isHoy(fecha, country)) return null
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
        color: 'var(--color-success)',
        border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
      }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.39 6.95H22l-6.18 4.49L18.18 22 12 17.27 5.82 22l2.36-8.56L2 8.95h7.61L12 2z" />
      </svg>
      Nuevo
    </span>
  )
}
