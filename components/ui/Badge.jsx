// components/ui/Badge.jsx

const variants = {
  blue:   { bg: 'var(--color-info-dim)',    fg: 'var(--color-info)',    bd: 'var(--color-info)' },
  green:  { bg: 'var(--color-success-dim)', fg: 'var(--color-success)', bd: 'var(--color-success)' },
  yellow: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)',  bd: 'var(--color-accent)' },
  red:    { bg: 'var(--color-danger-dim)',  fg: 'var(--color-danger)',  bd: 'var(--color-danger)' },
  purple: { bg: 'var(--color-purple-dim)',  fg: 'var(--color-purple)',  bd: 'var(--color-purple)' },
  teal:   { bg: 'var(--color-teal-dim)',    fg: 'var(--color-teal)',    bd: 'var(--color-teal)' },
  gray:   { bg: 'var(--color-bg-hover)',    fg: 'var(--color-text-secondary)', bd: 'var(--color-border)' },
}

export function Badge({ children, variant = 'blue', className = '' }) {
  const v = variants[variant] ?? variants.blue
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border leading-5',
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

export function StatusPill({ children, variant = 'green', dot = true, className = '' }) {
  const v = variants[variant] ?? variants.green
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold leading-none',
        className,
      ].join(' ')}
      style={{
        background: v.bg,
        color: v.fg,
      }}
    >
      {dot && <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: v.fg }} />}
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
    teal:   'var(--color-teal)',
    gray:   'var(--color-text-muted)',
  }
  return (
    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorMap[variant] ?? colorMap.gray }} />
  )
}
