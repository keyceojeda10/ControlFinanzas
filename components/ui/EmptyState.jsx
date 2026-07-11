// components/ui/EmptyState.jsx — estado vacio con MonedaCF.
// Uso:
//   <EmptyState pose="vacia" titulo="No hay clientes aún" hint="Crea el primero" action={<Button/>} />
// Poses: vacia (lista vacia), busca (sin resultados), celebra (todo listo), guia (CTA/onboarding).

import MonedaCF from './MonedaCF'

export default function EmptyState({ pose = 'vacia', titulo, hint, action, size = 92, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      <MonedaCF pose={pose} size={size} />
      {titulo && (
        <p className="text-[14px] font-semibold mt-3" style={{ color: 'var(--color-text-primary)' }}>
          {titulo}
        </p>
      )}
      {hint && (
        <p className="text-[12px] mt-1 max-w-[280px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
