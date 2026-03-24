// components/clientes/ClienteCard.jsx

import Link  from 'next/link'
import { Badge } from '@/components/ui/Badge'

const estadoBadge = {
  activo:    { variant: 'green',  label: 'Activo'    },
  mora:      { variant: 'red',    label: 'En mora'   },
  cancelado: { variant: 'gray',   label: 'Cancelado' },
}

export default function ClienteCard({ cliente }) {
  const badge = estadoBadge[cliente.estado] ?? estadoBadge.cancelado

  return (
    <Link
      href={`/clientes/${cliente.id}`}
      className="flex items-center gap-3 border border-[#2a2a2a] rounded-[14px] p-4 hover:border-[#f5c518]/40 transition-all duration-150 group"
      style={{
        background: cliente.estado === 'mora'
          ? 'linear-gradient(135deg, #ef444406 0%, #1a1a1a 40%, #1a1a1a 70%, #ef444403 100%)'
          : cliente.estado === 'activo'
          ? 'linear-gradient(135deg, #f5c51806 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51803 100%)'
          : '#1a1a1a',
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
        style={{
          background: cliente.estado === 'mora'
            ? 'rgba(239,68,68,0.2)'
            : cliente.estado === 'activo'
            ? 'rgba(245,197,24,0.2)'
            : 'rgba(100,116,139,0.2)',
          color: cliente.estado === 'mora'
            ? '#ef4444'
            : cliente.estado === 'activo'
            ? '#f5c518'
            : '#64748b',
        }}
      >
        {cliente.nombre?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#f1f5f9] truncate">{cliente.nombre}</p>
        <p className="text-xs text-[#8b95a5] mt-0.5">CC {cliente.cedula}</p>
        {cliente.referencia && (
          <p className="text-xs text-[#8b95a5] mt-0.5 truncate" title={cliente.referencia}>
            <svg className="w-3 h-3 inline -mt-0.5 mr-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg> {cliente.referencia}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {cliente.prestamosActivos > 0 && (
          <span className="text-[10px] text-[#8b95a5]">
            {cliente.prestamosActivos} préstamo{cliente.prestamosActivos > 1 ? 's' : ''} activo{cliente.prestamosActivos > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Arrow */}
      <svg
        className="w-4 h-4 text-[#2a2a2a] group-hover:text-[#f5c518] transition-colors shrink-0 ml-1"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
