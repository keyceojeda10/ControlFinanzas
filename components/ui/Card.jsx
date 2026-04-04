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
        background: `linear-gradient(135deg, ${glow}08 0%, rgba(15,15,22,0.8) 40%, rgba(15,15,22,0.8) 70%, ${glow}04 100%)`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid rgba(255,255,255,0.06)`,
        boxShadow: `0 0 30px ${glow}06, 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
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
