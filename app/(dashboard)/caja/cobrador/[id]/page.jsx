'use client'
// app/(dashboard)/caja/cobrador/[id]/page.jsx
// Caja completa de un cobrador (pantalla dedicada / deep-link). Reusa el cuerpo
// CajaCobradorDetalle, también usado por la pestaña "Caja por ruta" de /caja.
// Solo accesible por el owner.

import { useState, useEffect, useCallback } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
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

  // ── LA CABECERA VA DESPUÉS DE `data`, NO ANTES ──
  //
  // Estaba en la PRIMERA línea del componente leyendo `data?.cobrador?.nombre`,
  // y `data` se declara aquí con `const`. Un `const` no se puede leer antes de
  // su línea, así que la pantalla entera reventaba al pintarse:
  //
  //     Cannot access 'data' before initialization
  //
  // Minificado eso sale como «Cannot access 'O' before initialization», que es
  // el error #84 de producción. Y nadie lo veía porque el barrido de rutas SIN
  // ARGUMENTOS solo recorre las 32 fijas: las de detalle —esta entre ellas— hay
  // que pedirlas con un id. Se comprobó pasándole uno real.
  //
  // Es la misma forma que ya cazamos en `carga-masiva` y en el asistente: una
  // referencia que sube más arriba que su declaración. No la detecta el build ni
  // ninguna prueba; sí la detecta `no-use-before-define`, que ahora corre en CI.
  useCabecera({
    titulo: data?.cobrador?.nombre ? `Caja de ${data.cobrador.nombre}` : 'Caja del cobrador',
    subtitulo: data?.esRango ? `${data.desde} a ${data.hasta}` : fmtFecha(data?.fecha),
  })

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
        <p className="text-sm text-[var(--cf-ink-3)]">Solo el administrador puede ver la caja por cobrador.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        <Link href="/caja" className="text-sm text-[var(--cf-gold)] flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver a Caja
        </Link>
        <p className="text-sm text-[var(--cf-red-dark)]">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl lg:max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* El nombre del cobrador y la fecha viajan a la cabecera: son el
              titulo de esta pantalla, y salian repetidos debajo de ella. */}
          <div>
          </div>
          {data?.esRango ? null : (data?.cerrado ? <Badge variant="green">Cerrado</Badge> : <Badge variant="yellow">Pendiente cierre</Badge>)}
        </div>
      </div>

      <CajaCobradorDetalle data={data} />
    </div>
  )
}
