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

export default function Header() {
  const pathname         = usePathname()
  const { session }      = useAuth()
  const [open, setOpen]  = useState(false)
  const dropdownRef      = useRef(null)

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Control Finanzas'

  const nombre = session?.user?.nombre ?? session?.user?.name ?? 'Usuario'
  const email  = session?.user?.email  ?? ''
  const plan   = session?.user?.plan   ?? 'basic'
  const inicial = nombre[0]?.toUpperCase() ?? 'U'

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Cierra el dropdown al navegar
  useEffect(() => { setOpen(false) }, [pathname])

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

        {/* Avatar con dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer"
            aria-label="Menú de usuario"
          >
            {inicial}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] shadow-xl overflow-hidden z-50">
              {/* Info del usuario */}
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

              {/* Separador */}
              <div className="border-t border-[#2a2a2a]" />

              {/* Configuración */}
              <Link
                href="/configuracion"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#cccccc] hover:bg-[#2a2a2a] transition-colors"
                onClick={() => setOpen(false)}
              >
                <svg className="w-4 h-4 shrink-0 text-[#888888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuración
              </Link>

              {/* Separador */}
              <div className="border-t border-[#2a2a2a]" />

              {/* Cerrar sesión */}
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
