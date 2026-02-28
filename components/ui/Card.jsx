// components/ui/Card.jsx

export function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={[
        'bg-[#1c2333] border border-[#2a3245] rounded-[14px]',
        padding ? 'p-5' : '',
        className,
      ].join(' ')}
      {...props}
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
    <h3 className={`text-sm font-semibold text-[#f1f5f9] ${className}`}>
      {children}
    </h3>
  )
}

export function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>
}
