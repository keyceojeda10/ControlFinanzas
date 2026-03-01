'use client'
// app/(dashboard)/clientes/[id]/page.jsx - Detalle del cliente

import { useState, useEffect, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import { useAuth }                   from '@/hooks/useAuth'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import BotonWhatsApp                 from '@/components/ui/BotonWhatsApp'
import { formatCOP }                 from '@/lib/calculos'

const estadoBadge = {
  activo:    { variant: 'green',  label: 'Activo'    },
  mora:      { variant: 'red',    label: 'En mora'   },
  cancelado: { variant: 'gray',   label: 'Cancelado' },
}

const estadoPrestamoBadge = {
  activo:     { variant: 'blue',   label: 'Activo'     },
  completado: { variant: 'green',  label: 'Completado' },
  cancelado:  { variant: 'gray',   label: 'Cancelado'  },
}

export default function ClienteDetallePage({ params }) {
  const { id }     = use(params)
  const router     = useRouter()
  const { esOwner } = useAuth()

  const [cliente, setCliente]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setCliente)
      .catch(() => setError('No se pudo cargar el cliente.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
          <p className="font-semibold mb-2">Cliente no encontrado</p>
          <button onClick={() => router.back()} className="text-sm underline">Volver</button>
        </div>
      </div>
    )
  }

  const badge = estadoBadge[cliente.estado] ?? estadoBadge.cancelado
  const prestamosActivos = cliente.prestamos?.filter((p) => p.estado === 'activo') ?? []
  const historial        = cliente.prestamos?.filter((p) => p.estado !== 'activo')  ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#555555] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Clientes
      </button>

      {/* Header card */}
      <Card>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{
              background: cliente.estado === 'mora'     ? 'rgba(239,68,68,0.15)'
                        : cliente.estado === 'activo'   ? 'rgba(59,130,246,0.15)'
                        : 'rgba(100,116,139,0.15)',
              color: cliente.estado === 'mora'    ? '#ef4444'
                   : cliente.estado === 'activo'  ? '#3b82f6'
                   : '#555555',
            }}
          >
            {cliente.nombre?.[0]?.toUpperCase() ?? '?'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[white]">{cliente.nombre}</h1>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-[#888888]">
                <span className="text-[#555555]">CC</span> {cliente.cedula}
              </p>
              {cliente.telefono && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#555555]">Tel.</span> {cliente.telefono}
                </p>
              )}
              {cliente.direccion && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#555555]">Dir.</span> {cliente.direccion}
                </p>
              )}
              {cliente.ruta && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#555555]">Ruta</span> {cliente.ruta.nombre}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {esOwner && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-[#2a2a2a]">
            <Link href={`/prestamos/nuevo?clienteId=${cliente.id}`}>
              <Button
                size="sm"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Nuevo préstamo
              </Button>
            </Link>
            <Link href={`/clientes/${id}/editar`}>
              <Button size="sm" variant="secondary">Editar datos</Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Préstamos activos */}
      {prestamosActivos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#888888] mb-3 uppercase tracking-wide">
            Préstamos activos
          </h2>
          <div className="space-y-3">
            {prestamosActivos.map((p) => (
              <PrestamoCard key={p.id} prestamo={p} clienteId={id} cliente={cliente} />
            ))}
          </div>
        </div>
      )}

      {/* Sin préstamos activos */}
      {prestamosActivos.length === 0 && (
        <Card>
          <div className="text-center py-4">
            <p className="text-sm text-[#555555]">Sin préstamos activos</p>
          </div>
        </Card>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#888888] mb-3 uppercase tracking-wide">
            Historial
          </h2>
          <div className="space-y-2.5">
            {historial.map((p) => (
              <PrestamoCard key={p.id} prestamo={p} clienteId={id} mini />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componente: tarjeta de préstamo ─────────────────────────
function PrestamoCard({ prestamo: p, clienteId, cliente, mini = false }) {
  const badge  = estadoPrestamoBadge[p.estado] ?? estadoPrestamoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0

  if (mini) {
    return (
      <Link
        href={`/prestamos/${p.id}`}
        className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-4 py-3 hover:border-[#2a2a2a]/70 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[white]">{formatCOP(p.montoPrestado)}</p>
          <p className="text-xs text-[#555555]">
            {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <svg className="w-4 h-4 text-[#2a2a2a] group-hover:text-[#555555] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-base font-bold text-[white]">{formatCOP(p.montoPrestado)}</p>
          <p className="text-xs text-[#555555] mt-0.5">
            Prestado el {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#555555] mb-1.5">
          <span>Pagado: {formatCOP(p.montoPrestado - (p.saldoPendiente ?? 0))}</span>
          <span>{porcentaje}%</span>
        </div>
        <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100 ? '#22c55e' : p.diasMora > 0 ? '#ef4444' : '#3b82f6',
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-[#555555]">Saldo: <span className="text-[white] font-medium">{formatCOP(p.saldoPendiente)}</span></span>
          {p.diasMora > 0 && (
            <span className="text-[#ef4444] font-medium">{p.diasMora} días en mora</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Link href={`/prestamos/${p.id}`}>
          <Button size="sm" variant="secondary" className="w-full">
            Ver préstamo
          </Button>
        </Link>
        {p.diasMora > 0 && cliente?.telefono && (
          <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={p} />
        )}
      </div>
    </Card>
  )
}
