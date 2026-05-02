'use client'
// components/cobradores/CobradorCard.jsx
// Card premium de cobrador con mood color por desempeño del dia.

import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'

const COLOR_OK   = '#22c55e'
const COLOR_HOT  = '#f5c518'
const COLOR_WARN = '#f97316'
const COLOR_CRIT = '#ef4444'
const COLOR_OFF  = '#64748b'

function moodColor(progreso, esperadoHoy, activo) {
  if (!activo) return COLOR_OFF
  if (esperadoHoy === 0) return COLOR_OFF
  if (progreso >= 100) return COLOR_OK
  if (progreso >= 60) return COLOR_HOT
  if (progreso >= 30) return COLOR_WARN
  return COLOR_CRIT
}

function moodLabel(progreso, esperadoHoy, activo) {
  if (!activo) return 'Inactivo'
  if (esperadoHoy === 0) return 'Sin meta hoy'
  if (progreso >= 100) return 'Meta cumplida'
  if (progreso >= 60) return 'Buen ritmo'
  if (progreso >= 30) return 'Atrasado'
  return 'Crítico'
}

// Texto "activo hace X" basado en ultimoPago
function tiempoUltimaActividad(ultimoPago) {
  if (!ultimoPago) return null
  const ms = Date.now() - new Date(ultimoPago).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 5) return { texto: 'activo ahora', activo: true }
  if (min < 60) return { texto: `hace ${min} min`, activo: min < 30 }
  const hr = Math.floor(min / 60)
  if (hr < 24) return { texto: `hace ${hr} h`, activo: false }
  return null
}

export default function CobradorCard({ cobrador, onToggleActivo, toggling }) {
  const progreso = cobrador.esperadoHoy > 0
    ? Math.min(100, Math.round((cobrador.recaudadoHoy / cobrador.esperadoHoy) * 100))
    : 0
  const color = moodColor(progreso, cobrador.esperadoHoy, cobrador.activo)
  const label = moodLabel(progreso, cobrador.esperadoHoy, cobrador.activo)
  const inicial = cobrador.nombre?.[0]?.toUpperCase() ?? '?'
  const actividad = tiempoUltimaActividad(cobrador.ultimoPago)

  return (
    <div
      className="rounded-[16px] overflow-hidden transition-all kpi-lift"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, var(--color-border))`,
        boxShadow: `0 4px 16px color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <Link href={`/cobradores/${cobrador.id}`} className="block px-4 py-4">
        {/* Top: avatar + nombre + estado */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar con dot de actividad */}
          <div className="relative shrink-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-[16px] font-bold"
              style={{
                background: `color-mix(in srgb, ${color} 18%, transparent)`,
                color,
                border: `2px solid color-mix(in srgb, ${color} 40%, transparent)`,
              }}
            >
              {inicial}
            </div>
            {actividad?.activo && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                style={{ background: 'var(--color-success)', border: '2px solid var(--color-bg-card)', boxShadow: '0 0 8px var(--color-success)' }}
                title="Activo ahora"
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                {cobrador.nombre}
              </p>
              {/* Toggle activo/inactivo (no navega) */}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleActivo?.(cobrador) }}
                disabled={toggling}
                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full disabled:opacity-50"
                style={{
                  background: `color-mix(in srgb, ${color} 15%, transparent)`,
                  color,
                  border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                }}
                title={cobrador.activo ? 'Desactivar' : 'Activar'}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </button>
            </div>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
              {cobrador.email}
            </p>
            {actividad && (
              <p className="text-[10px] mt-0.5" style={{ color: actividad.activo ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {actividad.activo && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 animate-pulse" style={{ background: 'var(--color-success)' }} />}
                {actividad.texto}
              </p>
            )}
          </div>
        </div>

        {/* Recaudado hoy con progress bar */}
        <div className="mb-2">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Recaudado hoy</p>
            <p className="text-[10px] font-mono-display font-semibold" style={{ color }}>{progreso}%</p>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <p
              className="font-mono-display font-bold leading-none"
              style={{
                color: progreso >= 100 ? color : 'var(--color-text-primary)',
                fontSize: '20px',
                textShadow: progreso >= 100 ? `0 0 12px color-mix(in srgb, ${color} 30%, transparent)` : 'none',
              }}
            >
              {formatCOP(cobrador.recaudadoHoy ?? 0)}
            </p>
            <p className="text-[10px] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>
              de {formatCOP(cobrador.esperadoHoy ?? 0)}
            </p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progreso}%`,
                background: `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
                boxShadow: progreso > 5 ? `0 0 8px color-mix(in srgb, ${color} 50%, transparent)` : 'none',
              }}
            />
          </div>
        </div>

        {/* Footer stats: ruta + clientes + pagos hoy */}
        <div
          className="grid grid-cols-3 gap-2 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ruta</p>
            <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: cobrador.ruta ? 'var(--color-purple)' : 'var(--color-text-muted)' }}>
              {cobrador.ruta?.nombre ?? 'Sin ruta'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Clientes</p>
            <p className="text-[12px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-text-primary)' }}>{cobrador.cantidadClientes ?? 0}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Pagos hoy</p>
            <p className="text-[12px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-success)' }}>{cobrador.cantidadPagosHoy ?? 0}</p>
          </div>
        </div>
      </Link>
    </div>
  )
}
