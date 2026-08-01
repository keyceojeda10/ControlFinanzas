// components/ui/Badge.jsx

const variants = {
  blue:   { bg: 'var(--cf-fill)',    fg: 'var(--cf-ink-2)',    bd: 'var(--cf-ink-2)' },
  green:  { bg: 'var(--cf-green-pill-bg)', fg: 'var(--cf-green-dark)', bd: 'var(--cf-green-dark)' },
  yellow: { bg: 'var(--cf-gold-tint)', fg: 'var(--cf-gold)',  bd: 'var(--cf-gold)' },
  red:    { bg: 'var(--cf-red-pill-bg)',  fg: 'var(--cf-red-dark)',  bd: 'var(--cf-red-dark)' },
  purple: { bg: 'var(--cf-fill)',  fg: 'var(--cf-ink-2)',  bd: 'var(--cf-ink-2)' },
  teal:   { bg: 'var(--cf-fill)',    fg: 'var(--cf-ink-2)',    bd: 'var(--cf-ink-2)' },
  gray:   { bg: 'var(--cf-fill)',    fg: 'var(--cf-ink-2)', bd: 'var(--cf-border)' },
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
    green:  'var(--cf-green-dark)',
    yellow: 'var(--cf-gold-dark)',
    red:    'var(--cf-red-dark)',
    blue:   'var(--cf-ink-2)',
    teal:   'var(--cf-ink-2)',
    gray:   'var(--cf-ink-3)',
  }
  return (
    <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorMap[variant] ?? colorMap.gray }} />
  )
}
