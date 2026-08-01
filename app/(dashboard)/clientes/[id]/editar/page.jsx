'use client'
// app/(dashboard)/clientes/[id]/editar/page.jsx - Editar datos de cliente existente

import { useState, useEffect, use } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import ClienteForm                  from '@/components/clientes/ClienteForm'
import { planTieneFotos }           from '@/lib/planes'
import { SkeletonCard }             from '@/components/ui/Skeleton'
import { obtenerClienteOffline }    from '@/lib/offline'

export default function EditarClientePage({ params }) {
  useCabecera({ titulo: 'Editar cliente', subtitulo: 'Modifica los datos del cliente' })

  const { id }              = use(params)
  const router              = useRouter()
  const { session, puedeEditarClientes, esOwner, loading: authLoading } = useAuth()

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
      .catch(() => obtenerClienteOffline(id).then(cached => {
        if (cached) setCliente(cached)
        else setError('No se pudo cargar el cliente.')
      }))
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
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] rounded-[20px] p-6 text-center">
          <p className="font-semibold mb-2">{error || 'Cliente no encontrado'}</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Fuera el icono dorado de 40px y el titulo: los dos salian JUSTO
          debajo de la cabecera que ya dice «Editar cliente». El icono ademas
          gastaba el unico dorado de la pantalla en decorar. */}

      <ClienteForm
        clienteInicial={cliente}
        plan={session?.user?.plan ?? 'starter'}
        puedeSubirFoto={planTieneFotos(session?.user?.plan)}
        esOwner={esOwner}
      />
    </div>
  )
}
