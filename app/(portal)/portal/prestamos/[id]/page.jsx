'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'

const FREQ_LABEL = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }
const TIPO_LABEL = { completo: 'Cuota', parcial: 'Parcial', capital: 'Capital', recargo: 'Recargo', descuento: 'Descuento', liquidacion: 'Liquidación', intereses: 'Intereses' }

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--color-bg-hover)] ${className}`} />
}

export default function PortalPrestamoDetalle() {
  const router = useRouter()
  const params = useParams()
  const [prestamo, setPrestamo] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  const fmt = useCallback((v) => formatMoney(v, session?.country || 'co'), [session?.country])

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/session').then(r => r.ok ? r.json() : null),
      fetch(`/api/portal/prestamos/${params.id}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([sess, prest]) => {
        if (!sess?.authenticated) { router.push('/portal/login'); return }
        setSession(sess.cliente)
        if (!prest) { router.push('/portal'); return }
        setPrestamo(prest)
      })
      .catch(() => router.push('/portal'))
      .finally(() => setLoading(false))
  }, [params.id, router])

  if (loading || !prestamo) {
    return (
      <div className="max-w-lg mx-auto p-4 pt-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  const saldo = prestamo.saldo
  const pct = prestamo.porcentaje

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link
          href="/portal"
          className="w-9 h-9 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border-hover)] transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-bold tracking-tight text-[var(--color-text-primary)] truncate">
            {prestamo.nombreProducto || `Préstamo por ${fmt(prestamo.montoPrestado)}`}
          </h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {FREQ_LABEL[prestamo.frecuencia]} · {prestamo.diasPlazo} días
          </p>
        </div>
      </div>

      {/* Progress card */}
      <div className="mx-4 mb-4 p-4 rounded-[16px] bg-[var(--color-bg-card)] border border-[var(--color-border)]">
        {prestamo.estado === 'completado' ? (
          <div className="text-center py-3">
            <svg className="w-10 h-10 mx-auto text-[var(--color-success)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[14px] font-bold text-[var(--color-success)]">Préstamo completado</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Has pagado el 100% del préstamo</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Saldo pendiente</p>
                <p className="text-[26px] font-mono font-bold text-[var(--color-text-primary)] tracking-tight">{fmt(saldo)}</p>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-mono font-bold text-[var(--color-accent)]">{pct}%</p>
                <p className="text-[9px] text-[var(--color-text-muted)]">pagado</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--color-accent)' }}
              />
            </div>
            {prestamo.diasMora > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--color-danger-dim)]">
                <svg className="w-4 h-4 text-[var(--color-danger)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[12px] font-medium text-[var(--color-danger)]">
                  {prestamo.diasMora} día{prestamo.diasMora > 1 ? 's' : ''} en mora
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="mx-4 mb-4 flex gap-1 p-1 rounded-[12px] bg-[var(--color-bg-hover)]">
        {[
          { key: 'resumen', label: 'Resumen' },
          { key: 'pagos', label: `Pagos (${prestamo.pagos.length})` },
          { key: 'cuotas', label: 'Cuotas' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-[12px] font-semibold py-2 rounded-[10px] transition-all ${
              tab === t.key
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mx-4">
        {tab === 'resumen' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Monto prestado" value={fmt(prestamo.montoPrestado)} />
              <InfoCard label="Total a pagar" value={fmt(prestamo.totalAPagar)} />
              <InfoCard label="Cuota" value={fmt(prestamo.cuotaDiaria)} sub={FREQ_LABEL[prestamo.frecuencia]} />
              <InfoCard label="Interés" value={`${prestamo.tasaInteres}%`} sub={prestamo.modoInteres} />
              <InfoCard label="Inicio" value={formatDate(prestamo.fechaInicio)} />
              <InfoCard label="Vencimiento" value={formatDate(prestamo.fechaFin)} />
              <InfoCard label="Total pagado" value={fmt(prestamo.totalPagado)} highlight="success" />
              <InfoCard label="Saldo" value={fmt(saldo)} highlight={saldo > 0 ? 'accent' : 'success'} />
            </div>
            {prestamo.proximaCuota && prestamo.estado === 'activo' && (
              <div className="p-3 rounded-[12px] bg-[var(--color-accent-soft)] border border-[var(--color-accent)] border-opacity-20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">Próxima cuota</p>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-[16px] font-mono font-bold text-[var(--color-text-primary)]">{fmt(prestamo.proximaCuota.monto)}</span>
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    Cuota #{prestamo.proximaCuota.numero} · {formatDate(prestamo.proximaCuota.fechaProgramada)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'pagos' && (
          <div className="space-y-1">
            {prestamo.pagos.length === 0 ? (
              <EmptyState text="Sin pagos registrados" />
            ) : (
              prestamo.pagos.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 px-3 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[var(--color-success)]">+{fmt(p.montoPagado)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] font-medium">
                        {TIPO_LABEL[p.tipo] || p.tipo}
                      </span>
                    </div>
                    {p.nota && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">{p.nota}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-[var(--color-text-muted)]">{formatDate(p.fechaPago)}</p>
                    {p.cuotaNumero && <p className="text-[9px] text-[var(--color-text-muted)]">Cuota #{p.cuotaNumero}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'cuotas' && (
          <div className="space-y-1">
            {!prestamo.cuotas?.length ? (
              <EmptyState text="Sin cuotas programadas" />
            ) : (
              prestamo.cuotas.map(c => {
                const pagada = c.estado === 'pagada'
                const vencida = !pagada && new Date(c.fechaProgramada) < new Date()
                return (
                  <div key={c.numero} className={`flex items-center justify-between py-2.5 px-3 rounded-[10px] ${vencida ? 'bg-[var(--color-danger-dim)]' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        pagada ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]'
                          : vencida ? 'bg-[var(--color-danger)] text-white'
                          : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
                      }`}>
                        {pagada ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : c.numero}
                      </span>
                      <div>
                        <span className={`text-[12px] font-medium ${pagada ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}>
                          {fmt(c.monto)}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[11px] ${vencida ? 'text-[var(--color-danger)] font-bold' : 'text-[var(--color-text-muted)]'}`}>
                      {formatDate(c.fechaProgramada)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value, sub, highlight }) {
  const colorClass = highlight === 'success' ? 'text-[var(--color-success)]'
    : highlight === 'accent' ? 'text-[var(--color-accent)]'
    : 'text-[var(--color-text-primary)]'

  return (
    <div className="p-3 rounded-[12px] bg-[var(--color-bg-card)] border border-[var(--color-border)]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-[14px] font-mono font-bold mt-0.5 ${colorClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8">
      <p className="text-[13px] text-[var(--color-text-muted)]">{text}</p>
    </div>
  )
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
