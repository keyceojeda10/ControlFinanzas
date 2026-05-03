'use client'
// app/(dashboard)/gastos/page.jsx — Panel de gastos para owner

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCOP } from '@/lib/calculos'

const ESTADO_COLORS = {
  pendiente: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
  aprobado: 'bg-[var(--color-success-dim)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
  rechazado: 'bg-[var(--color-danger-dim)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
}

const TABS = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'rechazado', label: 'Rechazados' },
]

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
  const [tab, setTab] = useState('pendiente')
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
      if (tab) params.set('estado', tab)
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
  }, [tab, fecha, cobradorId])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/cobradores')
      .then(r => r.ok ? r.json() : [])
      .then(d => setCobradores(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [esOwner])

  useEffect(() => { fetchGastos() }, [fetchGastos])

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

  if (authLoading) {
    return <div className="p-4"><SkeletonCard /></div>
  }

  if (!esOwner) {
    return (
      <div className="p-4">
        <Card>
          <p className="text-sm text-[var(--color-text-muted)]">Solo el administrador puede gestionar gastos.</p>
        </Card>
      </div>
    )
  }

  // Configuracion de tabs con color por estado
  const TAB_COLORS = {
    pendiente:  { color: '#f59e0b', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    aprobado:   { color: '#22c55e', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> },
    rechazado:  { color: '#ef4444', icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> },
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Gastos menores</h1>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Aprobar, rechazar y revisar gastos reportados por tus cobradores
        </p>
      </div>

      {/* Tabs estado con mood color */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const tabInfo = TAB_COLORS[t.key]
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tabInfo.color} 18%, transparent)`
                  : 'var(--color-bg-card)',
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
          background: `linear-gradient(135deg, color-mix(in srgb, ${TAB_COLORS[tab].color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
          border: `1px solid color-mix(in srgb, ${TAB_COLORS[tab].color} 22%, var(--color-border))`,
          boxShadow: `0 4px 16px color-mix(in srgb, ${TAB_COLORS[tab].color} 12%, transparent)`,
        }}
      >
        <div className="flex items-end justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TAB_COLORS[tab].color }}>
              Total {TABS.find(t => t.key === tab)?.label.toLowerCase()}
            </p>
            <p
              className="font-mono-display font-bold leading-none mt-1"
              style={{
                color: TAB_COLORS[tab].color,
                fontSize: 'clamp(24px, 6vw, 32px)',
                textShadow: `0 0 24px color-mix(in srgb, ${TAB_COLORS[tab].color} 25%, transparent)`,
              }}
            >
              {formatCOP(totales.suma)}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {totales.cantidad} {totales.cantidad === 1 ? 'gasto' : 'gastos'}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${TAB_COLORS[tab].color} 15%, transparent)` }}>
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
              <button
                type="button"
                onClick={() => setFecha('')}
                className="text-[10px] px-2 py-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Limpiar
              </button>
            )}
          </div>
          {cobradores.length > 0 && (
            <select
              value={cobradorId}
              onChange={(e) => setCobradorId(e.target.value)}
              className="h-8 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Todos los cobradores</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : gastos.length === 0 ? (
        <div
          className="rounded-[16px] py-10 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${TAB_COLORS[tab].color} 15%, transparent)`, color: TAB_COLORS[tab].color }}
          >
            <span className="w-6 h-6">{TAB_COLORS[tab].icon}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No hay gastos {TABS.find(t => t.key === tab)?.label.toLowerCase()}
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
                  {/* Icono circular del estado */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${eInfo.color} 18%, transparent)`,
                      color: eInfo.color,
                      border: `1px solid color-mix(in srgb, ${eInfo.color} 30%, transparent)`,
                    }}
                  >
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

                {/* Acciones */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${eInfo.color} 15%, transparent)`,
                      color: eInfo.color,
                      border: `1px solid color-mix(in srgb, ${eInfo.color} 25%, transparent)`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: eInfo.color }} />
                    {g.estado.charAt(0).toUpperCase() + g.estado.slice(1)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {g.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          disabled={procesando === g.id}
                          onClick={() => handleAccion(g, 'rechazado')}
                          className="px-3 h-8 rounded-[8px] text-[11px] font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                          style={{
                            background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
                            color: 'var(--color-danger)',
                            border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
                          }}
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={procesando === g.id}
                          onClick={() => handleAccion(g, 'aprobado')}
                          className="px-3 h-8 rounded-[8px] text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                          style={{
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff',
                            boxShadow: '0 2px 8px rgba(34, 197, 94, 0.35)',
                          }}
                        >
                          Aprobar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleEliminar(g)}
                      disabled={procesando === g.id}
                      title="Eliminar gasto"
                      className="w-8 h-8 flex items-center justify-center rounded-[8px] disabled:opacity-50 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
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
    </div>
  )
}
