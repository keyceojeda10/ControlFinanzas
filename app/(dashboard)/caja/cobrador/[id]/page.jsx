'use client'
// app/(dashboard)/caja/cobrador/[id]/page.jsx
// Caja completa de un cobrador: resumen del día (prestado/cobrado/seguros/gastos/efectivo),
// desglose por ruta (capital + prestado/cobrado/seguros) y la línea de movimientos del día.
// Solo accesible por el owner.

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

const fmtFecha = (d) => {
  if (!d) return '—'
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

const fmtHora = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
}

// Configuración visual de cada tipo de movimiento de la línea de tiempo.
const MOV_CONFIG = {
  cobro:    { label: 'Cobro',    color: 'var(--color-success)', signo: '+' },
  prestamo: { label: 'Préstamo', color: 'var(--color-warning)', signo: '-' },
  gasto:    { label: 'Gasto',    color: 'var(--color-danger)',  signo: '-' },
}

export default function CajaCobradorPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const fechaParam = searchParams.get('fecha')
  const { esOwner, loading: authLoading } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = fechaParam ? `?fecha=${fechaParam}` : ''
      const res = await fetch(`/api/caja/cobrador/${id}${qs}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo cargar la caja del cobrador')
      }
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id, fechaParam])

  useEffect(() => { fetchData() }, [fetchData])

  if (authLoading || loading) {
    return (
      <div className="p-4 space-y-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!esOwner) {
    return (
      <div className="p-4">
        <p className="text-sm text-[var(--color-text-muted)]">Solo el administrador puede ver la caja por cobrador.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <Link href="/caja" className="text-sm text-[var(--color-accent)] flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a Caja
        </Link>
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    )
  }

  const r = data?.resumen || {}
  const movimientos = data?.movimientos || []
  const porRuta = data?.porRuta || []

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <Link href={`/caja?fecha=${data?.fecha || ''}`} className="text-sm text-[var(--color-accent)] flex items-center gap-1 w-fit">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a Caja
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Caja de {data?.cobrador?.nombre}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">{fmtFecha(data?.fecha)}</p>
          </div>
          {data?.cerrado ? <Badge variant="green">Cerrado</Badge> : <Badge variant="yellow">Pendiente cierre</Badge>}
        </div>
      </div>

      {/* Resumen del día */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Resumen del día</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Cobrado</p>
            <p className="text-base font-bold font-mono-display text-[var(--color-success)] mt-0.5">{formatMoney(r.cobradoDia)}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Prestado</p>
            <p className="text-base font-bold font-mono-display text-[var(--color-warning)] mt-0.5">{r.prestadoDia > 0 ? '-' : ''}{formatMoney(r.prestadoDia)}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Seguros</p>
            <p className="text-base font-bold font-mono-display text-[var(--color-info)] mt-0.5">{formatMoney(r.segurosDia)}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Gastos</p>
            <p className="text-base font-bold font-mono-display text-[var(--color-danger)] mt-0.5">{r.gastosDia > 0 ? '-' : ''}{formatMoney(r.gastosDia)}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Efectivo del día</p>
            <p className="text-base font-bold font-mono-display mt-0.5" style={{ color: (r.efectivoDia ?? 0) >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>{formatMoney(r.efectivoDia)}</p>
          </div>
          <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Capital en rutas</p>
            <p className="text-base font-bold font-mono-display text-[var(--color-text-primary)] mt-0.5">{formatMoney(r.capitalRutasTotal)}</p>
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-2">Efectivo del día = cobrado − prestado − gastos.</p>
      </Card>

      {/* Capital y movimiento por ruta */}
      {porRuta.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Por ruta</h2>
          <div className="space-y-2">
            {porRuta.map((ruta) => (
              <div key={ruta.rutaId || 'otros'} className="rounded-[12px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{ruta.nombre}</span>
                  {ruta.rutaId && (
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Capital: <span className="font-semibold font-mono-display text-[var(--color-text-primary)]">{formatMoney(ruta.saldoCapital)}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Prestado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-warning)]">{ruta.prestadoDia > 0 ? '-' : ''}{formatMoney(ruta.prestadoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Cobrado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-success)]">{formatMoney(ruta.cobradoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Seguros</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-info)]">{formatMoney(ruta.segurosDia)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Movimientos del día */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Movimientos del día</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Sin movimientos registrados este día.</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map((m, i) => {
              const cfg = MOV_CONFIG[m.tipo] || MOV_CONFIG.cobro
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {m.esClavo && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--color-danger)]/15 text-[var(--color-danger)]">CLAVO</span>}
                      <span className="text-[11px] text-[var(--color-text-muted)]">{fmtHora(m.fecha)}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-primary)] truncate">
                      {m.tipo === 'gasto' ? (m.concepto || 'Gasto menor') : (m.cliente || 'Cliente')}
                      {m.rutaNombre ? <span className="text-[var(--color-text-muted)]"> · {m.rutaNombre}</span> : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0" style={{ color: cfg.color }}>
                    {cfg.signo}{formatMoney(m.monto)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
