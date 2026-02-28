// components/prestamos/PrestamoCard.jsx - Card para lista de préstamos

import Link      from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatCOP } from '@/lib/calculos'

const estadoBadge = {
  activo:     { variant: 'blue',  label: 'Activo'     },
  completado: { variant: 'green', label: 'Completado' },
  cancelado:  { variant: 'gray',  label: 'Cancelado'  },
}

export default function PrestamoCard({ prestamo: p }) {
  const badge      = estadoBadge[p.estado] ?? estadoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0
  const enMora     = p.diasMora > 0

  return (
    <Link
      href={`/prestamos/${p.id}`}
      className="block bg-[#1c2333] border border-[#2a3245] rounded-[14px] p-4 hover:border-[#3b82f6]/40 hover:bg-[#222a3d] transition-all duration-150 group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center shrink-0">
            <span className="text-[#3b82f6] text-xs font-bold">
              {p.cliente?.nombre?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1f5f9] leading-none">{p.cliente?.nombre}</p>
            <p className="text-[10px] text-[#64748b] mt-0.5">CC {p.cliente?.cedula}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {p.pagoHoy && (
            <span className="flex items-center gap-1 text-[10px] text-[#10b981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] inline-block" />
              Pagó hoy
            </span>
          )}
        </div>
      </div>

      {/* Saldo */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] text-[#64748b]">Saldo pendiente</p>
          <p className="text-lg font-bold text-[#f1f5f9] leading-none">{formatCOP(p.saldoPendiente)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#64748b]">Prestado</p>
          <p className="text-sm font-medium text-[#94a3b8]">{formatCOP(p.montoPrestado)}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-[#2a3245] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${porcentaje}%`,
            background: porcentaje === 100 ? '#10b981' : enMora ? '#ef4444' : '#3b82f6',
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#64748b]">{porcentaje}% pagado</span>
        {enMora ? (
          <span className="text-[#ef4444] font-semibold">{p.diasMora} días en mora</span>
        ) : (
          <span className="text-[#64748b]">Cuota {formatCOP(p.cuotaDiaria)}/día</span>
        )}
      </div>
    </Link>
  )
}
