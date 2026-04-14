'use client'
// app/(dashboard)/cobradores/[id]/page.jsx - Detalle del cobrador

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter }                from 'next/navigation'
import { useAuth }                  from '@/hooks/useAuth'
import { Badge }                    from '@/components/ui/Badge'
import { Card }                     from '@/components/ui/Card'
import { SkeletonCard }             from '@/components/ui/Skeleton'
import { formatCOP }                from '@/lib/calculos'
import CompartirCredenciales        from '@/components/cobradores/CompartirCredenciales'
import Link                         from 'next/link'

export default function CobradorDetallePage({ params }) {
  const { id }      = use(params)
  const router      = useRouter()
  const { session } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toggling, setToggling] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [showReenviar, setShowReenviar] = useState(false)
  const [nuevaPass, setNuevaPass]       = useState('')
  const [reseteando, setReseteando]     = useState(false)

  const fetchCobrador = useCallback(async () => {
    try {
      const res = await fetch(`/api/cobradores/${id}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('No se pudo cargar el cobrador.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCobrador() }, [fetchCobrador])

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
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Cobradores
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center shrink-0">
              <span className="text-[#a855f7] font-bold text-lg">{data.nombre?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-[white] truncate">{data.nombre}</h1>
              <p className="text-sm text-[#888888] truncate">{data.email}</p>
              {data.telefono && <p className="text-xs text-[#666666] truncate">{data.telefono}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cobradores/${id}/editar`}
              className="p-2 rounded-[10px] text-[#888888] hover:text-[#f5c518] hover:bg-[rgba(245,197,24,0.1)] transition-all"
              title="Editar cobrador"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
            <button onClick={toggleActivo} disabled={toggling} title={data.activo ? 'Desactivar' : 'Activar'}>
              <Badge variant={data.activo ? 'green' : 'gray'}>{data.activo ? 'Activo' : 'Inactivo'}</Badge>
            </button>
            <button
              onClick={async () => {
                if (!confirm(`¿Eliminar a "${data.nombre}"? ${data.recaudadoHoy > 0 || data.pagosMes > 0 ? 'Tiene historial de pagos, se desactivará en vez de eliminarse.' : 'Se eliminará permanentemente.'}`)) return
                setEliminando(true)
                const res = await fetch(`/api/cobradores/${id}`, { method: 'DELETE' })
                if (res.ok) router.push('/cobradores')
                else { alert('Error al eliminar'); setEliminando(false) }
              }}
              disabled={eliminando}
              className="p-2 rounded-[10px] text-[#888888] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all disabled:opacity-50"
              title="Eliminar cobrador"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-[10px] text-[#888888]">Recaudado hoy</p>
          <p className="text-lg font-bold text-[#22c55e]">{formatCOP(data.recaudadoHoy)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#888888]">Cobros hoy</p>
          <p className="text-lg font-bold text-[white]">{data.pagosMes}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#888888]">Clientes</p>
          <p className="text-lg font-bold text-[white]">{clientes.length}</p>
        </Card>
      </div>

      {/* Reenviar credenciales */}
      <Card>
        {!showReenviar ? (
          <button
            onClick={() => setShowReenviar(true)}
            className="w-full flex items-center gap-3 text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[rgba(59,130,246,0.12)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Enviar credenciales</p>
              <p className="text-[10px] text-[#888888]">Resetea la contraseña y envía los datos de acceso por WhatsApp</p>
            </div>
            <svg className="w-4 h-4 text-[#555555] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : !nuevaPass ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Resetear contraseña</p>
            <p className="text-xs text-[#888888]">
              Se generará una contraseña temporal que podrás enviarle al cobrador.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReenviar(false)}
                className="flex-1 h-10 rounded-[12px] bg-[#1f1f1f] border border-[#2a2a2a] text-white text-sm font-medium transition-colors hover:bg-[#2a2a2a]"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setReseteando(true)
                  const tempPass = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10)
                  try {
                    const res = await fetch(`/api/cobradores/${id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ password: tempPass }),
                    })
                    if (!res.ok) { setError('Error al resetear contraseña'); setShowReenviar(false); return }
                    setNuevaPass(tempPass)
                  } catch {
                    setError('Error de conexión')
                    setShowReenviar(false)
                  } finally {
                    setReseteando(false)
                  }
                }}
                disabled={reseteando}
                className="flex-1 h-10 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {reseteando ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Reseteando...
                  </>
                ) : 'Generar contraseña'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-white">Contraseña reseteada</p>
            </div>
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-[10px] px-3 py-2">
              <p className="text-[10px] text-[#888888]">Nueva contraseña temporal</p>
              <p className="text-sm font-bold text-[#f5c518] font-mono">{nuevaPass}</p>
            </div>
            <CompartirCredenciales
              nombreCobrador={data.nombre}
              email={data.email}
              password={nuevaPass}
              telefono={data.telefono}
              nombreOwner={session?.user?.nombre}
            />
            <button
              onClick={() => { setShowReenviar(false); setNuevaPass('') }}
              className="w-full text-[10px] text-[#555555] hover:text-[#888888] transition-colors text-center pt-1"
            >
              Cerrar
            </button>
          </div>
        )}
      </Card>

      {/* Ruta */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">Ruta asignada</p>
        {ruta ? (
          <Link href={`/rutas/${ruta.id}`} className="flex items-center gap-3 hover:bg-[#111111] -mx-1 px-1 py-2 rounded-[10px] transition-colors">
            <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[white]">{ruta.nombre}</p>
              <p className="text-xs text-[#888888]">{clientes.length} clientes</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-[#f59e0b]">Sin ruta asignada</p>
        )}
      </Card>

      {/* Clientes de la ruta */}
      {clientes.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">
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
