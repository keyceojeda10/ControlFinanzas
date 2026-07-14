// components/rutas/RutaCard.jsx
// Tarjeta operativa de ruta — mood de calle, progreso del dia, datos del cobrador.
// Identidad propia: NO usa paletas de tarjeta de credito ni sheen metalico.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'

const COLOR_OK   = '#22c55e'
const COLOR_GOOD = 'var(--color-accent)'
const COLOR_SLOW = '#f97316'
const COLOR_CRIT = 'var(--color-danger)'
const COLOR_OFF  = '#64748b'

function progresoColor(progreso, esperado) {
  if (esperado === 0) return COLOR_OFF
  if (progreso >= 100) return COLOR_OK
  if (progreso >= 60) return COLOR_GOOD
  if (progreso >= 30) return COLOR_SLOW
  return COLOR_CRIT
}

function progresoLabel(progreso, esperado) {
  if (esperado === 0) return 'Sin actividad'
  if (progreso >= 100) return 'Meta cumplida'
  if (progreso >= 60) return 'Buen ritmo'
  if (progreso >= 30) return 'Atrasada'
  return 'Critica'
}

export default function RutaCard({ ruta }) {
  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100))
    : 0
  const color = progresoColor(progreso, ruta.esperadoHoy)
  const label = progresoLabel(progreso, ruta.esperadoHoy)
  const tieneCobrador = !!ruta.cobrador

  return (
    <Card
      as={Link}
      href={`/rutas/${ruta.id}`}
      padding={false}
      hoverable
      glowColor={color}
      className="block group relative overflow-hidden"
    >
      {/* Barra de progreso superior integrada */}
      <div className="h-1 w-full" style={{ background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)' }}>
        <div className="h-full transition-[width] duration-700" style={{ width: `${Math.max(progreso, 2)}%`, background: color }} />
      </div>

      <div className="px-4 py-3.5">
        {/* Cabecera: icono ruta + nombre + badge estado */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
              style={{
                background: `color-mix(in srgb, ${color} 12%, var(--color-bg-surface))`,
                border: `1px solid color-mix(in srgb, ${color} 22%, var(--color-border))`,
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke={color} strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-[15px] font-bold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                {ruta.nombre}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {tieneCobrador ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar nombre={ruta.cobrador.nombre} size={16} fontSize={7} />
                    <span className="text-[11px] truncate" style={{ color: 'var(--color-text-secondary)' }}>{ruta.cobrador.nombre}</span>
                  </span>
                ) : (
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sin cobrador</span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  · {ruta.cantidadClientes} cliente{ruta.cantidadClientes !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: `color-mix(in srgb, ${color} 14%, transparent)`,
              color,
              border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        </div>

        {/* Bloque financiero del dia */}
        <div className="rounded-[12px] px-3.5 py-3" style={{
          background: `color-mix(in srgb, ${color} 5%, var(--color-bg-surface))`,
          border: `1px solid color-mix(in srgb, ${color} 12%, var(--color-border))`,
        }}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                Recaudado hoy
              </p>
              <p className="text-[22px] font-mono-display font-bold leading-none mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(ruta.recaudadoHoy ?? 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-mono-display font-bold leading-none" style={{ color }}>{progreso}%</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>de la meta</p>
            </div>
          </div>

          <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
            de {formatMoney(ruta.esperadoHoy ?? 0)} esperados
          </p>

          {/* Progress bar */}
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-text-muted) 15%, transparent)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${progreso}%`, background: color }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
