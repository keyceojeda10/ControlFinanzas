'use client'
// components/ui/MoneyInput.jsx - Input con separadores de miles para montos en COP

import { useState, useRef, useEffect } from 'react'

function formatWithDots(val) {
  const num = String(val).replace(/\D/g, '')
  if (!num) return ''
  return Number(num).toLocaleString('es-CO')
}

export default function MoneyInput({
  label, value, onChange, placeholder, error, className = '', containerClassName = '', ...props
}) {
  const [display, setDisplay] = useState(() => formatWithDots(value))
  const inputRef = useRef(null)

  // Sync when external value changes (e.g. reset form)
  useEffect(() => {
    const raw = String(value).replace(/\D/g, '')
    const displayed = String(display).replace(/\D/g, '')
    if (raw !== displayed) {
      setDisplay(formatWithDots(value))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setDisplay(formatWithDots(raw))
    // Pass raw number string to parent
    onChange?.({ target: { value: raw } })
  }

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-[var(--color-text-muted)] text-sm pointer-events-none select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className={[
            'w-full h-10 rounded-[12px] border text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
            'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)]',
            'focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)]',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'pl-8 pr-3',
            error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[rgba(239,68,68,0.3)]' : '',
            className,
          ].join(' ')}
          value={display}
          onChange={handleChange}
          placeholder={placeholder || 'Ej: 500.000'}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
