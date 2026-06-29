// components/ui/Card.jsx

export function Card({ as: Component = 'div', children, className = '', padding = true, glowColor, elevation = 1, hoverable = false, ...props }) {
  const { style: propsStyle, ...restProps } = props
  return (
    <Component
      className={[
        'cf-hero-card rounded-[16px]',
        padding ? 'p-5' : '',
        `elevation-${elevation}`,
        hoverable ? 'hover-lift' : '',
        className,
      ].join(' ')}
      style={{
        background: 'var(--color-bg-card)',
        border: glowColor
          ? `1px solid color-mix(in srgb, ${glowColor} 25%, var(--color-border))`
          : '1px solid var(--color-border)',
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
