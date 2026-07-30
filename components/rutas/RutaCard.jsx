// components/rutas/RutaCard.jsx
// Panel operativo de ruta — dashboard compacto de progreso en calle.
// Barra de progreso gruesa dominante, numeros grandes de recaudado vs meta.
// Usa paletas pastel por mood pero layout tipo panel de control, NO ficha de perfil.

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import CardWaves from '@/components/ui/CardWaves'
import { useCardPalettes, moodKeyRuta } from '@/components/ui/tarjetaCredito'

function moodLabel(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return 'Sin cobros'
  if (progreso >= 100) return 'Meta cumplida'
  if (progreso >= 60) return 'Buen ritmo'
  if (progreso >= 30) return 'Atrasada'
  return 'Critica'
}

export default function RutaCard({ ruta, congelada }) {
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
      hoverable
      className="block group relative overflow-hidden"
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
      }}
    >
      <CardWaves tint={P.waves} />
      {P.sheen && P.sheen !== 'none' && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: P.sheen }} />
      )}

      <div className="relative px-4 py-4">
        {/* Cabecera: nombre ruta + badge estado */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold truncate leading-tight" style={{ color: P.ink }}>
              {ruta.nombre}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {tieneCobrador ? (
                <span className="inline-flex items-center gap-1">
                  <Avatar nombre={ruta.cobrador.nombre} size={16} fontSize={7} />
                  <span className="text-[11px] truncate" style={{ color: P.sub }}>{ruta.cobrador.nombre}</span>
                </span>
              ) : (
                <span className="text-[11px]" style={{ color: P.sub }}>Sin cobrador</span>
              )}
              <span className="text-[11px]" style={{ color: P.sub }}>
                · {ruta.cantidadClientes} cliente{ruta.cantidadClientes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {congelada ? (
            <span
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: 'color-mix(in srgb, var(--cf-gold-dark) 14%, transparent)',
                color: 'var(--cf-gold-dark)',
                border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 26%, transparent)',
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Solo lectura
            </span>
          ) : (
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
          )}
        </div>

        {/* Bloque central: porcentaje gigante + recaudado */}
        <div className="flex items-end justify-between gap-3 mt-3 mb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: P.sub }}>Recaudado</p>
            <p
              className="font-mono-display font-bold leading-none tracking-tight mt-1"
              style={{ color: P.ink, fontSize: 'clamp(22px, 5.5vw, 28px)' }}
            >
              {formatMoney(ruta.recaudadoHoy ?? 0)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="font-mono-display font-bold leading-none"
              style={{ color: P.accent, fontSize: 'clamp(28px, 7vw, 36px)' }}
            >
              {progreso}<span className="text-[16px]">%</span>
            </p>
          </div>
        </div>

        {/* Barra de progreso gruesa — elemento visual dominante */}
        <div className="h-[8px] rounded-full overflow-hidden" style={{ background: P.track }}>
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.max(progreso, 1)}%`, background: P.accent }}
          />
        </div>

        {/* Footer: meta esperada */}
        <p className="text-[11px] mt-1.5 text-right" style={{ color: P.sub }}>
          de {formatMoney(ruta.esperadoHoy ?? 0)} esperados
        </p>

        {/* Capital en la calle de esta ruta. Va abajo y separado porque la
            tarjeta cuenta el DIA (recaudado vs meta) y esto es otra dimension.
            Mismos rotulos que el detalle de ruta, para que no parezcan datos
            distintos. Solo llega si el usuario tiene permiso de ver capital. */}
        {typeof ruta.capitalTotal === 'number' && (
          <div
            className="grid grid-cols-2 gap-2 mt-2 pt-2"
            style={{ borderTop: `1px solid ${P.track}` }}
          >
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.sub }}>Prestado</p>
              <p className="text-[12px] font-mono-display font-bold leading-tight" style={{ color: P.ink }}>
                {formatMoney(ruta.capitalTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.sub }}>Con intereses</p>
              <p className="text-[12px] font-mono-display font-bold leading-tight" style={{ color: P.ink }}>
                {formatMoney(ruta.totalAPagarRuta ?? 0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
