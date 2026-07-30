// components/ui/IconButton.jsx
// Boton cuadrado redondeado con icono, fondo surface o *-soft

export default function IconButton({ children, onClick, color, soft = false, size = 40, label, className = '', ...props }) {
  const px = `${size}px`
  const radius = `${Math.round(size * 0.3)}px`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'inline-flex items-center justify-center shrink-0 cursor-pointer select-none',
        'transition-all duration-200 border-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]',
        className,
      ].join(' ')}
      style={{
        width: px,
        height: px,
        minWidth: px,
        borderRadius: radius,
        background: soft && color
          ? `color-mix(in srgb, ${color} 12%, var(--cf-surface))`
          : 'var(--cf-fill)',
        color: color || 'var(--cf-ink-2)',
      }}
      {...props}
    >
      {children}
    </button>
  )
}
