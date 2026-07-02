'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

  const toDisplay = useCallback((v) => {
    if (!abreviado || !v) return v
    const n = Number(String(v).replace(/\D/g, ''))
    return n ? String(Math.round(n / 1000)) : ''
  }, [abreviado])

  const [display, setDisplay] = useState(() => formatWithDots(toDisplay(value)))
  const inputRef = useRef(null)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (isEditingRef.current) return
    const raw = String(toDisplay(value)).replace(/\D/g, '')
    const displayed = String(display).replace(/\D/g, '')
    if (raw !== displayed) {
      setDisplay(formatWithDots(toDisplay(value)))
    }
  }, [value, abreviado]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    isEditingRef.current = true
    const raw = e.target.value.replace(/\D/g, '')
    setDisplay(formatWithDots(raw))
    const realValue = abreviado && raw ? String(Number(raw) * 1000) : raw
    onChange?.({ target: { value: realValue } })
    requestAnimationFrame(() => { isEditingRef.current = false })
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
            'cf-input w-full h-11 rounded-[12px] border text-sm',
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
          placeholder={placeholder || (abreviado ? 'Ej: 100 = 100.000' : 'Ej: 500.000')}
          {...props}
        />
        {abreviado && (
          <span className="absolute right-3 text-[10px] font-medium pointer-events-none select-none" style={{ color: 'var(--color-text-muted)' }}>
            x1.000
          </span>
        )}
      </div>
      {abreviado && display && (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-accent)' }}>
          = {formatWithDots(String(Number(String(display).replace(/\D/g, '')) * 1000))}
        </p>
      )}
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
