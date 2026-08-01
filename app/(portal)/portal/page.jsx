'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatMoney } from '@/lib/i18n'

const FREQ_LABEL = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

const ESTADO_STYLE = {
  activo: { bg: 'bg-[var(--cf-green-pill-bg)]', text: 'text-[var(--cf-green-dark)]', label: 'Activo' },
  completado: { bg: 'bg-[var(--cf-fill)]', text: 'text-[var(--cf-ink-3)]', label: 'Pagado' },
  pendiente_aprobacion: { bg: 'bg-[var(--cf-gold-tint)]', text: 'text-[var(--cf-gold-dark)]', label: 'Pendiente' },
}

function ProgressRing({ porcentaje, size = 44 }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const offset = c - (c * Math.min(porcentaje, 100) / 100)
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cf-fill)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={porcentaje >= 100 ? 'var(--cf-green-dark)' : 'var(--cf-gold)'} strokeWidth={4} strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  )
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short' })
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

export default function PortalPage() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [prestamos, setPrestamos] = useState([])
  const [loading, setLoading] = useState(true)

  const fmt = useCallback((v) => formatMoney(v, session?.country || 'co'), [session?.country])

  useEffect(() => {
    Promise.all([
      fetch('/api/portal/session').then(r => r.ok ? r.json() : null),
      fetch('/api/portal/prestamos').then(r => r.ok ? r.json() : null),
    ])
      .then(([sess, prest]) => {
        if (!sess?.authenticated) {
          router.push('/portal/login')
          return
        }
        setSession(sess.cliente)
        setPrestamos(prest || [])
      })
      .catch(() => router.push('/portal/login'))
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/portal/auth', { method: 'DELETE' })
    router.push('/portal/login')
  }

  if (loading || !session) {
    return (
      <div className="p-4 max-w-lg mx-auto pt-12 space-y-4">
        <div className="animate-pulse rounded-[16px] bg-[var(--cf-fill)] h-20" />
        <div className="animate-pulse rounded-[16px] bg-[var(--cf-fill)] h-32" />
        <div className="animate-pulse rounded-[16px] bg-[var(--cf-fill)] h-32" />
      </div>
    )
  }

  const completo = session.datosCompletos
  const activos = prestamos.filter(p => p.estado === 'activo')
  const saldoTotal = activos.reduce((sum, p) => sum + p.saldo, 0)

  const proximoPago = activos
    .filter(p => p.proximoPago)
    .sort((a, b) => new Date(a.proximoPago.fecha) - new Date(b.proximoPago.fecha))[0]?.proximoPago || null

  const diasProximo = proximoPago ? diasHasta(proximoPago.fecha) : null

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] text-[var(--cf-ink-3)]">{session.orgNombre}</p>
          <h1 className="text-[18px] font-bold tracking-tight text-[var(--cf-ink)]">
            Hola, {session.nombre.split(' ')[0]}
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-full bg-[var(--cf-fill)] flex items-center justify-center text-[var(--cf-ink-3)] hover:bg-[var(--cf-border-strong)] transition-colors"
          title="Cerrar sesión"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Próximo pago — lo más relevante */}
      {proximoPago && (
        <div className="mx-4 mb-3 p-4 rounded-[16px] bg-[var(--cf-gold-tint)] border border-[color-mix(in_oklch,var(--cf-gold),transparent_80%)]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-[12px] bg-[color-mix(in_oklch,var(--cf-gold),transparent_85%)] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-gold)]">Próximo pago</p>
              <p className="text-[15px] font-bold text-[var(--cf-ink)] capitalize">{formatDateFull(proximoPago.fecha)}</p>
            </div>
          </div>
          <div className="flex items-baseline justify-between pl-[52px]">
            <span className="text-[20px] font-mono font-bold text-[var(--cf-ink)]">{fmt(proximoPago.monto)}</span>
            <span className={`text-[12px] font-semibold ${
              diasProximo !== null && diasProximo < 0 ? 'text-[var(--cf-red-dark)]'
              : diasProximo === 0 ? 'text-[var(--cf-gold-dark)]'
              : 'text-[var(--cf-ink-3)]'
            }`}>
              {diasProximo !== null && (
                diasProximo < 0 ? `Vencido hace ${Math.abs(diasProximo)} día${Math.abs(diasProximo) > 1 ? 's' : ''}`
                : diasProximo === 0 ? 'Hoy'
                : diasProximo === 1 ? 'Mañana'
                : `En ${diasProximo} días`
              )}
            </span>
          </div>
        </div>
      )}

      {/* Resumen saldo */}
      {activos.length > 0 && (
        <div className="mx-4 mb-4 p-4 rounded-[16px] bg-[var(--cf-card)] border border-[var(--cf-border)]">
          <div className="flex items-center gap-4">
            <ProgressRing porcentaje={activos.length === 1 ? activos[0].porcentaje : Math.round(activos.reduce((s, p) => s + p.porcentaje, 0) / activos.length)} size={52} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">Saldo pendiente</p>
              <p className="text-[22px] font-mono font-bold text-[var(--cf-ink)] tracking-tight">{fmt(saldoTotal)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-[var(--cf-ink-3)]">Progreso</p>
              <p className="text-[16px] font-mono font-bold text-[var(--cf-gold)]">
                {activos.length === 1 ? activos[0].porcentaje : Math.round(activos.reduce((s, p) => s + p.porcentaje, 0) / activos.length)}%
              </p>
            </div>
          </div>

          {completo && (
            <>
              {(() => {
                const pagadoTotal = activos.reduce((sum, p) => sum + (p.totalPagado || 0), 0)
                const totalAPagarSum = activos.reduce((sum, p) => sum + (p.totalAPagar || 0), 0)
                const pctGlobal = totalAPagarSum > 0 ? Math.round((pagadoTotal / totalAPagarSum) * 100) : 0
                return (
                  <>
                    <div className="mt-3 h-2 rounded-full bg-[var(--cf-fill)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(pctGlobal, 100)}%`, background: pctGlobal >= 100 ? 'var(--cf-green-dark)' : 'var(--cf-gold)' }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-[var(--cf-ink-3)]">Pagado: {fmt(pagadoTotal)}</span>
                      <span className="text-[10px] text-[var(--cf-ink-3)]">Total: {fmt(totalAPagarSum)}</span>
                    </div>
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* Lista de préstamos */}
      <div className="px-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cf-ink-3)]">
          {prestamos.length === 0 ? 'Sin préstamos' : `${prestamos.length} préstamo${prestamos.length > 1 ? 's' : ''}`}
        </p>

        {prestamos.map(p => {
          const est = ESTADO_STYLE[p.estado] || ESTADO_STYLE.activo
          return (
            <Link
              key={p.id}
              href={`/portal/prestamos/${p.id}`}
              className="block p-4 rounded-[16px] bg-[var(--cf-card)] border border-[var(--cf-border)] hover:border-[var(--cf-border-strong)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--cf-ink)]">
                    {p.nombreProducto || (completo ? fmt(p.montoPrestado) : 'Préstamo')}
                  </p>
                  <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
                    {FREQ_LABEL[p.frecuencia] || p.frecuencia} · Cuota {fmt(p.cuota)}
                  </p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${est.bg} ${est.text}`}>
                  {est.label}
                </span>
              </div>

              {p.estado === 'activo' && p.proximoPago && (
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-[var(--cf-gold)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[11px] text-[var(--cf-ink-2)]">
                    Próximo pago: {formatDate(p.proximoPago.fecha)} · {fmt(p.proximoPago.monto)}
                  </span>
                </div>
              )}

              {p.estado === 'activo' && (
                <>
                  <div className="h-1.5 rounded-full bg-[var(--cf-fill)] overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(p.porcentaje, 100)}%`, background: 'var(--cf-gold)' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-[var(--cf-ink-3)]">
                      Saldo: {fmt(p.saldo)}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-[var(--cf-ink)]">
                      {p.porcentaje}%
                    </span>
                  </div>
                </>
              )}

              {p.estado === 'completado' && (
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[var(--cf-green-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[11px] text-[var(--cf-green-dark)] font-medium">Préstamo completado</span>
                </div>
              )}
            </Link>
          )
        })}

        {prestamos.length === 0 && (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-[var(--cf-ink-3)] opacity-40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-[13px] text-[var(--cf-ink-3)]">No tienes préstamos registrados</p>
          </div>
        )}
      </div>
    </div>
  )
}
