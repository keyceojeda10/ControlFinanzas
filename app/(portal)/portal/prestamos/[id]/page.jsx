'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'

const FREQ_LABEL = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }
const TIPO_LABEL = { completo: 'Cuota', parcial: 'Parcial', capital: 'Capital', recargo: 'Recargo', descuento: 'Descuento', liquidacion: 'Liquidación', intereses: 'Intereses' }

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-[10px] bg-[var(--cf-fill)] ${className}`} />
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateFull(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

function diasHasta(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const target = new Date(fecha)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - hoy) / (1000 * 60 * 60 * 24))
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

  const completo = session?.datosCompletos
  const saldo = prestamo.saldo
  const pct = prestamo.porcentaje
  const proxCuota = prestamo.proximaCuota
  const diasProx = proxCuota ? diasHasta(proxCuota.fechaProgramada) : null

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link
          href="/portal"
          className="w-9 h-9 rounded-full bg-[var(--cf-fill)] flex items-center justify-center text-[var(--cf-ink-2)] hover:bg-[var(--cf-border-strong)] transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-bold tracking-tight text-[var(--cf-ink)] truncate">
            {prestamo.nombreProducto || (completo ? `Préstamo por ${fmt(prestamo.montoPrestado)}` : 'Préstamo')}
          </h1>
          <p className="text-[11px] text-[var(--cf-ink-3)]">
            {FREQ_LABEL[prestamo.frecuencia]} · {prestamo.diasPlazo} días
          </p>
        </div>
      </div>

      {/* Próximo pago — lo más relevante */}
      {proxCuota && prestamo.estado === 'activo' && (
        <div className="mx-4 mb-3 p-4 rounded-[16px] bg-[var(--cf-gold-tint)] border border-[color-mix(in_oklch,var(--cf-gold),transparent_80%)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-[color-mix(in_oklch,var(--cf-gold),transparent_85%)] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-gold)]">Próximo pago · Cuota #{proxCuota.numero}</p>
              <p className="text-[15px] font-bold text-[var(--cf-ink)] capitalize">{formatDateFull(proxCuota.fechaProgramada)}</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2 pl-[52px]">
            <span className="text-[20px] font-mono font-bold text-[var(--cf-ink)]">{fmt(proxCuota.monto)}</span>
            <span className={`text-[12px] font-semibold ${
              diasProx !== null && diasProx < 0 ? 'text-[var(--cf-red-dark)]'
              : diasProx === 0 ? 'text-[var(--cf-gold-dark)]'
              : 'text-[var(--cf-ink-3)]'
            }`}>
              {diasProx !== null && (
                diasProx < 0 ? `Vencido hace ${Math.abs(diasProx)} día${Math.abs(diasProx) > 1 ? 's' : ''}`
                : diasProx === 0 ? 'Hoy'
                : diasProx === 1 ? 'Mañana'
                : `En ${diasProx} días`
              )}
            </span>
          </div>
        </div>
      )}

      {/* Progress card */}
      <div className="mx-4 mb-4 p-4 rounded-[16px] bg-[var(--cf-card)] border border-[var(--cf-border)]">
        {prestamo.estado === 'completado' ? (
          <div className="text-center py-3">
            <svg className="w-10 h-10 mx-auto text-[var(--cf-green-dark)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[14px] font-bold text-[var(--cf-green-dark)]">Préstamo completado</p>
            <p className="text-[11px] text-[var(--cf-ink-3)] mt-1">Has pagado el 100% del préstamo</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Saldo pendiente</p>
                <p className="text-[26px] font-mono font-bold text-[var(--cf-ink)] tracking-tight">{fmt(saldo)}</p>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-mono font-bold text-[var(--cf-gold)]">{pct}%</p>
                <p className="text-[9px] text-[var(--cf-ink-3)]">pagado</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--cf-fill)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--cf-gold)' }}
              />
            </div>
            {prestamo.diasMora > 0 && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--cf-red-pill-bg)]">
                <svg className="w-4 h-4 text-[var(--cf-red-dark)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-[12px] font-medium text-[var(--cf-red-dark)]">
                  {prestamo.diasMora} día{prestamo.diasMora > 1 ? 's' : ''} en mora
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="mx-4 mb-4 flex gap-1 p-1 rounded-[12px] bg-[var(--cf-fill)]">
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
                ? 'bg-[var(--cf-card)] text-[var(--cf-ink)] shadow-sm'
                : 'text-[var(--cf-ink-3)] hover:text-[var(--cf-ink-2)]'
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
              {completo && prestamo.montoPrestado != null && (
                <InfoCard label="Monto prestado" value={fmt(prestamo.montoPrestado)} />
              )}
              {completo && prestamo.totalAPagar != null && (
                <InfoCard label="Total a pagar" value={fmt(prestamo.totalAPagar)} />
              )}
              <InfoCard label="Cuota" value={fmt(prestamo.cuota)} sub={FREQ_LABEL[prestamo.frecuencia]} />
              {completo && prestamo.tasaInteres != null && (
                <InfoCard label="Interés" value={`${prestamo.tasaInteres}%`} sub={prestamo.modoInteres} />
              )}
              <InfoCard label="Inicio" value={formatDate(prestamo.fechaInicio)} />
              <InfoCard label="Vencimiento" value={formatDate(prestamo.fechaFin)} />
              <InfoCard label="Total pagado" value={fmt(prestamo.totalPagado)} highlight="success" />
              <InfoCard label="Saldo" value={fmt(saldo)} highlight={saldo > 0 ? 'accent' : 'success'} />
            </div>
          </div>
        )}

        {tab === 'pagos' && (
          <div className="space-y-1">
            {prestamo.pagos.length === 0 ? (
              <EmptyState text="Sin pagos registrados" />
            ) : (
              prestamo.pagos.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 px-3 rounded-[10px] hover:bg-[var(--cf-fill)] transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[var(--cf-green-dark)]">+{fmt(p.montoPagado)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--cf-fill)] text-[var(--cf-ink-3)] font-medium">
                        {TIPO_LABEL[p.tipo] || p.tipo}
                      </span>
                    </div>
                    {p.nota && <p className="text-[10px] text-[var(--cf-ink-3)] mt-0.5 truncate">{p.nota}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-[var(--cf-ink-3)]">{formatDate(p.fechaPago)}</p>
                    {p.cuotaNumero && <p className="text-[9px] text-[var(--cf-ink-3)]">Cuota #{p.cuotaNumero}</p>}
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
                  <div key={c.numero} className={`flex items-center justify-between py-2.5 px-3 rounded-[10px] ${vencida ? 'bg-[var(--cf-red-pill-bg)]' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        pagada ? 'bg-[var(--cf-green-pill-bg)] text-[var(--cf-green-dark)]'
                          : vencida ? 'bg-[var(--cf-red-dark)] text-white'
                          : 'bg-[var(--cf-fill)] text-[var(--cf-ink-3)]'
                      }`}>
                        {pagada ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : c.numero}
                      </span>
                      <div>
                        <span className={`text-[12px] font-medium ${pagada ? 'text-[var(--cf-ink-3)] line-through' : 'text-[var(--cf-ink)]'}`}>
                          {fmt(c.monto)}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[11px] ${vencida ? 'text-[var(--cf-red-dark)] font-bold' : 'text-[var(--cf-ink-3)]'}`}>
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
  const colorClass = highlight === 'success' ? 'text-[var(--cf-green-dark)]'
    : highlight === 'accent' ? 'text-[var(--cf-gold)]'
    : 'text-[var(--cf-ink)]'

  return (
    <div className="p-3 rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">{label}</p>
      <p className={`text-[14px] font-mono font-bold mt-0.5 ${colorClass}`}>{value}</p>
      {sub && <p className="text-[9px] text-[var(--cf-ink-3)]">{sub}</p>}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-8">
      <p className="text-[13px] text-[var(--cf-ink-3)]">{text}</p>
    </div>
  )
}
