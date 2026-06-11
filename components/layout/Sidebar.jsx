'use client'
// components/layout/Sidebar.jsx - Navegación lateral para desktop

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'
import { useOffline } from '@/components/providers/OfflineProvider'
import { useState, useEffect } from 'react'
import InstallButton from './InstallButton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useTheme } from '@/lib/theme/ThemeProvider'
import Avatar from '@/components/ui/Avatar'
import SyncStatusBadge from '@/components/offline/SyncStatusBadge'
import CacheAge from '@/components/offline/CacheAge'
import { limpiarDatosOffline } from '@/lib/offline'

function SyncStatusBadgeTrigger() {
  const { openSyncDrawer } = useOffline()
  return <SyncStatusBadge variant="full" onClick={() => openSyncDrawer?.()} />
}

import { formatMoney as formatMoneyFn } from '@/lib/i18n'
const formatCOPCompact = (monto = 0) => formatMoneyFn(monto)

const NAV_PRIMARY_OWNER = [
  {
    label: 'Dashboard',
    href:  '/dashboard',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Rutas',
    href:  '/rutas',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    label: 'Préstamos',
    href:  '/prestamos',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href:  '/clientes',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Caja',
    href:  '/caja',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
]

const NAV_MORE_OWNER = [
  {
    label: 'Cobradores',
    href:  '/cobradores',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Capital',
    href:  '/capital',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Reportes',
    href:  '/reportes',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'Historial',
    href:  '/actividad',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Gastos',
    href:  '/gastos',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Préstamos perdidos',
    href:  '/clavos',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    label: 'Lucas IA',
    href:  '/asistente',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
]

const NAV_CUENTA_OWNER = [
  {
    label: 'Configuracion',
    href:  '/configuracion',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Soporte',
    href:  '/soporte',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    label: 'Tutoriales',
    href:  '/tutoriales',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
]

const NAV_COBRADOR = [
  {
    label: 'Inicio',
    href:  '/dashboard',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href:  '/clientes',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Préstamos',
    href:  '/prestamos',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Rutas',
    href:  '/rutas',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    label: 'Mis cobros',
    href:  '/cobros-hoy',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Caja',
    href:  '/caja',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: 'Mi resumen',
    href:  '/mis-estadisticas',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    label: 'Tutoriales',
    href:  '/tutoriales',
    icon: (
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname   = usePathname()
  const { session, esCobrador } = useAuth()
  const { resolvedTheme } = useTheme()
  const [fechaHora, setFechaHora] = useState('')
  const [cierreWarning, setCierreWarning] = useState(null)
  const masHerramientasEnRuta = NAV_MORE_OWNER.some(item => pathname.startsWith(item.href))
  const [masHerramientasOpen, setMasHerramientasOpen] = useState(masHerramientasEnRuta)

  const { syncMeta, startBulkSync, bulkSyncing, bulkProgress } = useOffline()
  // Para el cobrador, el ítem "Rutas" apunta inteligente: si tiene UNA sola ruta,
  // va directo a esa ruta; si tiene varias (o ninguna conocida), va al listado.
  const rutaIdsCobrador = session?.user?.rutaIds ?? []
  const navFlat = esCobrador
    ? NAV_COBRADOR.map((item) =>
        item.label === 'Rutas' && rutaIdsCobrador.length === 1
          ? { ...item, href: `/rutas/${rutaIdsCobrador[0]}` }
          : item
      )
    : null

  // Abrir "Más herramientas" automáticamente al navegar a una ruta dentro del grupo
  useEffect(() => {
    if (masHerramientasEnRuta) setMasHerramientasOpen(true)
  }, [masHerramientasEnRuta])

  // Verificar advertencia de cierre de caja cada minuto
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/caja/warning')
        const data = await res.json()
        setCierreWarning((data.showWarning || data.showPendingReminder) ? data : null)
      } catch {}
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  // Actualizar fecha/hora cada minuto (timezone Colombia)
  useEffect(() => {
    const updateFechaHora = () => {
      const now = new Date()
      const fecha = now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
      const hora = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
      setFechaHora(`${fecha} • ${hora}`)
    }
    updateFechaHora()
    const interval = setInterval(updateFechaHora, 60000)
    return () => clearInterval(interval)
  }, [])

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const cierreWarningHref = cierreWarning?.showPendingReminder && cierreWarning?.pendingDate
    ? `/caja?fecha=${cierreWarning.pendingDate}`
    : '/caja'

  const cierreWarningTitle = cierreWarning?.showPendingReminder
    ? (cierreWarning.pendingType === 'ajuste_ayer'
      ? 'Ajusta cierre de ayer'
      : 'Tienes recaudo sin cierre')
    : `Cierre en ${cierreWarning?.minutesUntilClose} min`

  const cierreWarningSubtitle = cierreWarning?.showPendingReminder
    ? `Monto sugerido: ${formatCOPCompact(cierreWarning.pendingAmount)}`
    : 'Ir a cerrar caja'

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen shrink-0 cf-sidebar">
      {/* Logo */}
      <div className="flex flex-col items-center px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Image src={resolvedTheme === 'light' ? '/logo-dark.svg' : '/logo-full.svg'} alt="Control Finanzas" width={160} height={40} priority />
        {fechaHora && <span className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>{fechaHora}</span>}
      </div>

      {/* Search shortcut */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 transition-colors text-xs"
          style={{
            background: 'var(--color-bg-hover)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>Ctrl+K</kbd>
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto sidebar-nav">
        {!esCobrador ? (
          <>
            {/* Ítems primarios — siempre visibles */}
            <div className="space-y-0.5">
              {NAV_PRIMARY_OWNER.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className="group flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 relative"
                    style={{
                      background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {active && (
                      <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: 'var(--color-accent)' }} />
                    )}
                    <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Sección "Más herramientas" colapsable */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setMasHerramientasOpen(v => !v)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-[11px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2"
                style={{ color: masHerramientasOpen ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
              >
                <span className="flex-1 text-left">Más herramientas</span>
                <svg
                  className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                  style={{ transform: masHerramientasOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {masHerramientasOpen && (
                <div className="mt-1 space-y-0.5">
                  {NAV_MORE_OWNER.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className="group flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 relative"
                        style={{
                          background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                          color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                        }}
                      >
                        {active && (
                          <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: 'var(--color-accent)' }} />
                        )}
                        <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* CUENTA — siempre visible al final */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1" style={{ color: 'var(--color-text-muted)' }}>Cuenta</p>
              <div className="space-y-0.5">
                {NAV_CUENTA_OWNER.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="group flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 relative"
                      style={{
                        background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: 'var(--color-accent)' }} />
                      )}
                      <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </>
        ) : navFlat.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="group flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-[13px] font-medium transition-colors duration-150 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 relative"
              style={{
                background: active ? 'rgba(245,197,24,0.08)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: 'var(--color-accent)' }} />
              )}
              <span className="w-5 h-5 flex items-center justify-center shrink-0" style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Warning cierre de caja */}
      {cierreWarning && (
        <div className="mx-3 mb-2">
          <Link
            href={cierreWarningHref}
            className="flex items-center gap-2 px-3 py-2 rounded-[10px] border focus-visible:outline-none focus-visible:ring-2 transition-colors"
            style={{
              background: cierreWarning.showPendingReminder ? 'var(--color-accent-soft)' : 'var(--color-warning-dim)',
              borderColor: cierreWarning.showPendingReminder
                ? 'rgba(245,197,24,0.35)'
                : 'var(--color-warning-border)',
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold truncate" style={{ color: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }}>{cierreWarningTitle}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>{cierreWarningSubtitle}</p>
            </div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 pb-3 pt-3 space-y-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
        {/* Tarjeta de perfil */}
        <div
          className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-[12px]"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
        >
          <Avatar nombre={session?.user?.nombre} avatarId={session?.user?.avatarId} size={32} fontSize={12} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {session?.user?.nombre}
            </p>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {{ owner: 'Admin', cobrador: 'Cobrador', superadmin: 'Super Admin' }[session?.user?.rol] ?? session?.user?.rol}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <ThemeToggle size="sm" />
            <button
              onClick={async () => {
                try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
                await limpiarDatosOffline()
                signOut({ callbackUrl: '/login' })
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0 hover:bg-[var(--color-bg-hover)]"
              style={{ color: 'var(--color-text-muted)' }}
              title="Cerrar sesion"
              aria-label="Cerrar sesion"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sync offline */}
        <button
          onClick={startBulkSync}
          disabled={bulkSyncing}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 transition-colors disabled:opacity-50"
          style={{
            background: 'var(--color-success-dim)',
            border: '1px solid var(--color-success-border)',
          }}
        >
          <svg className={`w-3.5 h-3.5 shrink-0 ${bulkSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-success)' }}>
            {bulkProgress ? bulkProgress.message : 'Sync offline'}
          </span>
        </button>

        {/* Instalar app */}
        <InstallButton variant="desktop" />

        {/* Status line */}
        <div className="flex items-center gap-1.5 px-1 pt-0.5">
          <SyncStatusBadgeTrigger />
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>·</span>
          <CacheAge />
        </div>
      </div>
    </aside>
  )
}
