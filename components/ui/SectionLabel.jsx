// components/ui/SectionLabel.jsx
// Label de seccion uppercase: 11px, 800, letter-spacing, color ink-3

export default function SectionLabel({ children, color, className = '' }) {
  return (
    <span
      className={`text-[11px] font-extrabold uppercase tracking-[.07em] ${className}`}
      style={{ color: color || 'var(--cf-ink-3)' }}
    >
      {children}
    </span>
  )
}
