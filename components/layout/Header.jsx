'use client'
// components/layout/Header.jsx - Header superior para móvil

import Image            from 'next/image'
import Link             from 'next/link'
import { usePathname }  from 'next/navigation'
import { signOut }      from 'next-auth/react'
import { useAuth }      from '@/hooks/useAuth'
import { useEffect, useRef, useState } from 'react'
import ThemeToggle      from '@/components/ui/ThemeToggle'


const PAGE_TITLES = {
  '/dashboard':     'Inicio',
  '/clientes':      'Clientes',
  '/carga-masiva':  'Importar clientes',
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

const PLAN_LABELS = { starter: 'Inicial', basic: 'Básico', growth: 'Crecimiento', standard: 'Profesional', professional: 'Empresarial' }

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
  const plan   = session?.user?.plan   ?? 'starter'
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
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 cf-header-mobile"
    >
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Image src="/logo-icon.svg" alt="CF" width={28} height={28} className="shrink-0" />
        </Link>
        <span className="text-sm font-semibold tracking-[0.01em]" style={{ color: 'var(--color-text-primary)' }}>{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle compacto */}
        <ThemeToggle />

        {/* Search button */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="w-10 h-10 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 transition-colors cf-icon-btn"
          aria-label="Buscar"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </button>

        {/* Avatar with dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserOpen((v) => !v)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 transition-opacity cursor-pointer"
            aria-label="Menú de usuario"
            style={{ background: 'var(--color-accent)', color: '#1a1a2e' }}
          >
            {inicial}
          </button>

          {userOpen && (
            <div className="absolute right-0 top-12 w-60 rounded-[14px] shadow-2xl overflow-hidden z-50 glass-strong">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--color-accent)', color: '#1a1a2e' }}>
                    {inicial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{nombre}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{email}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-accent)',
                      borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                    }}
                  >
                    Plan {PLAN_LABELS[plan] ?? plan}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              <Link
                href="/configuracion?tab=apariencia"
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cf-menu-item"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Apariencia
              </Link>

              <Link
                href="/configuracion"
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cf-menu-item"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuración
              </Link>

              <div style={{ borderTop: '1px solid var(--color-border)' }} />

              <button
                onClick={() => {
                  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
                  signOut({ callbackUrl: '/login' })
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors cf-signout-btn"
                style={{ color: 'var(--color-text-secondary)' }}
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
