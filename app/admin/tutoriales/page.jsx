'use client'
// app/admin/tutoriales/page.jsx — Tutoriales para superadmin con botón de copiar WhatsApp

import TutorialesList from '@/components/TutorialesList'

export default function AdminTutorialesPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">📱 Tutoriales</h1>
        <p className="text-sm text-[#888888] mt-1">
          Respuestas rápidas para copiar y pegar en WhatsApp a tus clientes
        </p>
      </div>
      <TutorialesList showCopyButton={true} />
    </div>
  )
}
