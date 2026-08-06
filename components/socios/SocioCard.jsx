// components/socios/SocioCard.jsx
// Card de socio en estilo tarjeta de credito premium, consistente con
// ClienteCard / PrestamoCard: superficie pastel del estado + tinta profunda
// + olas sutiles, dentro del Card estandar del dashboard.

'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import CardWaves from '@/components/ui/CardWaves'
import { useCardPalettes } from '@/components/ui/tarjetaCredito'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

// Un socio no tiene estado de mora/vencido como un prestamo, asi que el
// "mood" refleja si esta produciendo retornos (oro), si tiene capital
// colocado sin intereses aun (verde, nuevo) o si esta inactivo (gris).
export function moodKeySocio(socio) {
  if (!socio.activo) return 'off'
  if (socio.capitalEnCalle > 0 && socio.interesesCobrados > 0) return 'ok'
  if (socio.capitalEnCalle > 0 && socio.interesesCobrados === 0) return 'nuevo'
  return 'ok'
}

function moodLabel(socio) {
  if (!socio.activo) return 'Inactivo'
  return 'Activo'
}

export default function SocioCard({ socio }) {
  const { country } = useCountry()
  const fmt = (v) => formatMoney(v, country)

  const { palettes } = useCardPalettes()
  const P = palettes[moodKeySocio(socio)]
  const label = moodLabel(socio)
  const balanceNeto = socio.balanceNeto ?? socio.totalAportes
  const prestamosActivos = socio.prestamosActivos ?? 0

  return (
    <Card
      as={Link}
      href={`/socios/${socio.id}`}
      padding={false}
      hoverable
      className="block px-4 py-3.5 group relative overflow-hidden"
      style={{
        background: `color-mix(in srgb, ${P.accent} 8%, var(--cf-card))`,
        border: `1px solid color-mix(in srgb, ${P.accent} 22%, var(--cf-border))`,
      }}
    >
      <div className="relative">
        {/* Seccion superior: identidad del socio */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold truncate leading-tight" style={{ color: 'var(--cf-ink)' }}>
              {socio.nombre}
            </p>
            {socio.cedula && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                CC {socio.cedula}
              </p>
            )}
          </div>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
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

        {/* Sub-panel estilo tarjeta de credito: balance + intereses + en calle */}
        <div
          className="mt-3 relative overflow-hidden rounded-[14px] px-4 py-3.5"
          style={{
            background: P.grad,
            border: `1px solid ${P.border}`,
            boxShadow: P.shadow,
          }}
        >
          <CardWaves tint={P.waves} />
          <div className="relative">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: P.sub }}>
                  Balance neto
                </p>
                <p className="font-mono-display font-bold leading-none mt-1" style={{ color: P.ink, fontSize: 'clamp(22px, 6vw, 26px)' }}>
                  {fmt(balanceNeto)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: P.sub }}>
                  Intereses
                </p>
                <p className="text-[15px] font-mono-display font-bold mt-1" style={{ color: P.accent }}>
                  {fmt(socio.interesesCobrados)}
                </p>
              </div>
            </div>

            <div
              className="flex items-center justify-between mt-3 pt-3"
              style={{ borderTop: `1px solid color-mix(in srgb, ${P.accent} 20%, transparent)` }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>
                  En calle
                </p>
                <p className="text-[13px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
                  {fmt(socio.capitalEnCalle)}
                </p>
              </div>
              {prestamosActivos > 0 && (
                <p className="text-[11px] font-medium text-right" style={{ color: P.sub }}>
                  {prestamosActivos} prestamo{prestamosActivos !== 1 ? 's' : ''} activo{prestamosActivos !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
