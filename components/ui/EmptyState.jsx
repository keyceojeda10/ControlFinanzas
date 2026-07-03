// components/ui/EmptyState.jsx — estado vacio con Capi (la mascota).
// Uso:
//   <EmptyState pose="duerme" titulo="No hay clientes aún" hint="Crea el primero" action={<Button/>} />
// Poses utiles: duerme (lista vacia), busca (sin resultados), celebra (todo listo/completado).

import Capi from './Capi'

export default function EmptyState({ pose = 'duerme', titulo, hint, action, size = 92, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      <div className="capi-in">
        <Capi pose={pose} size={size} />
      </div>
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
