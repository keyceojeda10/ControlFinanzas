'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'

export default function QrRedirectPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function resolver() {
      try {
        const res = await fetch(`/api/clientes/${id}`)
        if (!res.ok) {
          setError('Cliente no encontrado')
          return
        }
        const cliente = await res.json()
        const activos = cliente.prestamos?.filter(p => p.estado === 'activo') ?? []

        if (activos.length === 1) {
          router.replace(`/prestamos/${activos[0].id}?openPago=1&fromQr=1`)
        } else if (activos.length > 1) {
          router.replace(`/clientes/${id}`)
        } else {
          router.replace(`/clientes/${id}`)
        }
      } catch {
        if (!cancelled) setError('Error al cargar el cliente')
      }
    }
    resolver()
    return () => { cancelled = true }
  }, [id, router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
        <button
          onClick={() => router.push('/clientes')}
          className="h-10 px-5 rounded-xl text-sm font-medium"
          style={{ background: 'var(--color-accent)', color: '#18181b' }}
        >
          Ir a clientes
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Cargando cliente...</p>
    </div>
  )
}
