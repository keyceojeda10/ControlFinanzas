'use client'
// components/layout/Header.jsx - Header superior para móvil

import Image            from 'next/image'
import Link             from 'next/link'
import { usePathname }  from 'next/navigation'
import { signOut }      from 'next-auth/react'
import { useAuth }      from '@/hooks/useAuth'
import { useEffect, useRef, useState } from 'react'


const PAGE_TITLES = {
  '/dashboard':     'Inicio',
  '/clientes':      'Clientes',
  '/prestamos':     'Préstamos',
  '/rutas':         'Rutas',
  '/cobradores':    'Cobradores',
  '/caja':          'Caja',
  '/actividad':     'Actividad',
  '/reportes':      'Reportes',
  '/tutoriales':    'Tutoriales',
  '/capital':       'Capital',
  '/configuracion': 'Configuración',
  '/soporte':       'Soporte',
}

const PLAN_LABELS = { basic: 'Basico', growth: 'Crecimiento', standard: 'Profesional', professional: 'Empresarial' }

export default function Header() {
  const pathname         = usePathname()
  const { session } = useAuth()
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef(null)

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Control Finanzas'

  const nombre = session?.user?.nombre ?? session?.user?.name ?? 'Usuario'
  const email  = session?.user?.email  ?? ''
  const plan   = session?.user?.plan   ?? 'basic'
  const inicial = nombre[0]?.toUpperCase() ?? 'U'

  useEffect(() => {
    function handleClickOutside(e) {
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setUserOpen(false)
  }, [pathname])

  return (
    <>
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-[rgba(255,255,255,0.06)]" style={{ background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px) saturate(1.2)', WebkitBackdropFilter: 'blur(20px) saturate(1.2)' }}>
      {/* Logo + Title */}
      <div className="flex items-center gap-2.5">
        <Link href="/dashboard">
          <Image src="/logo-icon.svg" alt="CF" width={28} height={28} className="shrink-0" />
        </Link>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Search button */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#888888] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          aria-label="Buscar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </button>

        {/* Settings gear */}
        <Link
          href="/configuracion"
          className={[
            'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
            pathname.startsWith('/configuracion') ? 'text-[#f5c518]' : 'text-[#888888] hover:text-white hover:bg-[rgba(255,255,255,0.05)]',
          ].join(' ')}
          aria-label="Configuración"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>

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
            <div className="absolute right-0 top-11 w-56 rounded-[14px] shadow-2xl overflow-hidden z-50" style={{ background: 'rgba(15,15,22,0.9)', backdropFilter: 'blur(30px) saturate(1.3)', WebkitBackdropFilter: 'blur(30px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#f5c518] flex items-center justify-center text-[#0a0a0a] text-xs font-bold shrink-0">
                    {inicial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{nombre}</p>
                    <p className="text-[11px] text-[#888888] truncate">{email}</p>
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
                onClick={() => {
                  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
                  signOut({ callbackUrl: '/login' })
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    </>
  )
}
