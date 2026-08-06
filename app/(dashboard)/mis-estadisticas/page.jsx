'use client'
// app/(dashboard)/mis-estadisticas/page.jsx — Estadísticas propias del cobrador

import { formatMoney } from '@/lib/i18n'
import { useCabecera } from '@/components/armazon/Armazon'
import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { SkeletonCard }        from '@/components/ui/Skeleton'

function fmtFechaCorta(yyyy_mm_dd) {
  const [, m, d] = yyyy_mm_dd.split('-')
  const meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${parseInt(d)} ${meses[parseInt(m)]}`
}

export default function MisEstadisticasPage() {
  useCabecera({ titulo: 'Mi resumen' })

  const { session, loading: authLoading } = useAuth()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (authLoading) return
    // Hay que apagar `loading` tambien cuando NO se va a pedir nada. Sin esto la
    // pantalla se quedaba en el skeleton para siempre para cualquiera que no
    // fuera cobrador: la guarda de abajo devuelve el skeleton mientras `loading`
    // siga en true, asi que el mensaje "Esta pagina es solo para cobradores"
    // era codigo inalcanzable justo para quienes estaba escrito.
    if (session?.user?.rol !== 'cobrador') { setLoading(false); return }

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
      <div className="max-w-xl mx-auto mt-8 text-center" style={{ color: 'var(--cf-ink-3)' }}>
        Esta página es solo para cobradores.
      </div>
    )
  }

  if (error) {
    return (
      <div className="cf-card-shadow max-w-xl mx-auto mt-6 rounded-[20px] px-4 py-3 text-sm"
        style={{ background: 'var(--cf-red-pill-bg)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
      >
        {error}
      </div>
    )
  }

  const pctColor = data.pctMeta >= 90 ? 'var(--cf-green-dark)' : data.pctMeta >= 60 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)'
  const maxSemana = Math.max(...(data.semana?.map((d) => d.total) ?? [1]), 1)

  return (
    <div className="max-w-xl lg:max-w-4xl mx-auto space-y-5">
      <div>
        {/* Titulo en la cabecera; debajo se queda la ruta y sus clientes,
            que es lo que la cabecera no sabe. */}
        {data.rutaNombre && (
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
            Ruta: {data.rutaNombre} · {data.totalClientesActivos} clientes activos
          </p>
        )}
      </div>

      {/* ── Hoy: recaudado vs meta ── */}
      <div className="cf-card-shadow rounded-[20px] px-5 py-5"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${pctColor} 12%, var(--cf-card)) 0%, var(--cf-card) 100%)`,
          border: `1px solid color-mix(in srgb, ${pctColor} 22%, var(--cf-border))`,
        }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-3" style={{ color: 'var(--cf-ink-3)' }}>Hoy</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Recaudado</p>
            <p className="text-[32px] font-bold font-mono-display leading-none" style={{ color: pctColor }}>
              {formatMoney(data.recaudadoHoy)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Meta</p>
            <p className="text-[20px] font-bold font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
              {formatMoney(data.metaHoy)}
            </p>
          </div>
        </div>
        {/* Barra progreso */}
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.min(100, data.pctMeta)}%`,
              background: `linear-gradient(90deg, color-mix(in srgb, ${pctColor} 60%, transparent), ${pctColor})`,
            }}
          />
        </div>
        <p className="text-[11px] mt-1.5 font-semibold" style={{ color: pctColor }}>{data.pctMeta}% de la meta</p>
      </div>

      {/* ── Últimos 7 días ── */}
      <div className="cf-card-shadow rounded-[20px] px-4 py-4"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-4" style={{ color: 'var(--cf-ink-3)' }}>Últimos 7 días</p>
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
                        ? 'var(--cf-gold)'
                        : 'color-mix(in srgb, var(--cf-gold) 40%, transparent)',
                    }}
                    title={formatMoney(d.total)}
                  />
                </div>
                <p className="text-[11px] text-center leading-tight" style={{ color: isHoy ? 'var(--cf-gold)' : 'var(--cf-ink-3)' }}>
                  {fmtFechaCorta(d.fecha)}
                </p>
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t flex justify-between text-[11px]" style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink-3)' }}>
          <span>Total semana</span>
          <span className="font-semibold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
            {formatMoney(data.semana?.reduce((s, d) => s + d.total, 0) ?? 0)}
          </span>
        </div>
      </div>

      {/* ── Clientes en mora en mi ruta ── */}
      {data.clientesMora?.length > 0 && (
        <div className="cf-card-shadow rounded-[20px] px-4 py-4"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-3" style={{ color: 'var(--cf-ink-3)' }}>
            Mi cartera en mora ({data.clientesMora.length})
          </p>
          <div className="space-y-2">
            {data.clientesMora.map((c, i) => {
              const moraColor = c.diasMora > 30 ? 'var(--cf-red-dark)' : c.diasMora > 14 ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)'
              return (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-[12px]"
                  style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--cf-ink)' }}>{c.nombre}</p>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${moraColor} 12%, transparent)`,
                      color: moraColor,
                      border: `1px solid color-mix(in srgb, ${moraColor} 25%, transparent)`,
                    }}
                  >
                    {c.diasMora}d en mora
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.clientesMora?.length === 0 && (
        <div className="cf-card-shadow rounded-[20px] px-4 py-5 text-center"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--cf-green-dark)' }}>Sin clientes en mora</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>Tu cartera está al día</p>
        </div>
      )}
    </div>
  )
}
