'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--color-bg-hover)] ${className}`} />
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
              <div
                className="h-full rounded-[6px] transition-all duration-500 ease-out"
                style={{ width: `${Math.max(pct, 2)}%`, background: color }}
              />
              {d[dataKey] > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[var(--color-text-secondary)]">
                  {fmt(d[dataKey])}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ segments, size = 120, strokeWidth = 16 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null

  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-bg-hover)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const pct = seg.value / total
        const dashLen = circumference * pct
        const dashOffset = -offset
        offset += dashLen
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-700 ease-out"
          />
        )
      })}
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="text-[18px] font-mono font-bold" fill="var(--color-text-primary)">
        {total}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="text-[10px]" fill="var(--color-text-muted)">
        prestamos
      </text>
    </svg>
  )
}

function EficienciaRing({ pct, size = 80 }) {
  const radius = 32
  const circ = 2 * Math.PI * radius
  const dashLen = (pct / 100) * circ
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--color-bg-hover)" strokeWidth="8" />
      <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dashLen} ${circ - dashLen}`} strokeLinecap="round"
        transform="rotate(-90 40 40)" className="transition-all duration-700" />
      <text x="40" y="38" textAnchor="middle" className="text-[16px] font-mono font-bold" fill="var(--color-text-primary)">{pct}%</text>
      <text x="40" y="52" textAnchor="middle" className="text-[9px]" fill="var(--color-text-muted)">eficiencia</text>
    </svg>
  )
}

function Card({ children, className = '', href }) {
  const cls = `bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[16px] p-4 lg:p-5 ${className}`
  if (href) {
    return (
      <Link href={href} className={`${cls} hover:border-[var(--color-border-hover)] transition-colors block`}>
        {children}
      </Link>
    )
  }
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

function KpiMini({ label, value, sub, color, badge }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[20px] lg:text-[24px] font-mono font-bold" style={color ? { color } : {}}>{value}</span>
        {badge !== undefined && <Badge value={badge} />}
      </div>
      {sub && <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</span>}
    </div>
  )
}

function SectionLabel({ children }) {
  return <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{children}</span>
}

function ArrowIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function AnaliticasPage() {
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const country = session?.user?.country || 'CO'
  const fmt = useCallback(v => formatMoney(v, country), [country])

  useEffect(() => {
    fetch('/api/dashboard/analiticas')
      .then(r => {
        if (!r.ok) throw new Error('Error cargando datos')
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-56" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-8 max-w-6xl mx-auto">
        <p className="text-[var(--color-danger)] text-[14px]">{error}</p>
        <Link href="/dashboard" className="text-[13px] text-[var(--color-info)] underline mt-2 block">Volver al dashboard</Link>
      </div>
    )
  }

  const { tendenciaMensual, eficiencia, cartera, cobradores, rentabilidad, clientes } = data
  const cambios = rentabilidad.cambios || {}

  const donutSegments = [
    { value: cartera.activos - cartera.enMora, color: 'var(--color-success)', label: 'Al dia' },
    { value: cartera.enMora, color: 'var(--color-danger)', label: 'En mora' },
    { value: cartera.completados, color: 'var(--color-info)', label: 'Completados' },
    { value: cartera.cancelados, color: 'var(--color-text-muted)', label: 'Cancelados' },
  ].filter(s => s.value > 0)

  const rankingItems = cobradores.map(c => ({
    id: c.id,
    nombre: c.nombre,
    rol: c.rol,
    value: c.recaudado,
    pagos: c.pagos,
    prestamosAsignados: c.prestamosAsignados,
  }))

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto pb-24 space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-hover)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[20px] lg:text-[24px] font-semibold tracking-tight">Analiticas</h1>
          <p className="text-[12px] text-[var(--color-text-muted)]">Metricas de tu negocio</p>
        </div>
      </div>

      {/* Resultado del mes — ganancia neta destacada */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <SectionLabel>Resultado del mes</SectionLabel>
          <Badge value={cambios.recaudado} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <KpiMini label="Recaudado" value={fmt(rentabilidad.recaudadoMes)} color="var(--color-success)" />
          <KpiMini label="Gastos" value={fmt(rentabilidad.gastosMes)} color="var(--color-danger)" badge={cambios.gastos} />
          <KpiMini
            label="Ganancia neta"
            value={fmt(rentabilidad.gananciaNetaMes)}
            color={rentabilidad.gananciaNetaMes >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
          />
          <KpiMini label="Prestamos nuevos" value={tendenciaMensual[tendenciaMensual.length - 1]?.prestamosNuevos || 0} badge={cambios.prestamosNuevos} />
        </div>
      </Card>

      {/* Capital en calle — clickeable a prestamos */}
      <Card href="/prestamos">
        <div className="flex items-start justify-between mb-3">
          <SectionLabel>Tu dinero en la calle</SectionLabel>
          <ArrowIcon />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <KpiMini label="Capital prestado" value={fmt(rentabilidad.capitalEnCalle)} />
          <KpiMini label="Interes por cobrar" value={fmt(rentabilidad.interesEnCartera)} color="var(--color-accent)" />
          <KpiMini label="Por cobrar total" value={fmt(cartera.montoActivo)} color="var(--color-info)" />
          <KpiMini
            label="En mora"
            value={fmt(cartera.montoMora)}
            color="var(--color-danger)"
            sub={cartera.pctMora > 0 ? `${cartera.pctMora}% de la cartera` : undefined}
          />
        </div>
        {rentabilidad.clavos > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-danger-dim)] text-[var(--color-danger)] font-bold">
              {rentabilidad.clavos} clavos
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {fmt(rentabilidad.moraIrrecuperable)} irrecuperable
            </span>
          </div>
        )}
      </Card>

      {/* Eficiencia + Cartera + Clientes */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <Card className="flex flex-col items-center justify-center text-center">
          <SectionLabel>Eficiencia de cobro</SectionLabel>
          <div className="mt-2">
            <EficienciaRing pct={eficiencia.pct} />
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            {fmt(eficiencia.recaudado)} de {fmt(eficiencia.esperado)}
          </p>
          <p className="text-[9px] text-[var(--color-text-muted)]">
            {eficiencia.diasHabiles} dias habiles de {eficiencia.diasTranscurridos}
          </p>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <SectionLabel>Salud de cartera</SectionLabel>
          <div className="mt-2">
            <DonutChart segments={donutSegments} size={100} strokeWidth={14} />
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-2">
            {donutSegments.map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[9px] text-[var(--color-text-muted)]">{s.label} ({s.value})</span>
              </span>
            ))}
          </div>
        </Card>

        <Card href="/clientes" className="col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Clientes</SectionLabel>
            <ArrowIcon />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiMini label="Activos" value={clientes.activos} />
            <KpiMini label="Inactivos" value={clientes.inactivos} color="var(--color-text-muted)" />
            <KpiMini label="En mora" value={cartera.enMora} color="var(--color-danger)" sub={cartera.pctMora > 0 ? `${cartera.pctMora}%` : undefined} />
            <KpiMini label="Nuevos este mes" value={tendenciaMensual[tendenciaMensual.length - 1]?.clientesNuevos || 0} badge={cambios.clientesNuevos} />
          </div>
        </Card>
      </div>

      {/* Charts — 2 cols desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <Card>
          <SectionLabel>Recaudado por mes</SectionLabel>
          <div className="mt-3">
            <BarChart data={tendenciaMensual} dataKey="recaudado" formatValue={v => fmt(v)} color="var(--color-accent)" />
          </div>
        </Card>

        <Card>
          <SectionLabel>Capital prestado por mes</SectionLabel>
          <div className="mt-3">
            <BarChart data={tendenciaMensual} dataKey="capitalPrestado" formatValue={v => fmt(v)} color="var(--color-info)" />
          </div>
        </Card>

        <Card>
          <SectionLabel>Prestamos nuevos por mes</SectionLabel>
          <div className="mt-3">
            <BarChart data={tendenciaMensual} dataKey="prestamosNuevos" formatValue={v => `${v}`} color="var(--color-success)" />
          </div>
        </Card>

        <Card>
          <SectionLabel>Gastos por mes</SectionLabel>
          <div className="mt-3">
            <BarChart data={tendenciaMensual} dataKey="gastos" formatValue={v => fmt(v)} color="var(--color-danger)" />
          </div>
        </Card>
      </div>

      {/* Ranking cobradores */}
      {rankingItems.length > 0 && (
        <Card href="/cobradores">
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Ranking cobradores (este mes)</SectionLabel>
            <ArrowIcon />
          </div>
          <div className="space-y-3">
            {rankingItems.map((item, i) => {
              const max = rankingItems[0]?.value || 1
              const pct = (item.value / max) * 100
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${i < 3 ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{item.nombre}</span>
                      {item.rol === 'owner' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] font-medium">admin</span>
                      )}
                    </div>
                    <span className="text-[13px] font-mono font-bold text-[var(--color-text-primary)]">{fmt(item.value)}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-7">
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 3)}%`, background: i === 0 ? 'var(--color-accent)' : 'var(--color-info)', opacity: 1 - i * 0.15 }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-20 text-right">
                      {item.pagos} pagos
                    </span>
                    {item.prestamosAsignados > 0 && (
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-16 text-right">
                        {item.prestamosAsignados} prest.
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
