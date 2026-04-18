'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { Card }                from '@/components/ui/Card'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const MrrTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-[var(--color-success)] font-bold font-mono-display">{formatCOP(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null)
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/suscripciones?estado=porVencer'),
        ])
        const [s, a] = await Promise.all([sRes.json(), aRes.json()])
        setStats(s)
        setAlertas(Array.isArray(a) ? a : [])
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!stats) return <p className="text-[var(--color-danger)] text-sm">Error cargando estadísticas</p>

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Dashboard</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Vista general de la plataforma</p>
      </div>

      {/* Fila 1 — KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'MRR',               value: formatCOP(stats.mrr),       color: 'var(--color-success)', mono: true  },
          { label: 'Orgs activas',       value: stats.totalOrgs,            color: 'var(--color-info)', mono: false },
          { label: 'Por vencer (7d)',    value: stats.suscPorVencer,        color: 'var(--color-warning)', mono: false },
          { label: 'Vencidas',           value: stats.suscVencidas,         color: stats.suscVencidas > 0 ? 'var(--color-danger)' : '#888888', mono: false },
        ].map(({ label, value, color, mono }) => (
          <div
            key={label}
            className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
            style={{
              background: `linear-gradient(135deg, ${color}0A 0%, #1a1a1a 40%, #1a1a1a 70%, ${color}05 100%)`,
              boxShadow: `0 0 30px ${color}08, 0 1px 2px rgba(0,0,0,0.3)`,
            }}
          >
            <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
            <p className={`text-base font-bold mt-0.5${mono ? ' font-mono-display' : ''}`} style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Fila 2 — Distribución de planes */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { plan: 'Inicial',      ...stats.planes.starter,      color: '#888888' },
          { plan: 'Basico',       ...stats.planes.basic,        color: '#3b82f6' },
          { plan: 'Crecimiento',  ...stats.planes.growth,       color: 'var(--color-accent)' },
          { plan: 'Profesional',  ...stats.planes.standard,     color: 'var(--color-purple)' },
          { plan: 'Empresarial',  ...stats.planes.professional, color: 'var(--color-success)' },
        ].map(({ plan, cantidad, mrr, color }) => (
          <div key={plan} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-[var(--color-text-muted)]">{plan}</span>
            </div>
            <p className="text-lg font-bold text-[white]">{cantidad}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">MRR: <span className="font-mono-display">{formatCOP(mrr)}</span></p>
          </div>
        ))}
      </div>

      {/* Fila 3 — Gráfico MRR últimos 6 meses */}
      <Card>
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">MRR — Últimos 6 meses</p>
        {stats.mrrHistorico?.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.mrrHistorico} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#555555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MrrTooltip />} />
              <Line type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2} dot={{ fill: 'var(--color-success)', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin datos</p>
        )}
      </Card>

      {/* Fila 4 — Métricas globales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)]">Total clientes</p>
          <p className="text-lg font-bold text-[white]">{stats.totalClientes}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 text-center">
          <p className="text-[10px] text-[var(--color-text-muted)]">Préstamos activos</p>
          <p className="text-lg font-bold text-[var(--color-info)]">{stats.prestamosActivos}</p>
        </div>
        <div
          className="border border-[var(--color-border)] rounded-[12px] px-4 py-3 text-center"
          style={{
            background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
            boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Cartera total</p>
          <p className="text-lg font-bold text-[var(--color-success)] font-mono-display">{formatCOP(stats.carteraTotal)}</p>
        </div>
      </div>

      {/* Fila 5 — Alertas: suscripciones por vencer */}
      {alertas.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide mb-3">
            Suscripciones por vencer
          </p>
          <div className="space-y-2">
            {alertas.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[white]">{a.organizacion}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Vence en {a.diasRestantes} día{a.diasRestantes !== 1 ? 's' : ''}
                  </p>
                </div>
                <Link
                  href={`/admin/organizaciones/${a.organizacionId}`}
                  className="text-xs font-medium text-[var(--color-info)] hover:underline"
                >
                  Gestionar
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Nuevas orgs este mes */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)]">Nuevas organizaciones este mes</p>
          <p className="text-lg font-bold text-[var(--color-purple)]">{stats.orgsNuevas}</p>
        </div>
        <Link href="/admin/organizaciones" className="text-xs text-[var(--color-info)] hover:underline">
          Ver todas
        </Link>
      </div>
    </div>
  )
}
