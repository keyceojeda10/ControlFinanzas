'use client'
// app/(dashboard)/clientes/[id]/editar/page.jsx - Editar datos de cliente existente

import { useState, useEffect, use } from 'react'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import ClienteForm                  from '@/components/clientes/ClienteForm'
import { SkeletonCard }             from '@/components/ui/Skeleton'

export default function EditarClientePage({ params }) {
  const { id }              = use(params)
  const router              = useRouter()
  const { session, puedeEditarClientes, loading: authLoading } = useAuth()

  const [cliente,  setCliente]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Owner o cobrador con permiso puede editar cliente
  useEffect(() => {
    if (!authLoading && !puedeEditarClientes) router.replace(`/clientes/${id}`)
  }, [authLoading, puedeEditarClientes, id, router])

  // Cargar datos del cliente
  useEffect(() => {
    if (authLoading || !puedeEditarClientes) return
    fetch(`/api/clientes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('No encontrado')
        return r.json()
      })
      .then(setCliente)
      .catch(() => setError('No se pudo cargar el cliente.'))
      .finally(() => setLoading(false))
  }, [id, authLoading, puedeEditarClientes])

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">{error || 'Cliente no encontrado'}</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/clientes/${id}`)}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {cliente.nombre}
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Editar cliente</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Modifica los datos del cliente</p>
      </div>

      {/* Form card */}
      <div
        className="border border-[var(--color-border)] rounded-[16px] p-5 lg:p-6"
        style={{
          background: 'linear-gradient(135deg, #f5c5180A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f5c51805 100%)',
          boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        <ClienteForm
          clienteInicial={cliente}
          plan={session?.user?.plan ?? 'starter'}
        />
      </div>
    </div>
  )
}
