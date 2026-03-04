'use client'
// components/layout/Header.jsx - Header superior para móvil

import Image            from 'next/image'
import Link             from 'next/link'
import { usePathname }  from 'next/navigation'
import { signOut }      from 'next-auth/react'
import { useAuth }      from '@/hooks/useAuth'
import { useEffect, useRef, useState } from 'react'

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/clientes':      'Clientes',
  '/prestamos':     'Préstamos',
  '/rutas':         'Rutas',
  '/cobradores':    'Cobradores',
  '/caja':          'Caja',
  '/reportes':      'Reportes',
  '/configuracion': 'Configuración',
}

const PLAN_LABELS = { basic: 'Basic', standard: 'Standard', professional: 'Professional' }

const MENU_ITEMS_OWNER = [
  { label: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Clientes', href: '/clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Préstamos', href: '/prestamos', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Rutas', href: '/rutas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { label: 'Cobradores', href: '/cobradores', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Reportes', href: '/reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { label: 'Configuración', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const MENU_ITEMS_COBRADOR = [
  { label: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Cobros', href: '/prestamos', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Clientes', href: '/clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { label: 'Caja', href: '/caja', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { label: 'Configuración', href: '/configuracion', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function Header() {
  const pathname         = usePathname()
  const { session, esCobrador } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const menuRef = useRef(null)
  const userRef = useRef(null)

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Control Finanzas'

  const menuItems = esCobrador ? MENU_ITEMS_COBRADOR : MENU_ITEMS_OWNER
  const nombre = session?.user?.nombre ?? session?.user?.name ?? 'Usuario'
  const email  = session?.user?.email  ?? ''
  const plan   = session?.user?.plan   ?? 'basic'
  const inicial = nombre[0]?.toUpperCase() ?? 'U'

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setUserOpen(false)
  }, [pathname])

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[#111111] border-b border-[#2a2a2a]">
      {/* Logo + Title */}
      <div className="flex items-center gap-2.5">
        <Image src="/logo-icon.svg" alt="CF" width={28} height={28} className="shrink-0" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Menu button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            aria-label="Menú de navegación"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] shadow-xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
              <div className="py-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      pathname === item.href || pathname.startsWith(item.href + '/')
                        ? 'text-[#f5c518] bg-[rgba(245,197,24,0.1)]'
                        : 'text-[#cccccc] hover:bg-[#2a2a2a]'
                    ]}
                    onClick={() => setMenuOpen(false)}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar with dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer"
            aria-label="Menú de usuario"
          >
            {inicial}
          </button>

          {userOpen && (
            <div className="absolute right-0 top-11 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold shrink-0">
                    {inicial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{nombre}</p>
                    <p className="text-[11px] text-[#555555] truncate">{email}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[rgba(245,197,24,0.1)] text-[#f5c518] border border-[rgba(245,197,24,0.2)]">
                    Plan {PLAN_LABELS[plan] ?? plan}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#2a2a2a]" />

              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
