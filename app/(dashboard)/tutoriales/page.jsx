'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes

import TutorialesList from '@/components/TutorialesList'
import { useOnline } from '@/hooks/useOnline'
import OfflineFallback from '@/components/offline/OfflineFallback'

export default function TutorialesPage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="Los tutoriales no estan disponibles sin conexion" descripcion="Vuelve a conectarte para ver los videos." />
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Tutoriales</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Aprende a usar cada funcion del sistema paso a paso
        </p>
      </div>
      <TutorialesList showCopyButton={false} />
    </div>
  )
}
