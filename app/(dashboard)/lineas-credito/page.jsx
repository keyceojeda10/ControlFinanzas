'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { StaggeredList } from '@/components/ui/StaggeredList'
import { formatMoney } from '@/lib/i18n'

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
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Lineas de credito</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {lineas.length} linea{lineas.length !== 1 ? 's' : ''} · Saldo total {formatMoney(totalSaldo)}
          </p>
        </div>
        {esOwner && (
          <Button as={Link} href="/lineas-credito/nueva" size="sm">
            + Nueva linea
          </Button>
        )}
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
            {buscar || estado ? 'No se encontraron lineas con esos filtros' : 'No hay lineas de credito creadas'}
          </p>
          {esOwner && !buscar && !estado && (
            <Button as={Link} href="/lineas-credito/nueva" size="sm" className="mt-4">
              Crear primera linea
            </Button>
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

  const estadoColor = {
    activa: 'var(--color-accent)',
    congelada: 'var(--color-warning)',
    cerrada: '#64748b',
  }[linea.estado] || 'var(--color-accent)'

  return (
    <Card
      as={Link}
      href={`/lineas-credito/${linea.id}`}
      hoverable
      padding={false}
      glowColor={estadoColor}
      className="block px-4 py-3.5"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight truncate">
            {linea.cliente?.nombre}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            CC {linea.cliente?.cedula} · Cupo {formatMoney(linea.cupoMaximo)}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2"
          style={{ background: `${estadoColor}20`, color: estadoColor, border: `1px solid ${estadoColor}35` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoColor }} />
          {linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)}
        </span>
      </div>

      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Saldo actual</p>
            <p className="text-[18px] font-mono-display font-bold leading-none mt-1 text-[var(--color-text-primary)]">
              {formatMoney(linea.saldoTotal || 0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Disponible: {formatMoney(linea.cupoDisponible || 0)}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              Tasa: {linea.tasaInteres}% mensual
            </p>
          </div>
        </div>

        {/* Barra de uso */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-[var(--color-text-muted)]">Uso del cupo</span>
            <span className="font-mono-display font-semibold" style={{ color: porcentajeUsado > 80 ? 'var(--color-danger)' : estadoColor }}>
              {porcentajeUsado}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(porcentajeUsado, 2)}%`,
                background: porcentajeUsado > 80
                  ? 'var(--color-danger)'
                  : `linear-gradient(90deg, color-mix(in srgb, ${estadoColor} 80%, transparent), ${estadoColor})`,
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
