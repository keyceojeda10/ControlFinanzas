// components/ui/Badge.jsx

const variants = {
  blue:   'bg-[rgba(59,130,246,0.15)]   text-[#3b82f6]  border-[rgba(59,130,246,0.2)]',
  green:  'bg-[rgba(16,185,129,0.15)]   text-[#10b981]  border-[rgba(16,185,129,0.2)]',
  yellow: 'bg-[rgba(245,158,11,0.15)]   text-[#f59e0b]  border-[rgba(245,158,11,0.2)]',
  red:    'bg-[rgba(239,68,68,0.15)]    text-[#ef4444]  border-[rgba(239,68,68,0.2)]',
  purple: 'bg-[rgba(139,92,246,0.15)]   text-[#8b5cf6]  border-[rgba(139,92,246,0.2)]',
  gray:   'bg-[rgba(148,163,184,0.1)]   text-[#94a3b8]  border-[rgba(148,163,184,0.15)]',
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
    green:  'bg-[#10b981]',
    yellow: 'bg-[#f59e0b]',
    red:    'bg-[#ef4444]',
    blue:   'bg-[#3b82f6]',
    gray:   'bg-[#64748b]',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[variant] ?? colors.gray}`} />
  )
}
