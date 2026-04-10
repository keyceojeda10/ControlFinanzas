'use client'
// components/layout/BottomNav.jsx - Navegación inferior para móvil

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect, useRef } from 'react'

const ITEMS_OWNER = [
  {
    label: 'Inicio',
    href:  '/dashboard',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href:  '/clientes',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Préstamos',
    href:  '/prestamos',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Rutas',
    href:  '/rutas',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
]

const ITEMS_COBRADOR = [
  {
    label: 'Inicio',
    href:  '/dashboard',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Cobros',
    href:  '/prestamos',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href:  '/clientes',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Rutas',
    href:  '/rutas',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
]

// Items extra que aparecen en el sheet "Más"
const MORE_ITEMS_OWNER = [
  { label: 'Importar', href: '/carga-masiva', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { label: 'Cobradores', href: '/cobradores', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Capital', href: '/capital', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { label: 'Actividad', href: '/actividad', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Reportes', href: '/reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Soporte', href: '/soporte', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Configuracion', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const MORE_ITEMS_COBRADOR = [
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { label: 'Configuracion', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { esCobrador } = useAuth()
  const [cierreWarning, setCierreWarning] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const sheetRef = useRef(null)

  const items = esCobrador ? ITEMS_COBRADOR : ITEMS_OWNER
  const moreItems = esCobrador ? MORE_ITEMS_COBRADOR : MORE_ITEMS_OWNER

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  // Cierre warning check — solo para cobradores (owners no tienen cierre de caja)
  useEffect(() => {
    if (!esCobrador) return
    const checkCierreWarning = async () => {
      try {
        const res = await fetch('/api/caja/warning')
        const data = await res.json()
        setCierreWarning(data.showWarning ? data : null)
      } catch {}
    }
    checkCierreWarning()
    const interval = setInterval(checkCierreWarning, 60000)
    return () => clearInterval(interval)
  }, [esCobrador])

  // Close sheet on navigate
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Close sheet on outside click
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  // Check if any "more" item is active
  const moreActive = moreItems.some(m => pathname === m.href || pathname.startsWith(m.href + '/'))

  return (
    <>
      {/* Cierre warning pill */}
      {cierreWarning && (
        <Link
          href="/caja"
          className="lg:hidden fixed bottom-[88px] right-3 z-40 rounded-full px-3.5 py-2 flex items-center gap-2"
          style={{ background: 'rgba(20,18,12,0.92)', border: '1px solid rgba(245,158,11,0.35)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse shrink-0" />
          <span className="text-[11px] font-medium text-[#f59e0b]">Cierre de caja en {cierreWarning.minutesUntilClose} min</span>
        </Link>
      )}

      {/* Sheet overlay + content for "Más" */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50" style={{ background: 'rgba(0,0,5,0.6)' }}>
          <div
            ref={sheetRef}
            className="absolute bottom-0 left-0 right-0 rounded-t-[24px] overflow-hidden animate-slide-up"
            style={{
              background: 'rgba(15,15,22,0.95)',
              backdropFilter: 'blur(30px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(30px) saturate(1.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              maxHeight: '70vh',
            }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[rgba(255,255,255,0.15)]" />
            </div>

            <div className="px-4 pb-2">
              <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-3">Navegacion</p>
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
                      className={[
                        'flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all active:scale-95',
                        active ? 'bg-[rgba(245,197,24,0.1)] text-[#f5c518]' : 'text-[#999] hover:bg-[rgba(255,255,255,0.04)]',
                      ].join(' ')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                      </svg>
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 rounded-[22px] overflow-hidden" style={{ background: 'rgba(12,12,18,0.75)', backdropFilter: 'blur(30px) saturate(1.5)', WebkitBackdropFilter: 'blur(30px) saturate(1.5)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(245,197,24,0.04), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="flex items-stretch">
          {items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-all duration-200 relative',
                  active ? 'text-[#f5c518]' : 'text-[#777]',
                ].join(' ')}
              >
                {active && (
                  <span className="absolute inset-x-1 inset-y-1.5 rounded-[12px] -z-10" style={{ background: 'rgba(245,197,24,0.1)' }} />
                )}
                {item.icon}
                {item.label}
              </Link>
            )
          })}
          {/* "Más" button - opens sheet */}
          <button
            onClick={() => setMoreOpen(v => !v)}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-medium transition-all duration-200 relative',
              moreActive || moreOpen ? 'text-[#f5c518]' : 'text-[#777]',
            ].join(' ')}
          >
            {(moreActive || moreOpen) && (
              <span className="absolute inset-x-1 inset-y-1.5 rounded-[12px] -z-10" style={{ background: 'rgba(245,197,24,0.1)' }} />
            )}
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Más
          </button>
        </div>
      </nav>
    </>
  )
}
