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

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Gastos menores</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Aprobar, rechazar y revisar gastos reportados por tus cobradores</p>
      </div>

      {/* Tabs estado */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'px-4 py-2 rounded-full border text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.key
                ? 'bg-white text-black border-white'
                : 'bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Fecha (opcional)</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={fecha}
              max={getColombiaDateStr()}
              onChange={(e) => setFecha(e.target.value)}
              className="flex-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[10px] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            {fecha && (
              <button
                type="button"
                onClick={() => setFecha('')}
                className="px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-[10px]"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
        {cobradores.length > 0 && (
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Cobrador</label>
            <select
              value={cobradorId}
              onChange={(e) => setCobradorId(e.target.value)}
              className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[10px] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Todos</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end">
          <Card className="w-full">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Total mostrado</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] font-mono-display">{formatCOP(totales.suma)}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{totales.cantidad} gasto{totales.cantidad === 1 ? '' : 's'}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <SkeletonCard />
      ) : gastos.length === 0 ? (
        <Card>
          <div className="text-center py-6">
            <p className="text-sm text-[var(--color-text-muted)]">No hay gastos {TABS.find(t => t.key === tab)?.label.toLowerCase()}</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {gastos.map((g) => (
            <div key={g.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] p-4">
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{g.description}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {g.cobradorNombre || 'Owner'} • {fmtFecha(g.fecha)}
                  </p>
                </div>
                <p className="text-sm font-bold text-[var(--color-text-primary)] font-mono-display whitespace-nowrap">{formatCOP(g.monto)}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={[
                  'text-xs px-2 py-1 rounded-full border',
                  ESTADO_COLORS[g.estado] || ESTADO_COLORS.pendiente,
                ].join(' ')}>
                  {g.estado.charAt(0).toUpperCase() + g.estado.slice(1)}
                </span>
                <div className="flex items-center gap-2">
                  {g.estado === 'pendiente' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={procesando === g.id}
                        onClick={() => handleAccion(g, 'rechazado')}
                      >
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        disabled={procesando === g.id}
                        onClick={() => handleAccion(g, 'aprobado')}
                      >
                        Aprobar
                      </Button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleEliminar(g)}
                    disabled={procesando === g.id}
                    title="Eliminar gasto"
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] disabled:opacity-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
