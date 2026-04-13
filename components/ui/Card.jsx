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
        background: `linear-gradient(135deg, ${glow}07 0%, #111115 38%, #111115 72%, ${glow}04 100%)`,
        border: `1px solid rgba(255,255,255,0.1)`,
        boxShadow: `0 6px 20px rgba(0,0,0,0.28)`,
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
    <h3 className={`text-sm sm:text-[0.95rem] font-semibold text-[#f4f5fa] tracking-[0.01em] ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
