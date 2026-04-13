'use client'
// app/(dashboard)/clientes/[id]/page.jsx - Detalle del cliente

import { useState, useEffect, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerClienteOffline }     from '@/lib/offline'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import BotonWhatsApp                 from '@/components/ui/BotonWhatsApp'
import { formatCOP, formatFechaCobro } from '@/lib/calculos'
import ScoreCrediticio               from '@/components/clientes/ScoreCrediticio'

const estadoBadge = {
  activo:    { variant: 'green',  label: 'Activo'    },
  mora:      { variant: 'red',    label: 'En mora'   },
  cancelado: { variant: 'gray',   label: 'Cancelado' },
  inactivo:  { variant: 'gray',   label: 'Inactivo'  },
}

const estadoPrestamoBadge = {
  activo:     { variant: 'blue',   label: 'Activo'     },
  completado: { variant: 'green',  label: 'Completado' },
  cancelado:  { variant: 'gray',   label: 'Cancelado'  },
}

export default function ClienteDetallePage({ params }) {
  const { id }     = use(params)
  const router     = useRouter()
  const { esOwner, puedeCrearPrestamos, puedeEditarClientes, plan } = useAuth()
  const { lastSyncedAt } = useOffline()

  const [cliente, setCliente]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteData, setDeleteData] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rutaNav, setRutaNav]   = useState(null)

  // Leer contexto de ruta activa
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cf-ruta-nav')
      if (!saved) return
      const nav = JSON.parse(saved)
      const idx = nav.clientes.findIndex(c => c.id === id)
      if (idx >= 0) {
        setRutaNav({ ...nav, currentIndex: idx })
      }
    } catch {}
  }, [id])

  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const loadCliente = async () => {
      setIsOffline(false)
      // Offline: prefer IndexedDB (SW cache may be stale)
      if (!navigator.onLine) {
        try {
          const cached = await obtenerClienteOffline(id)
          if (cached) { setCliente(cached); setIsOffline(true); setLoading(false); return }
        } catch {}
      }
      try {
        const res = await fetch(`/api/clientes/${id}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (data.offline) throw new Error('offline')
        setCliente(data)
      } catch {
        try {
          const cached = await obtenerClienteOffline(id)
          if (cached) { setCliente(cached); setIsOffline(true); setLoading(false); return }
        } catch {}
        setError('No se pudo cargar el cliente.')
      } finally {
        setLoading(false)
      }
    }
    loadCliente()
  }, [id])

  // Re-fetch silently when offline payments get synced
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetch(`/api/clientes/${id}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setCliente(d) }).catch(() => {})
    }
  }, [lastSyncedAt])

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error === 'tiene_prestamos') {
        setDeleteData(data.prestamos)
        return
      }
      if (!res.ok) { alert(data.error || 'Error'); return }
      router.push('/clientes')
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  const handleToggleInactivo = async () => {
    setActionLoading(true)
    try {
      const accion = cliente.estado === 'inactivo' ? 'activar' : 'inactivar'
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return }
      const updated = await res.json()
      setCliente(prev => ({ ...prev, estado: updated.estado }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  const handleDeletePrestamo = async (prestamoId) => {
    if (!confirm('¿Eliminar este préstamo y todos sus pagos? Esta acción no se puede deshacer.')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Error'); return }
      setDeleteData(prev => prev.filter(p => p.id !== prestamoId))
      setCliente(prev => ({ ...prev, prestamos: prev.prestamos.filter(p => p.id !== prestamoId) }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

  const handleTrasladar = async (prestamoId, clienteDestinoId) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/trasladar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteDestinoId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Error'); return }
      alert(data.message)
      setDeleteData(prev => prev.filter(p => p.id !== prestamoId))
      setCliente(prev => ({ ...prev, prestamos: prev.prestamos.filter(p => p.id !== prestamoId) }))
    } catch { alert('Error de conexión') }
    finally { setActionLoading(false) }
  }

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

  const navegarEnRuta = (direction) => {
    if (!rutaNav) return
    const newIdx = rutaNav.currentIndex + direction
    if (newIdx < 0 || newIdx >= rutaNav.clientes.length) return
    const next = rutaNav.clientes[newIdx]
    // Actualizar contexto
    sessionStorage.setItem('cf-ruta-nav', JSON.stringify({ ...rutaNav, currentIndex: newIdx }))
    // Actualizar progreso de ruta
    const getColombiaDateStr = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
      clienteId: next.id,
      clienteNombre: next.nombre,
      index: newIdx,
      date: getColombiaDateStr(),
    }))
    if (navigator.onLine) {
      router.push(`/clientes/${next.id}`)
    } else {
      window.location.href = `/clientes/${next.id}`
    }
  }

  const irSiguienteEnRuta = () => navegarEnRuta(1)
  const noPagoSiguiente = () => navegarEnRuta(1)

  const esUltimoEnRuta = rutaNav && rutaNav.currentIndex >= rutaNav.clientes.length - 1
  const esPrimeroEnRuta = rutaNav && rutaNav.currentIndex <= 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {rutaNav ? rutaNav.rutaNombre : 'Clientes'}
      </button>

      {/* Barra de navegación de ruta */}
      {rutaNav && (
        <div className="bg-[rgba(245,197,24,0.06)] border border-[rgba(245,197,24,0.15)] rounded-[14px] px-3 py-2.5 flex items-center justify-between">
          <button
            onClick={() => navegarEnRuta(-1)}
            disabled={esPrimeroEnRuta}
            className="p-1.5 rounded-[8px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center min-w-0 px-2">
            <p className="text-[10px] text-[#888] uppercase tracking-wide">{rutaNav.rutaNombre}</p>
            <p className="text-xs text-white font-medium">{rutaNav.currentIndex + 1} de {rutaNav.clientes.length}</p>
          </div>
          <button
            onClick={irSiguienteEnRuta}
            disabled={esUltimoEnRuta}
            className="p-1.5 rounded-[8px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] disabled:opacity-30 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Header card */}
      <Card>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
            style={{
              background: cliente.estado === 'mora'     ? 'rgba(239,68,68,0.15)'
                        : cliente.estado === 'activo'   ? 'rgba(245,197,24,0.15)'
                        : 'rgba(100,116,139,0.15)',
              color: cliente.estado === 'mora'    ? '#ef4444'
                   : cliente.estado === 'activo'  ? '#f5c518'
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
              <ScoreCrediticio cedula={cliente.cedula} plan={plan} />
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm text-[#888888]">
                <span className="text-[#888888]">CC</span> {cliente.cedula}
              </p>
              {cliente.telefono && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#888888]">Tel.</span> {cliente.telefono}
                </p>
              )}
              {cliente.direccion && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#888888]">Dir.</span> {cliente.direccion}
                </p>
              )}
              {cliente.referencia && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#888888]">Ref.</span> {cliente.referencia}
                </p>
              )}
              {cliente.notas && (
                <p className="text-sm text-[#888888] whitespace-pre-wrap">
                  <span className="text-[#888888]">Notas:</span> {cliente.notas}
                </p>
              )}
              {cliente.ruta && (
                <p className="text-sm text-[#888888]">
                  <span className="text-[#888888]">Ruta</span> {cliente.ruta.nombre}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {(puedeCrearPrestamos || puedeEditarClientes) && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#2a2a2a]">
            {puedeCrearPrestamos && (
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
            )}
            <Link href={`/clientes/${id}/historial`}>
              <Button size="sm" variant="secondary">Historial</Button>
            </Link>
            {puedeEditarClientes && (
              <Link href={`/clientes/${id}/editar`}>
                <Button size="sm" variant="secondary">Editar</Button>
              </Link>
            )}
            {esOwner && (
              <>
                <Button size="sm" variant="secondary" onClick={handleToggleInactivo} disabled={actionLoading}>
                  {cliente.estado === 'inactivo' ? 'Activar' : 'Inactivar'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setShowDeleteModal(true); handleDelete() }}
                  disabled={actionLoading}
                  className="!text-[#ef4444] !border-[rgba(239,68,68,0.2)] hover:!bg-[rgba(239,68,68,0.1)]"
                >
                  Eliminar
                </Button>
              </>
            )}
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
            <p className="text-sm text-[#888888]">Sin préstamos activos</p>
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

      {/* Navegación ruta: botones de acción */}
      {rutaNav && (
        <div className="flex gap-2">
          {!esUltimoEnRuta ? (
            <>
              <button
                onClick={noPagoSiguiente}
                className="flex-1 py-3 rounded-[14px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] text-sm font-medium active:scale-[0.98] transition-all"
              >
                No pagó · Siguiente
              </button>
              <button
                onClick={irSiguienteEnRuta}
                className="flex-1 py-3 rounded-[14px] bg-[#f5c518] text-[#0a0a0a] text-sm font-semibold active:scale-[0.98] transition-all"
              >
                Siguiente cliente →
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                sessionStorage.removeItem('cf-ruta-nav')
                const url = `/rutas/${rutaNav.rutaId}`
                navigator.onLine ? router.push(url) : (window.location.href = url)
              }}
              className="flex-1 py-3 rounded-[14px] bg-[#22c55e] text-white text-sm font-semibold active:scale-[0.98] transition-all"
            >
              Ruta finalizada →
            </button>
          )}
        </div>
      )}

      {/* Modal: cliente tiene préstamos */}
      {showDeleteModal && deleteData && (
        <DeleteClienteModal
          cliente={cliente}
          prestamos={deleteData}
          onClose={() => { setShowDeleteModal(false); setDeleteData(null) }}
          onDeletePrestamo={handleDeletePrestamo}
          onTrasladar={handleTrasladar}
          onRetryDelete={handleDelete}
          loading={actionLoading}
          clienteId={id}
        />
      )}
    </div>
  )
}

// ─── Modal: eliminar cliente con préstamos ───────────────────────
function DeleteClienteModal({ cliente, prestamos, onClose, onDeletePrestamo, onTrasladar, onRetryDelete, loading, clienteId }) {
  const [trasladarId, setTrasladarId] = useState(null) // prestamoId que se va a trasladar
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [loadingClientes, setLoadingClientes] = useState(false)

  // Buscar clientes para trasladar
  useEffect(() => {
    if (!trasladarId) return
    setLoadingClientes(true)
    fetch(`/api/clientes?buscar=${encodeURIComponent(buscar)}`)
      .then(r => r.json())
      .then(data => {
        const lista = (data.clientes || data || []).filter(c => c.id !== clienteId)
        setClientes(lista)
      })
      .catch(() => {})
      .finally(() => setLoadingClientes(false))
  }, [trasladarId, buscar, clienteId])

  // Si ya no quedan préstamos, reintentar eliminar
  useEffect(() => {
    if (prestamos.length === 0) {
      onRetryDelete()
    }
  }, [prestamos.length])

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-[20px] sm:rounded-[20px] flex flex-col max-h-[85vh]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-white">Eliminar cliente</h3>
            <button onClick={onClose} className="text-[#888] hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-[#ef4444]">
            {cliente.nombre} tiene {prestamos.length} prestamo{prestamos.length > 1 ? 's' : ''}.
            Debes eliminarlos o trasladarlos antes de eliminar el cliente.
          </p>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {/* Vista de trasladar */}
          {trasladarId && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white font-medium">Trasladar a otro cliente</p>
                <button onClick={() => setTrasladarId(null)} className="text-xs text-[#888] hover:text-white">Cancelar</button>
              </div>
              <input
                type="text"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                placeholder="Buscar cliente por nombre o cedula..."
                className="w-full mb-2 px-3 py-2 bg-[#111] border border-[#2a2a2a] rounded-[10px] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#f5c518]"
              />
              {loadingClientes ? (
                <p className="text-xs text-[#888] text-center py-3">Buscando...</p>
              ) : clientes.length === 0 ? (
                <p className="text-xs text-[#888] text-center py-3">No se encontraron clientes</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientes.slice(0, 10).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onTrasladar(trasladarId, c.id); setTrasladarId(null) }}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#111] hover:bg-[rgba(245,197,24,0.08)] text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center text-xs font-bold text-[#f5c518] shrink-0">
                        {c.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{c.nombre}</p>
                        <p className="text-[10px] text-[#888]">CC {c.cedula}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lista de préstamos */}
          {!trasladarId && (
            <div className="space-y-3">
              {prestamos.map(p => (
                <div key={p.id} className="p-3 rounded-[12px] bg-[#151515] border border-[#222]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{formatCOP(p.montoPrestado)}</p>
                      <p className="text-[10px] text-[#888]">
                        Saldo: {formatCOP(p.saldoPendiente)} - {p.estado}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrasladarId(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs font-medium hover:bg-[rgba(245,197,24,0.15)] transition-colors"
                    >
                      Trasladar a otro cliente
                    </button>
                    <button
                      onClick={() => onDeletePrestamo(p.id)}
                      disabled={loading}
                      className="flex-1 py-2 rounded-[8px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-xs font-medium hover:bg-[rgba(239,68,68,0.15)] transition-colors"
                    >
                      Eliminar prestamo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-componente: tarjeta de préstamo ─────────────────────────
function PrestamoCard({ prestamo: p, clienteId, cliente, mini = false }) {
  const badge  = estadoPrestamoBadge[p.estado] ?? estadoPrestamoBadge.activo
  const porcentaje = p.porcentajePagado ?? 0
  const enMora = (p.diasMora ?? 0) > 0
  const tieneProximoCobro = p.estado === 'activo' && p.proximoCobro
  const proximoCobroLabel = tieneProximoCobro ? formatFechaCobro(p.proximoCobro) : null
  const cobroVencido = enMora && tieneProximoCobro
  const prefijoCobro = cobroVencido
    ? (p.frecuencia === 'diario' ? 'Cobro pendiente' : 'Debió cobrarse')
    : 'Próx. cobro'
  const valorCobro = cobroVencido && p.frecuencia === 'diario' ? 'hoy' : proximoCobroLabel

  if (mini) {
    return (
      <Link
        href={`/prestamos/${p.id}`}
        className="flex items-center gap-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-4 py-3 hover:border-[#2a2a2a]/70 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[white]">{formatCOP(p.montoPrestado)}</p>
          <p className="text-xs text-[#888888]">
            {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <svg className="w-4 h-4 text-[#2a2a2a] group-hover:text-[#888888] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <p className="text-xs text-[#888888] mt-0.5">
            Prestado el {new Date(p.fechaInicio).toLocaleDateString('es-CO')}
          </p>
          {proximoCobroLabel && (
            <p className={[
              'text-xs mt-0.5 flex items-center gap-1 capitalize',
              cobroVencido ? 'text-[#ef4444]' : 'text-[#f5c518]',
            ].join(' ')}>
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {prefijoCobro}: <span className="font-medium">{valorCobro}</span>
            </p>
          )}
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {/* Barra de progreso */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#888888] mb-1.5">
          <span>Pagado: {formatCOP(p.montoPrestado - (p.saldoPendiente ?? 0))}</span>
          <span>{porcentaje}%</span>
        </div>
        <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100 ? '#22c55e' : p.diasMora > 0 ? '#ef4444' : '#f5c518',
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-[#888888]">Saldo: <span className="text-[white] font-medium">{formatCOP(p.saldoPendiente)}</span></span>
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
