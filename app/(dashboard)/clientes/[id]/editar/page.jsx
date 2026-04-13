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
  const { session, esOwner, loading: authLoading } = useAuth()

  const [cliente,  setCliente]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  // Solo owners
  useEffect(() => {
    if (!authLoading && !esOwner) router.replace(`/clientes/${id}`)
  }, [authLoading, esOwner, id, router])

  // Cargar datos del cliente
  useEffect(() => {
    if (authLoading || !esOwner) return
    fetch(`/api/clientes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('No encontrado')
        return r.json()
      })
      .then(setCliente)
      .catch(() => setError('No se pudo cargar el cliente.'))
      .finally(() => setLoading(false))
  }, [id, authLoading, esOwner])

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
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
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
          className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-white transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {cliente.nombre}
        </button>
        <h1 className="text-xl font-bold text-white">Editar cliente</h1>
        <p className="text-sm text-[#888888] mt-0.5">Modifica los datos del cliente</p>
      </div>

      {/* Form card */}
      <div
        className="border border-[#2a2a2a] rounded-[16px] p-5 lg:p-6"
        style={{
          background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
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
