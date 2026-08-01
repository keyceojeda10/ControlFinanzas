// components/ui/ListRow.jsx
// Fila de lista: avatar/icono + titulo + subtitulo + valor/accion derecha

export default function ListRow({ icon, title, subtitle, right, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={[
        'flex items-center gap-3 w-full px-4 py-3 text-left',
        'transition-colors duration-150',
        onClick ? 'cursor-pointer hover:bg-[var(--cf-fill)]' : '',
        className,
      ].join(' ')}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--cf-ink-3)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <span className="shrink-0 ml-auto">{right}</span>}
    </Tag>
  )
}
