// components/prestamos/ResumenCalculo.jsx - Panel de resumen en tiempo real

import { formatCOP } from '@/lib/calculos'

const fmt = (v) => formatCOP(v)

const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function ResumenCalculo({ calculo, visible = true }) {
  if (!visible) return null

  const { totalAPagar, cuotaDiaria, totalInteres, fechaFin, frecuencia } = calculo ?? {}

  const labelCuota = {
    diario:    'Cuota diaria',
    semanal:   'Cuota semanal',
    quincenal: 'Cuota quincenal',
    mensual:   'Cuota mensual',
  }[frecuencia] ?? 'Cuota'

  const items = [
    { label: 'Total a pagar',  value: fmt(totalAPagar),  accent: '#3b82f6' },
    { label: labelCuota,       value: fmt(cuotaDiaria),  accent: '#10b981' },
    { label: 'Total interés',  value: fmt(totalInteres), accent: '#f59e0b' },
    { label: 'Fecha de cierre', value: fmtFecha(fechaFin), accent: '#8b5cf6' },
  ]

  return (
    <div className="bg-[#161b27] border border-[#2a3245] rounded-[14px] p-4 space-y-3">
      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
        Resumen del préstamo
      </p>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ label, value, accent }) => (
          <div
            key={label}
            className="bg-[#1c2333] border border-[#2a3245] rounded-[10px] px-3 py-2.5"
          >
            <p className="text-[10px] text-[#64748b] mb-0.5">{label}</p>
            <p
              className="text-base font-bold leading-tight"
              style={{ color: value === '$0' || value === '—' ? '#64748b' : accent }}
            >
              {value ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
