'use client'
// app/(dashboard)/reportes/page.jsx — Reportes escalonados por plan

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import EmptyState              from '@/components/ui/EmptyState'
import { nivelReportes }       from '@/lib/planes'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

// ── Fechas helper (timezone Colombia UTC-5) ─────────────────────
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy       = () => getColombiaDate().toISOString().slice(0, 10)
const inicioMes = () => {
  const d = getColombiaDate(); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

// ── Tooltip personalizado ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-2 text-xs shadow-xl">
      <p className="text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className="text-[var(--color-success)] font-bold">{formatMoney(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ── Gate de plan ───────────────────────────────────────────────
function PlanGate() {
  const features = [
    { label: 'Ingresos diario / semanal / mensual', color: '#22c55e' },
    { label: 'Cobros programados por mes', color: '#f59e0b' },
    { label: 'Rendimiento por cobrador', color: '#a855f7' },
    { label: 'Cartera y analisis por ruta', color: '#06b6d4' },
    { label: 'Exportar a PDF y Excel', color: 'var(--color-danger)' },
  ]
  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>Reportes</h1>
      <div className="rounded-[16px] p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border))',
        }}
      >
        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
        >
          <svg className="w-7 h-7" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>Reportes y analisis</p>
        <p className="text-[13px] mb-5" style={{ color: 'var(--color-text-muted)' }}>
          Visualiza el rendimiento de tu negocio con datos en tiempo real.
        </p>
        <div className="inline-flex flex-col gap-2.5 text-left mb-5">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-2.5">
              <div className="w-4 h-4 rounded-[6px] flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${f.color} 18%, transparent)` }}
              >
                <svg className="w-2.5 h-2.5" style={{ color: f.color }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>{f.label}</span>
            </div>
          ))}
        </div>
        <a
          href="/configuracion/plan"
          className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-[12px] transition-all"
          style={{
            background: 'var(--color-accent)',
            color: '#111',
          }}
        >
          Ver planes
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>
    </div>
  )
}

