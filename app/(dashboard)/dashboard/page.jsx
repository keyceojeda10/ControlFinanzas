'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'
import { useAuth } from '@/hooks/useAuth'
import { guardarEnCache, leerDeCache, obtenerDashboardOffline } from '@/lib/offline'
import { useOffline } from '@/components/providers/OfflineProvider'
import { useOnboarding } from '@/components/onboarding/useOnboarding'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import SpotlightOverlay from '@/components/onboarding/SpotlightOverlay'
import CobradorOnboarding from '@/components/onboarding/CobradorOnboarding'
import CacheAge from '@/components/offline/CacheAge'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-[12px] ${className}`} style={{ background: 'var(--color-bg-hover)' }} />
}

function KpiCard({ label, value, sub, color = 'var(--color-text-primary)', icon, info }) {
  const [showInfo, setShowInfo] = useState(false)
  const toggle = (e) => {
    if (!info) return
    e?.preventDefault?.()
    e?.stopPropagation?.()
    setShowInfo(v => !v)
  }
  return (
    <div
      onClick={toggle}
      role={info ? 'button' : undefined}
      tabIndex={info ? 0 : undefined}
      onKeyDown={info ? (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) } : undefined}
      className={`rounded-[16px] px-4 py-4 relative group transition-transform duration-200 ${info ? 'cursor-pointer hover:scale-[1.01]' : ''}`}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 10%, var(--color-bg-card)) 0%, var(--color-bg-card) 45%, var(--color-bg-card) 75%, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 100%)`,
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[11px] leading-tight" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
          {info && (
            <span
              aria-hidden
              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold pointer-events-none"
              style={{ background: 'color-mix(in srgb, var(--color-text-muted) 25%, transparent)', color: 'var(--color-text-secondary)' }}
            >
              i
            </span>
          )}
        </div>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      <p className="text-xl font-bold leading-tight font-mono-display truncate" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
      {info && showInfo && (
        <div
          className="absolute left-2 right-2 top-full mt-1 z-30 rounded-[10px] px-3 py-2 text-[11px] leading-relaxed"
          style={{
            background: 'var(--color-bg-base)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
            whiteSpace: 'normal',
          }}
        >
          {info}
        </div>
      )}
    </div>
  )
}

function RoutesCard({ value, sub }) {
  return (
    <KpiCard
      label="Rutas activas"
      value={value}
      sub={sub}
      color="#8b5cf6"
      info="Cantidad de rutas habilitadas en tu organizacion."
      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" /></svg>}
    />
  )
}

