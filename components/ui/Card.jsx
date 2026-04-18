// components/ui/Card.jsx

export function Card({ as: Component = 'div', children, className = '', padding = true, glowColor, ...props }) {
  const glow = glowColor || 'var(--color-accent)'
  const { style: propsStyle, ...restProps } = props
  return (
    <Component
      className={[
        'rounded-[16px]',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${glow} 7%, var(--color-bg-card)) 0%, var(--color-bg-card) 45%, var(--color-bg-card) 75%, color-mix(in srgb, ${glow} 4%, var(--color-bg-card)) 100%)`,
        border: `1px solid var(--color-border)`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.12)`,
        ...propsStyle,
      }}
      {...restProps}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-sm sm:text-[0.95rem] font-semibold tracking-[0.01em] ${className}`} style={{ color: 'var(--color-text-primary)' }}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
