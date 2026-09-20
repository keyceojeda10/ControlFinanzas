'use client'
// app/(dashboard)/mis-estadisticas/page.jsx — Estadísticas propias del cobrador

import { formatMoney } from '@/lib/i18n'
import { useCabecera } from '@/components/armazon/Armazon'
import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { BloqueOscuro, BarraProgreso } from '@/components/cf/primitivos'

function fmtFechaCorta(yyyy_mm_dd) {
  const [, m, d] = yyyy_mm_dd.split('-')
  // En minúscula y «sept», como el resto de la app («19 sept»): salía «19 Sep».
  const meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
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

      {/* ── Hoy ──
          ⚠ ERA UNA TARJETA ROSADA CON DEGRADADO, la cifra en ROJO y «6% de la meta»:
          a las ocho de la mañana todo cobrador sale en rojo, y eso no es una
          alarma, es que el día acaba de empezar. Y decía «Meta $815.067» donde su
          inicio dice «de $520.000 que toca cobrar» (19 sep 2026). Ahora es el
          bloque del sistema, con las mismas palabras que el inicio y la misma
          cifra. «Cobraste tú»: aquí solo cuentan los pagos que registró él. */}
      <BloqueOscuro etiqueta="Cobraste tú hoy" cifra={formatMoney(data.recaudadoHoy)}>
        <BarraProgreso porcentaje={Math.min(100, data.pctMeta)} tono="oro" alto={11} sobreOscuro />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -4 }}>
          <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2' }}>
            de {formatMoney(data.metaHoy)} que toca cobrar
          </span>
          <span className="cf-num" style={{ fontSize: 13, fontWeight: 700, color: '#F5B824', flex: 'none' }}>
            {Math.min(100, data.pctMeta)}%
          </span>
        </div>
      </BloqueOscuro>

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
