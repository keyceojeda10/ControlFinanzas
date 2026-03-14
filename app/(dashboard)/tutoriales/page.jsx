'use client'
// app/(dashboard)/tutoriales/page.jsx — Tutoriales para clientes (solo lectura)

import TutorialesList from '@/components/TutorialesList'

export default function TutorialesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">📚 Tutoriales</h1>
        <p className="text-sm text-[#888888] mt-1">
          Aprende a usar la plataforma paso a paso
        </p>
      </div>
      <TutorialesList showCopyButton={false} />
    </div>
  )
}
