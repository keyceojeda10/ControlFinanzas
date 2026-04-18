// components/ui/Input.jsx

import { forwardRef, useId } from 'react'

const labelCls = 'text-xs font-medium tracking-[0.01em]'
const labelStyle = { color: 'var(--color-text-secondary)' }
const fieldStyle = {
  background: 'var(--color-bg-hover)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
}

export const Input = forwardRef(function Input(
  { label, error, prefix, suffix, className = '', containerClassName = '', ...props },
  ref
) {
  const generatedId = useId()
  const fieldId = props.id || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId} className={labelCls} style={labelStyle}>{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-sm pointer-events-none select-none" style={{ color: 'var(--color-text-muted)' }}>
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={[
            'cf-input w-full h-11 rounded-[12px] border text-sm transition-all duration-200',
            'focus:outline-none focus:border-[var(--color-accent)]',
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
          <span className="absolute right-3 text-sm pointer-events-none select-none" style={{ color: 'var(--color-text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
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
          'cf-input w-full h-11 rounded-[12px] border text-sm px-3',
          'focus:outline-none focus:border-[var(--color-accent)]',
          'transition-all duration-200 cursor-pointer',
          error ? 'cf-input-error' : '',
          className,
        ].join(' ')}
        style={fieldStyle}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
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
          'focus:outline-none focus:border-[var(--color-accent)]',
          'transition-all duration-200 resize-none',
          error ? 'cf-input-error' : '',
          className,
        ].join(' ')}
        style={fieldStyle}
        {...props}
      />
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </div>
  )
})
