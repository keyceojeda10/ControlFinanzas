'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--color-bg-hover)] ${className}`} />
}

function Card({ children, className = '', href }) {
  const cls = `bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[16px] p-4 lg:p-5 ${className}`
  if (href) return <Link href={href} className={`${cls} hover:border-[var(--color-border-hover)] transition-colors block`}>{children}</Link>
  return <div className={cls}>{children}</div>
}

function Badge({ value, suffix = '%' }) {
  if (value === 0 || value === undefined) return null
  const positive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${positive ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'bg-[var(--color-danger-dim)] text-[var(--color-danger)]'}`}>
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: positive ? 'none' : 'rotate(180deg)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
      </svg>
      {Math.abs(value)}{suffix}
    </span>
  )
}

function ProgressBar({ value, max, color = 'var(--color-accent)', height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full rounded-full bg-[var(--color-bg-hover)] overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function BarChart({ data, dataKey, color = 'var(--color-accent)', formatValue }) {
  if (!data?.length) return null
  const max = Math.max(...data.map(d => d[dataKey]), 1)
  const fmt = formatValue || (v => v.toLocaleString())
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const pct = (d[dataKey] / max) * 100
        const mesLabel = new Date(d.mes + '-15').toLocaleDateString('es', { month: 'short' })
        return (
          <div key={i} className="flex items-center gap-2.5">
            <span className="text-[11px] w-8 text-right text-[var(--color-text-muted)] font-medium uppercase">{mesLabel}</span>
            <div className="flex-1 h-7 rounded-[6px] bg-[var(--color-bg-hover)] overflow-hidden relative">
              <div className="h-full rounded-[6px] transition-all duration-500 ease-out" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
              {d[dataKey] > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[var(--color-text-secondary)]">{fmt(d[dataKey])}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const SEV_STYLES = {
  grave:    { bg: 'bg-[var(--color-danger-dim)]', text: 'text-[var(--color-danger)]', label: 'Grave' },
  moderada: { bg: 'bg-[var(--color-warning-dim)]', text: 'text-[var(--color-warning)]', label: 'Moderada' },
  leve:     { bg: 'bg-[var(--color-bg-hover)]', text: 'text-[var(--color-text-muted)]', label: 'Leve' },
}

export default function AnaliticasPage() {
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAllAlertas, setShowAllAlertas] = useState(false)

  const country = session?.user?.country || 'CO'
  const fmt = useCallback(v => formatMoney(v, country), [country])

  useEffect(() => {
    fetch('/api/dashboard/analiticas')
      .then(r => { if (!r.ok) throw new Error('Error cargando datos'); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        <p className="text-[var(--color-danger)] text-[14px]">{error}</p>
        <Link href="/dashboard" className="text-[13px] text-[var(--color-info)] underline mt-2 block">Volver al dashboard</Link>
      </div>
    )
  }

  const { resumen, proyeccion, alertas, alertasResumen, cartera, cobradores, tendenciaMensual } = data
  const alertasVisibles = showAllAlertas ? alertas : alertas.slice(0, 5)

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto pb-24 space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-hover)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-[20px] lg:text-[24px] font-semibold tracking-tight">Analiticas</h1>
      </div>

      {/* === ROI headline === */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Rendimiento de tu capital</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[36px] lg:text-[44px] font-mono font-bold tracking-tight" style={{ color: resumen.roiMensual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {resumen.roiMensual}%
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">mensual</span>
              <Badge value={resumen.cambioRecaudado} />
            </div>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              Por cada {fmt(100)} en la calle, ganas {fmt(resumen.roiMensual)} neto este mes
            </p>
          </div>
          <div className="flex gap-6 lg:gap-8">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Ganancia neta</p>
              <p className="text-[20px] font-mono font-bold mt-0.5" style={{ color: resumen.gananciaNetaMes >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{fmt(resumen.gananciaNetaMes)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">recaudado - gastos</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Capital</p>
              <p className="text-[20px] font-mono font-bold mt-0.5">{fmt(resumen.capitalEnCalle)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">en la calle</p>
            </div>
          </div>
        </div>
      </Card>

      {/* === Proyeccion del mes === */}
      <Card>
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Proyeccion del mes</p>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">dia {proyeccion.diasHabiles} de {proyeccion.diasHabilesTotalMes}</span>
        </div>
        <ProgressBar value={proyeccion.recaudado} max={proyeccion.esperado} color="var(--color-accent)" height={10} />
        <div className="flex justify-between mt-2">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Recaudado</p>
            <p className="text-[15px] font-mono font-bold">{fmt(proyeccion.recaudado)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-[var(--color-text-muted)]">Promedio diario</p>
            <p className="text-[15px] font-mono font-bold text-[var(--color-info)]">{fmt(proyeccion.promedioDiario)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--color-text-muted)]">Al ritmo actual cerras con</p>
            <p className="text-[15px] font-mono font-bold text-[var(--color-accent)]">{fmt(proyeccion.proyectado)}</p>
          </div>
        </div>
        {proyeccion.esperado > 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2 text-center">
            {proyeccion.proyectado >= proyeccion.esperado
              ? `Vas ${Math.round(((proyeccion.proyectado / proyeccion.esperado) - 1) * 100)}% por encima de lo esperado`
              : `Vas ${Math.round((1 - (proyeccion.proyectado / proyeccion.esperado)) * 100)}% por debajo de lo esperado (${fmt(proyeccion.esperado)})`
            }
          </p>
        )}
      </Card>

      {/* === Alertas de mora === */}
      {alertasResumen.total > 0 && (
        <Card className={alertasResumen.graves > 0 ? '!border-[var(--color-danger)]' : ''}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">
                {alertasResumen.total} {alertasResumen.total === 1 ? 'cliente' : 'clientes'} en mora
              </p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                {fmt(alertasResumen.montoTotal)} en riesgo
              </p>
            </div>
            <div className="flex gap-1.5">
              {alertasResumen.graves > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-danger-dim)] text-[var(--color-danger)] font-bold">{alertasResumen.graves} graves</span>
              )}
              {alertasResumen.moderadas > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning-dim)] text-[var(--color-warning)] font-bold">{alertasResumen.moderadas} moderadas</span>
              )}
              {alertasResumen.leves > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] font-bold">{alertasResumen.leves} leves</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {alertasVisibles.map(a => {
              const sev = SEV_STYLES[a.severidad]
              return (
                <Link
                  key={a.prestamoId}
                  href={`/prestamos/${a.prestamoId}`}
                  className="flex items-center justify-between py-2 px-3 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text} shrink-0`}>
                      {a.diasMora}d
                    </span>
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{a.clienteNombre}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[12px] font-mono font-bold text-[var(--color-text-secondary)]">{fmt(a.montoEnRiesgo)}</span>
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>

          {alertas.length > 5 && (
            <button
              onClick={(e) => { e.preventDefault(); setShowAllAlertas(!showAllAlertas) }}
              className="w-full text-center text-[12px] text-[var(--color-info)] font-medium mt-2 py-1 hover:underline"
            >
              {showAllAlertas ? 'Ver menos' : `Ver todos (${alertas.length})`}
            </button>
          )}
        </Card>
      )}

      {/* === Cartera + Negocio === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card href="/prestamos">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Prestamos activos</p>
          <p className="text-[24px] font-mono font-bold mt-1">{cartera.activos}</p>
          {cartera.pctMora > 0 && <p className="text-[10px] text-[var(--color-danger)] font-medium">{cartera.pctMora}% en mora</p>}
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Por cobrar</p>
          <p className="text-[24px] font-mono font-bold mt-1 text-[var(--color-accent)]">{fmt(resumen.porCobrar)}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{fmt(resumen.interesEnCartera)} interes</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Ticket promedio</p>
          <p className="text-[24px] font-mono font-bold mt-1">{fmt(cartera.ticketPromedio)}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">por prestamo</p>
        </Card>
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Clientes que repiten</p>
          <p className="text-[24px] font-mono font-bold mt-1 text-[var(--color-info)]">{cartera.clientesRepiten}%</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">han tomado 2+ prestamos</p>
        </Card>
      </div>

      {/* === Recaudado mensual === */}
      <Card>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Recaudado por mes</p>
        <BarChart data={tendenciaMensual} dataKey="recaudado" formatValue={v => fmt(v)} color="var(--color-accent)" />
      </Card>

      {/* === Cobradores === */}
      {cobradores.length > 0 && (
        <Card href="/cobradores">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Cobradores este mes</p>
            <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="space-y-3">
            {cobradores.map((c, i) => {
              const max = cobradores[0]?.recaudado || 1
              const pct = (c.recaudado / max) * 100
              return (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${i < 3 ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-medium">{c.nombre}</span>
                      {c.rol === 'owner' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">admin</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{c.pagos} pagos</span>
                      <span className="text-[13px] font-mono font-bold">{fmt(c.recaudado)}</span>
                    </div>
                  </div>
                  <div className="ml-7">
                    <ProgressBar value={c.recaudado} max={max} color={i === 0 ? 'var(--color-accent)' : 'var(--color-info)'} height={4} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* === Clavos === */}
      {cartera.clavos > 0 && (
        <Card href="/clavos" className="!border-[var(--color-danger)] border-opacity-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-danger)]">Clavos</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">{cartera.clavos} prestamos marcados como irrecuperables</p>
            </div>
            <p className="text-[20px] font-mono font-bold text-[var(--color-danger)]">{fmt(cartera.moraIrrecuperable)}</p>
          </div>
        </Card>
      )}
    </div>
  )
}
