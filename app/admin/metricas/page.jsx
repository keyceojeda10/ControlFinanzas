'use client'

import { useState, useEffect } from 'react'
import { Card }                from '@/components/ui/Card'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PRECIOS = { basic: 59000, growth: 79000, standard: 119000, professional: 259000 }
const COLORES = { basic: '#888888', growth: '#3b82f6', standard: '#f5c518', professional: '#a855f7' }

const CopTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[#888888] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold font-mono-display" style={{ color: p.color }}>{p.name}: {formatCOP(p.value)}</p>
      ))}
    </div>
  )
}

const NumTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[#888888] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function MetricasPage() {
  const [stats,   setStats]   = useState(null)
  const [orgs,    setOrgs]    = useState([])
  const [subs,    setSubs]    = useState([])
  const [uso,     setUso]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, oRes, subRes, uRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/organizaciones'),
          fetch('/api/admin/suscripciones'),
          fetch('/api/admin/metricas/uso'),
        ])
        const [s, o, sub] = await Promise.all([sRes.json(), oRes.json(), subRes.json()])
        setStats(s)
        setOrgs(Array.isArray(o) ? o : [])
        setSubs(Array.isArray(sub) ? sub : [])
        if (uRes.ok) setUso(await uRes.json())
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

  if (!stats) return <p className="text-[#ef4444] text-sm">Error cargando métricas</p>

  const ahora = new Date()

  // 1. MRR por mes (últimos 12 meses)
  const mrrPorMes = []
  for (let i = 11; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const label = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    let basic = 0, growth = 0, standard = 0, professional = 0
    for (const o of orgs) {
      if (new Date(o.createdAt) <= new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)) {
        if (o.plan === 'basic') basic += PRECIOS.basic
        else if (o.plan === 'growth') growth += PRECIOS.growth
        else if (o.plan === 'standard') standard += PRECIOS.standard
        else professional += PRECIOS.professional
      }
    }
    mrrPorMes.push({ mes: label, basic, growth, standard, professional })
  }

  // 2. Crecimiento de orgs por mes
  const crecimiento = []
  for (let i = 11; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
    const label = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    const nuevas = orgs.filter((o) => {
      const d = new Date(o.createdAt)
      return d.getMonth() === fecha.getMonth() && d.getFullYear() === fecha.getFullYear()
    }).length
    const total = orgs.filter((o) => new Date(o.createdAt) <= finMes).length
    crecimiento.push({ mes: label, nuevas, total })
  }

  // 3. Distribución de planes
  const planDist = [
    { name: 'Basico',       value: stats.planes.basic?.cantidad || 0,        color: COLORES.basic },
    { name: 'Crecimiento',  value: stats.planes.growth?.cantidad || 0,       color: COLORES.growth },
    { name: 'Profesional',  value: stats.planes.standard?.cantidad || 0,     color: COLORES.standard },
    { name: 'Empresarial',  value: stats.planes.professional?.cantidad || 0, color: COLORES.professional },
  ].filter((p) => p.value > 0)

  // 4. Churn mensual
  const churn = []
  for (let i = 11; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const label = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    const canceladas = subs.filter((s) => {
      if (s.estado !== 'cancelada') return false
      const d = new Date(s.fechaVencimiento)
      return d.getMonth() === fecha.getMonth() && d.getFullYear() === fecha.getFullYear()
    }).length
    churn.push({ mes: label, canceladas })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Métricas de negocio</h1>
        <p className="text-sm text-[#555555] mt-0.5">Análisis detallado de la plataforma</p>
      </div>

      {/* MRR por mes — barras apiladas */}
      <Card style={{
        background: 'linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 40%, #1a1a1a 70%, #22c55e05 100%)',
        boxShadow: '0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)',
      }}>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">MRR por mes — Últimos 12 meses</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={mrrPorMes} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CopTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555555' }} />
            <Bar dataKey="basic" name="Basic" stackId="a" fill={COLORES.basic} />
            <Bar dataKey="standard" name="Standard" stackId="a" fill={COLORES.standard} />
            <Bar dataKey="professional" name="Professional" stackId="a" fill={COLORES.professional} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Crecimiento de organizaciones */}
      <Card style={{
        background: 'linear-gradient(135deg, #06b6d40A 0%, #1a1a1a 40%, #1a1a1a 70%, #06b6d405 100%)',
        boxShadow: '0 0 30px #06b6d408, 0 1px 2px rgba(0,0,0,0.3)',
      }}>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Crecimiento de organizaciones</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={crecimiento} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<NumTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#555555' }} />
            <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="nuevas" name="Nuevas" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Distribución de planes — dona */}
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Distribución de planes</p>
          {planDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={planDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                >
                  {planDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span className="text-[#888888]">{value}</span>}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10, fontSize: 12 }}
                  itemStyle={{ color: 'white' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[#555555] text-center py-8">Sin datos</p>
          )}
        </Card>

        {/* Churn mensual */}
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Churn mensual</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={churn} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<NumTooltip />} />
              <Bar dataKey="canceladas" name="Canceladas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Uso del producto ─────────────────────────────── */}
      {uso && (
        <>
          <div className="pt-4">
            <h2 className="text-lg font-bold text-white">Uso del producto</h2>
            <p className="text-xs text-[#555555] mt-0.5">Usuarios activos y features más usados</p>
          </div>

          {/* DAU/WAU/MAU */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'DAU', value: uso.dau, color: '#22c55e' },
              { label: 'WAU', value: uso.wau, color: '#3b82f6' },
              { label: 'MAU', value: uso.mau, color: '#a855f7' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{
                background: `linear-gradient(135deg, ${color}0A 0%, #1a1a1a 40%, #1a1a1a 70%, ${color}05 100%)`,
                boxShadow: `0 0 20px ${color}08`,
              }}>
                <p className="text-[10px] text-[#555555] uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-white font-mono-display mt-1">{value}</p>
              </Card>
            ))}
          </div>

          {/* DAU trend */}
          <Card style={{
            background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
            boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
          }}>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Usuarios activos diarios — Últimos 14 días</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={uso.dailyTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#555555', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<NumTooltip />} />
                <Line type="monotone" dataKey="usuarios" name="Usuarios" stroke="#f5c518" strokeWidth={2} dot={{ r: 3, fill: '#f5c518' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Top features */}
            <Card>
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">Features más usados</p>
              <div className="space-y-2">
                {uso.topFeatures.map((f) => (
                  <div key={f.evento} className="flex items-center justify-between">
                    <span className="text-xs text-[#999]">{f.evento}</span>
                    <span className="text-xs font-bold text-white font-mono-display">{f.count}</span>
                  </div>
                ))}
                {uso.topFeatures.length === 0 && <p className="text-xs text-[#555]">Sin datos aún</p>}
              </div>
            </Card>

            {/* Top pages */}
            <Card>
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">Páginas más visitadas</p>
              <div className="space-y-2">
                {uso.topPages.map((p) => (
                  <div key={p.pagina} className="flex items-center justify-between">
                    <span className="text-xs text-[#999]">{p.pagina}</span>
                    <span className="text-xs font-bold text-white font-mono-display">{p.count}</span>
                  </div>
                ))}
                {uso.topPages.length === 0 && <p className="text-xs text-[#555]">Sin datos aún</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
