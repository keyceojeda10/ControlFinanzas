'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                 from 'next/navigation'
import dynamic                       from 'next/dynamic'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerRutaOffline, guardarOrdenPendiente } from '@/lib/offline'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { Modal }                     from '@/components/ui/Modal'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import { formatCOP }                 from '@/lib/calculos'
import DiasSinCobroSelector          from '@/components/ui/DiasSinCobroSelector'

// Cargar mapa dinámicamente (evitar SSR con Leaflet)
const RouteMap = dynamic(() => import('@/components/rutas/RouteMap'), { ssr: false })

function HistorialCobros({ rutaId }) {
  const [open, setOpen] = useState(false)
  const [dias, setDias] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [tab, setTab] = useState('pagaron') // 'pagaron' | 'noPagaron'

  const cargar = async () => {
    if (dias) { setOpen(!open); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/rutas/${rutaId}/historial`)
      if (res.ok) {
        const data = await res.json()
        setDias(data.dias)
      }
    } catch {} finally { setLoading(false) }
  }

  const formatFecha = (str) => {
    const d = new Date(str + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <Card>
      <button onClick={cargar} className="w-full flex items-center justify-between">
        <span className="text-xs font-semibold text-[#888] uppercase tracking-wide">Historial de cobros</span>
        <svg className={`w-4 h-4 text-[#888] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 rounded-lg bg-[rgba(255,255,255,0.03)] animate-pulse" />
              ))}
            </div>
          ) : !dias?.length ? (
            <p className="text-sm text-[#888] text-center py-4">No hay historial aún</p>
          ) : (
            <div className="space-y-1.5">
              {dias.map((dia) => {
                const isOpen = expandido === dia.fecha
                const cantPagaron = dia.pagaron.length
                const cantNoPagaron = dia.noPagaron.length
                return (
                  <div key={dia.fecha} className="rounded-xl border border-[rgba(255,255,255,0.05)] overflow-hidden">
                    {/* Fila principal del día */}
                    <button
                      onClick={() => { setExpandido(isOpen ? null : dia.fecha); setTab('pagaron') }}
                      className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[13px] text-white font-medium capitalize">{formatFecha(dia.fecha)}</p>
                        <p className="text-[10px] text-[#666] mt-0.5">
                          <span className="text-[#22c55e]">{cantPagaron} pagaron</span>
                          {cantNoPagaron > 0 && <span className="text-[#ef4444]"> · {cantNoPagaron} sin pagar</span>}
                        </p>
                      </div>
                      <p className="text-[14px] font-bold font-mono-display text-[#22c55e] shrink-0">
                        {formatCOP(dia.cobrado)}
                      </p>
                      <svg className={`w-4 h-4 text-[#777] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Detalle expandido */}
                    {isOpen && (
                      <div className="border-t border-[rgba(255,255,255,0.05)]">
                        {/* Tabs */}
                        <div className="flex border-b border-[rgba(255,255,255,0.05)]">
                          <button
                            onClick={() => setTab('pagaron')}
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'pagaron' ? 'text-[#22c55e] border-b-2 border-[#22c55e]' : 'text-[#888]'}`}
                          >
                            Pagaron ({cantPagaron})
                          </button>
                          <button
                            onClick={() => setTab('noPagaron')}
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'noPagaron' ? 'text-[#ef4444] border-b-2 border-[#ef4444]' : 'text-[#888]'}`}
                          >
                            No pagaron ({cantNoPagaron})
                          </button>
                        </div>

                        {/* Contenido tab */}
                        <div className="px-3 py-2 max-h-[200px] overflow-y-auto">
                          {tab === 'pagaron' ? (
                            cantPagaron === 0 ? (
                              <p className="text-[11px] text-[#888] text-center py-2">Nadie pagó este día</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.pagaron.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                                      <span className="text-[12px] text-[#ccc] truncate">{c.nombre}</span>
                                    </div>
                                    <span className="text-[12px] font-bold font-mono-display text-white shrink-0 ml-2">{formatCOP(c.monto)}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            cantNoPagaron === 0 ? (
                              <p className="text-[11px] text-[#22c55e] text-center py-2">Todos pagaron</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.noPagaron.map((nombre, i) => (
                                  <div key={i} className="flex items-center gap-2 py-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                                    <span className="text-[12px] text-[#999]">{nombre}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default function RutaDetallePage({ params }) {
  const { id }    = use(params)
  const router    = useRouter()
  const { esOwner } = useAuth()
  const { lastSyncedAt } = useOffline()

  const [ruta,          setRuta]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [cobradores,    setCobradores]    = useState([])
  const [modalClientes, setModalClientes] = useState(false)
  const [clientesSinRuta, setClientesSinRuta] = useState([])
  const [clientesEnOtraRuta, setClientesEnOtraRuta] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [buscarCliente, setBuscarCliente] = useState('')
  const [errorAsignar, setErrorAsignar] = useState('')
  const [asignando,     setAsignando]     = useState(false)
  const [quitando,      setQuitando]      = useState(null)
  const [modalCaja,     setModalCaja]     = useState(false)
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardandoCaja, setGuardandoCaja] = useState(false)
  const [errorCaja,     setErrorCaja]     = useState('')
  const [dragIndex,     setDragIndex]     = useState(null)
  const [dragOverIdx,   setDragOverIdx]   = useState(null)
  const [ordenGuardado, setOrdenGuardado] = useState(false)
  const [guardandoOrden, setGuardandoOrden] = useState(false)
  const [ordenOffline,   setOrdenOffline]   = useState(false)
  const [ordenError,     setOrdenError]     = useState(null)
  const saveTimerRef     = useRef(null)
  const abortRef         = useRef(null)
  const pendingOrderRef  = useRef(null)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevoNombre,    setNuevoNombre]    = useState('')
  const [eliminando,     setEliminando]     = useState(false)
  const [optimizando,    setOptimizando]    = useState(false)
  const [optimResult,    setOptimResult]    = useState(null)
  const [showMap,        setShowMap]        = useState(false)
  const [highlightId,    setHighlightId]    = useState(null)
  const [banner,         setBanner]         = useState(null)
  const [pagandoRapido,  setPagandoRapido]  = useState(null) // clienteId while paying
  const [pagoRapidoOk,   setPagoRapidoOk]   = useState(null) // clienteId after success
  const [modalPagoRapido, setModalPagoRapido] = useState(null) // { id, nombre, cuota, prestamoActivo }
  const [undoPago,       setUndoPago]       = useState(null)  // { pagoId, prestamoId, clienteNombre, timer }
  const undoTimerRef = useRef(null)
  const [modalDiasSC,    setModalDiasSC]    = useState(false)
  const [diasSCRuta,     setDiasSCRuta]     = useState([])
  const [guardandoDSC,   setGuardandoDSC]   = useState(false)
  const [grupoFiltro,    setGrupoFiltro]    = useState(null)

  // Helper: fecha Colombia como string YYYY-MM-DD
  const getColombiaDateStr = () => {
    const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }

  const fetchRuta = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setError('')

    // Offline: always prefer IndexedDB (has locally-updated order)
    if (!navigator.onLine) {
      try {
        const cached = await obtenerRutaOffline(id)
        if (cached) { setRuta(cached); setLoading(false); return }
      } catch {}
    }
    try {
      const res  = await fetch(`/api/rutas/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      // If SW returned stale cache (offline flag), prefer IndexedDB
      if (data.offline) throw new Error('offline')
      setRuta(data)
    } catch {
      try {
        const cached = await obtenerRutaOffline(id)
        if (cached) { setRuta(cached); setLoading(false); return }
      } catch {}
      if (!soft) setError('No se pudo cargar la ruta.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRuta()
    if (esOwner) {
      fetch('/api/cobradores').then((r) => r.json()).then(setCobradores).catch(() => {})
    }
  }, [fetchRuta, esOwner])

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetchRuta({ soft: true })
    }
  }, [lastSyncedAt, fetchRuta])

  // Feature 2: Auto-scroll al siguiente cliente al volver
  useEffect(() => {
    if (!ruta?.clientes?.length) return
    const scrollTo = sessionStorage.getItem(`ruta-scroll-${id}`)
    if (!scrollTo) return
    sessionStorage.removeItem(`ruta-scroll-${id}`)
    requestAnimationFrame(() => {
      const el = document.getElementById(`cliente-${scrollTo}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightId(scrollTo)
        setTimeout(() => setHighlightId(null), 2000)
      }
    })
  }, [ruta, id])

  // Feature 3: Banner "Continuar ruta" / "Nueva ruta"
  useEffect(() => {
    if (!ruta?.clientes?.length) return
    // No mostrar banner si acabamos de volver de un cliente (scroll restoration)
    if (sessionStorage.getItem(`ruta-scroll-${id}`)) return

    const saved = localStorage.getItem(`cf-ruta-progress-${id}`)
    if (!saved) return

    try {
      const { clienteId, clienteNombre, date } = JSON.parse(saved)
      const today = getColombiaDateStr()
      const savedDate = new Date(date + 'T12:00:00')
      const todayDate = new Date(today + 'T12:00:00')
      const diffDays = Math.round((todayDate - savedDate) / 86400000)

      // Verificar que el cliente siga en la ruta
      if (!ruta.clientes.some(c => c.id === clienteId)) {
        localStorage.removeItem(`cf-ruta-progress-${id}`)
        return
      }

      if (diffDays === 0) {
        setBanner({ type: 'today', clienteId, clienteNombre, label: 'Dejaste la ruta en' })
      } else if (diffDays === 1) {
        setBanner({ type: 'yesterday', clienteId, clienteNombre, label: 'Ayer llegaste hasta' })
      } else if (diffDays <= 7) {
        setBanner({ type: 'days', clienteId, clienteNombre, label: `Hace ${diffDays} días llegaste hasta` })
      } else {
        localStorage.removeItem(`cf-ruta-progress-${id}`)
      }
    } catch {
      localStorage.removeItem(`cf-ruta-progress-${id}`)
    }
  }, [ruta, id])

  const cambiarCobrador = async (cobradorId) => {
    await fetch(`/api/rutas/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cobradorId: cobradorId || null }),
    })
    fetchRuta()
  }

  // Pago rápido: abre modal para elegir método, luego registra 1 cuota
  const abrirPagoRapido = (cliente) => {
    if (!cliente.cuota || cliente.cuota <= 0 || pagandoRapido) return
    const prestamoId = ruta.clientes.find(c => c.id === cliente.id)?.prestamoActivo
    if (!prestamoId) return
    setModalPagoRapido({ id: cliente.id, nombre: cliente.nombre, cuota: cliente.cuota, prestamoActivo: prestamoId })
  }

  const ejecutarPagoRapido = async (metodoPago) => {
    if (!modalPagoRapido) return
    const { id: clienteId, nombre, cuota, prestamoActivo } = modalPagoRapido
    setModalPagoRapido(null)
    setPagandoRapido(clienteId)
    try {
      const res = await fetch(`/api/prestamos/${prestamoActivo}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: cuota, tipo: 'completo', diasAbonados: 1, metodoPago }),
      })
      if (res.ok) {
        const data = await res.json()
        // El pago más reciente es pagos[0] (ordenados desc)
        const pagoId = data.pagos?.[0]?.id
        setPagoRapidoOk(clienteId)
        setTimeout(() => setPagoRapidoOk(null), 1200)
        fetchRuta()
        // Mostrar undo por 10 segundos
        if (pagoId) {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
          setUndoPago({ pagoId, prestamoId: prestamoActivo, clienteNombre: nombre })
          undoTimerRef.current = setTimeout(() => setUndoPago(null), 10000)
        }
      }
    } catch {} finally { setPagandoRapido(null) }
  }

  const deshacerPago = async () => {
    if (!undoPago) return
    const { pagoId } = undoPago
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoPago(null)
    try {
      await fetch(`/api/pagos/${pagoId}`, { method: 'DELETE' })
      fetchRuta()
    } catch {}
  }

  const abrirModalDSC = () => {
    try { setDiasSCRuta(JSON.parse(ruta?.diasSinCobro || '[]')) } catch { setDiasSCRuta([]) }
    setModalDiasSC(true)
  }
  const guardarDiasSCRuta = async () => {
    setGuardandoDSC(true)
    try {
      await fetch(`/api/rutas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diasSinCobro: diasSCRuta }),
      })
      setModalDiasSC(false)
      fetchRuta()
    } catch {} finally { setGuardandoDSC(false) }
  }

  const abrirModalClientes = async () => {
    const res  = await fetch('/api/clientes')
    const data = await res.json()
    const lista = Array.isArray(data) ? data : data.clientes ?? []
    setClientesSinRuta(lista.filter((c) => !c.rutaId))
    setClientesEnOtraRuta(lista.filter((c) => c.rutaId && c.rutaId !== id))
    setSeleccionados([])
    setErrorAsignar('')
    setModalClientes(true)
  }

  const toggleSeleccion = (cid) =>
    setSeleccionados((prev) => prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid])

  const asignarClientes = async () => {
    if (!seleccionados.length) return
    setErrorAsignar('')
    // Verificar si hay seleccionados de otra ruta
    const deOtraRuta = seleccionados.filter((cid) => clientesEnOtraRuta.some((c) => c.id === cid))
    if (deOtraRuta.length > 0) {
      const nombres = clientesEnOtraRuta.filter((c) => deOtraRuta.includes(c.id)).map((c) => `${c.nombre} (${c.rutaNombre})`).join(', ')
      if (!confirm(`Los siguientes clientes seran MOVIDOS desde su ruta actual:\n\n${nombres}\n\n¿Continuar?`)) return
    }
    setAsignando(true)
    try {
      const res = await fetch(`/api/rutas/${id}/clientes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clienteIds: seleccionados, forzar: deOtraRuta.length > 0 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorAsignar(data.error ?? 'Error al asignar clientes')
        return
      }
      setModalClientes(false)
      fetchRuta()
    } catch {
      setErrorAsignar('Error de conexión')
    } finally {
      setAsignando(false)
    }
  }

  const [confirmQuitar, setConfirmQuitar] = useState(null) // { id, nombre }

  const quitarCliente = async (clienteId) => {
    setConfirmQuitar(null)
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
      // Limpiar progreso de ruta — ya se finalizó el día
      localStorage.removeItem(`cf-ruta-progress-${id}`)
      setBanner(null)
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

  // Debounced save — collapses rapid drag/click operations into one API call
  const guardarOrden = useCallback((nuevosClientes) => {
    pendingOrderRef.current = nuevosClientes.map((c) => c.id)
    setOrdenError(null)

    // Cancel previous timer and in-flight request
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    abortRef.current?.abort()

    saveTimerRef.current = setTimeout(async () => {
      const clienteIds = pendingOrderRef.current
      if (!clienteIds) return

      // Offline: queue in IndexedDB
      if (!navigator.onLine) {
        try {
          await guardarOrdenPendiente(id, clienteIds)
          setOrdenOffline(true)
          setTimeout(() => setOrdenOffline(false), 2000)
        } catch { setOrdenError('No se pudo guardar offline') }
        return
      }

      // Online: send to server with abort support
      const controller = new AbortController()
      abortRef.current = controller
      setGuardandoOrden(true)
      try {
        const res = await fetch(`/api/rutas/${id}/reordenar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clienteIds }),
          signal: controller.signal,
        })
        if (res.ok) {
          setOrdenGuardado(true)
          setTimeout(() => setOrdenGuardado(false), 1500)
        } else {
          setOrdenError('Error al guardar orden')
        }
      } catch (err) {
        if (err.name === 'AbortError') return // Superseded by newer save
        // Network failed — queue offline
        try {
          await guardarOrdenPendiente(id, clienteIds)
          setOrdenOffline(true)
          setTimeout(() => setOrdenOffline(false), 2000)
        } catch { setOrdenError('Error de conexión') }
      } finally {
        setGuardandoOrden(false)
      }
    }, 800)
  }, [id])

  // Cleanup timer and abort on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      abortRef.current?.abort()
    }
  }, [])

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

  // ─── Touch drag-and-drop for mobile ───
  const touchStartRef = useRef(null)
  const touchNodeRef = useRef(null)
  const touchCloneRef = useRef(null)
  const touchIndexRef = useRef(null)
  const touchOverRef = useRef(null)
  const listRef = useRef(null)

  const handleTouchStart = (e, index) => {
    // Only start drag from the grip handle
    const grip = e.target.closest('[data-grip]')
    if (!grip) return
    const touch = e.touches[0]
    touchStartRef.current = { y: touch.clientY, started: false }
    touchIndexRef.current = index
    touchNodeRef.current = e.currentTarget
  }

  const handleTouchMove = (e) => {
    if (touchIndexRef.current === null || !touchStartRef.current) return
    const touch = e.touches[0]
    const dy = Math.abs(touch.clientY - touchStartRef.current.y)

    // Start drag after 8px movement
    if (!touchStartRef.current.started && dy < 8) return
    e.preventDefault()

    if (!touchStartRef.current.started) {
      touchStartRef.current.started = true
      setDragIndex(touchIndexRef.current)
      // Create floating clone
      const node = touchNodeRef.current
      if (node) {
        const rect = node.getBoundingClientRect()
        const clone = node.cloneNode(true)
        clone.style.position = 'fixed'
        clone.style.left = `${rect.left}px`
        clone.style.width = `${rect.width}px`
        clone.style.top = `${rect.top}px`
        clone.style.zIndex = '9999'
        clone.style.opacity = '0.9'
        clone.style.transform = 'scale(1.02)'
        clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'
        clone.style.borderRadius = '14px'
        clone.style.background = '#1a1a1a'
        clone.style.border = '1px solid #f5c518'
        clone.style.pointerEvents = 'none'
        clone.style.transition = 'none'
        document.body.appendChild(clone)
        touchCloneRef.current = clone
        touchStartRef.current.offsetY = touch.clientY - rect.top
      }
    }

    // Move clone
    if (touchCloneRef.current && touchStartRef.current.offsetY != null) {
      touchCloneRef.current.style.top = `${touch.clientY - touchStartRef.current.offsetY}px`
    }

    // Find which item we're over
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-idx]')
      for (const item of items) {
        const rect = item.getBoundingClientRect()
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const overIdx = parseInt(item.dataset.idx)
          if (overIdx !== touchOverRef.current) {
            touchOverRef.current = overIdx
            setDragOverIdx(overIdx)
          }
          break
        }
      }
    }
  }

  const handleTouchEnd = () => {
    if (touchCloneRef.current) {
      document.body.removeChild(touchCloneRef.current)
      touchCloneRef.current = null
    }
    if (touchIndexRef.current !== null && touchOverRef.current !== null && touchIndexRef.current !== touchOverRef.current) {
      const clientes = [...ruta.clientes]
      const [moved] = clientes.splice(touchIndexRef.current, 1)
      clientes.splice(touchOverRef.current, 0, moved)
      setRuta({ ...ruta, clientes })
      guardarOrden(clientes)
    }
    touchStartRef.current = null
    touchIndexRef.current = null
    touchNodeRef.current = null
    touchOverRef.current = null
    setDragIndex(null)
    setDragOverIdx(null)
  }

  // ─── Optimizar ruta ────────────────────────────────────
  const [confirmOptimizar, setConfirmOptimizar] = useState(false)

  const optimizarRuta = async () => {
    setConfirmOptimizar(false)
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

  const clientesFiltrados = grupoFiltro
    ? (ruta?.clientes ?? []).filter(c => c.grupoCobro?.id === grupoFiltro)
    : (ruta?.clientes ?? [])

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
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {editandoNombre ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                  className="flex-1 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] text-sm text-[white] focus:outline-none focus:border-[#f5c518]"
                  autoFocus
                />
                <button onClick={guardarNombre} className="text-[#22c55e] p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                <button onClick={() => setEditandoNombre(false)} className="text-[#888] p-1"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[white]">{ruta.nombre}</h1>
                  {esOwner && (
                    <button onClick={() => { setNuevoNombre(ruta.nombre); setEditandoNombre(true) }} className="text-[#666] hover:text-[#f5c518] transition-colors p-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#888] mt-0.5">
                  {ruta.cobrador && <span className="text-[#a855f7]">{ruta.cobrador.nombre}</span>}
                  {ruta.cobrador && ' · '}
                  {ruta.clientes?.length ?? 0} clientes
                </p>
              </>
            )}
          </div>
          {esOwner && !editandoNombre && (
            <button onClick={eliminarRuta} disabled={eliminando} className="text-[#666] hover:text-[#ef4444] transition-colors p-2 disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
        {esOwner && (<>
          <select
            value={ruta.cobrador?.id ?? ''}
            onChange={(e) => cambiarCobrador(e.target.value)}
            className="w-full h-9 rounded-[10px] border border-[#2a2a2a] bg-[#0a0a0a] text-xs text-[white] px-3 mt-3 focus:outline-none focus:border-[#f5c518] transition-all cursor-pointer"
          >
            <option value="">Sin cobrador asignado</option>
            {cobradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <button
            onClick={abrirModalDSC}
            className="w-full flex items-center justify-between h-9 rounded-[10px] border border-[#2a2a2a] bg-[#0a0a0a] text-xs text-[#888888] px-3 mt-2 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Días sin cobro
            </span>
            {ruta.diasSinCobro && JSON.parse(ruta.diasSinCobro).length > 0 && (
              <span className="text-[10px] font-medium text-[#f59e0b]">
                {JSON.parse(ruta.diasSinCobro).length} {JSON.parse(ruta.diasSinCobro).length === 1 ? 'día' : 'días'}
              </span>
            )}
          </button>
        </>)}
      </Card>

      {/* Modal días sin cobro de ruta */}
      <Modal open={modalDiasSC} onClose={() => setModalDiasSC(false)} title="Días sin cobro de la ruta" footer={
        <>
          <Button variant="secondary" onClick={() => setModalDiasSC(false)}>Cancelar</Button>
          <Button onClick={guardarDiasSCRuta} loading={guardandoDSC}>Guardar</Button>
        </>
      }>
        <div className="space-y-3">
          <p className="text-xs text-[#888888] leading-snug">
            Los clientes de esta ruta no serán cobrados estos días y no se les generará mora.
          </p>
          <DiasSinCobroSelector value={diasSCRuta} onChange={setDiasSCRuta} />
          {diasSCRuta.length > 0 && (
            <p className="text-[10px] text-[#f59e0b]">
              Aplica a todos los clientes de esta ruta (salvo los que tengan configuración propia).
            </p>
          )}
        </div>
      </Modal>

      {/* Métricas */}
      {(() => {
        const cobrado = ruta.capitalTotal - ruta.carteraTotal
        const carteraPct = ruta.capitalTotal > 0
          ? Math.min(100, Math.round((cobrado / ruta.capitalTotal) * 100))
          : 0
        return (
          <>
            {/* Cobro del día */}
            <Card padding={false}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-[#666] uppercase tracking-wide">Cobro del día</span>
                  <span className="text-[11px] font-bold" style={{ color: progreso >= 100 ? '#22c55e' : '#f5c518' }}>{progreso}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-[#22c55e] font-mono-display">{formatCOP(ruta.recaudadoHoy)}</p>
                  <p className="text-[11px] text-[#777] font-mono-display">de {formatCOP(ruta.esperadoHoy)}</p>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mt-2.5">
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${progreso}%`,
                    background: progreso >= 100 ? '#22c55e' : '#f5c518',
                  }} />
                </div>
              </div>
            </Card>

            {/* Cartera de la ruta */}
            <Card padding={false}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-[#666] uppercase tracking-wide">Cartera</span>
                  <span className="text-[11px] font-bold text-[#06b6d4]">{carteraPct}% cobrado</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <p className="text-lg font-bold text-[white] font-mono-display">{formatCOP(ruta.carteraTotal)}</p>
                  <p className="text-[11px] text-[#777] font-mono-display">de {formatCOP(ruta.capitalTotal)}</p>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden mt-2.5">
                  <div className="h-full rounded-full bg-[#06b6d4] transition-all duration-700" style={{ width: `${carteraPct}%` }} />
                </div>
              </div>
            </Card>

            {/* Pendientes + Mora */}
            <div className="grid grid-cols-2 gap-3">
              <Card padding={false}>
                <div className="px-4 py-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide mb-1">Pendientes hoy</p>
                  <p className="text-xl font-bold" style={{ color: ruta.pendientesHoy > 0 ? '#f59e0b' : '#22c55e' }}>{ruta.pendientesHoy}</p>
                </div>
              </Card>
              <Card padding={false}>
                <div className="px-4 py-3">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide mb-1">En mora</p>
                  <p className="text-xl font-bold" style={{ color: ruta.enMora > 0 ? '#ef4444' : '#22c55e' }}>{ruta.enMora}</p>
                </div>
              </Card>
            </div>
          </>
        )
      })()}

      {/* Banner: Continuar ruta */}
      {banner && (
        <div className="bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)] rounded-[16px] px-4 py-3">
          <p className="text-sm text-[white]">
            {banner.label} <strong className="text-[#f5c518]">{banner.clienteNombre}</strong>
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setBanner(null)
                // Buscar el siguiente cliente después del guardado
                const idx = ruta.clientes.findIndex(c => c.id === banner.clienteId)
                const nextIdx = idx >= 0 ? Math.min(idx + 1, ruta.clientes.length - 1) : 0
                const targetId = ruta.clientes[nextIdx].id
                requestAnimationFrame(() => {
                  const el = document.getElementById(`cliente-${targetId}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    setHighlightId(targetId)
                    setTimeout(() => setHighlightId(null), 2000)
                  }
                })
              }}
              className="px-3 py-1.5 rounded-[10px] bg-[#f5c518] text-[#0a0a0a] text-xs font-semibold active:scale-95 transition-transform"
            >
              Continuar ruta
            </button>
            <button
              onClick={() => {
                setBanner(null)
                localStorage.removeItem(`cf-ruta-progress-${id}`)
              }}
              className="px-3 py-1.5 rounded-[10px] bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] text-xs font-medium active:scale-95 transition-transform"
            >
              Nueva ruta
            </button>
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {esOwner && (
          <button onClick={abrirModalClientes} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[#111] text-[11px] text-[#aaa] font-medium active:scale-95 transition-transform">
            + Agregar
          </button>
        )}
        {(ruta.clientes?.length ?? 0) >= 2 && clientesConCoords >= 2 && (
          <button onClick={() => setConfirmOptimizar(true)} disabled={optimizando} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[#111] text-[11px] text-[#aaa] font-medium active:scale-95 transition-transform disabled:opacity-50">
            {optimizando ? 'Optimizando...' : 'Optimizar'}
          </button>
        )}
        {clientesConCoords >= 2 && (
          <>
            <button onClick={abrirGoogleMaps} className="shrink-0 h-8 px-3 rounded-[10px] border border-[rgba(66,133,244,0.2)] bg-[rgba(66,133,244,0.06)] text-[11px] text-[#4285f4] font-medium active:scale-95 transition-transform">
              Google Maps
            </button>
            <button onClick={() => setShowMap((v) => !v)} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[#111] text-[11px] text-[#666] font-medium active:scale-95 transition-transform">
              {showMap ? 'Ocultar mapa' : 'Ver mapa'}
            </button>
          </>
        )}
      </div>

      {/* Resultado de optimización */}
      {optimResult && (
        <div className="px-3 py-2 rounded-[12px] bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.12)]">
          <p className="text-xs text-[#22c55e] font-medium">
            Ruta optimizada {optimResult.ahorro > 0 && `· ${optimResult.ahorro}% mas corta`}
          </p>
        </div>
      )}

      {/* Mini-mapa */}
      {showMap && ruta.clientes && (
        <div className="rounded-[14px] overflow-hidden border border-[#222]">
          <RouteMap clientes={ruta.clientes} />
        </div>
      )}

      {/* Lista de clientes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[#888] uppercase tracking-wide">
            Clientes ({clientesFiltrados.length}{grupoFiltro ? ` de ${ruta.clientes?.length ?? 0}` : ''})
          </span>
          <span className="text-[10px] text-[#777]">
            {guardandoOrden && <span className="text-[#888] flex items-center gap-1 inline-flex"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando</span>}
            {ordenGuardado && <span className="text-[#22c55e]">Guardado</span>}
            {ordenOffline && <span className="text-[#f5c518]">Guardado offline</span>}
            {ordenError && <span className="text-[#ef4444]">{ordenError}</span>}
          </span>
        </div>

        {/* Chips de filtro por grupo */}
        {ruta.gruposCobro?.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-2">
            <button
              onClick={() => setGrupoFiltro(null)}
              className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-all ${!grupoFiltro ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]'}`}
            >
              Todos
            </button>
            {ruta.gruposCobro.map(g => (
              <button
                key={g.id}
                onClick={() => setGrupoFiltro(grupoFiltro === g.id ? null : g.id)}
                className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${grupoFiltro === g.id ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888] border border-[#2a2a2a]'}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color || '#666' }} />
                {g.nombre}
                <span className="text-[9px] opacity-60">{g._count?.clientes ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {(!ruta.clientes || ruta.clientes.length === 0) ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(245,197,24,0.08)] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-[#666]">Sin clientes asignados</p>
          </div>
        ) : (
          <div className="space-y-1.5" ref={listRef}>
            {[...clientesFiltrados].sort((a, b) => {
              const aComp = a.estado === 'completado' ? 1 : 0
              const bComp = b.estado === 'completado' ? 1 : 0
              return aComp - bComp
            }).map((c, idx) => {
              const isCompleted = c.estado === 'completado'
              const statusColor = isCompleted ? '#666' : c.hoySinCobro ? '#f59e0b' : c.diasMora > 0 ? '#ef4444' : c.pagoHoy ? '#22c55e' : '#f59e0b'
              const statusText = isCompleted
                ? 'Sin deuda — se puede retirar'
                : c.hoySinCobro && !c.pagoHoy
                  ? 'Hoy no se cobra'
                  : c.diasMora > 0
                    ? `${c.diasMora}d mora`
                    : c.pagoHoy
                      ? 'Pagó hoy'
                      : c.diasDesdeUltimoPago === 1
                        ? 'Falta hoy'
                        : c.diasDesdeUltimoPago >= 2
                          ? `${c.diasDesdeUltimoPago}d sin pago`
                          : 'Pendiente'
              return (
                <div
                  key={c.id}
                  id={`cliente-${c.id}`}
                  data-idx={idx}
                  draggable={!grupoFiltro}
                  onDragStart={!grupoFiltro ? () => handleDragStart(idx) : undefined}
                  onDragOver={!grupoFiltro ? (e) => handleDragOver(e, idx) : undefined}
                  onDrop={!grupoFiltro ? () => handleDrop(idx) : undefined}
                  onDragEnd={!grupoFiltro ? handleDragEnd : undefined}
                  onTouchStart={!grupoFiltro ? (e) => handleTouchStart(e, idx) : undefined}
                  onTouchMove={!grupoFiltro ? (e) => handleTouchMove(e, idx) : undefined}
                  onTouchEnd={!grupoFiltro ? handleTouchEnd : undefined}
                  className={[
                    'flex items-center gap-0 rounded-[14px] transition-all',
                    'border',
                    isCompleted ? 'opacity-50' : '',
                    dragIndex === idx ? 'opacity-30 scale-95' : '',
                    dragOverIdx === idx && dragIndex !== idx ? 'border-[#f5c518] bg-[rgba(245,197,24,0.05)]' : 'border-[#1f1f1f] bg-[rgba(255,255,255,0.02)]',
                    highlightId === c.id ? 'border-[#f5c518] bg-[rgba(245,197,24,0.08)]' : '',
                  ].join(' ')}
                >
                  {/* Grip */}
                  <div
                    data-grip="true"
                    className="flex flex-col items-center justify-center w-11 shrink-0 self-stretch rounded-l-[14px] cursor-grab active:cursor-grabbing touch-none select-none gap-1"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <svg className="w-4 h-4 text-[#666]" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
                      <circle cx="9" cy="13" r="1.5" /><circle cx="15" cy="13" r="1.5" />
                    </svg>
                    <span className="text-[10px] font-bold text-[#777]">{idx + 1}</span>
                  </div>

                  {/* Client content — clickable */}
                  <div
                    className="flex-1 py-3 pl-2 pr-3 min-w-0 cursor-pointer active:opacity-80"
                    onClick={() => {
                      const nextIdx = Math.min(idx + 1, ruta.clientes.length - 1)
                      sessionStorage.setItem(`ruta-scroll-${id}`, ruta.clientes[nextIdx].id)
                      localStorage.setItem(`cf-ruta-progress-${id}`, JSON.stringify({
                        clienteId: c.id, clienteNombre: c.nombre, index: idx, date: getColombiaDateStr(),
                      }))
                      sessionStorage.setItem('cf-ruta-nav', JSON.stringify({
                        rutaId: id, rutaNombre: ruta.nombre,
                        clientes: ruta.clientes.map(cl => ({ id: cl.id, nombre: cl.nombre })),
                        currentIndex: idx,
                      }))
                      if (navigator.onLine) { router.push(`/clientes/${c.id}`) }
                      else { window.location.href = `/clientes/${c.id}` }
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[13px] font-semibold text-[white] truncate">{c.nombre}</p>
                          {c.grupoCobro && !grupoFiltro && (
                            <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: c.grupoCobro.color || '#666' }} title={c.grupoCobro.nombre} />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor, boxShadow: `0 0 5px ${statusColor}50` }} />
                          <span className="text-[10px]" style={{ color: statusColor }}>{statusText}</span>
                          {c.frecuencia && c.frecuencia !== 'diario' && !isCompleted && (
                            <span className="text-[10px] ml-1" style={{ color: c.diasParaCobro < 0 ? '#ef4444' : c.diasParaCobro === 0 ? '#22c55e' : c.diasParaCobro === 1 ? '#f5c518' : '#666' }}>
                              · {c.diasParaCobro < 0
                                ? `Vencido ${Math.abs(c.diasParaCobro)}d`
                                : c.diasParaCobro === 0
                                  ? 'Cobra hoy'
                                  : c.diasParaCobro === 1
                                    ? 'Cobra mañana'
                                    : c.diasParaCobro != null
                                      ? `Cobra en ${c.diasParaCobro}d`
                                      : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: cuota arriba, boton abajo */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {c.cuota > 0 && (
                          <div className="flex items-baseline gap-1">
                            <p className="text-[13px] font-bold text-[white] font-mono-display leading-none">{formatCOP(c.cuota)}</p>
                            <p className="text-[9px] text-[#777] leading-none">/{c.frecuencia === 'semanal' ? 'sem' : c.frecuencia === 'quincenal' ? 'qna' : c.frecuencia === 'mensual' ? 'mes' : 'dia'}</p>
                          </div>
                        )}

                        {/* Quick pay button */}
                        {!isCompleted && c.cuota > 0 && !c.pagoHoy && c.prestamoActivo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirPagoRapido(c) }}
                            disabled={pagandoRapido === c.id}
                            className={[
                              'h-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 px-3 gap-1.5',
                              pagoRapidoOk === c.id
                                ? 'bg-[#22c55e]'
                                : 'bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.25)]',
                            ].join(' ')}
                          >
                            {pagandoRapido === c.id ? (
                              <svg className="w-3.5 h-3.5 text-[#22c55e] animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : pagoRapidoOk === c.id ? (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <>
                                <svg className="w-3 h-3 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                                </svg>
                                <span className="text-[10px] font-semibold text-[#22c55e] whitespace-nowrap">Cobro rápido</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isCompleted && c.proximoCobroLabel && (
                      <p className="text-[10px] mt-1.5 leading-snug capitalize" style={{ color: c.diasMora > 0 ? '#ef4444' : '#888' }}>
                        {c.diasMora > 0 ? 'Cobro pendiente: ' : 'Próx. cobro: '}
                        <span className="font-medium" style={{ color: c.diasMora > 0 ? '#fecaca' : '#bbb' }}>
                          {c.diasMora > 0 && c.frecuencia === 'diario' ? 'hoy' : c.proximoCobroLabel}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Remove button (owner only) */}
                  {esOwner && (
                    <button
                      onClick={() => setConfirmQuitar({ id: c.id, nombre: c.nombre })}
                      disabled={quitando === c.id}
                      className="pr-2 pl-0 self-stretch flex items-center text-[#2a2a2a] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cierre de caja */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Cierre de caja del día
        </p>
        {ruta.cierre ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Esperado</span>
              <span className="text-[white] font-medium font-mono-display">{formatCOP(ruta.cierre.totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Entregado</span>
              <span className="text-[white] font-medium font-mono-display">{formatCOP(ruta.cierre.totalRecogido)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
              <span className="text-[#888888]">Diferencia</span>
              <span className="font-mono-display" style={{ color: ruta.cierre.diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
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

      {/* Historial de cobros */}
      <HistorialCobros rutaId={id} />

      {/* Modal: agregar clientes */}
      <Modal
        open={modalClientes}
        onClose={() => { setModalClientes(false); setBuscarCliente('') }}
        title="Agregar clientes a la ruta"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalClientes(false); setBuscarCliente('') }}>Cancelar</Button>
            <Button onClick={asignarClientes} loading={asignando} disabled={!seleccionados.length}>
              Agregar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
            </Button>
          </>
        }
      >
        {clientesSinRuta.length === 0 && clientesEnOtraRuta.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">Todos los clientes ya tienen ruta asignada</p>
        ) : (
          <div className="space-y-1">
            {/* Buscador */}
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={buscarCliente}
                onChange={(e) => setBuscarCliente(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-[10px] bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#f5c518] transition-colors"
                autoFocus
              />
            </div>
            {errorAsignar && (
              <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-xs rounded-[10px] px-3 py-2 mb-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {errorAsignar}
              </div>
            )}
            {clientesSinRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).length > 0 && (
              <p className="text-[10px] font-medium text-[#555555] uppercase tracking-wide px-1 pt-1">Sin ruta asignada ({clientesSinRuta.length})</p>
            )}
            {clientesSinRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).map((c) => (
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
            {clientesEnOtraRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).length > 0 && (
              <>
                <div className="border-t border-[#2a2a2a] my-2" />
                <p className="text-[10px] font-medium text-[#f59e0b] uppercase tracking-wide px-1">Ya en otra ruta ({clientesEnOtraRuta.length})</p>
              </>
            )}
            {clientesEnOtraRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).map((c) => (
              <label
                key={c.id}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-[12px] cursor-pointer transition-colors',
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,158,11,0.1)]' : 'hover:bg-[#222222]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[#f59e0b]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[white] truncate">{c.nombre}</p>
                    <span className="shrink-0 text-[10px] font-medium text-[#f59e0b] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] px-1.5 py-0.5 rounded-full">
                      En: {c.rutaNombre}
                    </span>
                  </div>
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
            <span className="font-semibold text-[white] font-mono-display">{formatCOP(ruta.esperadoHoy)}</span>
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
              <span className="font-mono-display" style={{ color: Number(totalRecogido) >= ruta.esperadoHoy ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {Number(totalRecogido) >= ruta.esperadoHoy ? '+' : ''}{formatCOP(Number(totalRecogido) - ruta.esperadoHoy)}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: confirmar optimizar ruta */}
      <Modal
        open={confirmOptimizar}
        onClose={() => setConfirmOptimizar(false)}
        title="Optimizar ruta"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOptimizar(false)}>Cancelar</Button>
            <Button onClick={optimizarRuta} loading={optimizando}>Optimizar</Button>
          </>
        }
      >
        <p className="text-sm text-[#888]">
          Se reordenaran los clientes segun su ubicacion GPS para crear la ruta mas corta. Esto puede cambiar el orden que configuraste manualmente.
        </p>
      </Modal>

      {/* Modal: confirmar quitar cliente */}
      <Modal
        open={!!confirmQuitar}
        onClose={() => setConfirmQuitar(null)}
        title="Quitar cliente de la ruta"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmQuitar(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmQuitar && quitarCliente(confirmQuitar.id)}
              style={{ background: '#ef4444', color: 'white' }}
            >
              Quitar
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#888]">
          <span className="text-white font-medium">{confirmQuitar?.nombre}</span> sera removido de esta ruta. Podras reasignarlo despues.
        </p>
      </Modal>

      {/* Modal: cobro rápido — elegir método */}
      <Modal
        open={!!modalPagoRapido}
        onClose={() => setModalPagoRapido(null)}
        title="Cobro rápido"
      >
        {modalPagoRapido && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-[#888]">Registrar 1 cuota para</p>
              <p className="text-base font-bold text-white mt-1">{modalPagoRapido.nombre}</p>
              <p className="text-lg font-bold text-[#22c55e] font-mono-display mt-1">{formatCOP(modalPagoRapido.cuota)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => ejecutarPagoRapido('efectivo')}
                className="flex flex-col items-center gap-2 py-4 rounded-[14px] border border-[#2a2a2a] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(34,197,94,0.08)] hover:border-[rgba(34,197,94,0.3)] transition-all active:scale-95"
              >
                <svg className="w-6 h-6 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-white">Efectivo</span>
              </button>
              <button
                onClick={() => ejecutarPagoRapido('transferencia')}
                className="flex flex-col items-center gap-2 py-4 rounded-[14px] border border-[#2a2a2a] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(59,130,246,0.08)] hover:border-[rgba(59,130,246,0.3)] transition-all active:scale-95"
              >
                <svg className="w-6 h-6 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                <span className="text-sm font-medium text-white">Transferencia</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast: deshacer pago */}
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] border border-[rgba(34,197,94,0.2)] sm:min-w-[320px]"
            style={{ background: 'rgba(15,15,22,0.95)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <svg className="w-4 h-4 text-[#22c55e] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-white flex-1 truncate">Pago registrado — {undoPago.clienteNombre}</span>
            <button
              onClick={deshacerPago}
              className="text-sm font-bold text-[#f5c518] hover:text-[#f5c518]/80 transition-colors shrink-0"
            >
              Deshacer
            </button>
            <button
              onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }}
              className="text-[#666] hover:text-white transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
