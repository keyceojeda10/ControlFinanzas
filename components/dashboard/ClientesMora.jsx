// components/dashboard/ClientesMora.jsx - Lista de clientes en mora

import { Badge } from '@/components/ui/Badge'

export default function ClientesMora({ clientes = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-[#2a3245] shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 rounded bg-[#2a3245]" />
              <div className="h-2.5 w-20 rounded bg-[#2a3245]" />
            </div>
            <div className="h-5 w-16 rounded-full bg-[#2a3245]" />
          </div>
        ))}
      </div>
    )
  }

  if (!clientes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[#f1f5f9]">Sin clientes en mora</p>
        <p className="text-xs text-[#8b95a5] mt-1">Todos los pagos al día</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clientes.map((c) => (
        <div key={c.id} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(239,68,68,0.12)] flex items-center justify-center shrink-0">
            <span className="text-[#ef4444] text-xs font-bold">
              {c.nombre?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#f1f5f9] truncate">{c.nombre}</p>
            <p className="text-xs text-[#8b95a5]">{c.diasMora} días en mora</p>
          </div>
          <Badge variant="red">
            ${c.saldoPendiente?.toLocaleString('es-CO') ?? 0}
          </Badge>
        </div>
      ))}
    </div>
  )
}
