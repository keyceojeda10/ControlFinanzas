// components/ui/Card.jsx

export function Card({ as: Component = 'div', children, className = '', padding = true, glowColor, elevation = 1, hoverable = false, ...props }) {
  const { style: propsStyle, ...restProps } = props
  return (
    <Component
      className={[
        'cf-hero-card rounded-[20px]',
        padding ? 'p-4 sm:p-5' : '',
        hoverable ? 'hover-lift' : '',
        'cf-card-shadow',
        className,
      ].join(' ')}
      style={{
        background: 'var(--cf-card)',
        border: glowColor
          ? `1px solid color-mix(in srgb, ${glowColor} 25%, var(--cf-border))`
          : '1px solid var(--cf-border)',
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
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-[15px] sm:text-[16px] font-extrabold tracking-[0.01em] ${className}`} style={{ color: 'var(--cf-ink)' }}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
