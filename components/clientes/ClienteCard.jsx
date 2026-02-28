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
      className="flex items-center gap-3 bg-[#1c2333] border border-[#2a3245] rounded-[14px] p-4 hover:border-[#3b82f6]/40 hover:bg-[#222a3d] transition-all duration-150 group"
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 text-white"
        style={{
          background: cliente.estado === 'mora'
            ? 'rgba(239,68,68,0.2)'
            : cliente.estado === 'activo'
            ? 'rgba(59,130,246,0.2)'
            : 'rgba(100,116,139,0.2)',
          color: cliente.estado === 'mora'
            ? '#ef4444'
            : cliente.estado === 'activo'
            ? '#3b82f6'
            : '#64748b',
        }}
      >
        {cliente.nombre?.[0]?.toUpperCase() ?? '?'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#f1f5f9] truncate">{cliente.nombre}</p>
        <p className="text-xs text-[#64748b] mt-0.5">CC {cliente.cedula}</p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {cliente.prestamosActivos > 0 && (
          <span className="text-[10px] text-[#64748b]">
            {cliente.prestamosActivos} préstamo{cliente.prestamosActivos > 1 ? 's' : ''} activo{cliente.prestamosActivos > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Arrow */}
      <svg
        className="w-4 h-4 text-[#2a3245] group-hover:text-[#3b82f6] transition-colors shrink-0 ml-1"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
