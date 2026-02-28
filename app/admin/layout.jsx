'use client'
// app/admin/layout.jsx — Layout del panel de administración

import Link            from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut }     from 'next-auth/react'
import { Badge }       from '@/components/ui/Badge'

const nav = [
  {
    href: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/admin/organizaciones',
    label: 'Organizaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/admin/suscripciones',
    label: 'Suscripciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: '/admin/metricas',
    label: 'Métricas',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function AdminLayout({ children }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh bg-[#0f1117]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-[#2a3245] bg-[#0f1117] shrink-0">
        <div className="px-5 py-5 border-b border-[#2a3245]">
          <p className="text-sm font-bold text-[#f1f5f9]">Control Finanzas</p>
          <p className="text-[10px] text-[#64748b]">Panel de Administración</p>
          <Badge variant="purple" className="mt-2">SUPERADMIN</Badge>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all',
                  active
                    ? 'bg-[rgba(59,130,246,0.12)] text-[#3b82f6]'
                    : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1c2333]',
                ].join(' ')}
              >
                {icon}
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-[#2a3245]">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium text-[#94a3b8] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-all w-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#2a3245] bg-[#0f1117]">
          <p className="text-sm font-bold text-[#f1f5f9]">CF Admin</p>
          <Badge variant="purple">SUPERADMIN</Badge>
        </header>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 flex border-t border-[#2a3245] bg-[#0f1117] z-50">
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-all',
                  active ? 'text-[#3b82f6]' : 'text-[#64748b]',
                ].join(' ')}
              >
                {icon}
                {label}
              </Link>
            )
          })}
        </nav>

        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6 pb-24 lg:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
