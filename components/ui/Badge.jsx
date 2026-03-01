// components/ui/Badge.jsx

const variants = {
  blue:   'bg-[rgba(59,130,246,0.1)]   text-[#3b82f6]  border-[rgba(59,130,246,0.15)]',
  green:  'bg-[rgba(34,197,94,0.1)]    text-[#22c55e]  border-[rgba(34,197,94,0.15)]',
  yellow: 'bg-[rgba(245,197,24,0.1)]   text-[#f5c518]  border-[rgba(245,197,24,0.15)]',
  red:    'bg-[rgba(239,68,68,0.1)]    text-[#ef4444]  border-[rgba(239,68,68,0.15)]',
  purple: 'bg-[rgba(168,85,247,0.1)]   text-[#a855f7]  border-[rgba(168,85,247,0.15)]',
  gray:   'bg-[rgba(85,85,85,0.1)]     text-[#555555]  border-[rgba(85,85,85,0.15)]',
}

export function Badge({ children, variant = 'blue', className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
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
    blue:   'bg-[#3b82f6]',
    gray:   'bg-[#555555]',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[variant] ?? colors.gray}`} />
  )
}
