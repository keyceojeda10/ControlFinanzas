'use client'
// app/(dashboard)/mis-estadisticas/page.jsx — Estadísticas propias del cobrador

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

function fmtFechaCorta(yyyy_mm_dd) {
  const [, m, d] = yyyy_mm_dd.split('-')
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${parseInt(d)} ${meses[parseInt(m)]}`
}

export default function MisEstadisticasPage() {
  const { session, loading: authLoading } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (authLoading) return
    if (session?.user?.rol !== 'cobrador') return

    fetch('/api/mis-estadisticas')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
        else setError(json.error ?? 'Error al cargar')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [authLoading, session])

  if (authLoading || loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (session?.user?.rol !== 'cobrador') {
    return (
      <div className="max-w-xl mx-auto mt-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Esta página es solo para cobradores.
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-6 rounded-[12px] px-4 py-3 text-sm"
        style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
      >
        {error}
      </div>
    )
  }

  const pctColor = data.pctMeta >= 90 ? 'var(--color-success)' : data.pctMeta >= 60 ? 'var(--color-warning)' : 'var(--color-danger)'
  const maxSemana = Math.max(...(data.semana?.map((d) => d.total) ?? [1]), 1)

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Mis estadísticas</h1>
        {data.rutaNombre && (
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Ruta: {data.rutaNombre} · {data.totalClientesActivos} clientes activos
          </p>
        )}
      </div>

      {/* ── Hoy: recaudado vs meta ── */}
      <div className="rounded-[20px] px-5 py-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${pctColor} 12%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
          border: `1px solid color-mix(in srgb, ${pctColor} 22%, var(--color-border))`,
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>Hoy</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Recaudado</p>
            <p className="text-[32px] font-bold font-mono-display leading-none" style={{ color: pctColor }}>
              {formatCOP(data.recaudadoHoy)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Meta</p>
            <p className="text-[20px] font-bold font-mono-display" style={{ color: 'var(--color-text-secondary)' }}>
              {formatCOP(data.metaHoy)}
            </p>
          </div>
        </div>
        {/* Barra progreso */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, data.pctMeta)}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, ${pctColor} 60%, transparent), ${pctColor})`,
              boxShadow: `0 0 8px color-mix(in srgb, ${pctColor} 50%, transparent)`,
            }}
          />
        </div>
        <p className="text-[11px] mt-1.5 font-semibold" style={{ color: pctColor }}>{data.pctMeta}% de la meta</p>
      </div>

      {/* ── Últimos 7 días ── */}
      <div className="rounded-[16px] px-4 py-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>Últimos 7 días</p>
        <div className="flex items-end gap-1.5 h-28">
          {data.semana?.map((d, i) => {
            const pct = maxSemana > 0 ? Math.max(4, Math.round((d.total / maxSemana) * 100)) : 4
            const isHoy = i === data.semana.length - 1
            return (
              <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className="w-full rounded-t-[6px] transition-all duration-500"
                    style={{
                      height: `${pct}%`,
                      background: isHoy
                        ? 'var(--color-accent)'
                        : 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                    }}
                    title={formatCOP(d.total)}
                  />
                </div>
                <p className="text-[9px] text-center leading-tight" style={{ color: isHoy ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                  {fmtFechaCorta(d.fecha)}
                </p>
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between text-[11px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <span>Total semana</span>
          <span className="font-semibold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
            {formatCOP(data.semana?.reduce((s, d) => s + d.total, 0) ?? 0)}
          </span>
        </div>
      </div>

      {/* ── Clientes en mora en mi ruta ── */}
      {data.clientesMora?.length > 0 && (
        <div className="rounded-[16px] px-4 py-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Mi cartera en mora ({data.clientesMora.length})
          </p>
          <div className="space-y-2">
            {data.clientesMora.map((c, i) => {
              const moraColor = c.diasSinCobro > 30 ? 'var(--color-danger)' : c.diasSinCobro > 14 ? 'var(--color-warning)' : 'var(--color-text-muted)'
              return (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-[10px]"
                  style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${moraColor} 12%, transparent)`,
                      color: moraColor,
                      border: `1px solid color-mix(in srgb, ${moraColor} 25%, transparent)`,
                    }}
                  >
                    {c.diasSinCobro}d sin cobro
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.clientesMora?.length === 0 && (
        <div className="rounded-[16px] px-4 py-5 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>Sin clientes en mora</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Tu cartera está al día</p>
        </div>
      )}
    </div>
  )
}
