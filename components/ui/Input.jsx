// components/ui/Input.jsx

import { forwardRef, useId } from 'react'

export const Input = forwardRef(function Input(
  { label, error, prefix, suffix, className = '', containerClassName = '', ...props },
  ref
) {
  const generatedId = useId()
  const fieldId = props.id || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label htmlFor={fieldId} className="text-xs font-medium text-[#b5b5be] tracking-[0.01em]">{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[#9b9ba6] text-sm pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={[
            'w-full h-11 rounded-[12px] border text-sm text-[#f4f5fa] placeholder-[#8f8f99]',
            'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)]',
            'focus:outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[rgba(245,197,24,0.25)] focus:ring-offset-1 focus:ring-offset-[#0d0d12]',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            prefix ? 'pl-8' : 'pl-3',
            suffix ? 'pr-8' : 'pr-3',
            error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[rgba(239,68,68,0.35)]' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-[#9b9ba6] text-sm pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
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
      {label && <label htmlFor={fieldId} className="text-xs font-medium text-[#b5b5be] tracking-[0.01em]">{label}</label>}
      <select
        ref={ref}
        id={fieldId}
        className={[
          'w-full h-11 rounded-[12px] border text-sm text-[#f4f5fa] px-3',
          'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)]',
          'focus:outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[rgba(245,197,24,0.25)] focus:ring-offset-1 focus:ring-offset-[#0d0d12]',
          'transition-all duration-200 cursor-pointer',
          error ? 'border-[#ef4444]' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
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
      {label && <label htmlFor={fieldId} className="text-xs font-medium text-[#b5b5be] tracking-[0.01em]">{label}</label>}
      <textarea
        ref={ref}
        id={fieldId}
        className={[
          'w-full rounded-[12px] border text-sm text-[#f4f5fa] px-3 py-2.5 placeholder-[#8f8f99]',
          'bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.12)]',
          'focus:outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[rgba(245,197,24,0.25)] focus:ring-offset-1 focus:ring-offset-[#0d0d12]',
          'transition-all duration-200 resize-none',
          error ? 'border-[#ef4444]' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
    </div>
  )
})
