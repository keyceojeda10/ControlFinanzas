'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { useState, useEffect, use } from 'react'
import { useRouter }                 from 'next/navigation'
import dynamic                       from 'next/dynamic'
import { useAuth }                   from '@/hooks/useAuth'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { Modal }                     from '@/components/ui/Modal'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import { formatCOP }                 from '@/lib/calculos'

// Cargar mapa dinámicamente (evitar SSR con Leaflet)
const RouteMap = dynamic(() => import('@/components/rutas/RouteMap'), { ssr: false })

export default function RutaDetallePage({ params }) {
  const { id }    = use(params)
  const router    = useRouter()
  const { esOwner } = useAuth()

  const [ruta,          setRuta]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [cobradores,    setCobradores]    = useState([])
  const [modalClientes, setModalClientes] = useState(false)
  const [clientesSinRuta, setClientesSinRuta] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [asignando,     setAsignando]     = useState(false)
  const [quitando,      setQuitando]      = useState(null)
  const [modalCaja,     setModalCaja]     = useState(false)
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardandoCaja, setGuardandoCaja] = useState(false)
  const [errorCaja,     setErrorCaja]     = useState('')
  const [dragIndex,     setDragIndex]     = useState(null)
  const [dragOverIdx,   setDragOverIdx]   = useState(null)
  const [ordenGuardado, setOrdenGuardado] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevoNombre,    setNuevoNombre]    = useState('')
  const [eliminando,     setEliminando]     = useState(false)
  const [optimizando,    setOptimizando]    = useState(false)
  const [optimResult,    setOptimResult]    = useState(null)
  const [showMap,        setShowMap]        = useState(false)

  const fetchRuta = async () => {
    try {
      const res  = await fetch(`/api/rutas/${id}`)
      if (!res.ok) throw new Error()
      setRuta(await res.json())
    } catch {
      setError('No se pudo cargar la ruta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuta()
    if (esOwner) {
      fetch('/api/cobradores').then((r) => r.json()).then(setCobradores).catch(() => {})
    }
  }, [id, esOwner])

  const cambiarCobrador = async (cobradorId) => {
    await fetch(`/api/rutas/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cobradorId: cobradorId || null }),
    })
    fetchRuta()
  }

  const abrirModalClientes = async () => {
    const res  = await fetch('/api/clientes')
    const data = await res.json()
    const idsEnRuta = new Set(ruta?.clientes?.map((c) => c.id) ?? [])
    setClientesSinRuta(data.filter((c) => !c.rutaId || idsEnRuta.has(c.id) === false))
    setSeleccionados([])
    setModalClientes(true)
  }

  const toggleSeleccion = (id) =>
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const asignarClientes = async () => {
    if (!seleccionados.length) return
    setAsignando(true)
    await fetch(`/api/rutas/${id}/clientes`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clienteIds: seleccionados }),
    })
    setModalClientes(false)
    fetchRuta()
    setAsignando(false)
  }

  const quitarCliente = async (clienteId) => {
    setQuitando(clienteId)
    await fetch(`/api/rutas/${id}/clientes`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clienteId }),
    })
    setQuitando(null)
    fetchRuta()
  }

  const registrarCierre = async (e) => {
    e.preventDefault()
    setGuardandoCaja(true)
    setErrorCaja('')
    try {
      const res  = await fetch('/api/caja', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ totalRecogido: Number(totalRecogido) }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error'); return }
      setModalCaja(false)
      fetchRuta()
    } finally {
      setGuardandoCaja(false)
    }
  }

  const guardarNombre = async () => {
    if (!nuevoNombre.trim()) return
    await fetch(`/api/rutas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim() }),
    })
    setEditandoNombre(false)
    fetchRuta()
  }

  const eliminarRuta = async () => {
    if (!confirm(`¿Eliminar la ruta "${ruta.nombre}"? Los clientes quedarán sin ruta asignada.`)) return
    setEliminando(true)
    const res = await fetch(`/api/rutas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/rutas')
    } else {
      alert('Error al eliminar la ruta')
      setEliminando(false)
    }
  }

  const guardarOrden = async (nuevosClientes) => {
    try {
      const res = await fetch(`/api/rutas/${id}/reordenar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIds: nuevosClientes.map((c) => c.id) }),
      })
      if (res.ok) {
        setOrdenGuardado(true)
        setTimeout(() => setOrdenGuardado(false), 1500)
      }
    } catch {}
  }

  const moverCliente = (index, direccion) => {
    const newIdx = index + direccion
    if (newIdx < 0 || newIdx >= ruta.clientes.length) return
    const clientes = [...ruta.clientes]
    const [moved] = clientes.splice(index, 1)
    clientes.splice(newIdx, 0, moved)
    setRuta({ ...ruta, clientes })
    guardarOrden(clientes)
  }

  const handleDragStart = (index) => setDragIndex(index)
  const handleDragOver = (e, index) => { e.preventDefault(); setDragOverIdx(index) }
  const handleDrop = (index) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIdx(null); return }
    const clientes = [...ruta.clientes]
    const [moved] = clientes.splice(dragIndex, 1)
    clientes.splice(index, 0, moved)
    setRuta({ ...ruta, clientes })
    guardarOrden(clientes)
    setDragIndex(null)
    setDragOverIdx(null)
  }
  const handleDragEnd = () => { setDragIndex(null); setDragOverIdx(null) }

  // ─── Optimizar ruta ────────────────────────────────────
  const optimizarRuta = async () => {
    setOptimizando(true)
    setOptimResult(null)
    try {
      const res = await fetch(`/api/rutas/${id}/optimizar`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Error al optimizar'); return }
      setOptimResult(data)
      fetchRuta()
      setTimeout(() => setOptimResult(null), 6000)
    } catch {
      alert('Error de conexión')
    } finally {
      setOptimizando(false)
    }
  }

  // ─── Abrir ruta en Google Maps ─────────────────────────
  const abrirGoogleMaps = () => {
    const conCoords = ruta?.clientes?.filter((c) => c.latitud != null && c.longitud != null) ?? []
    if (conCoords.length < 2) { alert('Se necesitan al menos 2 clientes con ubicación'); return }
    const waypoints = conCoords.map((c) => `${c.latitud},${c.longitud}`).join('/')
    window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank')
  }

  const clientesConCoords = ruta?.clientes?.filter((c) => c.latitud != null && c.longitud != null).length ?? 0

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  )

  if (error || !ruta) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
        <p className="font-semibold">Ruta no encontrada</p>
        <button onClick={() => router.back()} className="text-sm underline mt-2">Volver</button>
      </div>
    </div>
  )

  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Rutas
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {editandoNombre ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                  className="flex-1 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] focus:outline-none focus:border-[#f5c518]"
                  autoFocus
                />
                <button onClick={guardarNombre} className="text-[#22c55e] hover:text-[#16a34a] p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button onClick={() => setEditandoNombre(false)} className="text-[#888888] hover:text-[white] p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[white]">{ruta.nombre}</h1>
                {esOwner && (
                  <button
                    onClick={() => { setNuevoNombre(ruta.nombre); setEditandoNombre(true) }}
                    className="text-[#555] hover:text-[#f5c518] transition-colors p-1"
                    title="Editar nombre"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          {esOwner && !editandoNombre && (
            <button
              onClick={eliminarRuta}
              disabled={eliminando}
              className="text-[#555] hover:text-[#ef4444] transition-colors p-1 disabled:opacity-50"
              title="Eliminar ruta"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Selector de cobrador (solo owner) */}
        {esOwner && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-[#888888]">Cobrador asignado</p>
            <select
              value={ruta.cobrador?.id ?? ''}
              onChange={(e) => cambiarCobrador(e.target.value)}
              className="w-full h-9 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] px-3 focus:outline-none focus:border-[#f5c518] transition-all cursor-pointer"
            >
              <option value="">Sin cobrador asignado</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
        {!esOwner && ruta.cobrador && (
          <p className="text-sm text-[#888888]">Cobrador: <span className="text-[white] font-medium">{ruta.cobrador.nombre}</span></p>
        )}
      </Card>

      {/* Métricas del día */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Esperado hoy',      value: formatCOP(ruta.esperadoHoy),   color: 'white' },
          { label: 'Recaudado hoy',     value: formatCOP(ruta.recaudadoHoy),  color: '#22c55e' },
          { label: 'Pendientes de pago', value: `${ruta.pendientesHoy} cliente${ruta.pendientesHoy !== 1 ? 's' : ''}`, color: ruta.pendientesHoy > 0 ? '#f59e0b' : '#22c55e' },
          { label: 'En mora',           value: `${ruta.enMora} cliente${ruta.enMora !== 1 ? 's' : ''}`, color: ruta.enMora > 0 ? '#ef4444' : '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
            <p className="text-[10px] text-[#888888]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progreso del día */}
      <Card padding={false}>
        <div className="px-4 py-3">
          <div className="flex justify-between text-xs text-[#888888] mb-1.5">
            <span>Progreso del día</span>
            <span>{progreso}%</span>
          </div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progreso}%`,
                background: progreso >= 100 ? '#22c55e' : 'linear-gradient(90deg, #f5c518, #f0b800)',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Clientes de la ruta */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
              Clientes ({ruta.clientes?.length ?? 0})
            </p>
            {ordenGuardado && (
              <span className="text-[10px] text-[#22c55e] animate-pulse">Orden guardado</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(ruta.clientes?.length ?? 0) >= 2 && clientesConCoords >= 2 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={optimizarRuta}
                loading={optimizando}
              >
                🗺️ Optimizar
              </Button>
            )}
            {esOwner && (
              <Button size="sm" variant="secondary" onClick={abrirModalClientes}>
                + Agregar clientes
              </Button>
            )}
          </div>
        </div>

        {/* Resultado de optimización */}
        {optimResult && (
          <div className="mb-3 px-3 py-2.5 rounded-[12px] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)]">
            <p className="text-xs text-[#22c55e] font-semibold">✅ Ruta optimizada</p>
            <p className="text-[11px] text-[#22c55e]/80 mt-0.5">
              {optimResult.ahorro > 0 ? `${optimResult.ahorro}% más corta` : 'Orden aplicado'}
              {optimResult.clientesSinUbicacion > 0 && ` • ${optimResult.clientesSinUbicacion} sin ubicación`}
            </p>
          </div>
        )}

        {/* Botón Google Maps + toggle mapa */}
        {clientesConCoords >= 2 && (
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={abrirGoogleMaps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[rgba(66,133,244,0.1)] border border-[rgba(66,133,244,0.2)] text-[#4285f4] text-xs font-medium hover:bg-[rgba(66,133,244,0.15)] transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              Iniciar ruta en Google Maps
            </button>
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] text-xs font-medium hover:text-white hover:border-[#3a3a3a] transition-all active:scale-95"
            >
              {showMap ? 'Ocultar mapa' : '🗺️ Ver mapa'}
            </button>
          </div>
        )}

        {/* Mini-mapa de la ruta */}
        {showMap && ruta.clientes && (
          <div className="mb-4">
            <RouteMap clientes={ruta.clientes} />
          </div>
        )}

        {(!ruta.clientes || ruta.clientes.length === 0) ? (
          <p className="text-sm text-[#888888] text-center py-4">Sin clientes asignados</p>
        ) : (
          <div className="space-y-0">
            {ruta.clientes.map((c, idx) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={[
                  'flex items-center gap-2 py-2.5 px-1 border-b border-[#2a2a2a] last:border-0 transition-all',
                  dragIndex === idx ? 'opacity-40' : '',
                  dragOverIdx === idx && dragIndex !== idx ? 'border-t-2 border-t-[#f5c518]' : '',
                ].join(' ')}
                style={{ cursor: 'grab' }}
              >
                {/* Botones mover (móvil-friendly) */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moverCliente(idx, -1)}
                    disabled={idx === 0}
                    className="text-[#555] hover:text-[#f5c518] disabled:opacity-20 transition-colors p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moverCliente(idx, 1)}
                    disabled={idx === ruta.clientes.length - 1}
                    className="text-[#555] hover:text-[#f5c518] disabled:opacity-20 transition-colors p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="w-7 h-7 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center shrink-0">
                  <span className="text-[#f5c518] text-[10px] font-bold">{c.nombre?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0" onClick={() => router.push(`/clientes/${c.id}`)}>
                  <p className="text-sm font-medium text-[white] truncate">{c.nombre}</p>
                  <p className="text-[10px] text-[#888888]">
                    {c.diasMora > 0 ? `${c.diasMora} días en mora` : c.pagoHoy ? 'Pagó hoy' : 'Pendiente'}
                    {c.latitud != null && ' • 📍'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.pagoHoy && <span className="w-2 h-2 rounded-full bg-[#22c55e]" />}
                  {c.diasMora > 0 && <Badge variant="red">{c.diasMora}d</Badge>}
                  {esOwner && (
                    <button
                      onClick={() => quitarCliente(c.id)}
                      disabled={quitando === c.id}
                      className="text-[#888888] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                      title="Quitar de la ruta"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cierre de caja */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Cierre de caja del día
        </p>
        {ruta.cierre ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Esperado</span>
              <span className="text-[white] font-medium">{formatCOP(ruta.cierre.totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Entregado</span>
              <span className="text-[white] font-medium">{formatCOP(ruta.cierre.totalRecogido)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
              <span className="text-[#888888]">Diferencia</span>
              <span style={{ color: ruta.cierre.diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatCOP(ruta.cierre.diferencia)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-[#888888] mb-3">No se ha registrado el cierre de hoy</p>
            <Button onClick={() => { setTotalRecogido(''); setModalCaja(true) }}>
              Registrar cierre de caja
            </Button>
          </div>
        )}
      </Card>

      {/* Modal: agregar clientes */}
      <Modal
        open={modalClientes}
        onClose={() => setModalClientes(false)}
        title="Agregar clientes a la ruta"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalClientes(false)}>Cancelar</Button>
            <Button onClick={asignarClientes} loading={asignando} disabled={!seleccionados.length}>
              Agregar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
            </Button>
          </>
        }
      >
        {clientesSinRuta.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">Todos los clientes ya tienen ruta asignada</p>
        ) : (
          <div className="space-y-2">
            {clientesSinRuta.map((c) => (
              <label
                key={c.id}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-[12px] cursor-pointer transition-colors',
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,197,24,0.1)]' : 'hover:bg-[#222222]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[#f5c518]"
                />
                <div>
                  <p className="text-sm font-medium text-[white]">{c.nombre}</p>
                  <p className="text-xs text-[#888888]">CC {c.cedula}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal: cierre de caja */}
      <Modal
        open={modalCaja}
        onClose={() => setModalCaja(false)}
        title="Registrar cierre de caja"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalCaja(false)}>Cancelar</Button>
            <Button onClick={registrarCierre} loading={guardandoCaja}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {errorCaja && (
            <div className="text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCaja}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Total esperado hoy</span>
            <span className="font-semibold text-[white]">{formatCOP(ruta.esperadoHoy)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#888888]">Dinero recogido (COP)</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ej: 250000"
              value={totalRecogido}
              onChange={(e) => setTotalRecogido(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
              autoFocus
            />
          </div>
          {totalRecogido && (
            <div className="text-sm">
              <span className="text-[#888888]">Diferencia: </span>
              <span style={{ color: Number(totalRecogido) >= ruta.esperadoHoy ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {Number(totalRecogido) >= ruta.esperadoHoy ? '+' : ''}{formatCOP(Number(totalRecogido) - ruta.esperadoHoy)}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
