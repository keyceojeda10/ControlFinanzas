// components/ui/StatTile.jsx
// Mini-tarjeta stat: label uppercase (color semantico) + numero grande (Space Grotesk)

import SectionLabel from './SectionLabel'
import MoneyText from './MoneyText'

export default function StatTile({ label, value, isMoney = false, color, icon, className = '' }) {
  const bgColor = color
    ? `color-mix(in srgb, ${color} 12%, var(--color-bg-surface))`
    : 'var(--color-bg-hover)'

  return (
    <div
      className={`rounded-[16px] p-3.5 flex flex-col gap-1.5 ${className}`}
      style={{ background: bgColor }}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0" style={{ color: color || 'var(--color-text-muted)' }}>{icon}</span>}
        <SectionLabel color={color}>{label}</SectionLabel>
      </div>
      {isMoney ? (
        <MoneyText value={value} size="sm" color={color || 'var(--color-text-primary)'} />
      ) : (
        <span
          className="font-mono-display font-bold text-[20px]"
          style={{ color: color || 'var(--color-text-primary)' }}
        >
          {value}
        </span>
      )}
    </div>
  )
}
