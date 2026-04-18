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
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] rounded-[16px] p-6 text-center">
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
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Cobradores
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-full bg-[rgba(139,92,246,0.15)] flex items-center justify-center shrink-0">
              <span className="text-[var(--color-purple)] font-bold text-lg">{data.nombre?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-[white] truncate">{data.nombre}</h1>
              <p className="text-sm text-[var(--color-text-muted)] truncate">{data.email}</p>
              {data.telefono && <p className="text-xs text-[var(--color-text-muted)] truncate">{data.telefono}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 self-end min-[420px]:self-auto shrink-0">
            <Link
              href={`/cobradores/${id}/editar`}
              className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all"
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
              className="p-2 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] transition-all disabled:opacity-50"
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
          <p className="text-[10px] text-[var(--color-text-muted)]">Recaudado hoy</p>
          <p className="text-lg font-bold text-[var(--color-success)]">{formatCOP(data.recaudadoHoy)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)]">Cobros hoy</p>
          <p className="text-lg font-bold text-[white]">{data.pagosMes}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)]">Clientes</p>
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
              <svg className="w-4 h-4 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Enviar credenciales</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">Resetea la contraseña y envía los datos de acceso por WhatsApp</p>
            </div>
            <svg className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : !nuevaPass ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Resetear contraseña</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Se generará una contraseña temporal que podrás enviarle al cobrador.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowReenviar(false)}
                className="flex-1 h-10 rounded-[12px] bg-[#1f1f1f] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium transition-colors hover:bg-[var(--color-bg-hover)]"
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
                className="flex-1 h-10 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
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
              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Contraseña reseteada</p>
            </div>
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[10px] px-3 py-2">
              <p className="text-[10px] text-[var(--color-text-muted)]">Nueva contraseña temporal</p>
              <p className="text-sm font-bold text-[var(--color-accent)] font-mono">{nuevaPass}</p>
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
              className="w-full text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] transition-colors text-center pt-1"
            >
              Cerrar
            </button>
          </div>
        )}
      </Card>

      {/* Ruta */}
      <Card>
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Ruta asignada</p>
        {ruta ? (
          <Link href={`/rutas/${ruta.id}`} className="flex items-center gap-3 hover:bg-[var(--color-bg-card)] -mx-1 px-1 py-2 rounded-[10px] transition-colors">
            <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[white]">{ruta.nombre}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{clientes.length} clientes</p>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-[var(--color-warning)]">Sin ruta asignada</p>
        )}
      </Card>

      {/* Clientes de la ruta */}
      {clientes.length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            Clientes ({clientes.length})
          </p>
          <div className="space-y-2">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-card)] -mx-1 px-1 rounded-[8px] transition-colors"
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
