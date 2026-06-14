// components/prestamos/TablaAmortizacion.jsx - Desglose periodo a periodo
// para prestamos en modoInteres = 'lineal' (cuota decreciente).

import { formatMoney } from '@/lib/i18n'

const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const LABEL_FRECUENCIA = {
  diario: 'Dia',
  semanal: 'Semana',
  quincenal: 'Quincena',
  mensual: 'Mes',
}

export default function TablaAmortizacion({ tabla, frecuencia = 'mensual', mostrarPagado = false }) {
  if (!Array.isArray(tabla) || tabla.length === 0) return null

  const labelPeriodo = LABEL_FRECUENCIA[frecuencia] || 'Periodo'

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-[#8b95a5] uppercase tracking-wide">
        Desglose por {labelPeriodo.toLowerCase()}
      </p>
      <div className="space-y-1.5">
        {tabla.map((fila) => {
          const completado = mostrarPagado && (fila.pagado || 0) >= fila.cuotaTotal
          const interesAlDia = mostrarPagado && !completado && (fila.interesPagado || 0) >= fila.interes
          return (
            <div
              key={fila.numeroPeriodo}
              className="flex items-center justify-between gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[10px] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {mostrarPagado && (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: completado ? 'var(--color-success)' : interesAlDia ? 'var(--color-warning)' : 'transparent',
                      border: (completado || interesAlDia) ? 'none' : '1.5px solid var(--color-border)',
                    }}
                    title={completado ? 'Cuota pagada' : interesAlDia ? 'Intereses al día' : 'Pendiente'}
                  >
                    {completado && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {interesAlDia && (
                      <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 4h.01" />
                      </svg>
                    )}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {labelPeriodo} {fila.numeroPeriodo}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {fmtFecha(fila.fechaEsperada)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right shrink-0">
                <div>
                  <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Capital</p>
                  <p className="text-[11px] font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(fila.capital)}</p>
                </div>
                <div>
                  <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Interés</p>
                  <p className="text-[11px] font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(fila.interes)}</p>
                </div>
                <div>
                  <p className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                  <p className="text-[12px] font-bold font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatMoney(fila.cuotaTotal)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
