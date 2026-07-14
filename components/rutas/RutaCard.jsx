// components/rutas/RutaCard.jsx
// Tarjeta pastel premium de ruta — superficie reactiva al progreso del dia.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardWaves from '@/components/ui/CardWaves'
import { useCardPalettes, moodKeyRuta } from '@/components/ui/tarjetaCredito'

function moodLabel(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return 'Sin actividad'
  if (progreso >= 100) return 'Meta cumplida'
  if (progreso >= 60) return 'Buen ritmo'
  if (progreso >= 30) return 'Atrasada'
  return 'Critica'
}

export default function RutaCard({ ruta }) {
  const { palettes } = useCardPalettes()
  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100))
    : 0
  const P = palettes[moodKeyRuta(progreso, ruta.esperadoHoy)]
  const label = moodLabel(progreso, ruta.esperadoHoy)
  const tieneCobrador = !!ruta.cobrador

  return (
    <Card
      as={Link}
      href={`/rutas/${ruta.id}`}
      padding={false}
      className="block px-4 py-4 group relative overflow-hidden"
      hoverable
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
      }}
    >
      <CardWaves tint={P.waves} />
      {P.sheen && P.sheen !== 'none' && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen, transform: 'scaleX(-1)', opacity: 0.5 }} />
        </>
      )}

      <div className="relative">
        {/* Top: icon + nombre + badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
              style={{
                background: `color-mix(in srgb, ${P.accent} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${P.accent} 26%, transparent)`,
                color: P.accent,
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
              </svg>
            </div>

            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: P.ink }}>{ruta.nombre}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {tieneCobrador ? (
                  <>
                    <Avatar nombre={ruta.cobrador.nombre} size={16} fontSize={7} />
                    <span className="text-[11px] truncate" style={{ color: P.sub }}>{ruta.cobrador.nombre}</span>
                  </>
                ) : (
                  <span className="text-[11px]" style={{ color: P.sub }}>Sin cobrador</span>
                )}
                <span className="text-[11px]" style={{ color: P.sub }}>·</span>
                <span className="text-[11px]" style={{ color: P.sub }}>
                  {ruta.cantidadClientes} cliente{ruta.cantidadClientes !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: `color-mix(in srgb, ${P.accent} 14%, transparent)`,
              color: P.accent,
              border: `1px solid color-mix(in srgb, ${P.accent} 26%, transparent)`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: P.accent }} />
            {label}
          </span>
        </div>

        {/* Recaudado del dia */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: P.sub }}>Recaudado hoy</p>
            <p className="text-[11px] font-mono-display font-bold" style={{ color: P.accent }}>{progreso}%</p>
          </div>
          <p
            className="font-mono-display font-bold leading-none tracking-tight"
            style={{ color: P.ink, fontSize: 'clamp(22px, 5.5vw, 26px)' }}
          >
            {formatMoney(ruta.recaudadoHoy ?? 0)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: P.sub }}>
            de {formatMoney(ruta.esperadoHoy ?? 0)} esperados
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-[5px] rounded-full overflow-hidden" style={{ background: P.track }}>
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${progreso}%`, background: P.accent }}
          />
        </div>
      </div>
    </Card>
  )
}
