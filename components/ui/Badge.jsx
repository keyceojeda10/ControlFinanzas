// components/ui/Badge.jsx

const variants = {
  blue:   { bg: 'var(--color-info-dim)',    fg: 'var(--color-info)',    bd: 'var(--color-info)' },
  green:  { bg: 'var(--color-success-dim)', fg: 'var(--color-success)', bd: 'var(--color-success)' },
  yellow: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)',  bd: 'var(--color-accent)' },
  red:    { bg: 'var(--color-danger-dim)',  fg: 'var(--color-danger)',  bd: 'var(--color-danger)' },
  purple: { bg: 'var(--color-purple-dim)',  fg: 'var(--color-purple)',  bd: 'var(--color-purple)' },
  gray:   { bg: 'var(--color-bg-hover)',    fg: 'var(--color-text-secondary)', bd: 'var(--color-border)' },
}

export function Badge({ children, variant = 'blue', className = '' }) {
  const v = variants[variant] ?? variants.blue
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border leading-5',
        className,
      ].join(' ')}
      style={{
        background: v.bg,
        color: v.fg,
        borderColor: `color-mix(in srgb, ${v.bd} 35%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

export function StatusDot({ variant = 'green' }) {
  const colorMap = {
    green:  'var(--color-success)',
    yellow: 'var(--color-warning)',
    red:    'var(--color-danger)',
    blue:   'var(--color-info)',
    gray:   'var(--color-text-muted)',
  }
  return (
    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorMap[variant] ?? colorMap.gray }} />
  )
}
