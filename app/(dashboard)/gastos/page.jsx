'use client'
// app/(dashboard)/gastos/page.jsx — Gastos unificados: Gastos del día + Capital

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCOP } from '@/lib/calculos'
import CapitalTab from '@/components/capital/CapitalTab'

const ESTADO_COLORS = {
  pendiente: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
  aprobado: 'bg-[var(--color-success-dim)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
  rechazado: 'bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
}

const ESTADO_TABS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'rechazado', label: 'Rechazados' },
]

const PAGE_TABS = [
  {
    key: 'dia',
    label: 'Gastos del día',
    desc: 'Reportes de cobradores',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25M6.75 12h.008v.008H6.75V12z" />
      </svg>
    ),
  },
  {
    key: 'capital',
    label: 'Capital',
    desc: 'Saldo y movimientos',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
]

const TAB_COLORS = {
  pendiente:  { color: '#f59e0b', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  aprobado:   { color: '#22c55e', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> },
  rechazado:  { color: '#ef4444', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> },
}

const getColombiaDateStr = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

const fmtFecha = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export default function GastosPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()

  // Tab de página: 'dia' | 'capital'
  const [pageTab, setPageTab] = useState(() => {
    const t = searchParams?.get('tab')
    return t === 'capital' ? 'capital' : 'dia'
  })

  // Tab de estado dentro de "Gastos del día"
  const [estadoTab, setEstadoTab] = useState('pendiente')
  const [fecha, setFecha] = useState('')
  const [cobradorId, setCobradorId] = useState('')
  const [cobradores, setCobradores] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(null)

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estadoTab) params.set('estado', estadoTab)
      if (fecha) params.set('fecha', fecha)
      if (cobradorId) params.set('cobrador', cobradorId)
      const res = await fetch(`/api/gastos?${params}`)
      if (!res.ok) { setGastos([]); return }
      const data = await res.json()
      setGastos(Array.isArray(data) ? data : [])
    } catch {
      setGastos([])
    } finally {
      setLoading(false)
    }
  }, [estadoTab, fecha, cobradorId])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/cobradores')
      .then(r => r.ok ? r.json() : [])
      .then(d => setCobradores(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [esOwner])

  useEffect(() => {
    if (pageTab === 'dia') fetchGastos()
  }, [fetchGastos, pageTab])

  const totales = useMemo(() => {
    const suma = gastos.reduce((a, g) => a + (g.monto || 0), 0)
    return { cantidad: gastos.length, suma }
  }, [gastos])

  const handleAccion = async (gasto, estado) => {
    setProcesando(gasto.id)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'No se pudo actualizar')
        return
      }
      fetchGastos()
    } finally {
      setProcesando(null)
    }
  }

  const handleEliminar = async (gasto) => {
    const msg = gasto.estado === 'aprobado'
      ? `Eliminar "${gasto.description}" por ${formatCOP(gasto.monto)}? Se revertirá el egreso en capital.`
      : `Eliminar "${gasto.description}" por ${formatCOP(gasto.monto)}?`
    if (!confirm(msg)) return
    setProcesando(gasto.id)
    try {
      const res = await fetch(`/api/gastos/${gasto.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'No se pudo eliminar')
        return
      }
      fetchGastos()
    } finally {
      setProcesando(null)
    }
  }

  if (authLoading) return <div className="p-4"><SkeletonCard /></div>

  if (!esOwner) {
    return (
      <div className="p-4">
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Solo el administrador puede gestionar gastos.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Gastos</h1>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Gastos de cobradores y control de capital
        </p>
      </div>

      {/* Tabs de página: Gastos del día | Capital */}
      <div
        className="flex gap-1 p-1 rounded-[14px]"
        style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}
      >
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPageTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-[10px] text-sm font-semibold transition-all"
            style={{
              background: pageTab === t.key ? 'var(--color-bg-card)' : 'transparent',
              color: pageTab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              boxShadow: pageTab === t.key ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Contenido según tab activo */}
      {pageTab === 'capital' ? (
        <CapitalTab />
      ) : (
        <>
          {/* Tabs de estado */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ESTADO_TABS.map((t) => {
              const tabInfo = TAB_COLORS[t.key]
              const active = estadoTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setEstadoTab(t.key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
                  style={{
                    background: active ? `color-mix(in srgb, ${tabInfo.color} 18%, transparent)` : 'var(--color-bg-card)',
                    color: active ? tabInfo.color : 'var(--color-text-muted)',
                    border: `1px solid ${active ? `color-mix(in srgb, ${tabInfo.color} 35%, transparent)` : 'var(--color-border)'}`,
                  }}
                >
                  <span className="w-3 h-3" style={{ color: tabInfo.color }}>{tabInfo.icon}</span>
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Hero del total + filtros */}
          <div
            className="rounded-[16px] px-4 py-4"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
              border: `1px solid color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 22%, var(--color-border))`,
              boxShadow: `0 4px 16px color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 12%, transparent)`,
            }}
          >
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TAB_COLORS[estadoTab].color }}>
                  Total {ESTADO_TABS.find(t => t.key === estadoTab)?.label.toLowerCase()}
                </p>
                <p
                  className="font-mono-display font-bold leading-none mt-1"
                  style={{
                    color: TAB_COLORS[estadoTab].color,
                    fontSize: 'clamp(24px, 6vw, 32px)',
                    textShadow: `0 0 24px color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 25%, transparent)`,
                  }}
                >
                  {formatCOP(totales.suma)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {totales.cantidad} {totales.cantidad === 1 ? 'gasto' : 'gastos'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 15%, transparent)` }}>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={fecha}
                  max={getColombiaDateStr()}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-8 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
                {fecha && (
                  <button type="button" onClick={() => setFecha('')}
                    className="text-[10px] px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>
                    Limpiar
                  </button>
                )}
              </div>
              {cobradores.length > 0 && (
                <select value={cobradorId} onChange={(e) => setCobradorId(e.target.value)}
                  className="h-8 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="">Todos los cobradores</option>
                  {cobradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Lista de gastos */}
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
          ) : gastos.length === 0 ? (
            <div className="rounded-[16px] py-10 text-center"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${TAB_COLORS[estadoTab].color} 15%, transparent)`, color: TAB_COLORS[estadoTab].color }}>
                <span className="w-6 h-6">{TAB_COLORS[estadoTab].icon}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No hay gastos {ESTADO_TABS.find(t => t.key === estadoTab)?.label.toLowerCase()}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {gastos.map((g) => {
                const eInfo = TAB_COLORS[g.estado] || TAB_COLORS.pendiente
                return (
                  <div
                    key={g.id}
                    className="rounded-[14px] px-3 py-3 transition-all kpi-lift"
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${eInfo.color} 5%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                      border: `1px solid color-mix(in srgb, ${eInfo.color} 18%, var(--color-border))`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `color-mix(in srgb, ${eInfo.color} 18%, transparent)`, color: eInfo.color, border: `1px solid color-mix(in srgb, ${eInfo.color} 30%, transparent)` }}>
                        <span className="w-5 h-5">{eInfo.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                          {g.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
                          <span style={{ color: 'var(--color-purple)' }}>{g.cobradorNombre || 'Owner'}</span>
                          <span>·</span>
                          <span>{fmtFecha(g.fecha)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[15px] font-bold font-mono-display leading-none" style={{ color: eInfo.color }}>
                          {formatCOP(g.monto)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${eInfo.color} 15%, transparent)`, color: eInfo.color, border: `1px solid color-mix(in srgb, ${eInfo.color} 25%, transparent)` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: eInfo.color }} />
                        {g.estado.charAt(0).toUpperCase() + g.estado.slice(1)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {g.estado === 'pendiente' && (
                          <>
                            <button type="button" disabled={procesando === g.id} onClick={() => handleAccion(g, 'rechazado')}
                              className="px-3 h-8 rounded-[8px] text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                              style={{ background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)' }}>
                              Rechazar
                            </button>
                            <button type="button" disabled={procesando === g.id} onClick={() => handleAccion(g, 'aprobado')}
                              className="px-3 h-8 rounded-[8px] text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 2px 8px rgba(34, 197, 94, 0.35)' }}>
                              Aprobar
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => handleEliminar(g)} disabled={procesando === g.id} title="Eliminar gasto"
                          className="w-8 h-8 flex items-center justify-center rounded-[8px] disabled:opacity-50 transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
