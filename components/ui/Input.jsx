// components/ui/Input.jsx

import { forwardRef, useId } from 'react'

/* ⚠ ERA `text-[12.5px]`, Y EL 12.5 NO EXISTE.
   La escala Manrope de `11-ESCALAS §1C` tiene siete tamaños —16·15·14·13·12·11·10—
   y ninguno con decimal. Este único literal se propagaba a la etiqueta de TODOS
   los formularios de la app: 235 usos de tamaños intermedios en el repo, y este
   era el más multiplicador. 12px es el valor de la escala para un metadato o una
   etiqueta de campo. */
const labelCls = 'text-[12px] font-bold tracking-[0.01em]'
const labelStyle = { color: 'var(--cf-ink-2)' }
const fieldStyle = {
  background: 'var(--cf-fill)',
  borderColor: 'var(--cf-border)',
  color: 'var(--cf-ink)',
}

export const Input = forwardRef(function Input(
  { label, error, prefix, suffix, className = '', containerClassName = '', type, onChange, ...props },
  ref
) {
  const generatedId = useId()
  const fieldId = props.id || generatedId

  // iOS Safari: type="number" causa "The string did not match the expected pattern"
  // Fix: usar type="text" con inputMode para mostrar teclado numérico
  const isNumber = type === 'number'
  const actualType = isNumber ? 'text' : type
  const actualInputMode = isNumber ? (props.inputMode || 'numeric') : props.inputMode
  const handleChange = isNumber
    ? (e) => {
        const allow = props.inputMode === 'decimal' ? /[^0-9.]/g : /[^0-9]/g
        e.target.value = e.target.value.replace(allow, '')
        onChange?.(e)
      }
    : onChange

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId} className={labelCls} style={labelStyle}>{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm pointer-events-none select-none" style={{ color: 'var(--cf-ink-3)' }}>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          type={actualType}
          inputMode={actualInputMode}
          onChange={handleChange}
          className={[
            'cf-input w-full h-14 rounded-[14px] border text-sm transition-all duration-200',
            'focus:outline-none focus:border-[var(--cf-gold)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            prefix ? 'pl-8' : 'pl-3',
            suffix ? 'pr-8' : 'pr-3',
            error ? 'cf-input-error' : '',
            className,
          ].join(' ')}
          style={fieldStyle}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm pointer-events-none select-none" style={{ color: 'var(--cf-ink-3)' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select(
  { label, error, className = '', containerClassName = '', children, ...props },
  ref
) {
  const generatedId = useId()
  const fieldId = props.id || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && <label htmlFor={fieldId} className={labelCls} style={labelStyle}>{label}</label>}
      <select
        ref={ref}
        id={fieldId}
        className={[
          'cf-input w-full h-14 rounded-[14px] border text-sm px-3',
          'focus:outline-none focus:border-[var(--cf-gold)]',
          'transition-all duration-200 cursor-pointer',
          error ? 'cf-input-error' : '',
          className,
        ].join(' ')}
        style={fieldStyle}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, className = '', containerClassName = '', ...props },
  ref
) {
  const generatedId = useId()
  const fieldId = props.id || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && <label htmlFor={fieldId} className={labelCls} style={labelStyle}>{label}</label>}
      <textarea
        ref={ref}
        id={fieldId}
        className={[
          'cf-input w-full rounded-[12px] border text-sm px-3 py-2.5',
          'focus:outline-none focus:border-[var(--cf-gold)]',
          'transition-all duration-200 resize-none',
          error ? 'cf-input-error' : '',
          className,
        ].join(' ')}
        style={fieldStyle}
        {...props}
      />
      {error && <p className="text-xs" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
    </div>
  )
})
