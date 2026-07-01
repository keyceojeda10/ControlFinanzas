'use client'
// components/ui/MoneyInput.jsx - Input con separadores de miles para montos en COP

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

function formatWithDots(val) {
  const num = String(val).replace(/\D/g, '')
  if (!num) return ''
  return Number(num).toLocaleString('es-CO')
}

export default function MoneyInput({
  label, value, onChange, placeholder, error, className = '', containerClassName = '', ...props
}) {
  const { modoAbreviado } = useAuth()
  const abreviado = modoAbreviado

  const toDisplay = (v) => {
    if (!abreviado || !v) return v
    const n = Number(String(v).replace(/\D/g, ''))
    return n ? String(Math.round(n / 1000)) : ''
  }

  const [display, setDisplay] = useState(() => formatWithDots(toDisplay(value)))
  const inputRef = useRef(null)

  useEffect(() => {
    const raw = String(toDisplay(value)).replace(/\D/g, '')
    const displayed = String(display).replace(/\D/g, '')
    if (raw !== displayed) {
      setDisplay(formatWithDots(toDisplay(value)))
    }
  }, [value, abreviado]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setDisplay(formatWithDots(raw))
    const realValue = abreviado && raw ? String(Number(raw) * 1000) : raw
    onChange?.({ target: { value: realValue } })
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
            'cf-input w-full h-11 rounded-[14px] border text-sm',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'pl-8 pr-3',
            error ? 'cf-input-error' : '',
            className,
          ].join(' ')}
          style={{
            background: 'var(--color-bg-hover)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          value={display}
          onChange={handleChange}
          placeholder={placeholder || (abreviado ? 'Ej: 500 = 500.000' : 'Ej: 500.000')}
          {...props}
        />
      </div>
      {abreviado && display && (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Valor real: ${formatWithDots(String(Number(String(display).replace(/\D/g, '')) * 1000))}
        </p>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
