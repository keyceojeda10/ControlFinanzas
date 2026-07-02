'use client'
// components/ui/Toggle.jsx — Switch on/off canónico del sistema.
// ÚNICO switch permitido en la app (ver DESIGN.md). ON = dorado accent.

import { useId } from 'react'

export function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md', // 'sm' | 'md'
  className = '',
}) {
  const id = useId()
  const dims = size === 'sm'
    ? { track: 'w-8 h-[18px]', knob: 14, travel: 14 }
    : { track: 'w-10 h-[22px]', knob: 16, travel: 18 }

  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={[
        'relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        dims.track,
      ].join(' ')}
      style={{
        background: checked ? 'var(--color-accent)' : 'var(--color-bg-hover)',
        border: `1px solid ${checked ? 'var(--color-accent)' : 'var(--color-border-hover)'}`,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-sm"
        style={{
          width: dims.knob,
          height: dims.knob,
          left: 2,
          background: checked ? '#1a1a2e' : 'var(--color-text-secondary)',
          transform: `translate(${checked ? dims.travel : 0}px, -50%)`,
        }}
      />
    </button>
  )

  if (!label) return control

  return (
    <label htmlFor={id} className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-60' : ''} ${className}`}>
      {control}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        {description && (
          <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{description}</span>
        )}
      </span>
    </label>
  )
}
