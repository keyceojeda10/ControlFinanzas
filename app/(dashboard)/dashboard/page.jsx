'use client'
import { useState, useEffect } from 'react'
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

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-[#2a2a2a] rounded-[12px] ${className}`} />
}

function KpiCard({ label, value, sub, color = '#ffffff', icon }) {
  return (
    <div
      className="rounded-[16px] px-4 py-4 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-200"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, #111115 40%, #111115 70%, ${color}04 100%)`,
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] text-[#999] leading-tight">{label}</p>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
      <p className="text-xl font-bold leading-tight font-mono-display truncate" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#888] mt-1">{sub}</p>}
    </div>
  )
}

function QuickLink({ href, label, desc, color, dataTour }) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className="rounded-[16px] px-4 py-4 transition-all duration-200 group flex items-center gap-3 hover:scale-[1.01]"
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, #111115 50%, #111115 100%)`,
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 15px ${color}10`; e.currentTarget.style.borderColor = `${color}18` }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
    >
      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white leading-tight">{label}</p>
        <p className="text-[10px] text-[#888] leading-tight mt-0.5">{desc}</p>
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

  useEffect(() => {
    const loadDashboard = async () => {
      setIsOffline(false)
      // Offline: prefer IndexedDB directly
      if (!navigator.onLine) {
        try {
          let cached = await leerDeCache('dashboard:resumen')
          if (!cached) cached = await obtenerDashboardOffline()
          if (cached) { setData(cached); setIsOffline(true); setLoading(false); return }
        } catch {}
      }
      try {
        const r = await fetch('/api/dashboard/resumen')
        const d = await r.json()
        if (d.error) setError(d.error)
        else if (d.offline) throw new Error('offline')
        else { setData(d); guardarEnCache('dashboard:resumen', d).catch(() => {}) }
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
    }
    loadDashboard()
  }, [lastSyncedAt])

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
        <h1 className="text-xl font-bold text-white">Tu resumen</h1>
        <p className="text-sm text-[#888888] mt-0.5">
          {fechaActual || 'Resumen de tu cartera hoy'}
          {horaActual && <span className="text-[#f5c518] font-mono-display ml-2">{horaActual}</span>}
        </p>
      </div>
      {isOffline && (
        <div className="bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
      {error && <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">{error}</div>}
      {loading || !mounted ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Clientes activos" value={data.clientes.total} sub={data.clientes.enMora > 0 ? `${data.clientes.enMora} en mora` : 'Sin mora'} color="#f5c518" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>} />
          <KpiCard label="Prestamos activos" value={data.prestamos.activos} sub={`${data.prestamos.completados} completados`} color="#22c55e" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
          <KpiCard label="Cartera activa" value={formatCOP(data.prestamos.carteraActiva)} sub={`Capital: ${formatCOP(data.prestamos.capitalPrestado)}`} color="#f59e0b" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>} />
          <KpiCard label="Cuota diaria total" value={formatCOP(data.prestamos.cuotaDiariaTotal)} sub="Esperado por dia" color="#a855f7" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>} />
          {capitalData && (
            <KpiCard
              label="Saldo disponible"
              value={formatCOP(capitalData.saldo)}
              sub={capitalData.saldo < 0 ? 'Capital insuficiente' : 'Capital en caja'}
              color={capitalData.saldo < 0 ? '#ef4444' : '#06b6d4'}
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>}
            />
          )}
        </div>
      )}
      {loading || !mounted ? (
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-[16px] px-4 py-4"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, #111115 40%, #111115 70%, rgba(52,211,153,0.03) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <p className="text-[11px] text-[#999] mb-1">Recaudado hoy</p>
            <p className="text-xl font-bold text-[#34d399] font-mono-display truncate">{formatCOP(data.cobros.hoy)}</p>
            <p className="text-[10px] text-[#888] mt-1">{data.cobros.cantidadHoy} pagos registrados</p>
            <div className="mt-2 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div className="h-full rounded-full progress-shimmer transition-all" style={{ width: data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-[#888] mt-1">{data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de la cuota diaria` : 'Sin cuotas esperadas'}</p>
          </div>
          <div
            className="rounded-[16px] px-4 py-4"
            style={{
              background: 'linear-gradient(135deg, rgba(245,197,24,0.06) 0%, #111115 40%, #111115 70%, rgba(245,197,24,0.03) 100%)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <p className="text-[11px] text-[#999] mb-1">Recaudado este mes</p>
            <p className="text-xl font-bold text-[#f5c518] font-mono-display truncate">{formatCOP(data.cobros.mes)}</p>
            <p className="text-[10px] text-[#888] mt-1">{data.cobros.cantidadMes} pagos en el mes</p>
            {data.clientes.enMora > 0 && (<div className="mt-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f87171] animate-pulse" /><p className="text-[10px] text-[#f87171]">{moraPct}% de clientes en mora</p></div>)}
          </div>
        </div>
      )}
      {(loading || !mounted) ? <Skeleton className="h-44" /> : data && data.ultimosPagos.length > 0 && (
        <div
          className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.04) 0%, #111115 40%, #111115 70%, rgba(52,211,153,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#999] uppercase tracking-wide">Últimos pagos</p>
            <Link href="/prestamos" className="text-[11px] text-[#f5c518] hover:underline">Ver todos →</Link>
          </div>
          <div className="space-y-0 divide-y divide-[rgba(255,255,255,0.05)]">
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.cliente}</p>
                  <p className="text-[10px] text-[#888888]">{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold text-[#34d399] shrink-0 ml-3 font-mono-display">+{formatCOP(p.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && mounted && moraData !== undefined && moraData.total > 0 && (
        <div
          className="border border-[#2a2a2a] rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, #ef444406 0%, #1a1a1a 40%, #1a1a1a 70%, #ef444403 100%)',
            boxShadow: '0 0 20px #ef444405, 0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Alertas de mora</p>
            <span className="text-[11px] bg-[#ef4444] text-white px-2 py-0.5 rounded-full">{moraData.total} clientes</span>
          </div>
          <div className="space-y-2">
            {moraData.agrupado.mora31plus.length > 0 && (
              <div className="bg-[#7f1d1d] border border-[#991b1b] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fca5a5] font-medium mb-2">Más de 30 días ({moraData.agrupado.mora31plus.length})</p>
                {moraData.agrupado.mora31plus.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#991b1b] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fca5a5]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fca5a5] shrink-0 ml-2 font-mono-display">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora16a30.length > 0 && (
              <div className="bg-[#78350f] border border-[#92400e] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fcd34d] font-medium mb-2">16-30 días ({moraData.agrupado.mora16a30.length})</p>
                {moraData.agrupado.mora16a30.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#92400e] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fcd34d]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fcd34d] shrink-0 ml-2 font-mono-display">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora8a15.length > 0 && (
              <div className="bg-[#713f12] border border-[#854d0e] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fde047] font-medium mb-2">8-15 días ({moraData.agrupado.mora8a15.length})</p>
                {moraData.agrupado.mora8a15.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#854d0e] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fde047]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fde047] shrink-0 ml-2 font-mono-display">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora1a7.length > 0 && (
              <div className="bg-[#365314] border border-[#3f6212] rounded-[12px] p-3">
                <p className="text-[11px] text-[#a3e635] font-medium mb-2">1-7 días ({moraData.agrupado.mora1a7.length})</p>
                {moraData.agrupado.mora1a7.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#3f6212] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#a3e635]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#a3e635] shrink-0 ml-2 font-mono-display">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Offline sync status indicator */}
      {syncMeta && !bulkSyncing && !bulkProgress && (
        <div className="w-full border border-[#2a2a2a] rounded-[16px] px-4 py-3 text-left" style={{ background: '#1a1a1a' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: '#22c55e18' }}>
              <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#888888]">
                Datos offline: {syncMeta.totalClientes} clientes, {syncMeta.totalPrestamos} prestamos
                <span className="text-[#888]"> · </span>
                {new Date(syncMeta.syncedAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
              </p>
            </div>
            <button onClick={startBulkSync} className="text-[10px] text-[#888] hover:text-[#22c55e] transition-colors shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {bulkSyncing && (
        <div className="w-full border border-[#22c55e]/20 rounded-[16px] px-4 py-3 text-left" style={{ background: '#22c55e08' }}>
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-[#22c55e] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-[11px] text-[#22c55e]">{bulkProgress?.message || 'Sincronizando datos...'}</p>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">Accesos rápidos</p>
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
