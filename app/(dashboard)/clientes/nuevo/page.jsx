'use client'
// app/(dashboard)/clientes/nuevo/page.jsx - Formulario de nuevo cliente

import { useEffect }   from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/hooks/useAuth'
import ClienteForm     from '@/components/clientes/ClienteForm'

export default function NuevoClientePage() {
  const router = useRouter()
  const { session, puedeCrearClientes, loading } = useAuth()

  // Owner o cobrador con permiso puede crear clientes
  useEffect(() => {
    if (!loading && !puedeCrearClientes) router.replace('/clientes')
  }, [loading, puedeCrearClientes, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!puedeCrearClientes) return null

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm transition-colors mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 22%, transparent), color-mix(in srgb, var(--color-accent) 12%, transparent))',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Nuevo cliente</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Registra los datos del cliente</p>
          </div>
        </div>
      </div>

      <ClienteForm plan={session?.user?.plan ?? 'starter'} />
    </div>
  )
}
