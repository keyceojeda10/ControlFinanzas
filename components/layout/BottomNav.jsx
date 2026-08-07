'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect } from 'react'

import { formatMoney as formatMoneyFn } from '@/lib/i18n'
import QrScanner from '@/components/qr/QrScanner'
import QrCobroModal from '@/components/qr/QrCobroModal'
const formatCOPCompact = (monto = 0) => formatMoneyFn(monto)

const FAB_ITEMS_OWNER = [
  // Va en el FAB, no en la pill: la pantalla es util para el dueño que cobra
  // solo, pero no vale sacar Rutas de la barra para meterla.
  { label: 'Cobrar', bold: 'hoy', href: '/cobros-hoy', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z' },
  { label: 'Nuevo', bold: 'préstamo', href: '/prestamos/nuevo', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Nuevo', bold: 'cliente', href: '/clientes/nuevo', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { label: 'Escanear', bold: 'QR', href: '__qr_scan__', icon: 'M4.5 3h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 017.5 9h-3A1.5 1.5 0 013 7.5v-3A1.5 1.5 0 014.5 3zm0 12h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 017.5 21h-3A1.5 1.5 0 013 19.5v-3A1.5 1.5 0 014.5 15zm12-12h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 0119.5 9h-3A1.5 1.5 0 0115 7.5v-3A1.5 1.5 0 0116.5 3zm-1.5 13.5h6m-3-3v6' },
  { label: 'Registrar', bold: 'gasto', href: '/gastos?nuevo=1', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
  { label: 'Ver', bold: 'caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Ver', bold: 'mi plan', href: '/configuracion/plan', icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' },
  { label: 'Lucas', bold: 'IA', href: '__lucas__', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
]

const FAB_ITEMS_COBRADOR = [
  { label: 'Mis', bold: 'cobros', href: '/cobros-hoy', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
  { label: 'Escanear', bold: 'QR', href: '__qr_scan__', icon: 'M4.5 3h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 017.5 9h-3A1.5 1.5 0 013 7.5v-3A1.5 1.5 0 014.5 3zm0 12h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 017.5 21h-3A1.5 1.5 0 013 19.5v-3A1.5 1.5 0 014.5 15zm12-12h3a1.5 1.5 0 011.5 1.5v3A1.5 1.5 0 0119.5 9h-3A1.5 1.5 0 0115 7.5v-3A1.5 1.5 0 0116.5 3zm-1.5 13.5h6m-3-3v6' },
  { label: 'Registrar', bold: 'gasto', href: '/gastos?nuevo=1', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
  { label: 'Ver', bold: 'caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Lucas', bold: 'IA', href: '__lucas__', icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' },
]

const MORE_ITEMS_OWNER = [
  { label: 'Pasar mi cuaderno', href: '/migrador', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5' },
  { label: 'Importar Excel', href: '/carga-masiva', icon: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { label: 'Rutas', href: '/rutas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
  { label: 'Caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Líneas crédito', href: '/lineas-credito', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Cobradores', href: '/cobradores', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
  { label: 'Mi plata', href: '/capital', icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z' },
  { label: 'Reportes', href: '/reportes', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { label: '¿Cómo va?', href: '/dashboard/analiticas', icon: 'M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941' },
  { label: 'Quién hizo qué', href: '/actividad', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Gastos', href: '/gastos', icon: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
  { label: 'Socios', href: '/socios', icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z' },
  { label: 'Perdidos', href: '/clavos', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  { label: 'Soporte', href: '/soporte', icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { label: 'Lucas IA', href: '__lucas__', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z' },
  { label: 'Configuración', href: '/configuracion', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const MORE_ITEMS_COBRADOR = [
  { label: 'Mis cobros', href: '/cobros-hoy', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { label: 'Mi resumen', href: '/mis-estadisticas', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { label: 'Tutoriales', href: '/tutoriales', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { label: 'Lucas IA', href: '__lucas__', icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z' },
  { label: 'Configuración', href: '/configuracion', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const RUTAS_SIN_BOTTOMNAV = [
  '/clientes/nuevo',
  '/prestamos/nuevo',
]
const PATRON_SIN_BOTTOMNAV = /^\/clientes\/[^/]+\/editar/

const TAB_INICIO   = { id: 'dashboard', href: '/dashboard', icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25', iconFill: 'M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97V19.5a2.25 2.25 0 01-2.25 2.25h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3A2.25 2.25 0 013.75 19.5v-6.88l-.97.97a.75.75 0 01-1.06-1.06l8.69-8.69z' }
const TAB_COBRAR   = { id: 'cobros-hoy', href: '/cobros-hoy', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z' }
const TAB_CLIENTES = { id: 'clientes', href: '/clientes', icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' }
const TAB_PRESTAMOS= { id: 'prestamos', href: '/prestamos', icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
const TAB_CAJA     = { id: 'caja', href: '/caja', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' }
const TAB_RUTAS    = { id: 'rutas', href: '/rutas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' }

// RUTAS NO SE TOCA.
//
// En un cambio anterior se saco Rutas de la pill y se puso "Cobrar hoy" en su
// lugar, razonando que el 95% de las organizaciones tiene una sola ruta o
// ninguna. Ese promedio es cierto y la conclusion fue igual equivocada: las 14
// organizaciones CON cobradores son el 63% del ingreso, y para ellas Rutas es
// la pantalla que mas usan — el dueño entra ahi para ver la ruta de cada
// cobrador. El cliente con mas cobradores lo reporto el mismo dia.
//
// Leccion: optimizar por la mayoria contada rompe a la minoria que paga. Si
// una pantalla nueva vale la pena, va en el FAB o en "Mas"; no le quita el
// puesto a algo que la gente ya usa todos los dias.
const PILL_BASE = [TAB_INICIO, TAB_CLIENTES, TAB_PRESTAMOS, TAB_RUTAS]
const PILL_COBRADOR = PILL_BASE
const PILL_OWNER    = PILL_BASE

const ICON_GRID = 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'

export default function BottomNav({ onOpenLucas, lucasOpen = false }) {
  const pathname = usePathname()
  const router = useRouter()
  const { esCobrador } = useAuth()
  const [cierreWarning, setCierreWarning] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)
  const [qrScanOpen, setQrScanOpen] = useState(false)
  const [qrClienteId, setQrClienteId] = useState(null)

  const moreItems = esCobrador ? MORE_ITEMS_COBRADOR : MORE_ITEMS_OWNER
  const fabItems = esCobrador ? FAB_ITEMS_COBRADOR : FAB_ITEMS_OWNER

  const isActive = (href) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)

  const ocultarPorRuta = RUTAS_SIN_BOTTOMNAV.some(r => pathname?.startsWith(r)) || PATRON_SIN_BOTTOMNAV.test(pathname)

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

  const pillTabs = esCobrador ? PILL_COBRADOR : PILL_OWNER
  const pillHrefs = new Set(pillTabs.map(t => t.href))
  const moreActive = moreItems.some(m => !pillHrefs.has(m.href) && (pathname === m.href || pathname.startsWith(m.href + '/')))

  if (ocultarPorRuta) return null

  const handleFabAction = (item) => {
    setFabOpen(false)
    if (item.href === '__lucas__') {
      onOpenLucas?.()
    } else if (item.href === '__qr_scan__') {
      setQrScanOpen(true)
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
            background: cierreWarning.showPendingReminder ? 'var(--cf-gold-tint)' : 'var(--cf-gold-tint)',
            border: `1px solid ${cierreWarning.showPendingReminder ? 'rgba(245,197,24,0.4)' : 'rgba(251,191,36,0.4)'}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: cierreWarning.showPendingReminder ? 'var(--cf-gold)' : 'var(--cf-gold-dark)' }} />
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: cierreWarning.showPendingReminder ? 'var(--cf-gold)' : 'var(--cf-gold-dark)' }}>{warningText}</span>
        </Link>
      )}

      {/* ─── FAB fullscreen — Lemon Cash style ──────────────────── */}
      <div
        className="lg:hidden fixed inset-0 z-[54] flex flex-col"
        style={{
          background: 'var(--cf-gold)',
          opacity: fabOpen ? 1 : 0,
          visibility: fabOpen ? 'visible' : 'hidden',
          pointerEvents: fabOpen ? 'auto' : 'none',
          // Revela desde la esquina del FAB (abajo-derecha) con un clip circular,
          // y un leve fundido. Se siente como si el boton se expandiera.
          clipPath: fabOpen
            ? 'circle(150% at calc(100% - 44px) calc(100% - 40px))'
            : 'circle(0% at calc(100% - 44px) calc(100% - 40px))',
          transition: 'clip-path 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease, visibility 0.45s',
        }}
      >
        {/* Contenido: opciones. El boton para abrir/cerrar es el FAB persistente
            de abajo (no se duplica aqui), asi no "salta" de posicion. Reservamos
            espacio inferior (pb) para que la ultima opcion no quede bajo el FAB. */}
        <div className="flex-1 flex flex-col justify-end px-7 pb-28">
          <p
            className="text-[15px] font-medium mb-6 transition-all duration-300"
            style={{ color: 'rgba(0,0,0,0.45)', opacity: fabOpen ? 1 : 0, transform: fabOpen ? 'translateY(0)' : 'translateY(12px)' }}
          >
            ¿Qué quieres hacer?
          </p>

          <div className="space-y-1">
            {fabItems.map((item, i) => (
              <button
                key={item.href}
                type="button"
                onClick={() => handleFabAction(item)}
                className="flex items-center gap-3 w-full text-left py-1.5 active:opacity-60"
                style={{
                  opacity: fabOpen ? 1 : 0,
                  transform: fabOpen ? 'translateY(0)' : 'translateY(16px)',
                  transition: `opacity 0.35s ease ${fabOpen ? i * 0.04 + 0.05 : 0}s, transform 0.35s cubic-bezier(0.22,1,0.36,1) ${fabOpen ? i * 0.04 + 0.05 : 0}s`,
                }}
              >
                {item.icon && (
                  <svg className="w-6 h-6 shrink-0" style={{ color: 'rgba(0,0,0,0.5)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                )}
                <span className="text-[26px] font-extrabold leading-snug tracking-tight" style={{ color: '#000' }}>
                  {item.label}{' '}
                  <span className="font-normal">{item.bold}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── More sheet overlay ─────────────────────────────────── */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 cf-modal-overlay"
          onClick={() => setMoreOpen(false)}
          role="button"
          tabIndex={-1}
          aria-label="Cerrar menú"
        >
          <div
            /* La altura va en CLASE y no en el `style` para poder dejar el `vh`
               como respaldo del `dvh`: en un `style` inline no caben las dos, y
               si un navegador viejo no entendiera `dvh` se quedaría sin tope de
               altura. `dvh` es la altura que de verdad queda con la barra del
               navegador puesta — con `vh` a secas, en Safari de iPhone la hoja
               se extiende por debajo de lo que se ve. */
            className="absolute bottom-0 left-0 right-0 rounded-t-[20px] overflow-hidden animate-slide-up cf-sheet max-h-[75vh] max-h-[75dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1.5">
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--cf-border-strong)' }} />
            </div>

            <div className="px-4 pb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--cf-ink-2)' }}>Navegación</p>
            </div>

            <div className="px-2 pb-6 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1">
                {moreItems.map((item) => {
                  const esLucas = item.href === '__lucas__'
                  const active = !esLucas && (pathname === item.href || pathname.startsWith(item.href + '/'))
                  const contenido = (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </>
                  )
                  const clases = "flex flex-col items-center gap-1 py-3 rounded-2xl transition-all active:scale-95 cf-nav-item"
                  const estilo = active ? { background: 'var(--cf-gold-tint)', color: 'var(--cf-gold)' } : { color: 'var(--cf-ink-2)' }

                  if (esLucas) {
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => { setMoreOpen(false); onOpenLucas?.() }}
                        className={clases}
                        style={estilo}
                      >
                        {contenido}
                      </button>
                    )
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={clases}
                      style={estilo}
                    >
                      {contenido}
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
            aria-label="Navegación principal móvil"
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
                  style={active ? { background: 'var(--cf-gold-tint)' } : {}}
                >
                  <svg
                    className="w-[22px] h-[22px]"
                    fill={active && tab.iconFill ? 'var(--cf-gold)' : 'none'}
                    stroke={active && tab.iconFill ? 'none' : active ? 'var(--cf-gold)' : 'var(--cf-ink-3)'}
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
              style={(moreActive || moreOpen) ? { background: 'var(--cf-gold-tint)' } : {}}
            >
              <svg
                className="w-[22px] h-[22px]"
                fill="none"
                stroke={(moreActive || moreOpen) ? 'var(--cf-gold)' : 'var(--cf-ink-3)'}
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={ICON_GRID} />
              </svg>
            </button>
          </nav>

          {/* Espaciador: reserva el lugar del FAB en la fila (el FAB real es un
              elemento fixed aparte, en z superior, para no saltar al abrir). */}
          <div className="w-[60px] h-[60px] shrink-0" aria-hidden />
        </div>
      </div>

      {/* ─── FAB persistente: MISMA posicion abierto y cerrado ───────
          Vive en z superior al overlay, asi no "salta" entre + y X.
          El icono rota suavemente de + (cerrado) a X (abierto). */}
      <button
        type="button"
        onClick={() => { setFabOpen(v => !v); setMoreOpen(false) }}
        aria-label={fabOpen ? 'Cerrar menú' : 'Acciones rápidas'}
        aria-expanded={fabOpen}
        className={`lg:hidden fixed right-4 w-[60px] h-[60px] rounded-full flex items-center justify-center active:scale-90 transition-[transform,background,opacity] cf-fab-button${fabOpen ? ' cf-fab-open' : ''}`}
        // z dinamico: cerrado en z-[45] (encima de la pill z-40 pero DEBAJO de
        // chat de Lucas, sheet "Mas" y demas overlays que viven en z-50, asi no
        // los tapa). Abierto sube a z-[55], por encima de su propio overlay
        // (z-54). Los modales (z-10001) siempre quedan arriba.
        // +4px en bottom: pill mide 64px y FAB 56px -> (64-56)/2 para centrar.
        // Ademas se oculta del todo cuando el sheet "Mas" esta abierto.
        style={{
          zIndex: fabOpen ? 55 : 45,
          bottom: 'calc(max(20px, env(safe-area-inset-bottom, 12px)) + 4px)',
          opacity: (moreOpen || lucasOpen) ? 0 : 1,
          visibility: (moreOpen || lucasOpen) ? 'hidden' : 'visible',
          pointerEvents: (moreOpen || lucasOpen) ? 'none' : 'auto',
        }}
      >
        <svg
          className="w-7 h-7 cf-fab-icon"
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true"
          style={{ transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)', transform: fabOpen ? 'rotate(135deg)' : 'rotate(0deg)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      <QrScanner
        open={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onClientDetected={(id) => setQrClienteId(id)}
      />
      <QrCobroModal
        open={!!qrClienteId}
        onClose={() => setQrClienteId(null)}
        clienteId={qrClienteId}
      />
    </>
  )
}
