// components/ui/Input.jsx

import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, error, prefix, suffix, className = '', containerClassName = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-medium text-[#94a3b8]">{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-[#64748b] text-sm pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={[
            'w-full h-10 rounded-[10px] border text-sm text-[#f1f5f9] placeholder-[#64748b]',
            'bg-[#161b27] border-[#2a3245]',
            'focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)]',
            'transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            prefix ? 'pl-8' : 'pl-3',
            suffix ? 'pr-8' : 'pr-3',
            error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[rgba(239,68,68,0.3)]' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-[#64748b] text-sm pointer-events-none select-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select(
  { label, error, className = '', containerClassName = '', children, ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && <label className="text-xs font-medium text-[#94a3b8]">{label}</label>}
      <select
        ref={ref}
        className={[
          'w-full h-10 rounded-[10px] border text-sm text-[#f1f5f9] px-3',
          'bg-[#161b27] border-[#2a3245]',
          'focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)]',
          'transition-all duration-150 cursor-pointer',
          error ? 'border-[#ef4444]' : '',
          className,
        ].join(' ')}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, className = '', containerClassName = '', ...props },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && <label className="text-xs font-medium text-[#94a3b8]">{label}</label>}
      <textarea
        ref={ref}
        className={[
          'w-full rounded-[10px] border text-sm text-[#f1f5f9] px-3 py-2.5 placeholder-[#64748b]',
          'bg-[#161b27] border-[#2a3245]',
          'focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)]',
          'transition-all duration-150 resize-none',
          error ? 'border-[#ef4444]' : '',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  )
})
