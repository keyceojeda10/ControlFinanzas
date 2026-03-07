'use client'
// app/(dashboard)/cobradores/[id]/page.jsx - Detalle del cobrador

import { useState, useEffect, use } from 'react'
import { useRouter }                from 'next/navigation'
import { Badge }                    from '@/components/ui/Badge'
import { Card }                     from '@/components/ui/Card'
import { SkeletonCard }             from '@/components/ui/Skeleton'
import { formatCOP }                from '@/lib/calculos'
import Link                         from 'next/link'

export default function CobradorDetallePage({ params }) {
  const { id }      = use(params)
  const router      = useRouter()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toggling, setToggling] = useState(false)

  const fetchCobrador = async () => {
    try {
      const res = await fetch(`/api/cobradores/${id}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('No se pudo cargar el cobrador.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCobrador() }, [id])

  const toggleActivo = async () => {
    if (!data) return
    setToggling(true)
    try {
      const res = await fetch(`/api/cobradores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !data.activo }),
      })
      if (!res.ok) throw new Error()
      setData((prev) => ({ ...prev, activo: !prev.activo }))
    } catch {
      setError('No se pudo cambiar el estado.')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">{error || 'Cobrador no encontrado'}</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const ruta = data.ruta
  const clientes = ruta?.clientes ?? []

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#555555] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Cobradores
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center shrink-0">
              <span className="text-[#a855f7] font-bold text-lg">{data.nombre?.[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[white]">{data.nombre}</h1>
              <p className="text-sm text-[#555555]">{data.email}</p>
            </div>
          </div>
          <button onClick={toggleActivo} disabled={toggling} title={data.activo ? 'Desactivar' : 'Activar'}>
            <Badge variant={data.activo ? 'green' : 'gray'}>{data.activo ? 'Activo' : 'Inactivo'}</Badge>
          </button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[10px] text-[#555555]">Recaudado hoy</p>
          <p className="text-lg font-bold text-[#22c55e]">{formatCOP(data.recaudadoHoy)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#555555]">Cobros hoy</p>
          <p className="text-lg font-bold text-[white]">{data.pagosMes}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#555555]">Clientes</p>
          <p className="text-lg font-bold text-[white]">{clientes.length}</p>
        </Card>
      </div>

      {/* Ruta */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">Ruta asignada</p>
        {ruta ? (
          <Link href={`/rutas/${ruta.id}`} className="flex items-center gap-3 hover:bg-[#111111] -mx-1 px-1 py-2 rounded-[10px] transition-colors">
            <div className="w-9 h-9 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[white]">{ruta.nombre}</p>
              <p className="text-xs text-[#555555]">{clientes.length} clientes</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-[#f59e0b]">Sin ruta asignada</p>
        )}
      </Card>

      {/* Clientes de la ruta */}
      {clientes.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-3">
            Clientes ({clientes.length})
          </p>
          <div className="space-y-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0 hover:bg-[#111111] -mx-1 px-1 rounded-[8px] transition-colors"
              >
                <p className="text-sm text-[white]">{c.nombre}</p>
                <Badge variant={c.estado === 'mora' ? 'red' : c.estado === 'activo' ? 'green' : 'gray'}>
                  {c.estado === 'mora' ? 'En mora' : c.estado === 'activo' ? 'Al día' : 'Cancelado'}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
