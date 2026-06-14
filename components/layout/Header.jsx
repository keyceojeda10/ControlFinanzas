'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useRef, useState } from 'react'
import NotificationsCenter from '@/components/layout/NotificationsCenter'
import Avatar from '@/components/ui/Avatar'
import { limpiarDatosOffline } from '@/lib/offline'

export default function Header() {
  const pathname = usePathname()
  const { session } = useAuth()
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef(null)

  const nombre = session?.user?.nombre ?? session?.user?.name ?? 'Usuario'
  const primerNombre = nombre.split(' ')[0]

  useEffect(() => {
    function handleClickOutside(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => { setUserOpen(false) }, [pathname])

  return (
    <>
      <div className="lg:hidden h-[60px] shrink-0" aria-hidden />
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-[60px]"
        style={{ background: 'var(--color-bg-base)' }}
      >
        {/* Left: logo + avatar pill */}
        <div className="flex items-center gap-3" ref={userRef}>
          <Link href="/dashboard" className="shrink-0">
            <Image src="/logo-icon.svg" alt="Control Finanzas" width={30} height={30} className="rounded-lg" />
          </Link>

          <button
            onClick={() => setUserOpen(v => !v)}
            className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 active:scale-[0.97] transition-transform cf-header-pill"
            aria-label="Menu de usuario"
          >
            <div className="relative">
              <Avatar nombre={nombre} avatarId={session?.user?.avatarId} size={34} fontSize={12} />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                style={{ background: '#22c55e', border: '2px solid var(--color-bg-base)' }}
              />
            </div>
            <span className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {primerNombre}
            </span>
          </button>

          {/* User dropdown */}
          {userOpen && (
            <div
              className="absolute left-4 top-[56px] w-56 rounded-[16px] shadow-2xl overflow-hidden z-50"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
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
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
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
            className="w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-95"
            aria-label="Buscar"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      </header>
    </>
  )
}
