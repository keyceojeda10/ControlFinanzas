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
    <div className="bg-[#1c2333] border border-[#2a3245] rounded-[10px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[#94a3b8] mb-1">{label}</p>
      <p className="text-[#10b981] font-bold">{formatCOP(payload[0]?.value ?? 0)}</p>
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

  if (!stats) return <p className="text-[#ef4444] text-sm">Error cargando estadísticas</p>

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#f1f5f9]">Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Vista general de la plataforma</p>
      </div>

      {/* Fila 1 — KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'MRR',               value: formatCOP(stats.mrr),       color: '#10b981' },
          { label: 'Orgs activas',       value: stats.totalOrgs,            color: '#f1f5f9' },
          { label: 'Por vencer (7d)',    value: stats.suscPorVencer,        color: '#f59e0b' },
          { label: 'Vencidas',           value: stats.suscVencidas,         color: stats.suscVencidas > 0 ? '#ef4444' : '#94a3b8' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-3 py-3 text-center">
            <p className="text-[10px] text-[#64748b]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Fila 2 — Distribución de planes */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { plan: 'Basic',        ...stats.planes.basic,        color: '#94a3b8' },
          { plan: 'Standard',     ...stats.planes.standard,     color: '#3b82f6' },
          { plan: 'Professional', ...stats.planes.professional, color: '#8b5cf6' },
        ].map(({ plan, cantidad, mrr, color }) => (
          <div key={plan} className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-[#94a3b8]">{plan}</span>
            </div>
            <p className="text-lg font-bold text-[#f1f5f9]">{cantidad}</p>
            <p className="text-[10px] text-[#64748b]">MRR: {formatCOP(mrr)}</p>
          </div>
        ))}
      </div>

      {/* Fila 3 — Gráfico MRR últimos 6 meses */}
      <Card>
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-4">MRR — Últimos 6 meses</p>
        {stats.mrrHistorico?.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.mrrHistorico} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3245" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MrrTooltip />} />
              <Line type="monotone" dataKey="mrr" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[#64748b] text-center py-8">Sin datos</p>
        )}
      </Card>

      {/* Fila 4 — Métricas globales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-4 py-3 text-center">
          <p className="text-[10px] text-[#64748b]">Total clientes</p>
          <p className="text-lg font-bold text-[#f1f5f9]">{stats.totalClientes}</p>
        </div>
        <div className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-4 py-3 text-center">
          <p className="text-[10px] text-[#64748b]">Préstamos activos</p>
          <p className="text-lg font-bold text-[#3b82f6]">{stats.prestamosActivos}</p>
        </div>
        <div className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-4 py-3 text-center">
          <p className="text-[10px] text-[#64748b]">Cartera total</p>
          <p className="text-lg font-bold text-[#10b981]">{formatCOP(stats.carteraTotal)}</p>
        </div>
      </div>

      {/* Fila 5 — Alertas: suscripciones por vencer */}
      {alertas.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[#f59e0b] uppercase tracking-wide mb-3">
            Suscripciones por vencer
          </p>
          <div className="space-y-2">
            {alertas.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-[#2a3245] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#f1f5f9]">{a.organizacion}</p>
                  <p className="text-[10px] text-[#64748b]">
                    Vence en {a.diasRestantes} día{a.diasRestantes !== 1 ? 's' : ''}
                  </p>
                </div>
                <Link
                  href={`/admin/organizaciones/${a.organizacionId}`}
                  className="text-xs font-medium text-[#3b82f6] hover:underline"
                >
                  Gestionar
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Nuevas orgs este mes */}
      <div className="bg-[#1c2333] border border-[#2a3245] rounded-[12px] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#64748b]">Nuevas organizaciones este mes</p>
          <p className="text-lg font-bold text-[#8b5cf6]">{stats.orgsNuevas}</p>
        </div>
        <Link href="/admin/organizaciones" className="text-xs text-[#3b82f6] hover:underline">
          Ver todas
        </Link>
      </div>
    </div>
  )
}
