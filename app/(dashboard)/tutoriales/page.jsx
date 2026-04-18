'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes

import TutorialesList from '@/components/TutorialesList'

export default function TutorialesPage() {
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
