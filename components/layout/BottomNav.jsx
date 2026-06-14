'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'

import { formatMoney as formatMoneyFn } from '@/lib/i18n'
const formatCOPCompact = (monto = 0) => formatMoneyFn(monto)

const FAB_ITEMS_OWNER = [
  { label: 'Nuevo', bold: 'prestamo', href: '/prestamos/nuevo' },
  { label: 'Nuevo', bold: 'cliente', href: '/clientes/nuevo' },
  { label: 'Registrar', bold: 'gasto', href: '/gastos?nuevo=1' },
  { label: 'Lucas', bold: 'IA', href: '__lucas__' },
]

const FAB_ITEMS_COBRADOR = [
  { label: 'Mis', bold: 'cobros', href: '/cobros-hoy' },
  { label: 'Registrar', bold: 'gasto', href: '/gastos?nuevo=1' },
  { label: 'Lucas', bold: 'IA', href: '__lucas__' },
]

const MORE_ITEMS_OWNER = [
  { label: 'Rutas', href: '/rutas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { label: 'Caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Cobradores', href: '/cobradores', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 013 17.16V17c0-2.796 2.567-5 6-5 1.29 0 2.476.35 3.434.943M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07m0 0A5.006 5.006 0 0012 10c-1.68 0-3.166.793-4.214 2.003M12 4.5a3 3 0 110 6 3 3 0 010-6z' },
  { label: 'Capital', href: '/capital', icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z' },
  { label: 'Reportes', href: '/reportes', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { label: 'Historial', href: '/actividad', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Gastos', href: '/gastos', icon: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
  { label: 'Perdidos', href: '/clavos', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  { label: 'Soporte', href: '/soporte', icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { label: 'Config', href: '/configuracion', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const MORE_ITEMS_COBRADOR = [
  { label: 'Mis cobros', href: '/cobros-hoy', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Mi resumen', href: '/mis-estadisticas', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { label: 'Config', href: '/configuracion', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const RUTAS_SIN_BOTTOMNAV = [
  '/clientes/nuevo',
  '/clientes/editar',
  '/prestamos/nuevo',
]

// Tabs de la pill — diferenciados por rol
// Owner: Inicio, Clientes, Prestamos, Historial, Mas
// Cobrador: Inicio, Clientes, Prestamos, Rutas, Mas (lo que tenia antes)
const PILL_TABS_OWNER = [
  { id: 'dashboard', href: '/dashboard', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25', iconFill: 'M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97V19.5a2.25 2.25 0 01-2.25 2.25h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3A2.25 2.25 0 013.75 19.5v-6.88l-.97.97a.75.75 0 01-1.06-1.06l8.69-8.69z' },
  { id: 'clientes', href: '/clientes', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 013 17.16V17c0-2.796 2.567-5 6-5 1.29 0 2.476.35 3.434.943M12 4.5a3 3 0 110 6 3 3 0 010-6z' },
  { id: 'prestamos', href: '/prestamos', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'actividad', href: '/actividad', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
]

const PILL_TABS_COBRADOR = [
  { id: 'dashboard', href: '/dashboard', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25', iconFill: 'M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97V19.5a2.25 2.25 0 01-2.25 2.25h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3A2.25 2.25 0 013.75 19.5v-6.88l-.97.97a.75.75 0 01-1.06-1.06l8.69-8.69z' },
  { id: 'clientes', href: '/clientes', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2 2 0 013 17.16V17c0-2.796 2.567-5 6-5 1.29 0 2.476.35 3.434.943M12 4.5a3 3 0 110 6 3 3 0 010-6z' },
  { id: 'prestamos', href: '/prestamos', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'rutas', href: '/rutas', icon: 'M9 6.75V15m0-8.25a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9 15a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 0V6.75m6-1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM15 8.25V18m0 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z' },
]

const ICON_GRID = 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'

export default function BottomNav({ onOpenLucas }) {
  const pathname = usePathname()
  const router = useRouter()
  const { esCobrador } = useAuth()
  const [cierreWarning, setCierreWarning] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const moreItems = esCobrador ? MORE_ITEMS_COBRADOR : MORE_ITEMS_OWNER
  const fabItems = esCobrador ? FAB_ITEMS_COBRADOR : FAB_ITEMS_OWNER
  const pillTabs = esCobrador ? PILL_TABS_COBRADOR : PILL_TABS_OWNER

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const ocultarPorRuta = RUTAS_SIN_BOTTOMNAV.some(r => pathname?.startsWith(r))

  useEffect(() => {
    if (!esCobrador) return
    const check = async () => {
      try {
        const res = await fetch('/api/caja/warning')
        const data = await res.json()
        setCierreWarning((data.showWarning || data.showPendingReminder) ? data : null)
      } catch {}
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [esCobrador])

  const warningHref = cierreWarning?.showPendingReminder && cierreWarning?.pendingDate
    ? `/caja?fecha=${cierreWarning.pendingDate}`
    : '/caja'

  const warningText = cierreWarning?.showPendingReminder
    ? (cierreWarning.pendingType === 'ajuste_ayer'
      ? `Ajusta cierre de ayer · ${formatCOPCompact(cierreWarning.pendingAmount)}`
      : `Recaudo sin cierre · ${formatCOPCompact(cierreWarning.pendingAmount)}`)
    : `Cierre de caja en ${cierreWarning?.minutesUntilClose} min`

  useEffect(() => { setMoreOpen(false); setFabOpen(false) }, [pathname])

  useEffect(() => {
    const prev = document.body.style.overflow
    if (moreOpen || fabOpen) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [moreOpen, fabOpen])

  const moreActive = moreItems.some(m => pathname === m.href || pathname.startsWith(m.href + '/'))

  if (ocultarPorRuta) return null

  const handleFabAction = (item) => {
    setFabOpen(false)
    if (item.href === '__lucas__') {
      onOpenLucas?.()
    } else {
      router.push(item.href)
    }
  }

  return (
    <>
      {/* Cierre warning pill */}
      {cierreWarning && (
        <Link
          href={warningHref}
          className="lg:hidden fixed bottom-[90px] left-1/2 -translate-x-1/2 z-40 max-w-[90vw] rounded-full px-3.5 py-2.5 flex items-center gap-2"
          style={{
            background: cierreWarning.showPendingReminder ? 'var(--color-accent-soft)' : 'var(--color-warning-dim)',
            border: `1px solid ${cierreWarning.showPendingReminder ? 'rgba(245,197,24,0.4)' : 'rgba(251,191,36,0.4)'}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }} />
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: cierreWarning.showPendingReminder ? 'var(--color-accent)' : 'var(--color-warning)' }}>{warningText}</span>
        </Link>
      )}

      {/* ─── FAB fullscreen — Lemon Cash style ──────────────────── */}
      <div
        className="lg:hidden fixed inset-0 z-50 flex flex-col transition-all duration-300"
        style={{
          background: 'var(--color-accent)',
          opacity: fabOpen ? 1 : 0,
          visibility: fabOpen ? 'visible' : 'hidden',
          pointerEvents: fabOpen ? 'auto' : 'none',
        }}
      >
        <div className="flex-1 flex flex-col justify-end px-7 pb-8">
          <p
            className="text-[15px] font-medium mb-6"
            style={{ color: 'rgba(0,0,0,0.45)' }}
          >
            Que quieres hacer?
          </p>

          <div className="space-y-1">
            {fabItems.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => handleFabAction(item)}
                className="block w-full text-left py-2 active:opacity-60 transition-opacity"
              >
                <span className="text-[38px] font-extrabold leading-tight tracking-tight" style={{ color: '#000' }}>
                  {item.label}{' '}
                  <span className="font-normal">{item.bold}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Close button — bottom right */}
        <div className="px-7 pb-10 flex justify-end">
          <button
            type="button"
            onClick={() => setFabOpen(false)}
            className="w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: '#000' }}
            aria-label="Cerrar menu"
          >
            <svg className="w-7 h-7" fill="none" stroke="var(--color-accent)" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── More sheet overlay ─────────────────────────────────── */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 cf-modal-overlay"
          onClick={() => setMoreOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Cerrar menu"
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[24px] overflow-hidden animate-slide-up cf-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border-hover)' }} />
            </div>

            <div className="px-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-secondary)' }}>Navegacion</p>
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
                      className="flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all active:scale-95 min-h-[78px] cf-nav-item"
                      style={active ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent)' } : { color: 'var(--color-text-secondary)' }}
                    >
                      <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="text-[12px] font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom nav — floating pill + separate FAB ──────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-5 pointer-events-none" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 12px))' }}>
        <div className="flex items-center gap-3">
          {/* Nav pill */}
          <nav
            aria-label="Navegacion principal movil"
            className="flex-1 flex items-center justify-around rounded-[22px] py-2 pointer-events-auto cf-nav-pill"
          >
            {pillTabs.map((tab) => {
              const active = isActive(tab.href)
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex items-center justify-center w-12 h-12 rounded-[16px] transition-all active:scale-90"
                  style={active ? { background: 'var(--color-text-primary)' } : {}}
                >
                  <svg
                    className="w-[22px] h-[22px]"
                    fill={active && tab.iconFill ? 'var(--color-bg-base)' : 'none'}
                    stroke={active && tab.iconFill ? 'none' : active ? 'var(--color-bg-base)' : 'var(--color-text-muted)'}
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={active && tab.iconFill ? tab.iconFill : tab.icon} />
                  </svg>
                </Link>
              )
            })}

            {/* Mas */}
            <button
              type="button"
              onClick={() => { setMoreOpen(v => !v); setFabOpen(false) }}
              aria-expanded={moreOpen}
              aria-label="Mas opciones"
              className="relative flex items-center justify-center w-12 h-12 rounded-[16px] transition-all active:scale-90"
              style={(moreActive || moreOpen) ? { background: 'var(--color-text-primary)' } : {}}
            >
              <svg
                className="w-[22px] h-[22px]"
                fill="none"
                stroke={(moreActive || moreOpen) ? 'var(--color-bg-base)' : 'var(--color-text-muted)'}
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON_GRID} />
              </svg>
            </button>
          </nav>

          {/* FAB — separate circle, Lemon Cash style */}
          <button
            type="button"
            onClick={() => { setFabOpen(true); setMoreOpen(false) }}
            className="w-[56px] h-[56px] rounded-full flex items-center justify-center shrink-0 pointer-events-auto active:scale-90 transition-transform"
            style={{
              background: '#000',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
            aria-label="Acciones rapidas"
          >
            <svg className="w-7 h-7" fill="none" stroke="var(--color-accent)" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
