'use client'
// components/ui/DiasSinCobroSelector.jsx — Selector de días sin cobro reutilizable

const DIAS = [
  { num: 0, label: 'Dom', full: 'Domingo' },
  { num: 1, label: 'Lun', full: 'Lunes' },
  { num: 2, label: 'Mar', full: 'Martes' },
  { num: 3, label: 'Mié', full: 'Miércoles' },
  { num: 4, label: 'Jue', full: 'Jueves' },
  { num: 5, label: 'Vie', full: 'Viernes' },
  { num: 6, label: 'Sáb', full: 'Sábado' },
]

export default function DiasSinCobroSelector({ value = [], onChange, heredados, compact }) {
  const toggle = (num) => {
    const next = value.includes(num)
      ? value.filter(d => d !== num)
      : [...value, num].sort()
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {DIAS.map(({ num, label }) => {
          const activo = value.includes(num)
          return (
            <button
              key={num}
              type="button"
              onClick={() => toggle(num)}
              className={[
                'h-9 rounded-[10px] border text-xs font-semibold transition-all cursor-pointer',
                compact ? 'px-2.5' : 'px-3.5',
                activo
                  ? 'bg-[rgba(245,158,11,0.15)] border-[#f59e0b] text-[#f59e0b]'
                  : 'bg-transparent border-[#2a2a2a] text-[#888888] hover:bg-[#1a1a1a] hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>
      {heredados && heredados.length > 0 && value.length === 0 && (
        <p className="text-[10px] text-[#666666] leading-snug">
          Heredado: {heredados.map(d => DIAS[d]?.full).filter(Boolean).join(', ')}
        </p>
      )}
    </div>
  )
}
