// components/ui/Card.jsx

export function Card({ children, className = '', padding = true, glowColor, ...props }) {
  const glow = glowColor || '#f5c518'
  const { style: propsStyle, ...restProps } = props
  return (
    <div
      className={[
        'border border-[#2a2a2a] rounded-[16px]',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
      style={{
        background: `linear-gradient(135deg, ${glow}06 0%, #1a1a1a 40%, #1a1a1a 70%, ${glow}03 100%)`,
        boxShadow: `0 0 20px ${glow}05, 0 1px 2px rgba(0,0,0,0.2)`,
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
    <h3 className={`text-sm font-semibold text-white ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
