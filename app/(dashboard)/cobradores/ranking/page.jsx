'use client'
// app/(dashboard)/cobradores/ranking/page.jsx - Ranking / scorecard de cobradores

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import MonedaCF from '@/components/ui/MonedaCF'
import Avatar from '@/components/ui/Avatar'

const MEDALS = {
  1: { color: 'var(--cf-gold)', label: '1°' },
  2: { color: '#94a3b8', label: '2°' },
  3: { color: '#cd7f32', label: '3°' },
}

function scoreColor(score) {
  if (score >= 80) return 'var(--cf-green-dark)'
  if (score >= 60) return 'var(--cf-gold-dark)'
  return 'var(--cf-red-dark)'
}

function ProgressBar({ value, color }) {
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  )
}

function PodiumCard({ cobrador, order }) {
  const medal = MEDALS[cobrador.rank] ?? MEDALS[3]
  const isFirst = cobrador.rank === 1
  return (
    <Link
      href={`/cobradores/${cobrador.id}`}
      className="flex flex-col items-center active:scale-[0.98] transition-transform"
      style={{ order }}
    >
      <div
        className="rounded-[20px] w-full flex flex-col items-center text-center px-3 py-4"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${medal.color} 14%, var(--cf-card)) 0%, var(--cf-card) 60%)`,
          border: `1px solid color-mix(in srgb, ${medal.color} 30%, var(--cf-border))`,
          boxShadow: isFirst ? `0 6px 24px color-mix(in srgb, ${medal.color} 25%, transparent)` : 'none',
          minHeight: isFirst ? '190px' : '160px',
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mb-2"
          style={{
            background: `color-mix(in srgb, ${medal.color} 16%, transparent)`,
            color: medal.color,
            border: `1.5px solid color-mix(in srgb, ${medal.color} 50%, transparent)`,
          }}
        >
          {medal.label}
        </div>
        <Avatar nombre={cobrador.nombre} avatarId={cobrador.avatarId} size={isFirst ? 56 : 48} />
        <p className="text-sm font-semibold mt-2 truncate max-w-full" style={{ color: 'var(--cf-ink)' }}>
          {cobrador.nombre}
        </p>
        <p className="text-[11px] truncate max-w-full" style={{ color: 'var(--cf-ink-3)' }}>
          {cobrador.rutas?.join(', ') || 'Sin ruta'}
        </p>
        <p
          className="font-mono-display font-bold mt-2"
          style={{ fontSize: isFirst ? '32px' : '24px', color: scoreColor(cobrador.score), lineHeight: 1 }}
        >
          {cobrador.score}
        </p>
        <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>
          {cobrador.metrics?.eficiencia?.toFixed(1)}% eficiencia
        </p>
      </div>
    </Link>
  )
}

function MetricItem({ label, value, sub }) {
  return (
    <div className="rounded-[12px] px-3 py-2" style={{ background: 'var(--cf-fill)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>{label}</p>
      <p className="text-sm font-semibold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{value}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{sub}</p>}
    </div>
  )
}

function RankingCard({ cobrador }) {
  const [open, setOpen] = useState(false)
  const m = cobrador.metrics ?? {}
  const color = scoreColor(cobrador.score)

  return (
    <div
      className="cf-card-shadow rounded-[20px] overflow-hidden"
      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
    >
      <div className="flex items-center gap-3 p-4">
        <Link href={`/cobradores/${cobrador.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:scale-[0.98] transition-transform">
          <span
            className="text-base font-bold font-mono-display w-6 text-center shrink-0"
            style={{ color: MEDALS[cobrador.rank]?.color ?? 'var(--cf-ink-3)' }}
          >
            {cobrador.rank}
          </span>
          <Avatar nombre={cobrador.nombre} avatarId={cobrador.avatarId} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{cobrador.nombre}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--cf-ink-3)' }}>
              {cobrador.rutas?.join(', ') || 'Sin ruta'}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xl font-bold font-mono-display" style={{ color }}>{cobrador.score}</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]"
            style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)' }}
          >
            <svg
              className="w-4 h-4 transition-transform"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-0 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Eficiencia</span>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{m.eficiencia?.toFixed(1)}%</span>
            </div>
            <ProgressBar value={m.eficiencia ?? 0} color={color} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <MetricItem label="Recaudado" value={formatMoney(m.totalRecaudado ?? 0)} />
            <MetricItem label="Pagos" value={m.totalPagos ?? 0} />
            <MetricItem label="Días trabajados" value={m.diasTrabajados ?? 0} />
            <MetricItem label="Clientes activos" value={m.clientesActivos ?? 0} />
            <MetricItem
              label="Clientes en mora"
              value={m.clientesMora ?? 0}
              sub={m.tasaMora != null ? `${m.tasaMora.toFixed(1)}%` : undefined}
            />
            <MetricItem label="Puntualidad" value={m.puntualidad ?? '—'} />
            <MetricItem label="GPS" value={`${m.pagosConGps ?? 0}%`} />
            <MetricItem label="Fotos" value={`${m.pagosConFoto ?? 0}%`} />
            <MetricItem label="Faltante promedio" value={formatMoney(m.faltantePromedio ?? 0)} />
          </div>
        </div>
      )}
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 items-end">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[20px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', minHeight: i === 1 ? '190px' : '160px' }}>
            <div className="skeleton-shimmer w-8 h-8 rounded-full mx-auto mb-3" />
            <div className="skeleton-shimmer w-12 h-12 rounded-full mx-auto mb-3" />
            <div className="skeleton-shimmer h-3 w-16 mx-auto mb-2 rounded-[6px]" />
            <div className="skeleton-shimmer h-6 w-10 mx-auto rounded-[6px]" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[20px] p-4 flex items-center gap-3" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
            <div className="skeleton-shimmer w-6 h-6 rounded-[6px]" />
            <div className="skeleton-shimmer w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-3 w-32 rounded-[6px]" />
              <div className="skeleton-shimmer h-2.5 w-20 rounded-[6px]" />
            </div>
            <div className="skeleton-shimmer h-6 w-10 rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RankingCobradoresPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const [cobradores, setCobradores] = useState([])
  const [periodo, setPeriodo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/reportes/scorecard')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        setCobradores(Array.isArray(d?.cobradores) ? d.cobradores : [])
        setPeriodo(d?.periodo ?? null)
      })
      .catch(() => setError('No se pudo cargar el ranking de cobradores.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (authLoading || !esOwner) { setLoading(false); return }
    cargar()
  }, [authLoading, esOwner, cargar])

  if (!authLoading && !esOwner) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <MonedaCF pose="vacia" size={92} />
          <p className="text-sm font-semibold mt-3" style={{ color: 'var(--cf-ink)' }}>
            Acceso restringido
          </p>
          <p className="text-xs mt-1 max-w-[280px]" style={{ color: 'var(--cf-ink-3)' }}>
            Solo el propietario de la cuenta puede ver el ranking de cobradores.
          </p>
        </div>
      </div>
    )
  }

  const periodoLabel = periodo?.desde && periodo?.hasta
    ? 'Últimos 30 días'
    : ''

  const top3 = cobradores.slice(0, 3)
  const resto = cobradores.slice(3)
  const podiumOrder = { 1: 2, 2: 1, 3: 3 }

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto pb-6">
      <div className="mb-6">
        <Link
          href="/cobradores"
          className="inline-flex items-center gap-1.5 text-sm mb-3 transition-colors"
          style={{ color: 'var(--cf-ink-3)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Cobradores
        </Link>
        <h1 className="text-[25px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Ranking de cobradores</h1>
        {periodoLabel && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{periodoLabel}</p>
        )}
      </div>

      {loading && <RankingSkeleton />}

      {!loading && error && (
        <div
          className="cf-card-shadow rounded-[20px] p-6 text-center"
          style={{ background: 'var(--cf-red-pill-bg)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
          <button
            type="button"
            onClick={cargar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-semibold transition-colors"
            style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && cobradores.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <MonedaCF pose="vacia" size={92} />
          <p className="text-sm font-semibold mt-3" style={{ color: 'var(--cf-ink)' }}>
            No hay cobradores registrados
          </p>
          <p className="text-xs mt-1 max-w-[280px]" style={{ color: 'var(--cf-ink-3)' }}>
            Cuando registres cobradores y empiecen a recaudar pagos, verás su desempeño aquí.
          </p>
          <Link
            href="/cobradores/nuevo"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-[12px] text-sm font-semibold transition-colors"
            style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
          >
            Crear cobrador
          </Link>
        </div>
      )}

      {!loading && !error && cobradores.length > 0 && (
        <div className="space-y-6">
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 items-end">
              {top3.map((c) => (
                <PodiumCard key={c.id} cobrador={c} order={podiumOrder[c.rank] ?? c.rank} />
              ))}
            </div>
          )}

          <div className="space-y-3">
            {(top3.length >= 3 ? resto : cobradores).map((c) => (
              <RankingCard key={c.id} cobrador={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
