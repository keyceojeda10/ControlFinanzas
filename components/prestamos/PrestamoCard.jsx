// components/prestamos/PrestamoCard.jsx - Card para lista de préstamos

import Link      from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatCOP, formatFechaCobro } from '@/lib/calculos'

const estadoBadge = {
  activo:     { variant: 'blue',  label: 'Activo'     },
  completado: { variant: 'green', label: 'Completado' },
  cancelado:  { variant: 'gray',  label: 'Cancelado'  },
}

export default function PrestamoCard({ prestamo: p }) {
  const badge      = estadoBadge[p.estado] ?? estadoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0
  const enMora     = p.diasMora > 0
  const proximoCobroLabel = p.estado === 'activo' && p.proximoCobro ? formatFechaCobro(p.proximoCobro) : null

  return (
    <Link
      href={`/prestamos/${p.id}`}
      className={[
        'block rounded-[14px] p-4 transition-all duration-150 group',
        enMora
          ? 'bg-[rgba(239,68,68,0.06)] border-2 border-[rgba(239,68,68,0.3)] hover:border-[rgba(239,68,68,0.5)]'
          : 'bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#f5c518]/40 hover:bg-[#222222]',
      ].join(' ')}
    >
      {/* Alerta de mora */}
      {enMora && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-[8px] bg-[rgba(239,68,68,0.1)]">
          <svg className="w-3.5 h-3.5 text-[#ef4444] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-xs font-semibold text-[#ef4444]">
            {p.diasMora} {p.diasMora === 1 ? 'día' : 'días'} en mora
          </span>
        </div>
      )}

      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {/* Progress ring avatar */}
          <div className="relative w-9 h-9 shrink-0">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={porcentaje === 100 ? '#10b981' : enMora ? '#ef4444' : '#f5c518'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${porcentaje * 94.25 / 100} 94.25`}
                className="transition-all duration-500"
              />
            </svg>
            <span className={['absolute inset-0 flex items-center justify-center text-[11px] font-bold', enMora ? 'text-[#ef4444]' : 'text-[#f5c518]'].join(' ')}>
              {p.cliente?.nombre?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f1f5f9] leading-none">{p.cliente?.nombre}</p>
            <p className="text-[10px] text-[#8b95a5] mt-0.5">CC {p.cliente?.cedula}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {enMora
            ? <Badge variant="red">En mora</Badge>
            : <Badge variant={badge.variant}>{badge.label}</Badge>
          }
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
          <p className="text-[10px] text-[#8b95a5]">Saldo pendiente</p>
          <p className={['text-lg font-bold leading-none font-mono-display', enMora ? 'text-[#ef4444]' : 'text-[#f1f5f9]'].join(' ')}>
            {formatCOP(p.saldoPendiente)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[#8b95a5]">Prestado</p>
          <p className="text-sm font-medium text-[#94a3b8] font-mono-display">{formatCOP(p.montoPrestado)}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${porcentaje}%`,
            background: porcentaje === 100 ? '#10b981' : enMora ? '#ef4444' : '#f5c518',
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[#8b95a5]"><span className="font-mono-display">{porcentaje}%</span> pagado</span>
        <span className="text-[#8b95a5]">Cuota <span className="font-mono-display">{formatCOP(p.cuotaDiaria)}</span></span>
      </div>

      {proximoCobroLabel && (
        <div className="mt-2 pt-2 border-t border-[#2a2a2a] flex items-center gap-1.5 text-[10px] text-[#8b95a5]">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Próx. cobro: <span className="text-[#f1f5f9] font-medium capitalize">{proximoCobroLabel}</span></span>
        </div>
      )}
    </Link>
  )
}
