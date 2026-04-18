'use client'
// app/(dashboard)/reportes/page.jsx — Solo plan professional

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
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
      <p className="text-[var(--color-success)] font-bold">{formatCOP(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

// ── Gate de plan ───────────────────────────────────────────────
function PlanGate() {
  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-xl font-bold text-[white] mb-6">Reportes</h1>
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[rgba(245,158,11,0.12)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[var(--color-warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-base font-bold text-[white] mb-2">Reportes avanzados</p>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Accede a gráficas de ingresos, métricas de cobradores, análisis de cartera y exportación a Excel.
        </p>
        <div className="inline-flex flex-col gap-2 text-xs text-[var(--color-text-muted)] text-left">
          <span>✓ Gráficas de ingresos diario / semanal / mensual</span>
          <span>✓ Rendimiento por cobrador</span>
          <span>✓ Análisis de cartera por ruta</span>
          <span>✓ Exportar a Excel (4 reportes)</span>
        </div>
      </div>
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

  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta]  = useState(hoy())

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const qs = `desde=${desde}&hasta=${hasta}`
      const [rRes, iRes, cRes, cbRes] = await Promise.all([
        fetch(`/api/reportes/resumen?${qs}`),
        fetch(`/api/reportes/ingresos?periodo=${periodoIngresos}&${qs}`),
        fetch('/api/reportes/cartera'),
        fetch(`/api/reportes/cobradores?${qs}`),
      ])
      const [r, i, c, cb] = await Promise.all([
        rRes.json(), iRes.json(), cRes.json(), cbRes.json(),
      ])
      if (!rRes.ok) { setError(r.error ?? 'Error'); return }
      setResumen(r)
      setIngresos(Array.isArray(i.data) ? i.data : [])
      setCartera(Array.isArray(c) ? c : [])
      setCobsData(Array.isArray(cb) ? cb : [])
    } catch {
      setError('No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && esOwner && plan === 'professional') fetchAll()
    else if (!authLoading) setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, periodoIngresos, desde, hasta])

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

  if (authLoading || (loading && plan === 'professional' && esOwner)) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!esOwner || plan !== 'professional') return <PlanGate />

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header + filtro fechas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-bold text-[white]">Reportes</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Análisis de tu cartera y cobradores</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <span className="text-[var(--color-text-muted)] text-xs">—</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>

      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      {/* ── 1. Resumen de cartera ────────────────────────────── */}
      {resumen && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Clientes activos',  value: resumen.clientes.total,                     color: 'var(--color-text-primary)' },
              { label: 'En mora',           value: resumen.clientes.enMora,                    color: 'var(--color-danger)' },
              { label: 'Préstamos activos', value: resumen.prestamos.activos,                  color: 'var(--color-accent)' },
              { label: 'Cartera activa',    value: formatCOP(resumen.prestamos.carteraActiva), color: 'var(--color-success)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
                style={{
                  background: `linear-gradient(135deg, ${color === 'white' ? '#ffffff' : color}0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, ${color === 'white' ? '#ffffff' : color}05 100%)`,
                  boxShadow: `0 0 30px ${color === 'white' ? '#ffffff' : color}08, 0 1px 2px rgba(0,0,0,0.3)`,
                }}
              >
                <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                <p className="text-base font-bold mt-0.5 font-mono-display" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="border border-[var(--color-border)] rounded-[12px] px-4 py-3"
              style={{
                background: 'linear-gradient(135deg, #22c55e0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #22c55e05 100%)',
                boxShadow: '0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              <p className="text-[10px] text-[var(--color-text-muted)]">Ingresos del período</p>
              <p className="text-lg font-bold text-[var(--color-success)] mt-0.5 font-mono-display">{formatCOP(resumen.pagos.totalPeriodo)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{resumen.pagos.cantidad} pagos</p>
            </div>
            <div
              className="border border-[var(--color-border)] rounded-[12px] px-4 py-3"
              style={{
                background: 'linear-gradient(135deg, #f5c5180A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f5c51805 100%)',
                boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              <p className="text-[10px] text-[var(--color-text-muted)]">Capital prestado activo</p>
              <p className="text-lg font-bold text-[var(--color-accent)] mt-0.5 font-mono-display">{formatCOP(resumen.prestamos.capitalPrestado)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{resumen.prestamos.completados} completados</p>
            </div>
          </div>
        </>
      )}

      {/* ── 2. Gráfica de ingresos ───────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Ingresos</p>
          <div className="flex gap-1.5">
            {['diario', 'semanal', 'mensual'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriodoIngresos(p)}
                className={`px-2.5 py-1 rounded-[8px] text-[10px] font-medium capitalize transition-all ${
                  periodoIngresos === p
                    ? 'bg-[var(--color-accent)] text-[var(--color-text-primary)]'
                    : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[white]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {ingresos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin pagos en el período</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ingresos} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis
                dataKey="fecha"
                tick={{ fill: '#555555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#555555', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,197,24,0.08)' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {ingresos.map((_, i) => (
                  <Cell key={i} fill={i === ingresos.length - 1 ? 'var(--color-accent)' : '#7a6210'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── 3. Cartera por ruta ──────────────────────────────── */}
      {cartera.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
            Cartera por ruta
          </p>
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 text-[10px] text-[var(--color-text-muted)] font-medium uppercase pb-2 border-b border-[var(--color-border)]">
              <span>Ruta / Cobrador</span>
              <span className="text-right">Clientes</span>
              <span className="text-right">Cartera</span>
              <span className="text-right">Cuota/día</span>
            </div>
            {cartera.map((r) => (
              <div key={r.id} className="grid grid-cols-4 gap-2 py-2.5 border-b border-[var(--color-border)] last:border-0 items-center">
                <div>
                  <p className="text-sm font-medium text-[white] truncate">{r.ruta}</p>
                  <p className="text-[10px] text-[var(--color-purple)]">{r.cobrador}</p>
                </div>
                <span className="text-sm text-[var(--color-text-muted)] text-right">{r.clientes}</span>
                <span className="text-sm text-[white] text-right font-mono-display">{formatCOP(r.saldoPendiente)}</span>
                <span className="text-sm text-[var(--color-success)] font-medium text-right font-mono-display">{formatCOP(r.cuotaDiariaTotal)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 4. Rendimiento cobradores ────────────────────────── */}
      {cobsData.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
            Rendimiento de cobradores
          </p>
          <div className="space-y-3">
            {cobsData.map((c) => {
              const totalGastos = c.totalGastos || 0
              const totalDesembolsado = c.totalDesembolsado || 0
              const saldoRealCaja = c.saldoRealCaja ?? ((c.totalRecogido || 0) - totalGastos - totalDesembolsado)
              return (
              <div key={c.id} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium text-[white]">{c.nombre}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-2">{c.ruta}</span>
                  </div>
                  <span
                    className="text-xs font-bold font-mono-display"
                    style={{ color: c.eficiencia >= 95 ? 'var(--color-success)' : c.eficiencia >= 80 ? 'var(--color-warning)' : 'var(--color-danger)' }}
                  >
                    {c.eficiencia}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, c.eficiencia)}%`,
                      background: c.eficiencia >= 95 ? 'var(--color-success)' : c.eficiencia >= 80 ? 'var(--color-warning)' : 'var(--color-danger)',
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
                  <span>Esperado: <span className="font-mono-display">{formatCOP(c.totalEsperado)}</span></span>
                  <span>Recogido: <span className="font-mono-display">{formatCOP(c.totalRecogido)}</span></span>
                  <span>Gastos: <span className="font-mono-display text-[var(--color-danger)]">{formatCOP(totalGastos)}</span></span>
                  <span>Desembolsado: <span className="font-mono-display text-[var(--color-warning)]">{formatCOP(totalDesembolsado)}</span></span>
                  <span>Saldo real: <span className="font-mono-display" style={{ color: saldoRealCaja >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>{formatCOP(saldoRealCaja)}</span></span>
                  <span>{c.diasTrabajados} días</span>
                </div>
              </div>
            )})}
          </div>
        </Card>
      )}

      {/* ── 5. Exportar a Excel ──────────────────────────────── */}
      <Card>
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
          Exportar a Excel
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { tipo: 'clientes',   label: 'Clientes',   desc: 'Lista completa de clientes' },
            { tipo: 'prestamos',  label: 'Préstamos',  desc: 'Cartera con saldos'         },
            { tipo: 'pagos',      label: 'Pagos',      desc: 'Historial del período'       },
            { tipo: 'cobradores', label: 'Cobradores', desc: 'Rendimiento del período'     },
          ].map(({ tipo, label, desc }) => (
            <button
              key={tipo}
              onClick={() => exportar(tipo)}
              disabled={!!descargando}
              className="flex flex-col items-start gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-[#f5c518]/40 hover:bg-[var(--color-bg-hover)] rounded-[12px] px-4 py-3 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2 w-full">
                <svg className="w-4 h-4 text-[var(--color-success)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-[white]">
                  {descargando === tipo ? 'Descargando…' : label}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] pl-6">{desc}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
