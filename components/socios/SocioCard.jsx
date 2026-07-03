'use client'

import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

export default function SocioCard({ socio }) {
  const { country } = useCountry()
  const fmt = (v) => formatMoney(v, country)

  return (
    <Link href={`/socios/${socio.id}`}>
      <div
        className="rounded-[16px] p-4 transition-all active:scale-[0.98]"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className="text-[15px] font-semibold truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {socio.nombre}
            </h3>
            {socio.cedula && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                CC {socio.cedula}
              </p>
            )}
          </div>
          <div
            className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: socio.activo ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
              color: socio.activo ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {socio.activo ? 'Activo' : 'Inactivo'}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Balance
            </p>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {fmt(socio.balanceNeto ?? socio.totalAportes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              En calle
            </p>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-accent)' }}>
              {fmt(socio.capitalEnCalle)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Intereses
            </p>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--color-success)' }}>
              {fmt(socio.interesesCobrados)}
            </p>
          </div>
        </div>

        {socio.prestamosActivos > 0 && (
          <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {socio.prestamosActivos} prestamo{socio.prestamosActivos !== 1 ? 's' : ''} activo{socio.prestamosActivos !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </Link>
  )
}
