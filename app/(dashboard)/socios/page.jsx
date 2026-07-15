'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import CardWaves from '@/components/ui/CardWaves'
import { useCardPalettes } from '@/components/ui/tarjetaCredito'
import SocioCard from '@/components/socios/SocioCard'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

export default function SociosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const { palettes } = useCardPalettes()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fmt = (v) => formatMoney(v, country)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await fetch('/api/socios')
      if (!res.ok) throw new Error('Error al cargar socios')
      const data = await res.json()
      setSocios(data)
    } catch {
      setError('No se pudieron cargar los socios. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (authLoading) return <div className="space-y-3 pb-28">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>

  if (!esOwner) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
        No tienes acceso a esta seccion.
      </div>
    )
  }

  const totalAportes = socios.reduce((acc, s) => acc + s.totalAportes, 0)
  const totalRetiros = socios.reduce((acc, s) => acc + (s.totalRetiros || 0), 0)
  const capitalTotal = totalAportes - totalRetiros
  const totalEnCalle = socios.reduce((acc, s) => acc + s.capitalEnCalle, 0)
  const totalIntereses = socios.reduce((acc, s) => acc + s.interesesCobrados, 0)

  const hayContenido = !loading && !error
  const hayDatos = hayContenido && socios.length > 0

  const P = palettes.ok

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[25px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Socios
        </h1>
        {hayDatos && (
          <Link href="/socios/nuevo">
            <Button>Nuevo socio</Button>
          </Link>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && error && (
        <div
          className="cf-card-shadow rounded-[20px] p-6 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
          <Button variant="secondary" onClick={cargar}>Reintentar</Button>
        </div>
      )}

      {hayContenido && (
        <>
          {hayDatos && (
            <div
              className="relative rounded-[20px] overflow-hidden mb-4"
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

              <div className="relative p-4">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: P.sub }}>
                  Capital total
                </p>
                <p
                  className="font-mono-display font-bold leading-none tracking-tight mt-1.5"
                  style={{ color: P.ink, fontSize: 'clamp(28px, 8vw, 34px)' }}
                >
                  {fmt(capitalTotal)}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: P.sub }}>
                  Aportes {fmt(totalAportes)} · Retiros {fmt(totalRetiros)}
                </p>

                <div
                  className="rounded-[14px] grid grid-cols-3 gap-2 mt-4 pt-3"
                  style={{ borderTop: `1px solid ${P.track}` }}
                >
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>
                      En calle
                    </p>
                    <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
                      {fmt(totalEnCalle)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>
                      Intereses
                    </p>
                    <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: P.accent }}>
                      {fmt(totalIntereses)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>
                      Socios
                    </p>
                    <p className="text-[14px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
                      {socios.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {socios.length === 0 ? (
            <EmptyState
              pose="guia"
              titulo="No hay socios registrados"
              hint="Los socios son inversores que aportan capital al negocio y reciben intereses."
              action={<Link href="/socios/nuevo"><Button>Crear primer socio</Button></Link>}
            />
          ) : (
            <div className="space-y-3">
              {socios.map((s) => <SocioCard key={s.id} socio={s} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
