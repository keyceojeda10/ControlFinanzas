// components/ui/Button.jsx

import { forwardRef } from 'react'

const variants = {
  primary:   'bg-[#3b82f6] hover:bg-[#2563eb] text-white border-transparent',
  secondary: 'bg-[#1c2333] hover:bg-[#222a3d] text-[#f1f5f9] border-[#2a3245]',
  danger:    'bg-[#ef4444] hover:bg-[#dc2626] text-white border-transparent',
  ghost:     'bg-transparent hover:bg-[#222a3d] text-[#94a3b8] hover:text-[#f1f5f9] border-transparent',
  success:   'bg-[#10b981] hover:bg-[#059669] text-white border-transparent',
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
    'inline-flex items-center justify-center font-medium rounded-[10px]',
    'border transition-all duration-150 cursor-pointer select-none',
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
