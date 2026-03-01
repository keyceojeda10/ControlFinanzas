'use client'
// app/(dashboard)/clientes/nuevo/page.jsx - Formulario de nuevo cliente

import { useEffect }   from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/hooks/useAuth'
import ClienteForm     from '@/components/clientes/ClienteForm'

export default function NuevoClientePage() {
  const router = useRouter()
  const { session, esOwner, loading } = useAuth()

  // Solo owners pueden crear clientes
  useEffect(() => {
    if (!loading && !esOwner) router.replace('/clientes')
  }, [loading, esOwner, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!esOwner) return null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#555555] hover:text-[white] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[white]">Nuevo cliente</h1>
        <p className="text-sm text-[#555555] mt-0.5">Registra los datos del cliente</p>
      </div>

      {/* Form card */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 lg:p-6">
        <ClienteForm plan={session?.user?.plan ?? 'basic'} />
      </div>
    </div>
  )
}
