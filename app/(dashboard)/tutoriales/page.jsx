'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes

import TutorialesList from '@/components/TutorialesList'

export default function TutorialesPage() {
  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[25px] font-semibold text-[var(--cf-ink)]">Tutoriales</h1>
        <p className="text-sm text-[var(--cf-ink-3)] mt-1">
          Aprende a usar cada función del sistema paso a paso
        </p>
      </div>
      <TutorialesList showCopyButton={false} />
    </div>
  )
}
