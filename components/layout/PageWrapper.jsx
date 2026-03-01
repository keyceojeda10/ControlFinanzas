'use client'
// components/layout/PageWrapper.jsx
// Envuelve el contenido de cada página para animar solo al cambiar de ruta

import { usePathname } from 'next/navigation'

export default function PageWrapper({ children }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-transition h-full">
      {children}
    </div>
  )
}
