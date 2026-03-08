// components/dashboard/ResumenCard.jsx - Tarjeta de resumen premium

export default function ResumenCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'blue',
  trend,
  loading = false,
}) {
  const accents = {
    blue:   { bg: 'rgba(245,197,24,0.12)',  icon: '#f5c518', border: 'rgba(245,197,24,0.2)' },
    green:  { bg: 'rgba(16,185,129,0.12)',  icon: '#10b981', border: 'rgba(16,185,129,0.2)' },
    yellow: { bg: 'rgba(245,158,11,0.12)',  icon: '#f59e0b', border: 'rgba(245,158,11,0.2)' },
    red:    { bg: 'rgba(239,68,68,0.12)',   icon: '#ef4444', border: 'rgba(239,68,68,0.2)'  },
    purple: { bg: 'rgba(139,92,246,0.12)',  icon: '#8b5cf6', border: 'rgba(139,92,246,0.2)' },
  }

  const colors = accents[accent] ?? accents.blue

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[14px] p-5 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-[10px] bg-[#2a2a2a]" />
          <div className="h-5 w-14 rounded-full bg-[#2a2a2a]" />
        </div>
        <div className="h-3 w-24 rounded bg-[#2a2a2a] mb-2" />
        <div className="h-7 w-32 rounded bg-[#2a2a2a]" />
      </div>
    )
  }

  return (
    <div
      className="bg-[#1a1a1a] border rounded-[14px] p-5 flex flex-col gap-3 transition-transform duration-150 hover:scale-[1.01]"
      style={{ borderColor: colors.border }}
    >
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: colors.bg }}
        >
          <span style={{ color: colors.icon }}>{icon}</span>
        </div>

        {trend !== undefined && (
          <span
            className={[
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              trend >= 0
                ? 'bg-[rgba(16,185,129,0.12)] text-[#10b981]'
                : 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]',
            ].join(' ')}
          >
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Label + Value */}
      <div>
        <p className="text-xs text-[#8b95a5] font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-[#f1f5f9] leading-none tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-[#8b95a5] mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
