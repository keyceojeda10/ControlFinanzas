// components/rutas/RutaCard.jsx
// Tarjeta premium oscura de ruta. El mood color (por % de cobro del dia)
// se expresa via acento: recaudado, glow, borde, pill y progreso.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { CARD_SURFACE as S, cardBackground, cardBorder } from '@/components/ui/tarjetaCredito'

const COLOR_OK   = '#34d399'
const COLOR_HOT  = '#f5c518'
const COLOR_WARN = '#fb923c'
const COLOR_CRIT = '#f87171'
const COLOR_OFF  = '#9aa5b5'

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
  const accent = moodColor(progreso, ruta.esperadoHoy)
  const label = moodLabel(progreso, ruta.esperadoHoy)

  const tieneCobrador = !!ruta.cobrador

  return (
    <Card
      as={Link}
      href={`/rutas/${ruta.id}`}
      padding={false}
      className="block px-4 py-4 transition-all duration-200 group kpi-lift"
      style={{
        background: cardBackground(accent),
        border: cardBorder(accent),
        boxShadow: S.shadow,
      }}
    >
      {/* Top: nombre + chip estado */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icono ruta con color del estado */}
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 28%, transparent)`,
              color: accent,
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold truncate leading-tight" style={{ color: S.ink }}>{ruta.nombre}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tieneCobrador ? (
                <>
                  <Avatar nombre={ruta.cobrador.nombre} size={16} fontSize={7} />
                  <span className="text-[10px] truncate" style={{ color: S.sub }}>{ruta.cobrador.nombre}</span>
                </>
              ) : (
                <span className="text-[10px]" style={{ color: S.faint }}>Sin cobrador</span>
              )}
              <span className="text-[10px]" style={{ color: S.faint }}>·</span>
              <span className="text-[10px]" style={{ color: S.faint }}>
                {ruta.cantidadClientes} cliente{ruta.cantidadClientes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <span
          className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
            border: `1px solid color-mix(in srgb, ${accent} 26%, transparent)`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          {label}
        </span>
      </div>

      {/* Recaudado del dia — el acento colorea el numero */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: S.sub }}>Recaudado hoy</p>
          <p className="text-[10px] font-mono-display font-bold" style={{ color: accent }}>{progreso}%</p>
        </div>
        <p
          className="font-mono-display font-bold leading-none tracking-tight"
          style={{ color: accent, fontSize: 'clamp(20px, 5vw, 24px)' }}
        >
          {formatMoney(ruta.recaudadoHoy ?? 0)}
        </p>
        <p className="text-[10px] mt-1" style={{ color: S.sub }}>
          de {formatMoney(ruta.esperadoHoy ?? 0)} esperados
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-[6px] rounded-full overflow-hidden" style={{ background: S.track }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${progreso}%`,
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 65%, transparent), ${accent})`,
          }}
        />
      </div>
    </Card>
  )
}
