'use client'
// components/layout/BottomNav.jsx - Navegacion inferior estilo Lemon Cash

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect, useRef } from 'react'

import { formatMoney as formatMoneyFn } from '@/lib/i18n'
const formatCOPCompact = (monto = 0) => formatMoneyFn(monto)

// ─── FAB menu items ────────────────────────────────────────────
const FAB_ITEMS_OWNER = [
  { label: 'Nuevo prestamo', href: '/prestamos/nuevo', color: '#f5c518', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Nuevo cliente', href: '/clientes/nuevo', color: '#22c55e', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { label: 'Registrar gasto', href: '/gastos?nuevo=1', color: '#f97316', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Importar clientes', href: '/carga-masiva', color: '#8b5cf6', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
]

const FAB_ITEMS_COBRADOR = [
  { label: 'Mis cobros', href: '/cobros-hoy', color: '#22c55e', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Registrar gasto', href: '/gastos?nuevo=1', color: '#f97316', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
]

// ─── More sheet items ──────────────────────────────────────────
const MORE_ITEMS_OWNER = [
  { label: 'Rutas', href: '/rutas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Cobradores', href: '/cobradores', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Capital', href: '/capital', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { label: 'Reportes', href: '/reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Historial', href: '/actividad', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Gastos', href: '/gastos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { label: 'Perdidos', href: '/clavos', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z' },
  { label: 'Lucas IA', href: '/asistente', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
  { label: 'Soporte', href: '/soporte', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Config', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const MORE_ITEMS_COBRADOR = [
  { label: 'Mis cobros', href: '/cobros-hoy', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Mi resumen', href: '/mis-estadisticas', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Config', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const RUTAS_SIN_BOTTOMNAV = [
  '/clientes/nuevo',
  '/clientes/editar',
  '/prestamos/nuevo',
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { esCobrador } = useAuth()
  const [cierreWarning, setCierreWarning] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const moreItems = esCobrador ? MORE_ITEMS_COBRADOR : MORE_ITEMS_OWNER
  const fabItems = esCobrador ? FAB_ITEMS_COBRADOR : FAB_ITEMS_OWNER

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const ocultarPorRuta = RUTAS_SIN_BOTTOMNAV.some(r => pathname?.startsWith(r))

  // Cierre warning check
  useEffect(() => {
    if (!esCobrador) return
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
  }, [esCobrador])

  const warningHref = cierreWarning?.showPendingReminder && cierreWarning?.pendingDate
    ? `/caja?fecha=${cierreWarning.pendingDate}`
    : '/caja'

  const warningText = cierreWarning?.showPendingReminder
    ? (cierreWarning.pendingType === 'ajuste_ayer'
      ? `Ajusta cierre de ayer · ${formatCOPCompact(cierreWarning.pendingAmount)}`
      : `Recaudo sin cierre · ${formatCOPCompact(cierreWarning.pendingAmount)}`)
    : `Cierre de caja en ${cierreWarning?.minutesUntilClose} min`

  useEffect(() => { setMoreOpen(false); setFabOpen(false) }, [pathname])

  useEffect(() => {
    const prev = document.body.style.overflow
    if (moreOpen || fabOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [moreOpen, fabOpen])

  const moreActive = moreItems.some(m => pathname === m.href || pathname.startsWith(m.href + '/'))

  if (ocultarPorRuta) return null

  return (
    <>
      {/* Cierre warning pill */}
      {cierreWarning && (
        <Link
          href={warningHref}
          className="lg:hidden fixed bottom-[78px] left-1/2 -translate-x-1/2 z-40 max-w-[90vw] rounded-full px-3.5 py-2.5 flex items-center gap-2"
          style={{
            background: cierreWarning.showPendingReminder ? 'var(--color-accent-soft)' : 'var(--color-warning-dim)',
            border: `1px solid ${cierreWarning.showPendingReminder ? 'rgba(245,197,24,0.4)' : 'rgba(251,191,36,0.4)'}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }} />
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }}>{warningText}</span>
        </Link>
      )}

      {/* ─── FAB fullscreen overlay ─────────────────────────────── */}
      {fabOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end items-center"
          onClick={() => setFabOpen(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full max-w-sm px-6 pb-28 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-[13px] font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Que quieres hacer?
            </p>
            {fabItems.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => { setFabOpen(false); router.push(item.href) }}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: item.color }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <span className="text-[15px] font-semibold text-white">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── More sheet overlay ─────────────────────────────────── */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 cf-modal-overlay"
          onClick={() => setMoreOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Cerrar menu"
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[24px] overflow-hidden animate-slide-up cf-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border-hover)' }} />
            </div>

            <div className="px-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-secondary)' }}>Navegacion</p>
            </div>

            <div className="px-2 pb-8 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1">
                {moreItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all active:scale-95 min-h-[78px] cf-nav-item"
                      style={active ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' } : { color: 'var(--color-text-secondary)' }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                      </svg>
                      <span className="text-[12px] font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom nav bar ─────────────────────────────────────── */}
      <nav aria-label="Navegacion principal movil" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 cf-bottomnav-bar">
        <div className="flex items-stretch relative">
          {/* Inicio */}
          <Link
            href="/dashboard"
            aria-current={isActive('/dashboard') ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[58px] transition-all"
            style={{ color: isActive('/dashboard') ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
          >
            {isActive('/dashboard') && <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: 'var(--color-accent)', width: '20%', left: '15%', borderRadius: '0 0 2px 2px' }} />}
            <svg className="w-6 h-6" fill={isActive('/dashboard') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/dashboard') ? 0 : 1.8}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-semibold">Inicio</span>
          </Link>

          {/* Clientes */}
          <Link
            href="/clientes"
            aria-current={isActive('/clientes') ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[58px] transition-all"
            style={{ color: isActive('/clientes') ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
          >
            <svg className="w-6 h-6" fill={isActive('/clientes') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/clientes') ? 0 : 1.8}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] font-semibold">Clientes</span>
          </Link>

          {/* FAB central (+) */}
          <div className="flex-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => { setFabOpen(v => !v); setMoreOpen(false) }}
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 -mt-5"
              style={{
                background: fabOpen ? '#ef4444' : 'var(--color-accent)',
                boxShadow: fabOpen ? '0 4px 20px rgba(239,68,68,0.4)' : '0 4px 20px rgba(245,197,24,0.4)',
              }}
              aria-label={fabOpen ? 'Cerrar menu' : 'Abrir menu de acciones'}
            >
              <svg
                className="w-7 h-7 transition-transform duration-200"
                style={{ transform: fabOpen ? 'rotate(45deg)' : 'none' }}
                fill="none" stroke="#000" strokeWidth={2.5} viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>

          {/* Prestamos */}
          <Link
            href="/prestamos"
            aria-current={isActive('/prestamos') ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[58px] transition-all"
            style={{ color: isActive('/prestamos') ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
          >
            <svg className="w-6 h-6" fill={isActive('/prestamos') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive('/prestamos') ? 0 : 1.8}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-semibold">Prestamos</span>
          </Link>

          {/* Mas */}
          <button
            type="button"
            onClick={() => { setMoreOpen(v => !v); setFabOpen(false) }}
            aria-expanded={moreOpen}
            aria-label="Mas opciones"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[58px] transition-all"
            style={{ color: (moreActive || moreOpen) ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span className="text-[10px] font-semibold">Mas</span>
          </button>
        </div>
      </nav>
    </>
  )
}