// ── Nudge de upgrade para secciones bloqueadas ─────────────────
function UpgradeNudge({ titulo, planRequerido }) {
  const labelPlan = planRequerido === 'standard' ? 'Profesional' : 'Empresarial'
  return (
    <div className="rounded-[16px] px-4 py-4 flex items-center gap-3"
      style={{
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 5%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)',
        border: '1px solid color-mix(in srgb, var(--color-accent) 12%, var(--color-border))',
      }}
    >
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
      >
        <svg className="w-4 h-4" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{titulo}</p>
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Disponible en plan <span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{labelPlan}</span>
        </p>
      </div>
      <a
        href="/configuracion/plan"
        className="text-[11px] font-semibold px-3 py-1.5 rounded-[8px] transition-all shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
          color: 'var(--color-accent)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
        }}
      >
        Mejorar
      </a>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function ReportesPage() {
  const { session, esOwner, loading: authLoading } = useAuth()

    const plan = session?.user?.plan ?? 'starter'

  const [resumen,    setResumen]    = useState(null)
  const [ingresos,   setIngresos]   = useState([])
  const [cartera,    setCartera]    = useState([])
  const [cobsData,   setCobsData]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [periodoIngresos, setPeriodoIngresos] = useState('diario')
  const [descargando, setDescargando] = useState('')
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  // Seguros por ruta (carga independiente, con su propio periodo)
  const [seguros, setSeguros] = useState(null)
  const [periodoSeguros, setPeriodoSeguros] = useState('mes')
  // Cobros del mes (reporte mensual)
  const [cobrosMes, setCobrosMes] = useState(null)
  const [cobrosMesLoading, setCobrosMesLoading] = useState(false)
  const [mesCobros, setMesCobros] = useState(() => {
    const d = getColombiaDate()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta]  = useState(hoy())

  const nivel = nivelReportes(plan)

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = `desde=${desde}&hasta=${hasta}`
      const promises = [
        fetch(`/api/reportes/resumen?${qs}`),
        fetch(`/api/reportes/ingresos?periodo=${periodoIngresos}&${qs}`),
      ]
      if (nivel >= 2) {
        promises.push(fetch('/api/reportes/cartera'))
        promises.push(fetch(`/api/reportes/cobradores?${qs}`))
      }
      const responses = await Promise.all(promises)
      const jsons = await Promise.all(responses.map((r) => r.json()))
      const [r, i, c, cb] = jsons
      if (!responses[0].ok) { setError(r.error ?? 'Error'); return }
      setResumen(r)
      setIngresos(Array.isArray(i.data) ? i.data : [])
      if (nivel >= 2) {
        setCartera(Array.isArray(c) ? c : [])
        setCobsData(Array.isArray(cb) ? cb : [])
      }
    } catch {
      setError('No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && esOwner && nivel >= 1) fetchAll()
    else if (!authLoading) setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, periodoIngresos, desde, hasta])

  // Seguros por ruta: carga independiente con su propio periodo
  useEffect(() => {
    if (authLoading || !esOwner || nivel < 2) return
    fetch(`/api/reportes/seguros?periodo=${periodoSeguros}`)
      .then(r => r.json())
      .then(d => setSeguros(d?.items ? d : null))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, periodoSeguros, nivel])

  // Cobros del mes: carga independiente con su propio selector de mes (nivel 1+)
  useEffect(() => {
    if (authLoading || !esOwner || nivel < 1) return
    setCobrosMesLoading(true)
    const [y, m] = mesCobros.split('-').map(Number)
    fetch(`/api/reportes/cobros-mes?year=${y}&month=${m}`)
      .then(r => r.json())
      .then(d => setCobrosMes(d?.rutas ? d : null))
      .catch(() => {})
      .finally(() => setCobrosMesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, mesCobros, nivel])

  const exportarPDF = async () => {
    setDescargandoPDF(true)
    try {
      const res = await fetch(`/api/reportes/resumen-pdf?desde=${desde}&hasta=${hasta}`)
      if (!res.ok) { alert('Error al generar PDF'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `resumen-${desde}-a-${hasta}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Error de conexión.')
    } finally {
      setDescargandoPDF(false)
    }
  }

  const exportar = async (tipo) => {
    setDescargando(tipo)
    try {
      const url = `/api/reportes/exportar?tipo=${tipo}&desde=${desde}&hasta=${hasta}`
      const res = await fetch(url)
      if (!res.ok) { alert('Error al exportar'); return }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `control-finanzas-${tipo}-${desde}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      alert('Error de conexión.')
    } finally {
      setDescargando('')
    }
  }

  if (authLoading || (loading && nivel >= 1 && esOwner)) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!esOwner || nivel === 0) return <PlanGate />

  // Top recaudacion del periodo (medalla)
  const topCobradores = nivel >= 2 ? [...cobsData].sort((a, b) => (b.totalRecogido || 0) - (a.totalRecogido || 0)).slice(0, 3) : []

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header + filtro fechas como chips de periodo + date pickers */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Reportes</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Análisis de tu cartera y cobradores</p>
          </div>
        </div>
        {/* Chips de período rápido + date inputs */}
        <div className="rounded-[12px] p-2.5 flex flex-wrap items-center gap-2"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          {[
            { id: 'hoy', label: 'Hoy', from: hoy, to: hoy },
            { id: 'mes', label: 'Este mes', from: inicioMes, to: hoy },
            { id: '7d', label: 'Últimos 7d', from: () => { const d = getColombiaDate(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) }, to: hoy },
            { id: '30d', label: 'Últimos 30d', from: () => { const d = getColombiaDate(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10) }, to: hoy },
          ].map((p) => {
            const active = desde === p.from() && hasta === p.to()
            return (
              <button
                key={p.id}
                onClick={() => { setDesde(p.from()); setHasta(p.to()) }}
                className="text-[11px] px-2.5 py-1 rounded-[8px] font-medium transition-all"
                style={{
                  background: active ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'transparent',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: active ? '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)' : '1px solid transparent',
                }}
              >
                {p.label}
              </button>
            )
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-7 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-7 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none transition-all"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* HERO: Ingresos del período (lo más mirado) */}
      {resumen && (() => {
        const heroColor = '#22c55e'
        return (
          <div
            className="cf-hero-card relative rounded-[20px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--color-bg-card)) 100%)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
              boxShadow: `0 8px 32px color-mix(in srgb, ${heroColor} 18%, transparent)`,
            }}
          >
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none hidden lg:block"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor, boxShadow: `0 0 12px ${heroColor}` }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>
                  Ingresos del período
                </p>
              </div>
              <p
                className="font-mono-display font-bold leading-none tracking-tight"
                style={{
                  color: heroColor,
                  fontSize: 'clamp(36px, 10vw, 52px)',
                  textShadow: `0 0 30px color-mix(in srgb, ${heroColor} 25%, transparent)`,
                }}
              >
                {formatMoney(resumen.pagos.totalPeriodo)}
              </p>
              <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {resumen.pagos.cantidad} pagos registrados
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── 1. Resumen de cartera (4 KPIs con icono SVG circular) ── */}
      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Clientes activos',
              value: resumen.clientes.total,
              color: '#f5c518',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
            },
            {
              label: 'En mora',
              value: resumen.clientes.enMora,
              color: '#ef4444',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
            },
            {
              label: 'Préstamos activos',
              value: resumen.prestamos.activos,
              color: '#22c55e',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
            },
            {
              label: 'Cartera activa',
              value: formatMoney(resumen.prestamos.carteraActiva),
              color: '#06b6d4',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[16px] px-3 py-3 transition-all kpi-lift"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${s.color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                border: `1px solid color-mix(in srgb, ${s.color} 22%, var(--color-border))`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>
                  <span className="w-3 h-3">{s.icon}</span>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
              </div>
              <p className="text-[16px] font-bold font-mono-display leading-tight" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Interés ganado del período — la GANANCIA real (lo que pide el cliente) */}
      {resumen && resumen.pagos?.interesGanado != null && (
        <div className="rounded-[16px] px-4 py-4 transition-all kpi-lift"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, #10b981 12%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
            border: '1px solid color-mix(in srgb, #10b981 28%, var(--color-border))',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #10b981 18%, transparent)', color: '#10b981' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10b981' }}>Interés ganado</p>
          </div>
          <p className="text-[24px] font-bold font-mono-display leading-tight" style={{ color: '#10b981' }}>{formatMoney(resumen.pagos.interesGanado)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            tu ganancia del período · capital recuperado {formatMoney(resumen.pagos.capitalRecuperado ?? 0)}
          </p>
        </div>
      )}

      {/* Capital prestado + completados como cards complementarias */}
      {resumen && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[16px] px-4 py-3 transition-all kpi-lift"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
              border: '1px solid color-mix(in srgb, var(--color-accent) 22%, var(--color-border))',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>Capital prestado activo</p>
            <p className="text-[18px] font-bold font-mono-display mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(resumen.prestamos.capitalPrestado)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>en la calle</p>
          </div>
          <div className="rounded-[16px] px-4 py-3 transition-all kpi-lift"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, #a855f7 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
              border: '1px solid color-mix(in srgb, #a855f7 22%, var(--color-border))',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a855f7' }}>Completados</p>
            <p className="text-[18px] font-bold font-mono-display mt-1" style={{ color: 'var(--color-text-primary)' }}>{resumen.prestamos.completados}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>préstamos finalizados</p>
          </div>
        </div>
      )}

      {/* ── 2. Gráfica de ingresos ───────────────────────────── */}
      <div className="rounded-[16px] px-4 py-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Ingresos</p>
          </div>
          <div className="flex gap-1">
            {['diario', 'semanal', 'mensual'].map((p) => {
              const active = periodoIngresos === p
              return (
                <button
                  key={p}
                  onClick={() => setPeriodoIngresos(p)}
                  className="px-2.5 py-1 rounded-[8px] text-[10px] font-medium capitalize transition-all"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: active ? '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)' : '1px solid var(--color-border)',
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        {ingresos.length === 0 ? (
          <EmptyState pose="busca" titulo="Sin pagos en el periodo" hint="Ajusta las fechas o espera a que se registren cobros." size={64} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ingresos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="fecha"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(34,197,94,0.08)' }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {ingresos.map((_, i) => (
                  <Cell key={i} fill={i === ingresos.length - 1 ? '#22c55e' : 'color-mix(in srgb, #22c55e 60%, transparent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 3. Cartera por ruta ──────────────────────────────── */}
      {nivel < 2 && <UpgradeNudge titulo="Cartera por ruta" planRequerido="standard" />}
      {nivel >= 2 && cartera.length > 0 && (
        <div className="rounded-[16px] px-4 py-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #06b6d4 18%, transparent)', color: '#06b6d4' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
              </svg>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Cartera por ruta</p>
          </div>
          <div className="space-y-2">
            {cartera.map((r) => (
              <div
                key={r.id}
                className="rounded-[12px] px-3 py-2.5 flex items-center justify-between gap-3"
                style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{r.ruta}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-purple)' }}>
                    {r.cobrador} · {r.clientes} {r.clientes === 1 ? 'cliente' : 'clientes'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(r.saldoPendiente)}</p>
                  <p className="text-[10px] font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(r.cuotaDiariaTotal)}/día</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Seguros por ruta ── */}
      {nivel >= 2 && seguros && (
        <div className="rounded-[16px] px-4 py-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #8b5cf6 18%, transparent)', color: '#8b5cf6' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--color-text-secondary)' }}>Seguros por ruta</p>
            </div>
            <select
              value={periodoSeguros}
              onChange={e => setPeriodoSeguros(e.target.value)}
              className="text-[11px] rounded-[8px] px-2 py-1 shrink-0"
              style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="dia">Hoy</option>
              <option value="semana">7 días</option>
              <option value="mes">30 días</option>
              <option value="todo">Histórico</option>
            </select>
          </div>
          {seguros.items.length === 0 ? (
            <p className="text-[12px] text-center py-3" style={{ color: 'var(--color-text-muted)' }}>Sin seguros cobrados en este período</p>
          ) : (
            <>
              <div className="space-y-2">
                {seguros.items.map((r) => (
                  <div key={r.rutaId || 'sin'} className="rounded-[12px] px-3 py-2.5 flex items-center justify-between gap-3"
                    style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{r.ruta}</p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--color-purple)' }}>
                        {r.cobrador} · {r.cantPrestamosConSeguro} {r.cantPrestamosConSeguro === 1 ? 'préstamo' : 'préstamos'}
                      </p>
                    </div>
                    <p className="text-[14px] font-bold font-mono-display shrink-0" style={{ color: '#8b5cf6' }}>{formatMoney(r.totalSeguro)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <span className="text-[12px] font-bold" style={{ color: 'var(--color-text-secondary)' }}>Total seguros</span>
                <span className="text-[15px] font-bold font-mono-display" style={{ color: '#8b5cf6' }}>{formatMoney(seguros.totalGeneral)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Cobros del mes (reporte mensual imprimible, nivel 1+) ── */}
      {nivel >= 1 && (
        <div className="rounded-[16px] px-4 py-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #f59e0b 18%, transparent)', color: '#f59e0b' }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--color-text-secondary)' }}>Cobros del mes</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="month"
                value={mesCobros}
                onChange={e => setMesCobros(e.target.value)}
                className="h-7 px-2 rounded-[8px] border bg-transparent text-[11px] focus:outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              {cobrosMes && cobrosMes.rutas?.length > 0 && (
                <button
                  onClick={() => {
                    const printW = window.open('', '_blank')
                    if (!printW) return
                    const rows = cobrosMes.rutas.flatMap(r =>
                      r.clientes.map(c => `<tr>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${r.ruta}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${c.nombre}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${c.telefono || ''}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${c.cuotasMes}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">$${c.totalMes.toLocaleString('es-CO')}</td>
                        <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#666">$${c.saldoPendiente.toLocaleString('es-CO')}</td>
                      </tr>`)
                    )
                    printW.document.write(`<!DOCTYPE html><html><head><title>Cobros ${cobrosMes.monthLabel}</title>
                      <style>body{font-family:system-ui,sans-serif;padding:20px;color:#111}
                      table{width:100%;border-collapse:collapse;font-size:13px}
                      th{text-align:left;padding:6px 8px;border-bottom:2px solid #111;font-size:11px;text-transform:uppercase}
                      .total-row td{font-weight:700;border-top:2px solid #111;padding-top:8px}
                      @media print{body{padding:10px}}</style></head>
                      <body><h2 style="margin-bottom:4px">Cobros programados</h2>
                      <p style="color:#666;margin-bottom:16px;font-size:14px">${cobrosMes.monthLabel} — ${cobrosMes.totalClientes} clientes</p>
                      <table><thead><tr><th>Ruta</th><th>Cliente</th><th>Tel</th><th style="text-align:right">Cuotas</th><th style="text-align:right">Total mes</th><th style="text-align:right">Saldo</th></tr></thead>
                      <tbody>${rows.join('')}
                      <tr class="total-row"><td colspan="4">TOTAL</td><td style="text-align:right">$${cobrosMes.granTotal.toLocaleString('es-CO')}</td><td></td></tr>
                      </tbody></table></body></html>`)
                    printW.document.close()
                    printW.focus()
                    printW.print()
                  }}
                  className="h-7 px-2.5 rounded-[8px] text-[11px] font-semibold transition-all cursor-pointer"
                  style={{ color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 10%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)' }}
                >
                  Imprimir
                </button>
              )}
            </div>
          </div>

          {cobrosMesLoading ? (
            <div className="py-8 text-center">
              <div className="w-6 h-6 mx-auto border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
            </div>
          ) : !cobrosMes || cobrosMes.rutas?.length === 0 ? (
            <EmptyState pose="vacia" titulo="Sin cobros programados" hint="No hay cobros pendientes en el periodo seleccionado." size={64} />
          ) : (
            <>
              <div className="rounded-[12px] px-3 py-2.5 mb-3 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)' }}
              >
                <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {cobrosMes.totalClientes} clientes
                </span>
                <span className="text-[16px] font-bold font-mono-display" style={{ color: '#f59e0b' }}>
                  {formatMoney(cobrosMes.granTotal)}
                </span>
              </div>

              <div className="space-y-3">
                {cobrosMes.rutas.map((ruta) => (
                  <div key={ruta.rutaId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{ruta.ruta}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>({ruta.cobrador})</span>
                      </div>
                      <span className="text-[12px] font-bold font-mono-display" style={{ color: '#f59e0b' }}>{formatMoney(ruta.totalRuta)}</span>
                    </div>
                    <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                      {ruta.clientes.map((c, i) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-3 py-2 gap-2"
                          style={{
                            background: i % 2 === 0 ? 'var(--color-bg-base)' : 'var(--color-bg-card)',
                            borderBottom: i < ruta.clientes.length - 1 ? '1px solid var(--color-border)' : 'none',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                              {c.cuotasMes} {c.cuotasMes === 1 ? 'cuota' : 'cuotas'} · Saldo {formatMoney(c.saldoPendiente)}
                            </p>
                          </div>
                          <span className="text-[13px] font-bold font-mono-display shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                            {formatMoney(c.totalMes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 4. Top cobradores (podio visual) + lista completa ── */}
      {nivel < 2 && <UpgradeNudge titulo="Rendimiento de cobradores" planRequerido="standard" />}
      {nivel >= 2 && cobsData.length > 0 && (
        <div className="rounded-[16px] px-4 py-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #a855f7 18%, transparent)', color: '#a855f7' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Rendimiento de cobradores</p>
          </div>

          {/* Top 3 podio si hay >= 2 */}
          {topCobradores.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 0, 2].map((idx) => {
                const c = topCobradores[idx]
                if (!c) return <div key={idx} />
                const medalColor = idx === 0 ? '#f5c518' : idx === 1 ? '#94a3b8' : '#cd7f32'
                const medalLabel = idx === 0 ? '#1' : idx === 1 ? '#2' : '#3'
                return (
                  <div
                    key={c.id}
                    className={`rounded-[12px] px-2 py-3 text-center transition-all ${idx === 0 ? '-mt-2' : ''}`}
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${medalColor} 14%, var(--color-bg-base)) 0%, var(--color-bg-base) 100%)`,
                      border: `1px solid color-mix(in srgb, ${medalColor} 30%, transparent)`,
                      boxShadow: idx === 0 ? `0 0 16px color-mix(in srgb, ${medalColor} 25%, transparent)` : 'none',
                    }}
                  >
                    <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-[12px] font-bold mb-1.5"
                      style={{ background: `color-mix(in srgb, ${medalColor} 25%, transparent)`, color: medalColor, border: `2px solid ${medalColor}` }}
                    >
                      {medalLabel}
                    </div>
                    <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                    <p className="text-[12px] font-bold font-mono-display mt-0.5" style={{ color: medalColor }}>{formatMoney(c.totalRecogido || 0)}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{c.eficiencia}% eficiencia</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista completa con barras */}
          <div className="space-y-2.5">
            {cobsData.map((c) => {
              const totalGastos = c.totalGastos || 0
              const totalDesembolsado = c.totalDesembolsado || 0
              const saldoRealCaja = c.saldoRealCaja ?? ((c.totalRecogido || 0) - totalGastos - totalDesembolsado)
              const eficColor = c.eficiencia >= 95 ? '#22c55e' : c.eficiencia >= 80 ? '#f5c518' : '#ef4444'
              return (
                <div
                  key={c.id}
                  className="rounded-[12px] px-3 py-2.5"
                  style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{c.ruta} · {c.diasTrabajados} días</p>
                    </div>
                    <span
                      className="text-[12px] font-bold font-mono-display px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ background: `color-mix(in srgb, ${eficColor} 15%, transparent)`, color: eficColor, border: `1px solid color-mix(in srgb, ${eficColor} 25%, transparent)` }}
                    >
                      {c.eficiencia}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--color-bg-hover)' }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, c.eficiencia)}%`,
                        background: `linear-gradient(90deg, color-mix(in srgb, ${eficColor} 60%, transparent), ${eficColor})`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    <span>Esperado: <span className="font-mono-display">{formatMoney(c.totalEsperado)}</span></span>
                    <span>Recogido: <span className="font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(c.totalRecogido)}</span></span>
                    <span>Gastos: <span className="font-mono-display" style={{ color: 'var(--color-danger)' }}>{formatMoney(totalGastos)}</span></span>
                    <span>Desembolsado: <span className="font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(totalDesembolsado)}</span></span>
                    <span>Saldo real: <span className="font-mono-display" style={{ color: saldoRealCaja >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>{formatMoney(saldoRealCaja)}</span></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. Descargar Resumen PDF ────────────────────────────── */}
      {nivel < 2 && <UpgradeNudge titulo="Resumen PDF" planRequerido="standard" />}
      {nivel >= 2 && <div className="rounded-[16px] px-4 py-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-danger) 18%, transparent)', color: 'var(--color-danger)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Resumen PDF</p>
        </div>
        <button
          onClick={exportarPDF}
          disabled={descargandoPDF}
          className="group w-full h-14 px-3 rounded-[12px] flex items-center gap-3 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-base)) 0%, var(--color-bg-base) 100%)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 22%, var(--color-border))',
          }}
        >
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
            style={{ background: 'color-mix(in srgb, var(--color-danger) 18%, transparent)', color: 'var(--color-danger)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div className="flex flex-col items-start text-left min-w-0 flex-1">
            <span className="text-[13px] font-semibold truncate w-full" style={{ color: 'var(--color-danger)' }}>
              {descargandoPDF ? 'Generando PDF...' : 'Descargar Resumen'}
            </span>
            <span className="text-[10px] truncate w-full" style={{ color: 'var(--color-text-muted)' }}>
              KPIs, capital, cobradores del periodo
            </span>
          </div>
        </button>
      </div>}

      {/* ── 6. Exportar a Excel como chips ──────────────────────── */}
      {nivel < 3 && <UpgradeNudge titulo="Exportar a Excel" planRequerido="professional" />}
      {nivel >= 3 && <div className="rounded-[16px] px-4 py-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-success) 18%, transparent)', color: 'var(--color-success)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Exportar a Excel</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { tipo: 'clientes',   label: 'Clientes',   desc: 'Lista completa',           color: '#f5c518' },
            { tipo: 'prestamos',  label: 'Préstamos',  desc: 'Cartera con saldos',       color: '#22c55e' },
            { tipo: 'pagos',      label: 'Pagos',      desc: 'Historial del período',    color: '#06b6d4' },
            { tipo: 'cobradores', label: 'Cobradores', desc: 'Rendimiento del período',  color: '#a855f7' },
          ].map(({ tipo, label, desc, color }) => (
            <button
              key={tipo}
              onClick={() => exportar(tipo)}
              disabled={!!descargando}
              className="group h-14 px-3 rounded-[12px] flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${color} 8%, var(--color-bg-base)) 0%, var(--color-bg-base) 100%)`,
                border: `1px solid color-mix(in srgb, ${color} 22%, var(--color-border))`,
              }}
            >
              <div
                className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div className="flex flex-col items-start text-left min-w-0 flex-1">
                <span className="text-[12px] font-semibold truncate w-full" style={{ color }}>
                  {descargando === tipo ? 'Descargando…' : label}
                </span>
                <span className="text-[10px] truncate w-full" style={{ color: 'var(--color-text-muted)' }}>{desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>}
    </div>
  )
}

