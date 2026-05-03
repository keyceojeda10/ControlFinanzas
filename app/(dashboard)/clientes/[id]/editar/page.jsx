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
      <div className="mb-5">
        <button
          onClick={() => router.push(`/clientes/${id}`)}
          className="flex items-center gap-1.5 text-sm transition-colors mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {cliente.nombre}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>Editar cliente</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Modifica los datos del cliente</p>
          </div>
        </div>
      </div>

      <ClienteForm
        clienteInicial={cliente}
        plan={session?.user?.plan ?? 'starter'}
      />
    </div>
  )
}
