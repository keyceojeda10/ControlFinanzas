'use client'
// components/layout/Header.jsx - Header superior para movil (estilo Lemon Cash)

import Link             from 'next/link'
import { usePathname }  from 'next/navigation'
import { signOut }      from 'next-auth/react'
import { useAuth }      from '@/hooks/useAuth'
import { useEffect, useRef, useState } from 'react'
import NotificationsCenter from '@/components/layout/NotificationsCenter'
import Avatar           from '@/components/ui/Avatar'
import { limpiarDatosOffline } from '@/lib/offline'

const PAGE_TITLES = {
  '/dashboard':     'Inicio',
  '/clientes':      'Clientes',
  '/carga-masiva':  'Importar clientes',
  '/prestamos':     'Prestamos',
  '/rutas':         'Rutas',
  '/cobradores':    'Cobradores',
  '/caja':          'Caja',
  '/actividad':     'Actividad',
  '/reportes':      'Reportes',
  '/tutoriales':    'Tutoriales',
  '/capital':       'Capital',
  '/configuracion': 'Configuracion',
  '/soporte':       'Soporte',
}

export default function Header() {
  const pathname = usePathname()
  const { session } = useAuth()
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef(null)

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? ''

  const nombre = session?.user?.nombre ?? session?.user?.name ?? 'Usuario'
  const primerNombre = nombre.split(' ')[0]

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
    <div className="lg:hidden h-[60px] shrink-0" aria-hidden />
    <header
      className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-[60px]"
      style={{
        background: 'var(--color-bg-base)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Left: Avatar + greeting/title */}
      <div className="flex items-center gap-3 min-w-0" ref={userRef}>
        <button
          onClick={() => setUserOpen((v) => !v)}
          className="focus-visible:outline-none focus-visible:ring-2 rounded-full active:scale-95 transition-transform"
          aria-label="Menu de usuario"
        >
          <Avatar nombre={nombre} avatarId={session?.user?.avatarId} size={36} fontSize={13} />
        </button>
        <div className="min-w-0">
          {title ? (
            <p className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{title}</p>
          ) : (
            <p className="text-[15px] font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>Hola, {primerNombre}</p>
          )}
        </div>

        {/* User dropdown */}
        {userOpen && (
          <div
            className="absolute left-4 top-[56px] w-56 rounded-[16px] shadow-2xl overflow-hidden z-50"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="px-4 py-3.5">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{nombre}</p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{session?.user?.email}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)' }} />

            <Link
              href="/configuracion"
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuracion
            </Link>

            <div style={{ borderTop: '1px solid var(--color-border)' }} />

            <button
              onClick={async () => {
                try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
                await limpiarDatosOffline()
                signOut({ callbackUrl: '/login' })
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] transition-colors"
              style={{ color: '#ef4444' }}
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

      {/* Right: action icons */}
      <div className="flex items-center gap-1">
        <NotificationsCenter />

        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors active:scale-95"
          aria-label="Buscar"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </button>
      </div>
    </header>
    </>
  )
}
