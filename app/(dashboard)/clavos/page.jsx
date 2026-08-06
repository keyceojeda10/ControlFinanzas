'use client'
// app/(dashboard)/clavos/page.jsx - Contabilidad aparte de tarjetas clavo

import { useState, useEffect, useMemo } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import Link from 'next/link'
import { useCountry } from '@/hooks/useCountry'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ORDEN_OPTS = [
  { value: 'fecha', label: 'Más reciente' },
  { value: 'saldo', label: 'Mayor saldo' },
  { value: 'monto', label: 'Mayor monto' },
]

export default function ClavosPage() {
  useCabecera({ titulo: 'Préstamos perdidos', subtitulo: 'Préstamos que separaste de tu cartera. Si el cliente paga algo, se registra aquí.' })

  const { formatMoney } = useCountry()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rutaFiltro, setRutaFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [orden, setOrden] = useState('fecha')
  const [showFiltros, setShowFiltros] = useState(false)

  useEffect(() => {
    fetch('/api/clavos')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: true, items: [] }))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = useMemo(() => {
    if (!data?.items) return []
    let items = [...data.items]
    if (rutaFiltro) items = items.filter(it => it.rutaId === rutaFiltro)
    if (tipoFiltro === 'perdida') items = items.filter(it => it.clavoPerdida)
    if (tipoFiltro === 'activo') items = items.filter(it => !it.clavoPerdida)
    if (orden === 'saldo') items.sort((a, b) => b.saldoPendiente - a.saldoPendiente)
    else if (orden === 'monto') items.sort((a, b) => b.montoPrestado - a.montoPrestado)
    return items
  }, [data, rutaFiltro, tipoFiltro, orden])

  const stats = useMemo(() => {
    const total = filtrados.length
    const capitalEnClavos = filtrados.reduce((a, it) => a + (it.montoPrestado || 0), 0)
    const saldoEnClavos = filtrados.reduce((a, it) => a + (it.saldoPendiente || 0), 0)
    const recuperado = filtrados.reduce((a, it) => a + (it.recuperado || 0), 0)
    return { total, capitalEnClavos, saldoEnClavos, recuperado }
  }, [filtrados])

  const hayFiltros = rutaFiltro || tipoFiltro || orden !== 'fecha'
  const numFiltrosActivos = [rutaFiltro, tipoFiltro, orden !== 'fecha'].filter(Boolean).length

  if (loading) {
    return <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-3"><SkeletonCard /><SkeletonCard /></div>
  }
  if (!data || data.error) {
    return <p className="text-sm text-[var(--cf-red-dark)]">No se pudieron cargar los préstamos perdidos</p>
  }

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto space-y-5">
      {/* Titulo y subtitulo, en la cabecera del armazon y en un solo sitio. */}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Clavos', value: stats.total, color: 'var(--cf-red-dark)' },
          { label: 'Capital prestado', value: formatMoney(stats.capitalEnClavos), color: 'var(--cf-gold-dark)' },
          { label: 'Saldo pendiente', value: formatMoney(stats.saldoEnClavos), color: 'var(--cf-gold)' },
          { label: 'Recuperado', value: formatMoney(stats.recuperado), color: 'var(--cf-green-dark)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-[var(--cf-border)] rounded-[12px] px-3 py-3 text-center bg-[var(--cf-card)]">
            <p className="text-[10px] text-[var(--cf-ink-3)]">{label}</p>
            <p className="font-mono-display text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros avanzados */}
      <div>
        <button
          type="button"
          onClick={() => setShowFiltros(!showFiltros)}
          className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
          style={{ color: hayFiltros ? 'var(--cf-gold)' : 'var(--cf-ink-3)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros avanzados
          {numFiltrosActivos > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[11px] font-bold" style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
              {numFiltrosActivos}
            </span>
          )}
          <svg className={`w-3 h-3 transition-transform ${showFiltros ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFiltros && (
          <div className="mt-3 space-y-3 p-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)]">
            {/* Filtro por ruta */}
            {data.rutas && data.rutas.length > 1 && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Ruta</label>
                <select
                  value={rutaFiltro}
                  onChange={e => setRutaFiltro(e.target.value)}
                  className="mt-1 w-full h-9 px-2.5 rounded-lg border text-sm bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-ink)]"
                >
                  <option value="">Todas las rutas</option>
                  {data.rutas.map(r => {
                    const count = data.items.filter(it => it.rutaId === r.id).length
                    return <option key={r.id} value={r.id}>{r.nombre} ({count})</option>
                  })}
                </select>
              </div>
            )}

            {/* Filtro por tipo */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Estado</label>
              <div className="flex gap-1.5 mt-1">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'activo', label: 'En cobro' },
                  { value: 'perdida', label: 'Pérdida total' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTipoFiltro(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={tipoFiltro === opt.value
                      ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
                      : { background: 'var(--cf-surface)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }
                    }
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Ordenar por */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Ordenar por</label>
              <div className="flex gap-1.5 mt-1">
                {ORDEN_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrden(opt.value)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={orden === opt.value
                      ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
                      : { background: 'var(--cf-surface)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }
                    }
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Limpiar filtros */}
            {hayFiltros && (
              <button
                type="button"
                onClick={() => { setRutaFiltro(''); setTipoFiltro(''); setOrden('fecha') }}
                className="text-[11px] font-medium text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resumen por ruta (cuando no hay filtro de ruta) */}
      {!rutaFiltro && data.rutas && data.rutas.length > 1 && (
        <div className="border border-[var(--cf-border)] rounded-[12px] bg-[var(--cf-card)] divide-y divide-[var(--cf-border)]">
          <p className="px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[.07em] text-[var(--cf-ink-3)]">Por ruta</p>
          {data.rutas.map(r => {
            const rutaItems = data.items.filter(it => it.rutaId === r.id)
            const saldo = rutaItems.reduce((a, it) => a + it.saldoPendiente, 0)
            const capital = rutaItems.reduce((a, it) => a + it.montoPrestado, 0)
            return (
              <button
                key={r.id}
                onClick={() => { setRutaFiltro(r.id); setShowFiltros(true) }}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[rgba(255,255,255,0.03)] transition-all text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--cf-ink)]">{r.nombre}</p>
                  <p className="text-[10px] text-[var(--cf-ink-3)]">{rutaItems.length} clavo{rutaItems.length !== 1 ? 's' : ''} · capital {formatMoney(capital)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono-display text-sm font-semibold text-[var(--cf-gold)]">{formatMoney(saldo)}</p>
                  <p className="text-[10px] text-[var(--cf-ink-3)]">pendiente</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Lista */}
      <div className="border border-[var(--cf-border)] rounded-[12px] bg-[var(--cf-card)] divide-y divide-[var(--cf-border)]">
        {hayFiltros && (
          <p className="px-4 py-2 text-[11px] text-[var(--cf-ink-3)]">
            {filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}
            {rutaFiltro && data.rutas ? ` en ${data.rutas.find(r => r.id === rutaFiltro)?.nombre || 'ruta'}` : ''}
          </p>
        )}
        {filtrados.length === 0 && (
          <p className="px-4 py-8 text-sm text-[var(--cf-ink-3)] text-center">
            {hayFiltros ? 'No hay clavos con estos filtros.' : 'No tienes préstamos perdidos. Cuando apartes un préstamo de tu cartera, aparece aquí.'}
          </p>
        )}
        {filtrados.map(it => (
          <Link
            key={it.id}
            href={`/prestamos/${it.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-all"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-[var(--cf-ink)] truncate">{it.cliente}</p>
                {it.clavoPerdida && (
                  <span className="shrink-0 text-[11px] font-semibold px-1.5 py-px rounded-full bg-[color-mix(in_srgb,var(--cf-red-dark)_15%,transparent)] text-[var(--cf-red-dark)] border border-[color-mix(in_srgb,var(--cf-red-dark)_25%,transparent)]">
                    Pérdida
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--cf-ink-3)]">
                {it.ruta} · prestó {formatMoney(it.montoPrestado)}
                {it.recuperado > 0 ? ` · recuperó ${formatMoney(it.recuperado)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono-display text-sm font-semibold text-[var(--cf-gold)]">{formatMoney(it.saldoPendiente)}</p>
              <p className="text-[10px] text-[var(--cf-ink-3)]">debe</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
