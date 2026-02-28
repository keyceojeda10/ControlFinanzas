'use client'
// components/layout/Header.jsx - Header superior para móvil

import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'

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

export default function Header() {
  const pathname = usePathname()
  const { session } = useAuth()

  // Find matching title
  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Control Finanzas'

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[#161b27] border-b border-[#2a3245]">
      {/* Logo + Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-[7px] bg-[#3b82f6] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-[#f1f5f9]">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications placeholder */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#222a3d] transition-colors">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Avatar + sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold"
          title="Cerrar sesión"
        >
          {session?.user?.nombre?.[0]?.toUpperCase() ?? 'U'}
        </button>
      </div>
    </header>
  )
}
