'use client'

import { useState, useEffect } from 'react'
import { Card }                from '@/components/ui/Card'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const PRECIOS = { basic: 80000, standard: 150000, professional: 250000 }
const COLORES = { basic: '#888888', standard: '#3b82f6', professional: '#a855f7' }

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, oRes, subRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/organizaciones'),
          fetch('/api/admin/suscripciones'),
        ])
        const [s, o, sub] = await Promise.all([sRes.json(), oRes.json(), subRes.json()])
        setStats(s)
        setOrgs(Array.isArray(o) ? o : [])
        setSubs(Array.isArray(sub) ? sub : [])
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
    let basic = 0, standard = 0, professional = 0
    for (const o of orgs) {
      if (new Date(o.createdAt) <= new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)) {
        if (o.plan === 'basic') basic += PRECIOS.basic
        else if (o.plan === 'standard') standard += PRECIOS.standard
        else professional += PRECIOS.professional
      }
    }
    mrrPorMes.push({ mes: label, basic, standard, professional })
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
    { name: 'Basic',        value: stats.planes.basic.cantidad,        color: COLORES.basic },
    { name: 'Standard',     value: stats.planes.standard.cantidad,     color: COLORES.standard },
    { name: 'Professional', value: stats.planes.professional.cantidad, color: COLORES.professional },
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
    </div>
  )
}
