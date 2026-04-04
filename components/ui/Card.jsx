// components/ui/Card.jsx

export function Card({ children, className = '', padding = true, glowColor, ...props }) {
  const glow = glowColor || '#f5c518'
  const { style: propsStyle, ...restProps } = props
  return (
    <div
      className={[
        'rounded-[16px]',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, ${glow}06 0%, #111115 40%, #111115 70%, ${glow}03 100%)`,
        border: `1px solid rgba(255,255,255,0.07)`,
        boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
        ...propsStyle,
      }}
      {...restProps}
    >
      {children}
    </div>
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
    <h3 className={`text-sm font-semibold text-[#f0f0f5] ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
