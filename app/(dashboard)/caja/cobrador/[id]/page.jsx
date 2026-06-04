'use client'
// app/(dashboard)/caja/cobrador/[id]/page.jsx
// Caja completa de un cobrador (pantalla dedicada / deep-link). Reusa el cuerpo
// CajaCobradorDetalle, también usado por la pestaña "Caja por ruta" de /caja.
// Solo accesible por el owner.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'
import CajaCobradorDetalle from '@/components/caja/CajaCobradorDetalle'

const fmtFecha = (d) => {
  if (!d) return '—'
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

export default function CajaCobradorPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const fechaParam = searchParams.get('fecha')
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')
  const { esOwner, loading: authLoading } = useAuth()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = (desdeParam && hastaParam)
        ? `?desde=${desdeParam}&hasta=${hastaParam}`
        : (fechaParam ? `?fecha=${fechaParam}` : '')
      const res = await fetch(`/api/caja/cobrador/${id}${qs}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo cargar la caja del cobrador')
      }
      setData(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id, fechaParam, desdeParam, hastaParam])

  useEffect(() => { fetchData() }, [fetchData])

  if (authLoading || loading) {
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!esOwner) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-sm text-[var(--color-text-muted)]">Solo el administrador puede ver la caja por cobrador.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <Link href="/caja" className="text-sm text-[var(--color-accent)] flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a Caja
        </Link>
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <Link href={`/caja?fecha=${data?.fecha || ''}`} className="text-sm text-[var(--color-accent)] flex items-center gap-1 w-fit">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a Caja
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Caja de {data?.cobrador?.nombre}</h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              {data?.esRango ? `${data.desde} a ${data.hasta}` : fmtFecha(data?.fecha)}
            </p>
          </div>
          {data?.esRango ? null : (data?.cerrado ? <Badge variant="green">Cerrado</Badge> : <Badge variant="yellow">Pendiente cierre</Badge>)}
        </div>
      </div>

      <CajaCobradorDetalle data={data} />
    </div>
  )
}
