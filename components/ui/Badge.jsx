// components/ui/Badge.jsx

const variants = {
  blue:   'bg-[rgba(245,197,24,0.12)]  text-[#ffd452]  border-[rgba(245,197,24,0.22)]',
  green:  'bg-[rgba(34,197,94,0.12)]   text-[#59e3a4]  border-[rgba(34,197,94,0.22)]',
  yellow: 'bg-[rgba(245,197,24,0.12)]  text-[#ffd452]  border-[rgba(245,197,24,0.22)]',
  red:    'bg-[rgba(239,68,68,0.12)]   text-[#ff8e8e]  border-[rgba(239,68,68,0.24)]',
  purple: 'bg-[rgba(168,85,247,0.12)]  text-[#d2a9ff]  border-[rgba(168,85,247,0.22)]',
  gray:   'bg-[rgba(148,163,184,0.12)] text-[#d1d5e0]  border-[rgba(148,163,184,0.22)]',
}

export function Badge({ children, variant = 'blue', className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border leading-5',
        variants[variant] ?? variants.blue,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export function StatusDot({ variant = 'green' }) {
  const colors = {
    green:  'bg-[#22c55e]',
    yellow: 'bg-[#f59e0b]',
    red:    'bg-[#ef4444]',
    blue:   'bg-[#f5c518]',
    gray:   'bg-[#555555]',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[variant] ?? colors.gray}`} />
  )
}
