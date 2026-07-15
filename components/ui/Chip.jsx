// components/ui/Chip.jsx
// Chip/filtro pill: activo = accent-soft + borde acento; inactivo = surface + borde line-2

export default function Chip({ children, active = false, onClick, icon, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold',
        'border transition-all duration-200 cursor-pointer select-none whitespace-nowrap',
        'min-h-[36px]',
        className,
      ].join(' ')}
      style={active ? {
        background: 'var(--color-accent-soft)',
        borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
        color: 'var(--color-accent)',
      } : {
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border-hover)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {icon && <span className="shrink-0 w-4 h-4">{icon}</span>}
      {children}
    </button>
  )
}

export function ChipRow({ children, className = '' }) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-none pb-1 ${className}`}>
      {children}
    </div>
  )
}
