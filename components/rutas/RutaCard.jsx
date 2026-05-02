// components/rutas/RutaCard.jsx
// Card premium para lista de rutas. Mood color por % de cobro del dia.

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { formatCOP } from '@/lib/calculos'

const COLOR_OK   = '#22c55e'
const COLOR_HOT  = '#f5c518'
const COLOR_WARN = '#f97316'
const COLOR_CRIT = '#ef4444'
const COLOR_OFF  = '#64748b'

// Mood color por % de cobro y cantidad de clientes pendientes
function moodColor(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return COLOR_OFF // sin actividad esperada
  if (progreso >= 100) return COLOR_OK
  if (progreso >= 60) return COLOR_HOT
  if (progreso >= 30) return COLOR_WARN
  return COLOR_CRIT
}

function moodLabel(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return 'Sin actividad'
  if (progreso >= 100) return 'Meta cumplida'
  if (progreso >= 60) return 'Buen ritmo'
  if (progreso >= 30) return 'Atrasada'
  return 'Crítica'
}

export default function RutaCard({ ruta }) {
  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100))
    : 0
  const color = moodColor(progreso, ruta.esperadoHoy)
  const label = moodLabel(progreso, ruta.esperadoHoy)

  // Avatar del cobrador (inicial)
  const inicial = ruta.cobrador?.nombre?.[0]?.toUpperCase() ?? '?'
  const tieneCobrador = !!ruta.cobrador

  return (
    <Card
      as={Link}
      href={`/rutas/${ruta.id}`}
      glowColor={color}
      padding={false}
      className="block px-4 py-4 transition-all duration-200 group kpi-lift"
    >
      {/* Top: nombre + chip estado */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icono ruta con color del estado */}
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: `color-mix(in srgb, ${color} 18%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              color,
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-text-primary)] truncate leading-tight">{ruta.nombre}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tieneCobrador ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--color-purple) 25%, transparent)', color: 'var(--color-purple)' }}
                  >
                    {inicial}
                  </span>
                  <span className="text-[10px] truncate" style={{ color: 'var(--color-purple)' }}>{ruta.cobrador.nombre}</span>
                </>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Sin cobrador</span>
              )}
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>·</span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {ruta.cantidadClientes} cliente{ruta.cantidadClientes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <span
          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            color,
            border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      </div>

      {/* Saldo cobrado del dia tipo balance bancario */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Recaudado hoy</p>
          <p className="text-[10px] font-mono-display font-semibold" style={{ color }}>{progreso}%</p>
        </div>
        <p
          className="font-mono-display font-bold leading-none tracking-tight"
          style={{
            color: progreso >= 100 ? color : 'var(--color-text-primary)',
            fontSize: 'clamp(20px, 5vw, 24px)',
            textShadow: progreso >= 100 ? `0 0 18px color-mix(in srgb, ${color} 30%, transparent)` : 'none',
          }}
        >
          {formatCOP(ruta.recaudadoHoy ?? 0)}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          de {formatCOP(ruta.esperadoHoy ?? 0)} esperados
        </p>
      </div>

      {/* Progress bar con glow */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progreso}%`,
            background: progreso >= 100
              ? `linear-gradient(90deg, ${COLOR_OK}, ${COLOR_OK})`
              : `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
            boxShadow: progreso > 5 ? `0 0 10px color-mix(in srgb, ${color} 50%, transparent)` : 'none',
          }}
        />
      </div>
    </Card>
  )
}
