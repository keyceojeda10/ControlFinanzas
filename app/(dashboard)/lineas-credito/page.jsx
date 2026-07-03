'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { StaggeredList } from '@/components/ui/StaggeredList'
import { formatMoney } from '@/lib/i18n'
import CardWaves from '@/components/ui/CardWaves'
import Avatar from '@/components/ui/Avatar'
import { CARD_PALETTES, moodKeyLinea } from '@/components/ui/tarjetaCredito'

const ESTADOS = [
  { value: '',         label: 'Todas' },
  { value: 'activa',   label: 'Activas' },
  { value: 'congelada', label: 'Congeladas' },
  { value: 'cerrada',  label: 'Cerradas' },
]

export default function LineasCreditoPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const [lineas, setLineas] = useState([])
  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('activa')
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estado) params.set('estado', estado)
      if (buscar) params.set('buscar', buscar)
      const res = await fetch(`/api/lineas-credito?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLineas(data)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }, [estado, buscar])

  useEffect(() => { cargar() }, [cargar])

  if (authLoading) return <div className="p-4 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>

  const totalSaldo = lineas.reduce((s, l) => s + (l.saldoTotal || 0), 0)
  const totalCupo = lineas.reduce((s, l) => s + l.cupoMaximo, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Lineas de crédito</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {lineas.length} línea{lineas.length !== 1 ? 's' : ''} · Saldo total {formatMoney(totalSaldo)}
          </p>
        </div>
        {esOwner && (
          <Link href="/lineas-credito/nueva" className="cf-btn-primary inline-flex items-center justify-center font-medium rounded-[12px] border transition-all h-9 px-3 text-xs">
            + Nueva línea
          </Link>
        )}
      </div>

      {/* Explicacion */}
      <div className="mb-4 p-3 rounded-xl text-[11px] text-[var(--color-text-muted)] leading-relaxed" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        Una línea de crédito funciona como un cupo rotativo: le apruebas un monto máximo al cliente y él puede pedir plata varias veces sin crear un préstamo nuevo cada vez. Al final del mes se genera un corte con lo que debe (capital + intereses) y puede pagar todo o una parte. Lo que no pague, rota al siguiente mes.
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setEstado(e.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              estado === e.value
                ? 'bg-[var(--color-accent)] text-black'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Buscar */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o cedula..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
      ) : lineas.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          <p className="text-sm text-[var(--color-text-muted)]">
            {buscar || estado ? 'No se encontraron líneas con esos filtros' : 'No hay líneas de crédito creadas'}
          </p>
          {esOwner && !buscar && !estado && (
            <Link href="/lineas-credito/nueva" className="cf-btn-primary inline-flex items-center justify-center font-medium rounded-[12px] border transition-all h-9 px-3 text-xs mt-4">
              Crear primera línea
            </Link>
          )}
        </div>
      ) : (
        <StaggeredList className="space-y-3">
          {lineas.map(linea => (
            <LineaCreditoCard key={linea.id} linea={linea} />
          ))}
        </StaggeredList>
      )}
    </div>
  )
}

function LineaCreditoCard({ linea }) {
  const porcentajeUsado = linea.cupoMaximo > 0
    ? Math.round((linea.capitalUsado || 0) / linea.cupoMaximo * 100)
    : 0

  const P = CARD_PALETTES[moodKeyLinea(linea.estado, porcentajeUsado)]
  const estadoLabel = linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)

  return (
    <Card
      as={Link}
      href={`/lineas-credito/${linea.id}`}
      padding={false}
      className="block px-4 py-4 group relative overflow-hidden"
      style={{
        background: P.grad,
        border: `1px solid ${P.border}`,
        boxShadow: P.shadow,
      }}
    >
      <CardWaves tint={P.waves} />

      <div className="relative">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              nombre={linea.cliente?.nombre}
              size={34}
              fontSize={12}
              style={{ border: `2px solid color-mix(in srgb, ${P.ink} 20%, transparent)` }}
            />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-tight" style={{ color: P.ink }}>
                {linea.cliente?.nombre}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: P.sub }}>
                CC {linea.cliente?.cedula} · Cupo {formatMoney(linea.cupoMaximo)}
              </p>
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
            {estadoLabel}
          </span>
        </div>

        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: P.sub }}>
            Saldo actual
          </p>
          <p
            className="font-mono-display font-bold leading-none tracking-tight"
            style={{ color: P.ink, fontSize: 'clamp(20px, 5vw, 24px)' }}
          >
            {formatMoney(linea.saldoTotal || 0)}
          </p>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span style={{ color: P.sub }}>Uso del cupo</span>
            <span className="font-mono-display font-bold" style={{ color: P.accent }}>
              {porcentajeUsado}%
            </span>
          </div>
          <div className="h-[5px] rounded-full overflow-hidden" style={{ background: P.track }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(porcentajeUsado, 2)}%`, background: P.accent }}
            />
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 pt-2.5"
          style={{ borderTop: `1px solid ${P.track}` }}
        >
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Disponible</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
              {formatMoney(linea.cupoDisponible || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.sub }}>Tasa mensual</p>
            <p className="text-[12px] font-mono-display font-bold mt-0.5" style={{ color: P.ink }}>
              {linea.tasaInteres}%
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
