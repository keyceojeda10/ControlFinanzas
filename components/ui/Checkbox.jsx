'use client'
// components/ui/Checkbox.jsx — Checkbox canónico del sistema (ver DESIGN.md).
// Check dorado sobre caja de 18px, radio 6px.

import { useId } from 'react'

export function Checkbox({ checked = false, onChange, label, description, disabled = false, className = '' }) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2.5 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <span className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={[
            'flex items-center justify-center w-[18px] h-[18px] rounded-[6px] border transition-all duration-150',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--cf-gold)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--cf-surface)]',
          ].join(' ')}
          style={{
            background: checked ? 'var(--cf-gold)' : 'var(--cf-fill)',
            borderColor: checked ? 'var(--cf-gold)' : 'var(--cf-border-strong)',
          }}
        >
          {checked && (
            <svg className="w-3 h-3" fill="none" stroke="var(--cf-ink)" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </span>
      {(label || description) && (
        <span className="flex-1 min-w-0">
          {label && <span className="block text-sm" style={{ color: 'var(--cf-ink)' }}>{label}</span>}
          {description && (
            <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{description}</span>
          )}
        </span>
      )}
    </label>
  )
}
