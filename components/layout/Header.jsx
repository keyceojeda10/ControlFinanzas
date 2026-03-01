'use client'
// components/layout/Header.jsx - Header superior para móvil

import Image from 'next/image'
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
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[#111111] border-b border-[#2a2a2a]">
      {/* Logo + Title */}
      <div className="flex items-center gap-2.5">
        <Image src="/logo-icon.svg" alt="CF" width={28} height={28} className="shrink-0" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications placeholder */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Avatar + sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-8 h-8 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold"
          title="Cerrar sesión"
        >
          {session?.user?.nombre?.[0]?.toUpperCase() ?? 'U'}
        </button>
      </div>
    </header>
  )
}
