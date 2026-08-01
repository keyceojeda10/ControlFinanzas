// components/ui/EmptyState.jsx
// Uso:
//   <EmptyState icon={<SvgIcon />} titulo="No hay clientes" hint="Crea el primero" action={<Button/>} />
//   <EmptyState pose="vacia" titulo="Sin resultados" />  (fallback con MonedaCF)

import MonedaCF from './MonedaCF'

export default function EmptyState({ icon, pose = 'vacia', titulo, hint, action, size = 92, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      {icon ? (
        <div
          className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-1"
          style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}
        >
          {icon}
        </div>
      ) : (
        <MonedaCF pose={pose} size={size} />
      )}
      {titulo && (
        <p className="text-[15px] font-bold mt-3" style={{ color: 'var(--cf-ink)' }}>
          {titulo}
        </p>
      )}
      {hint && (
        <p className="text-[12.5px] mt-1.5 max-w-[280px] leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