function QuickLink({ href, label, desc, color, dataTour }) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className="rounded-[16px] px-4 py-4 transition-all duration-200 group flex items-center gap-3 hover:scale-[1.01]"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)`,
        border: '1px solid var(--color-border)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 14px color-mix(in srgb, ${color} 18%, transparent)`; e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 25%, var(--color-border))` }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
    >
      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
    </Link>
  )
}

function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function DashboardPage() {
  const { session, loading: authLoading, esOwner, puedeCrearClientes, puedeCrearPrestamos } = useAuth()

  const [data, setData] = useState(null)
  const [moraData, setMoraData] = useState(undefined)
  const [capitalData, setCapitalData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [fechaActual, setFechaActual] = useState('')
  const [horaActual, setHoraActual] = useState('')
  const [actualizadoEn, setActualizadoEn] = useState(null)

  const { syncMeta, startBulkSync, bulkSyncing, bulkProgress, lastSyncedAt } = useOffline()
  const onboarding = useOnboarding(authLoading ? null : esOwner)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setFechaActual(now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }))
      setHoraActual(now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboard = useCallback(async () => {
    setIsOffline(false)
    // Offline real: leer de IndexedDB directamente
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache('dashboard:resumen')
        if (!cached) cached = await obtenerDashboardOffline()
        if (cached) { setData(cached); setIsOffline(true); setLoading(false); return }
      } catch {}
    }
    try {
      // Cache-buster: evita que el navegador o cualquier intermediario reuse
      // una respuesta vieja. Combinado con Cache-Control: no-store en la API,
      // garantiza que cada carga del dashboard sea fresca.
      const r = await fetch(`/api/dashboard/resumen?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      const d = await r.json()
      if (d.error) setError(d.error)
      else if (d.offline) throw new Error('offline')
      else {
        setData(d)
        setActualizadoEn(d.generatedAt || new Date().toISOString())
        setError('')
        guardarEnCache('dashboard:resumen', d).catch(() => {})
      }
    } catch {
      try {
        let cached = await leerDeCache('dashboard:resumen')
        if (!cached) cached = await obtenerDashboardOffline()
        if (cached) { setData(cached); setIsOffline(true); return }
      } catch {}
      setError('No se pudo cargar el resumen.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard, lastSyncedAt])

  // Refrescar cuando el usuario vuelve a la pestaña/app despues de tenerla en
  // segundo plano. Sin esto, KPIs se quedan congelados con el snapshot inicial.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadDashboard() }
    const onFocus = () => loadDashboard()
    const onOnline = () => loadDashboard()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }, [loadDashboard])

  useEffect(() => {
    fetch('/api/mora')
      .then((r) => r.json())
      .then((d) => { setMoraData(d); guardarEnCache('dashboard:mora', d).catch(() => {}) })
      .catch(async () => {
        try {
          const cached = await leerDeCache('dashboard:mora')
          if (cached) { setMoraData(cached); return }
        } catch {}
        setMoraData({ total: 0, agrupado: {} })
      })
  }, [lastSyncedAt])

  // Cargar capital solo para owners
  useEffect(() => {
    if (authLoading || !esOwner) return
    fetch('/api/capital/resumen')
      .then((r) => r.json())
      .then((d) => { if (d.configurado) { setCapitalData(d); guardarEnCache('dashboard:capital', d).catch(() => {}) } })
      .catch(async () => {
        try {
          const cached = await leerDeCache('dashboard:capital')
          if (cached) setCapitalData(cached)
        } catch {}
      })
  }, [authLoading, esOwner])

  const moraPct = data ? (data.clientes.total > 0 ? Math.round((data.clientes.enMora / data.clientes.total) * 100) : 0) : 0

  // Wizard: full-screen takeover for brand-new users
  if (onboarding.showWizard && esOwner) {
    return (
      <div className="max-w-3xl mx-auto">
        <OnboardingWizard
          nombre={session?.user?.nombre || session?.user?.name}
          initialStep={onboarding.wizardInitialStep}
          onComplete={() => {
            onboarding.dismiss()
            window.location.reload()
          }}
          onDismiss={() => {
            onboarding.dismiss()
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {onboarding.visible && (
        <OnboardingChecklist
          misiones={onboarding.misiones}
          completadas={onboarding.completadas}
          total={onboarding.total}
          progreso={onboarding.progreso}
          onDismiss={onboarding.dismiss}
          onSpotlight={onboarding.showSpotlight}
        />
      )}
      {!authLoading && !esOwner && session?.user?.id && (
        <CobradorOnboarding userId={session.user.id} />
      )}
      <SpotlightOverlay
        spotlight={onboarding.spotlight}
        onClose={onboarding.hideSpotlight}
      />
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Tu resumen</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboard}
              className="text-[10px] px-2 py-1 rounded-[8px] transition-colors"
              style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              title="Actualizar datos"
            >
              ↻ Actualizar
            </button>
            <CacheAge compact />
          </div>
        </div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {fechaActual || 'Resumen de tu cartera hoy'}
          {horaActual && <span className="font-mono-display ml-2" style={{ color: 'var(--color-accent)' }}>{horaActual}</span>}
        </p>
        {actualizadoEn && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Datos actualizados a las {new Date(actualizadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}
          </p>
        )}
      </div>
      {isOffline && (
        <div className="text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--color-warning-dim)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)', color: 'var(--color-warning)' }}>
          <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: 'var(--color-warning)' }} />
          Datos guardados — sin conexión
        </div>
      )}
      {error && <div className="text-sm rounded-[12px] px-4 py-3" style={{ background: 'var(--color-danger-dim)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)' }}>{error}</div>}
      {loading || !mounted ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Clientes activos" value={data.clientes.total} sub={data.clientes.enMora > 0 ? `${data.clientes.enMora} en mora` : 'Sin mora'} color="#f5c518" info="Total de clientes con al menos un prestamo activo. Si hay clientes en mora, se muestra cuantos." icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} />
          <KpiCard label="Prestamos activos" value={data.prestamos.activos} sub={`${data.prestamos.completados} completados`} color="#22c55e" info="Cantidad de prestamos vigentes. Tambien muestra cuantos ya estan completamente pagados." icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
          <KpiCard label="Cartera activa" value={formatCOP(data.prestamos.carteraActiva)} sub={`Capital: ${formatCOP(data.prestamos.capitalPrestado)}`} color="#f59e0b" info="Total que vas a recibir cuando todos terminen de pagar (capital + intereses). Solo cambia si creas o se completa un prestamo." icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>} />
          {data.prestamos.saldoPorCobrar !== undefined && (
            <KpiCard
              label="Por cobrar"
              value={formatCOP(data.prestamos.saldoPorCobrar)}
              sub="Saldo pendiente real"
              color="#0ea5e9"
              info="Suma del saldo pendiente real de todos los prestamos activos. Baja con cada pago que recibes."
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>}
            />
          )}
          <KpiCard label="Cuota diaria total" value={formatCOP(data.prestamos.cuotaDiariaTotal)} sub="Esperado por dia" color="#a855f7" info="Suma de las cuotas diarias de todos los prestamos activos. Es lo que esperas cobrar en un dia tipico." icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>} />
          {capitalData && (
            <KpiCard
              label="Saldo disponible"
              value={formatCOP(capitalData.saldo)}
              sub={capitalData.saldo < 0 ? 'Capital insuficiente' : 'Capital en caja'}
              color={capitalData.saldo < 0 ? '#ef4444' : '#06b6d4'}
              info="Dinero que tienes disponible en caja para prestar o retirar. Sube con cobros e inyecciones, baja con desembolsos, retiros y gastos."
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
            />
          )}
          {data.finanzas && (
            <KpiCard
              label="Patrimonio"
              value={formatCOP(data.finanzas.patrimonio)}
              sub={`Caja + por cobrar - gastos del mes`}
              color="#10b981"
              info={`Tu foto financiera completa: caja disponible (${formatCOP(data.finanzas.cajaDisponible)}) + por cobrar real (${formatCOP(data.prestamos.saldoPorCobrar)}) - gastos del mes (${formatCOP(data.finanzas.gastosMes)}). Refleja tus movimientos del dia: pagos, prestamos, retiros y gastos.`}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>}
            />
          )}
          <RoutesCard
            value={data.rutas?.activas ?? 0}
            sub={esOwner ? 'Rutas habilitadas en la organización' : 'Rutas activas asignadas al equipo'}
          />
        </div>
      )}
      {loading || !mounted ? (
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-[16px] px-4 py-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 10%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, var(--color-success) 6%, var(--color-bg-card)) 100%)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
            }}
          >
            <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Recaudado hoy</p>
            <p className="text-xl font-bold font-mono-display truncate" style={{ color: 'var(--color-success)' }}>{formatCOP(data.cobros.hoy)}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.cobros.cantidadHoy} pagos registrados</p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
              <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}%` : '0%' }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de la cuota diaria` : 'Sin cuotas esperadas'}</p>
          </div>
          <div
            className="rounded-[16px] px-4 py-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-card)) 100%)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
            }}
          >
            <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-secondary)' }}>Recaudado este mes</p>
            <p className="text-xl font-bold font-mono-display truncate" style={{ color: 'var(--color-accent)' }}>{formatCOP(data.cobros.mes)}</p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{data.cobros.cantidadMes} pagos en el mes</p>
            {data.clientes.enMora > 0 && (<div className="mt-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-danger)' }} /><p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>{moraPct}% de clientes en mora</p></div>)}
          </div>
        </div>
      )}
      {(loading || !mounted) ? <Skeleton className="h-44" /> : data && data.ultimosPagos.length > 0 && (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 12px rgba(20,20,40,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Últimos pagos</p>
            <Link href="/prestamos" className="text-[11px] hover:underline" style={{ color: 'var(--color-accent)' }}>Ver todos →</Link>
          </div>
          <div className="space-y-0 divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5" style={{ borderTopColor: 'var(--color-border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.cliente}</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold shrink-0 ml-3 font-mono-display" style={{ color: 'var(--color-success)' }}>+{formatCOP(p.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && mounted && moraData !== undefined && moraData.total > 0 && (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, var(--color-bg-card) 100%)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--color-danger) 12%, transparent)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>Alertas de mora</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--color-danger)', color: 'var(--color-text-primary)' }}>{moraData.total} clientes</span>
          </div>
          <div className="space-y-2">
            {moraData.agrupado.mora31plus.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-danger) 18%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-danger)' }}>Más de 30 días ({moraData.agrupado.mora31plus.length})</p>
                {moraData.agrupado.mora31plus.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-danger)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-danger)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora16a30.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-warning) 18%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-warning)' }}>16-30 días ({moraData.agrupado.mora16a30.length})</p>
                {moraData.agrupado.mora16a30.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-warning)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora8a15.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-accent)' }}>8-15 días ({moraData.agrupado.mora8a15.length})</p>
                {moraData.agrupado.mora8a15.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-accent)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora1a7.length > 0 && (
              <div className="rounded-[12px] p-3" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-success)' }}>1-7 días ({moraData.agrupado.mora1a7.length})</p>
                {moraData.agrupado.mora1a7.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 rounded px-1 -mx-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)]">
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.cliente.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-success)' }}>{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold shrink-0 ml-2 font-mono-display" style={{ color: 'var(--color-success)' }}>{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Offline sync status indicator */}
      {syncMeta && !bulkSyncing && !bulkProgress && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--color-success) 15%, transparent)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Datos offline: {syncMeta.totalClientes} clientes, {syncMeta.totalPrestamos} prestamos
                <span> · </span>
                {new Date(syncMeta.syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
              </p>
            </div>
            <button onClick={startBulkSync} className="text-[10px] transition-colors shrink-0 hover:text-[var(--color-success)]" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {bulkSyncing && (
        <div className="w-full rounded-[16px] px-4 py-3 text-left" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 25%, transparent)' }}>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[11px]" style={{ color: 'var(--color-success)' }}>{bulkProgress?.message || 'Sincronizando datos...'}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>Accesos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {puedeCrearClientes && <QuickLink href="/clientes/nuevo" label="Nuevo cliente" desc="Registrar cliente" color="#f5c518" dataTour="nuevo-cliente" />}
          {puedeCrearPrestamos && <QuickLink href="/prestamos/nuevo" label="Nuevo prestamo" desc="Crear prestamo" color="#22c55e" dataTour="nuevo-prestamo" />}
          <QuickLink href="/caja" label="Cierre de caja" desc="Registrar cierre del dia" color="#f59e0b" dataTour="caja" />
          <QuickLink href="/clientes" label="Clientes" desc="Ver cartera completa" color="#a855f7" dataTour="prestamos" />
          {esOwner && <QuickLink href="/capital" label="Capital" desc="Control de capital" color="#06b6d4" />}
          {esOwner && <QuickLink href="/rutas" label="Rutas" desc="Gestionar rutas" color="#8b5cf6" dataTour="rutas" />}
          {esOwner && <QuickLink href="/configuracion" label="Configuracion" desc="Perfil y organizacion" color="#555555" />}
        </div>
      </div>
    </div>
  )
}
