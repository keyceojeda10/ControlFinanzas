// components/ui/Button.jsx

import { forwardRef } from 'react'

const variants = {
  primary:   'bg-[#f5c518] hover:bg-[#f0b800] text-[#0a0a0a] font-bold border-transparent hover:shadow-[0_0_25px_rgba(245,197,24,0.35)]',
  secondary: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#f0f0f5] border-[rgba(255,255,255,0.08)] hover:border-[rgba(245,197,24,0.3)] hover:text-[#f5c518] hover:shadow-[0_0_15px_rgba(245,197,24,0.1)]',
  danger:    'bg-[#f87171] hover:bg-[#ef4444] text-white border-transparent hover:shadow-[0_0_20px_rgba(248,113,113,0.3)]',
  ghost:     'bg-transparent hover:bg-[rgba(255,255,255,0.05)] text-[#7a7a8c] hover:text-[#f0f0f5] border-transparent',
  success:   'bg-[#34d399] hover:bg-[#22c55e] text-[#0a0a0a] font-bold border-transparent hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]',
}

const sizes = {
  sm: 'h-8  px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size    = 'md',
    loading = false,
    icon,
    className = '',
    ...props
  },
  ref
) {
  const base = [
    'inline-flex items-center justify-center font-medium rounded-[12px]',
    'border transition-all duration-200 cursor-pointer select-none',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variants[variant] ?? variants.primary,
    sizes[size]       ?? sizes.md,
    className,
  ].join(' ')

  return (
    <button ref={ref} className={base} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
})
