'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--color-bg-hover)] ${className}`} />
}

function BarChart({ data, dataKey, label, color = 'var(--color-accent)', formatValue }) {
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

function HorizontalRanking({ items, fmtValue, color = 'var(--color-info)' }) {
  if (!items?.length) return <p className="text-[13px] text-[var(--color-text-muted)]">Sin cobradores</p>
  const max = Math.max(...items.map(i => i.value), 1)

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const pct = (item.value / max) * 100
        const medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : `${i + 1}`
        return (
          <div key={item.id} className="flex items-center gap-2.5">
            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${i < 3 ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'}`}>
              {medal}
            </span>
            <span className="text-[12px] font-medium w-20 truncate text-[var(--color-text-secondary)]">{item.nombre}</span>
            <div className="flex-1 h-6 rounded-[5px] bg-[var(--color-bg-hover)] overflow-hidden relative">
              <div
                className="h-full rounded-[5px] transition-all duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, background: i === 0 ? 'var(--color-accent)' : color, opacity: 1 - i * 0.12 }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[var(--color-text-secondary)]">
                {fmtValue(item.value)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
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

function Card({ children, className = '' }) {
  return (
    <div className={`bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[16px] p-4 ${className}`}>
      {children}
    </div>
  )
}

function KpiMini({ label, value, sub, color }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[20px] font-mono font-bold mt-0.5" style={color ? { color } : {}}>{value}</span>
      {sub && <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</span>}
    </div>
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
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-56" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-[var(--color-danger)] text-[14px]">{error}</p>
        <Link href="/dashboard" className="text-[13px] text-[var(--color-info)] underline mt-2 block">Volver al dashboard</Link>
      </div>
    )
  }

  const { tendenciaMensual, eficiencia, cartera, cobradores, rentabilidad, clientes } = data

  const donutSegments = [
    { value: cartera.activos - cartera.enMora, color: 'var(--color-success)', label: 'Al dia' },
    { value: cartera.enMora, color: 'var(--color-danger)', label: 'En mora' },
    { value: cartera.completados, color: 'var(--color-info)', label: 'Completados' },
    { value: cartera.cancelados, color: 'var(--color-text-muted)', label: 'Cancelados' },
  ].filter(s => s.value > 0)

  const rankingItems = cobradores.map(c => ({
    id: c.id,
    nombre: c.nombre,
    value: c.recaudado,
  }))

  const totalCartera = cartera.activos + cartera.completados + cartera.cancelados

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-hover)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Analiticas</h1>
          <p className="text-[12px] text-[var(--color-text-muted)]">Metricas de tu negocio</p>
        </div>
      </div>

      {/* Rentabilidad KPIs */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Tu dinero en la calle</p>
        <div className="grid grid-cols-2 gap-4">
          <KpiMini label="Capital prestado" value={fmt(rentabilidad.capitalEnCalle)} />
          <KpiMini label="Interes por cobrar" value={fmt(rentabilidad.interesEnCartera)} color="var(--color-success)" />
          <KpiMini label="Recaudado este mes" value={fmt(rentabilidad.recaudadoMes)} color="var(--color-info)" />
          <KpiMini label="Gastos este mes" value={fmt(rentabilidad.gastosMes)} color="var(--color-danger)" />
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

      {/* Eficiencia de cobro + Cartera */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Eficiencia de cobro</p>
          <EficienciaRing pct={eficiencia.pct} />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            {fmt(eficiencia.recaudado)} de {fmt(eficiencia.esperado)}
          </p>
          <p className="text-[9px] text-[var(--color-text-muted)]">
            {eficiencia.diasHabiles} dias habiles de {eficiencia.diasTranscurridos}
          </p>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Salud de cartera</p>
          <DonutChart segments={donutSegments} size={100} strokeWidth={14} />
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 mt-2">
            {donutSegments.map(s => (
              <span key={s.label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[9px] text-[var(--color-text-muted)]">{s.label} ({s.value})</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Recaudado mensual chart */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Recaudado por mes</p>
        <BarChart data={tendenciaMensual} dataKey="recaudado" formatValue={v => fmt(v)} color="var(--color-accent)" />
      </Card>

      {/* Capital prestado mensual */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Capital prestado por mes</p>
        <BarChart data={tendenciaMensual} dataKey="capitalPrestado" formatValue={v => fmt(v)} color="var(--color-info)" />
      </Card>

      {/* Ranking cobradores */}
      {rankingItems.length > 0 && (
        <Card>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Ranking cobradores (este mes)</p>
          <HorizontalRanking items={rankingItems} fmtValue={fmt} />
        </Card>
      )}

      {/* Datos de cartera */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Numeros de cartera</p>
        <div className="grid grid-cols-2 gap-4">
          <KpiMini label="Clientes activos" value={clientes.activos} />
          <KpiMini label="Clientes inactivos" value={clientes.inactivos} color="var(--color-text-muted)" />
          <KpiMini label="Por cobrar" value={fmt(cartera.montoActivo)} color="var(--color-accent)" />
          <KpiMini label="En mora" value={fmt(cartera.montoMora)} color="var(--color-danger)" />
        </div>
      </Card>

      {/* Prestamos y clientes nuevos */}
      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Prestamos nuevos por mes</p>
        <BarChart data={tendenciaMensual} dataKey="prestamosNuevos" formatValue={v => `${v}`} color="var(--color-success)" />
      </Card>

      <Card>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Clientes nuevos por mes</p>
        <BarChart data={tendenciaMensual} dataKey="clientesNuevos" formatValue={v => `${v}`} color="var(--color-teal)" />
      </Card>
    </div>
  )
}
