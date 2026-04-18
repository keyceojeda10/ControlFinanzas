// components/ui/Button.jsx

import { forwardRef } from 'react'

const variants = {
  primary:   'cf-btn-primary',
  secondary: 'cf-btn-secondary',
  danger:    'cf-btn-danger',
  ghost:     'cf-btn-ghost',
  success:   'cf-btn-success',
}

const sizes = {
  sm: 'h-9  px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
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
    'border transition-all duration-200 cursor-pointer select-none active:scale-[0.99]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
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
