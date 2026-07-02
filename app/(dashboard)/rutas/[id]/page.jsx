'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                 from 'next/navigation'
import dynamic                       from 'next/dynamic'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerRutaOffline, guardarOrdenPendiente } from '@/lib/offline'
import { obtenerCoordsRapido } from '@/lib/geo'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { Modal }                     from '@/components/ui/Modal'
import MoneyInput                    from '@/components/ui/MoneyInput'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import AiTipBanner                   from '@/components/ui/AiTipBanner'
import { generarTipRuta }            from '@/lib/tips/rutaTips'
import DiasSinCobroSelector          from '@/components/ui/DiasSinCobroSelector'
import { ConfirmModal }              from '@/components/ui/ConfirmModal'
import HojaRutaImprimible            from '@/components/rutas/HojaRutaImprimible'
import ModalWhatsAppTemplates        from '@/components/ui/ModalWhatsAppTemplates'

// Cargar mapa dinámicamente (evitar SSR con Leaflet)
const RouteMap = dynamic(() => import('@/components/rutas/RouteMap'), { ssr: false })

function HistorialCobros({ rutaId }) {
  const [open, setOpen] = useState(false)
  const [dias, setDias] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [tab, setTab] = useState('pagaron') // 'pagaron' | 'noPagaron'
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = async (d = desde, h = hasta) => {
    setOpen(true)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (d) params.set('desde', d)
      if (h) params.set('hasta', h)
      const qs = params.toString()
      const res = await fetch(`/api/rutas/${rutaId}/historial${qs ? `?${qs}` : ''}`)
      if (res.ok) {
        const data = await res.json()
        setDias(data.dias)
      }
    } catch {} finally { setLoading(false) }
  }

  const toggle = () => {
    if (dias) { setOpen(!open); return }
    cargar()
  }

  const aplicarFiltro = () => cargar(desde, hasta)
  const limpiarFiltro = () => { setDesde(''); setHasta(''); cargar('', '') }

  const formatFecha = (str) => {
    const d = new Date(str + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <Card>
      <button onClick={toggle} className="w-full flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Historial de cobros</span>
        <svg className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          {/* Filtro por rango de fechas (calendario nativo del dispositivo) */}
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] text-[#666] uppercase tracking-wide mb-1">Desde</label>
              <div className="relative">
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full h-9 px-2 pr-8 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-date-and-time-value]:text-left"
                />
                {!desde && (
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[#555]">dd/mm/aaaa</span>
                )}
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] text-[#666] uppercase tracking-wide mb-1">Hasta</label>
              <div className="relative">
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full h-9 px-2 pr-8 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-date-and-time-value]:text-left"
                />
                {!hasta && (
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[#555]">dd/mm/aaaa</span>
                )}
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <button
              onClick={aplicarFiltro}
              disabled={loading}
              className="h-9 px-3 rounded-[10px] bg-[var(--color-accent)] text-black text-[11px] font-semibold hover:bg-[#e0b014] transition-colors disabled:opacity-50"
            >
              Buscar
            </button>
            {(desde || hasta) && (
              <button
                onClick={limpiarFiltro}
                disabled={loading}
                className="h-9 px-3 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-[11px] font-medium hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
              >
                Limpiar
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-10 rounded-lg bg-[rgba(255,255,255,0.03)] animate-pulse" />
              ))}
            </div>
          ) : !dias?.length ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No hay historial aún</p>
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
                        <p className="text-[13px] text-[var(--color-text-primary)] font-medium capitalize">{formatFecha(dia.fecha)}</p>
                        <p className="text-[10px] text-[#666] mt-0.5">
                          <span className="text-[var(--color-success)]">{cantPagaron} pagaron</span>
                          {cantNoPagaron > 0 && <span className="text-[var(--color-danger)]"> · {cantNoPagaron} sin pagar</span>}
                        </p>
                      </div>
                      <p className="text-[14px] font-bold font-mono-display text-[var(--color-success)] shrink-0">
                        {formatMoney(dia.cobrado)}
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
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'pagaron' ? 'text-[var(--color-success)] border-b-2 border-[#22c55e]' : 'text-[var(--color-text-muted)]'}`}
                          >
                            Pagaron ({cantPagaron})
                          </button>
                          <button
                            onClick={() => setTab('noPagaron')}
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'noPagaron' ? 'text-[var(--color-danger)] border-b-2 border-[#ef4444]' : 'text-[var(--color-text-muted)]'}`}
                          >
                            No pagaron ({cantNoPagaron})
                          </button>
                        </div>

                        {/* Contenido tab */}
                        <div className="px-3 py-2 max-h-[200px] overflow-y-auto">
                          {tab === 'pagaron' ? (
                            cantPagaron === 0 ? (
                              <p className="text-[11px] text-[var(--color-text-muted)] text-center py-2">Nadie pagó este día</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.pagaron.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                                      <span className="text-[12px] text-[#ccc] truncate">{c.nombre}</span>
                                    </div>
                                    <span className="text-[12px] font-bold font-mono-display text-[var(--color-text-primary)] shrink-0 ml-2">{formatMoney(c.monto)}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            cantNoPagaron === 0 ? (
                              <p className="text-[11px] text-[var(--color-success)] text-center py-2">Todos pagaron</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.noPagaron.map((nombre, i) => (
                                  <div key={i} className="flex items-center gap-2 py-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)] shrink-0" />
                                    <span className="text-[12px] text-[var(--color-text-secondary)]">{nombre}</span>
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
  const { esOwner, puedeGestionarRutas, orgNombre } = useAuth()

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
  const [posicionesNuevos, setPosicionesNuevos] = useState({})
  const [quitando,      setQuitando]      = useState(null)
  const [modalCaja,     setModalCaja]     = useState(false)
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardandoCaja, setGuardandoCaja] = useState(false)
  const [errorCaja,     setErrorCaja]     = useState('')
  // Capital de la ruta (inyectar/retirar)
  const [modalCapital,  setModalCapital]  = useState(null) // 'inyeccion' | 'retiro' | null
  const [capitalMonto,  setCapitalMonto]  = useState('')
  const [capitalDesc,   setCapitalDesc]   = useState('')
  const [capitalAbsorber, setCapitalAbsorber] = useState(false)
  const [guardandoCapital, setGuardandoCapital] = useState(false)
  const [errorCapital,  setErrorCapital]  = useState('')
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
  const [confirmEliminarRuta, setConfirmEliminarRuta] = useState(false)
  const [optimizando,    setOptimizando]    = useState(false)
  const [optimResult,    setOptimResult]    = useState(null)
  const [showMap,        setShowMap]        = useState(false)
  const [highlightId,    setHighlightId]    = useState(null)
  const [banner,         setBanner]         = useState(null)
  const [pagandoRapido,  setPagandoRapido]  = useState(null) // clienteId while paying
  const [pagoRapidoOk,   setPagoRapidoOk]   = useState(null) // clienteId after success
  const [modalPagoRapido, setModalPagoRapido] = useState(null) // { id, nombre, cuota, prestamoActivo }
  const [modalSeleccionPrestamo, setModalSeleccionPrestamo] = useState(null) // { clienteId, clienteNombre, idxRuta, prestamos }
  const [undoPago,       setUndoPago]       = useState(null)  // { pagoId, prestamoId, clienteNombre, timer }
  const undoTimerRef = useRef(null)
  const [modalWA,        setModalWA]        = useState(null) // { cliente, prestamo }
  const [modalDiasSC,    setModalDiasSC]    = useState(false)
  const [diasSCRuta,     setDiasSCRuta]     = useState([])
  const [guardandoDSC,   setGuardandoDSC]   = useState(false)
  const [festivoHoy,     setFestivoHoy]     = useState(null)
  const [guardandoFestivo, setGuardandoFestivo] = useState(false)
  const [grupoFiltro,    setGrupoFiltro]    = useState(null)
  const [estadoFiltro,   setEstadoFiltro]   = useState(null) // 'pendientes' | 'mora' | 'pagados' | null
  // Vista de la lista: 'trabajo' = 3 secciones (por cobrar/pagados/proximos) sin drag.
  // 'ordenar' = lista plana con drag-and-drop para reordenar la ruta.
  const [modoVista, setModoVista] = useState('trabajo')
  const [seccionProximosAbierta, setSeccionProximosAbierta] = useState(false)
  const [vistaPlana, setVistaPlana] = useState(() => {
    try { return localStorage.getItem('cf-ruta-vistaPlana') !== 'agrupada' } catch { return true }
  })
  // Vista Auditoria (admin): filtro por estado de cobro hoy, busqueda y fila expandida.
  const [auditoriaFiltro, setAuditoriaFiltro] = useState('todos') // 'todos' | 'pagaron' | 'pendientes' | 'parciales'
  const [auditoriaBusqueda, setAuditoriaBusqueda] = useState('')
  const [auditoriaExpandido, setAuditoriaExpandido] = useState(null)

  // Helper: fecha Colombia como string YYYY-MM-DD
  const getColombiaDateStr = () => {
    const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }

  const frecuenciaPrestamoLabel = (f) => {
    if (f === 'semanal') return 'Semanal'
    if (f === 'quincenal') return 'Quincenal'
    if (f === 'mensual') return 'Mensual'
    return 'Diario'
  }

  const normalizarNavCliente = (clienteRuta) => ({
    id: clienteRuta.id,
    nombre: clienteRuta.nombre,
    prestamoActivo: clienteRuta.prestamoActivo ?? null,
    prestamosActivosIds: Array.isArray(clienteRuta.prestamosActivos)
      ? clienteRuta.prestamosActivos.map((p) => p.id).filter(Boolean)
      : (clienteRuta.prestamoActivo ? [clienteRuta.prestamoActivo] : []),
  })

  const guardarContextoRuta = (clienteRuta, idxRuta) => {
    if (!ruta?.clientes?.length) return

    const currentIndex = idxRuta >= 0 ? idxRuta : ruta.clientes.findIndex((cl) => cl.id === clienteRuta.id)
    if (currentIndex < 0) return

    sessionStorage.setItem(`ruta-scroll-${id}`, clienteRuta.id)
    sessionStorage.setItem(`ruta-scrollY-${id}`, String(window.scrollY))
    sessionStorage.setItem(`ruta-modo-${id}`, modoVista)

    localStorage.setItem(`cf-ruta-progress-${id}`, JSON.stringify({
      clienteId: clienteRuta.id,
      clienteNombre: clienteRuta.nombre,
      index: currentIndex,
      date: getColombiaDateStr(),
    }))

    sessionStorage.setItem('cf-ruta-nav', JSON.stringify({
      rutaId: id,
      rutaNombre: ruta.nombre,
      clientes: ruta.clientes.map(normalizarNavCliente),
      currentIndex,
    }))
  }

  const navegarACobroCliente = (clienteRuta, idxRuta, prestamoIdForzado = null) => {
    if (!clienteRuta) return
    guardarContextoRuta(clienteRuta, idxRuta)

    const prestamosIds = Array.isArray(clienteRuta.prestamosActivos)
      ? clienteRuta.prestamosActivos.map((p) => p.id).filter(Boolean)
      : []

    const prestamoObjetivo = prestamoIdForzado
      || (prestamosIds.length === 1 ? prestamosIds[0] : null)
      || clienteRuta.prestamoActivo
      || null

    const url = prestamoObjetivo
      ? `/prestamos/${prestamoObjetivo}?openPago=1&fromRuta=1`
      : `/clientes/${clienteRuta.id}`

    if (navigator.onLine) router.push(url)
    else window.location.href = url
  }

  const abrirClienteDesdeRuta = (clienteRuta, idxVista) => {
    if (!clienteRuta || !ruta?.clientes?.length) return

    const idxRuta = ruta.clientes.findIndex((cl) => cl.id === clienteRuta.id)
    const idxObjetivo = idxRuta >= 0 ? idxRuta : idxVista
    const prestamosActivos = Array.isArray(clienteRuta.prestamosActivos) ? clienteRuta.prestamosActivos : []

    if (prestamosActivos.length > 1) {
      setModalSeleccionPrestamo({
        clienteId: clienteRuta.id,
        clienteNombre: clienteRuta.nombre,
        idxRuta: idxObjetivo,
        prestamos: prestamosActivos,
      })
      return
    }

    const prestamoUnico = prestamosActivos[0]?.id ?? clienteRuta.prestamoActivo ?? null
    navegarACobroCliente(clienteRuta, idxObjetivo, prestamoUnico)
  }

  const irAPrestamoSeleccionado = (prestamoId) => {
    if (!modalSeleccionPrestamo) return
    const payload = modalSeleccionPrestamo
    setModalSeleccionPrestamo(null)

    const clienteRuta = ruta?.clientes?.find((cl) => cl.id === payload.clienteId)
    if (!clienteRuta) return
    navegarACobroCliente(clienteRuta, payload.idxRuta, prestamoId)
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
      return data
    } catch {
      try {
        const cached = await obtenerRutaOffline(id)
        if (cached) { setRuta(cached); setLoading(false); return cached }
      } catch {}
      if (!soft) setError('No se pudo cargar la ruta.')
      return null
    } finally {
      setLoading(false)
    }
  }, [id])

  // Inyectar/retirar capital de esta ruta (reusa POST /api/capital con rutaId)
  const guardarCapitalRuta = async (e) => {
    e.preventDefault()
    const monto = Number(capitalMonto)
    if (!Number.isFinite(monto) || monto <= 0) { setErrorCapital('Ingresa un monto válido'); return }
    setGuardandoCapital(true)
    setErrorCapital('')
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: modalCapital,
          monto,
          descripcion: capitalDesc || `${modalCapital === 'inyeccion' ? 'Inyección' : 'Retiro'} ruta ${ruta?.nombre ?? ''}`.trim(),
          rutaId: id,
          ...(modalCapital === 'inyeccion' && capitalAbsorber && { absorberActivos: true }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErrorCapital(data.error || 'No se pudo registrar'); return }
      setModalCapital(null)
      setCapitalMonto('')
      setCapitalDesc('')
      setCapitalAbsorber(false)
      fetchRuta({ soft: true })
    } finally {
      setGuardandoCapital(false)
    }
  }

  useEffect(() => {
    fetchRuta()
    if (esOwner) {
      fetch('/api/cobradores').then((r) => r.json()).then(setCobradores).catch(() => {})
      fetch('/api/festivos')
        .then(r => r.json())
        .then(d => {
          const hoyCol = new Date(Date.now() - 5 * 60 * 60 * 1000)
          const hoyStr = hoyCol.toISOString().split('T')[0]
          const hoy = (d.festivos ?? []).find(f => new Date(f.fecha).toISOString().split('T')[0] === hoyStr)
          setFestivoHoy(hoy ?? null)
        })
        .catch(() => {})
    }
  }, [fetchRuta, esOwner])

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetchRuta({ soft: true })
    }
  }, [lastSyncedAt, fetchRuta])

  // Feature 2: Auto-scroll al cliente visitado al volver de su ficha
  const scrollRestoredRef = useRef(false)
  const pendingScrollRef = useRef(null)

  useEffect(() => {
    if (!ruta?.clientes?.length || scrollRestoredRef.current) return
    const scrollTo = sessionStorage.getItem(`ruta-scroll-${id}`)
    if (!scrollTo) return
    scrollRestoredRef.current = true
    sessionStorage.removeItem(`ruta-scroll-${id}`)
    const savedY = sessionStorage.getItem(`ruta-scrollY-${id}`)
    sessionStorage.removeItem(`ruta-scrollY-${id}`)
    const savedModo = sessionStorage.getItem(`ruta-modo-${id}`)
    sessionStorage.removeItem(`ruta-modo-${id}`)

    if (savedModo && savedModo !== modoVista) {
      pendingScrollRef.current = { scrollTo, savedY }
      setModoVista(savedModo)
      return
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(`cliente-${scrollTo}`)
      if (savedY) {
        window.scrollTo(0, parseInt(savedY, 10))
      } else if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
      if (el) {
        setHighlightId(scrollTo)
        setTimeout(() => setHighlightId(null), 2000)
      }
    })
  }, [ruta, id])

  useEffect(() => {
    if (!pendingScrollRef.current) return
    const { scrollTo, savedY } = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`cliente-${scrollTo}`)
        if (savedY) {
          window.scrollTo(0, parseInt(savedY, 10))
        } else if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' })
        }
        if (el) {
          setHighlightId(scrollTo)
          setTimeout(() => setHighlightId(null), 2000)
        }
      })
    })
  }, [modoVista])

  // Feature 3: Banner "Continuar ruta" / "Nueva ruta"
  useEffect(() => {
    if (!ruta?.clientes?.length) return
    if (scrollRestoredRef.current) return

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
    if (pagandoRapido) return
    const datos = ruta.clientes.find(c => c.id === cliente.id)
    const activos = Array.isArray(datos?.prestamosActivos) ? datos.prestamosActivos : []
    if (activos.length === 0) return

    const pendiente = Boolean(
      datos?.cobroPendienteHoy ?? (!datos?.pagoHoy && !datos?.hoySinCobro && datos?.estado !== 'completado')
    )
    const abonoConPendiente = Boolean(datos?.pagoHoy && pendiente)

    // Si hay multiples prestamos activos, dejar que el cobrador elija cual cobrar
    if (activos.length > 1) {
      setModalPagoRapido({
        id: cliente.id,
        nombre: cliente.nombre,
        abonoConPendiente,
        prestamosActivos: activos,
        prestamoActivo: null,
        cuota: null,
      })
      return
    }

    const p = activos[0]
    const cuota = p.cuotaDiaria || cliente.cuota
    if (!cuota || cuota <= 0) return
    setModalPagoRapido({
      id: cliente.id,
      nombre: cliente.nombre,
      cuota,
      cuotaOriginal: cuota,
      prestamoActivo: p.id,
      abonoConPendiente,
      modoInteres: p.modoInteres,
      esBalloon: p.esBalloon || false,
      cuotaNumero: p.cuotaNumero ?? null,
    })
  }

  const elegirPrestamoPagoRapido = (prestamoId, cuota, modoInteres, extra = {}) => {
    if (!modalPagoRapido) return
    if (!cuota || cuota <= 0) return
    setModalPagoRapido(prev => prev ? { ...prev, prestamoActivo: prestamoId, cuota, cuotaOriginal: cuota, modoInteres, esBalloon: extra.esBalloon || false, cuotaNumero: extra.cuotaNumero ?? null } : prev)
  }

  const ejecutarPagoRapido = async (metodoPago, { confirmarDuplicado = false } = {}) => {
    if (!modalPagoRapido || pagandoRapido) return
    const { id: clienteId, nombre, cuota, cuotaOriginal, prestamoActivo } = modalPagoRapido
    if (!cuota || cuota <= 0) return
    const esCuotaExacta = cuota === (cuotaOriginal ?? cuota)
    setModalPagoRapido(null)
    setPagandoRapido(clienteId)
    setRuta(prev => prev ? {
      ...prev,
      clientes: prev.clientes.map(c => c.id === clienteId ? { ...c, pagoHoy: true, cobroPendienteHoy: false } : c)
    } : prev)
    const coords = await obtenerCoordsRapido().catch(() => null)
    try {
      const url = `/api/prestamos/${prestamoActivo}/pagos${confirmarDuplicado ? '?confirmarDuplicado=1' : ''}`
      const payload = esCuotaExacta
        ? { montoPagado: cuota, tipo: 'completo', diasAbonados: 1, metodoPago, ...(coords ?? {}) }
        : { montoPagado: cuota, tipo: 'parcial', metodoPago, ...(coords ?? {}) }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        // El pago más reciente es pagos[0] (ordenados desc)
        const pagoId = data.pagos?.[0]?.id
        setPagoRapidoOk(clienteId)
        setTimeout(() => setPagoRapidoOk(null), 1200)
        await fetchRuta()
        // Mostrar undo por 10 segundos
        if (pagoId) {
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
          setUndoPago({ pagoId, prestamoId: prestamoActivo, clienteNombre: nombre })
          undoTimerRef.current = setTimeout(() => setUndoPago(null), 10000)
        }
      } else if (res.status === 409) {
        // Duplicado detectado: preguntar al usuario si confirmar
        const data = await res.json().catch(() => ({}))
        if (data?.duplicado && !confirmarDuplicado) {
          await fetchRuta()
          if (confirm(`${nombre} ya recibió un pago por ${formatMoney(cuota)} hace menos de 1 minuto.\n\n¿Registrar este pago de todos modos?`)) {
            setModalPagoRapido({ id: clienteId, nombre, cuota, prestamoActivo, abonoConPendiente: false })
            return ejecutarPagoRapido(metodoPago, { confirmarDuplicado: true })
          }
        } else {
          alert(data?.error || 'No se pudo registrar el pago')
          await fetchRuta()
        }
      } else {
        // Si falla, revertir estado optimista
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'No se pudo registrar el pago')
        await fetchRuta()
      }
    } catch {
      alert('Error de conexión. Verifica tu red.')
      await fetchRuta()
    } finally { setPagandoRapido(null) }
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

  const marcarFestivoHoy = async () => {
    setGuardandoFestivo(true)
    try {
      const hoyStr = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().split('T')[0]
      const res = await fetch('/api/festivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: hoyStr, nombre: 'Festivo' }),
      })
      const data = await res.json()
      if (res.ok) setFestivoHoy(data.festivo)
    } finally { setGuardandoFestivo(false) }
  }

  const quitarFestivoHoy = async () => {
    if (!festivoHoy) return
    setGuardandoFestivo(true)
    try {
      await fetch(`/api/festivos/${festivoHoy.id}`, { method: 'DELETE' })
      setFestivoHoy(null)
    } finally { setGuardandoFestivo(false) }
  }

  const abrirModalClientes = async () => {
    const res  = await fetch('/api/clientes')
    const data = await res.json()
    const lista = Array.isArray(data) ? data : data.clientes ?? []
    setClientesSinRuta(lista.filter((c) => !c.rutaId))
    setClientesEnOtraRuta(lista.filter((c) => c.rutaId && c.rutaId !== id))
    setSeleccionados([])
    setErrorAsignar('')
    setPosicionesNuevos({})
    setModalClientes(true)
  }

  const toggleSeleccion = (cid) => {
    setSeleccionados((prev) => prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid])
    if (seleccionados.includes(cid)) setPosicionesNuevos(prev => { const n = { ...prev }; delete n[cid]; return n })
  }

  const asignarClientes = async () => {
    if (!seleccionados.length) return
    setErrorAsignar('')
    // Verificar si hay seleccionados de otra ruta
    const deOtraRuta = seleccionados.filter((cid) => clientesEnOtraRuta.some((c) => c.id === cid))
    if (deOtraRuta.length > 0) {
      const nombres = clientesEnOtraRuta.filter((c) => deOtraRuta.includes(c.id)).map((c) => `${c.nombre} (${c.rutaNombre})`).join(', ')
      if (!confirm(`Los siguientes clientes serán MOVIDOS desde su ruta actual:\n\n${nombres}\n\n¿Continuar?`)) return
    }

    // Si algún cliente que entra ya trae un préstamo activo, preguntar si su saldo se
    // descuenta del capital de esta ruta (para que el capital de la ruta cuadre).
    const todos = [...clientesSinRuta, ...clientesEnOtraRuta]
    const conPrestamo = seleccionados
      .map((cid) => todos.find((c) => c.id === cid))
      .filter((c) => c && (c.prestamosActivos > 0 || (c.saldoPendienteTotal || 0) > 0))
    let descontarCapitalRuta = false
    if (conPrestamo.length > 0) {
      const saldoTotal = conPrestamo.reduce((a, c) => a + Math.round(c.saldoPendienteTotal || 0), 0)
      const nombres = conPrestamo.map((c) => c.nombre).join(', ')
      descontarCapitalRuta = confirm(
        `${conPrestamo.length === 1 ? 'Este cliente ya trae' : 'Estos clientes ya traen'} un préstamo activo (saldo $${saldoTotal.toLocaleString('es-CO')}):\n\n${nombres}\n\n¿Descontar ese saldo del capital de ESTA ruta?\n\nAceptar = sí, reservarlo en el capital de la ruta.\nCancelar = no tocar el capital de la ruta.`
      )
    }

    setAsignando(true)
    try {
      const res = await fetch(`/api/rutas/${id}/clientes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clienteIds: seleccionados, forzar: deOtraRuta.length > 0, descontarCapitalRuta }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorAsignar(data.error ?? 'Error al asignar clientes')
        return
      }
      setModalClientes(false)
      const rutaActualizada = await fetchRuta()
      const tieneAlgunaPosicion = seleccionados.some(cid => posicionesNuevos[cid])
      if (tieneAlgunaPosicion && rutaActualizada?.clientes) {
        const nuevosIds = new Set(seleccionados)
        const sinNuevos = rutaActualizada.clientes.filter(c => !nuevosIds.has(c.id))
        const soloNuevos = seleccionados
          .map(cid => rutaActualizada.clientes.find(c => c.id === cid))
          .filter(Boolean)
          .sort((a, b) => {
            const pa = parseInt(posicionesNuevos[a.id], 10) || Infinity
            const pb = parseInt(posicionesNuevos[b.id], 10) || Infinity
            return pa - pb
          })
        let reordenados = [...sinNuevos]
        for (const cliente of soloNuevos) {
          const posRaw = parseInt(posicionesNuevos[cliente.id], 10)
          const pos = posRaw ? Math.max(0, Math.min(posRaw - 1, reordenados.length)) : reordenados.length
          reordenados.splice(pos, 0, cliente)
        }
        setRuta(prev => ({ ...prev, clientes: reordenados }))
        guardarOrden(reordenados)
      }
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
    try {
      const res = await fetch(`/api/rutas/${id}/clientes`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clienteId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'No se pudo quitar el cliente de la ruta')
        return
      }
      fetchRuta()
    } catch {
      alert('Error de conexión')
    } finally {
      setQuitando(null)
    }
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
    setConfirmEliminarRuta(true)
  }

  const _doEliminarRuta = async () => {
    setConfirmEliminarRuta(false)
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

  const clientesFiltrados = (() => {
    let list = ruta?.clientes ?? []
    if (grupoFiltro) list = list.filter(c => c.grupoCobro?.id === grupoFiltro)
    if (estadoFiltro === 'pendientes') list = list.filter(c => c.cobroPendienteHoy)
    else if (estadoFiltro === 'mora') list = list.filter(c => c.diasMora > 0)
    else if (estadoFiltro === 'pagados') list = list.filter(c => c.pagoHoy)
    return list
  })()

  const clientesConCoords = ruta?.clientes?.filter((c) => c.latitud != null && c.longitud != null).length ?? 0

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  )

  if (error || !ruta) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] rounded-[16px] p-6 text-center">
        <p className="font-semibold">Ruta no encontrada</p>
        <button onClick={() => router.back()} className="text-sm underline mt-2">Volver</button>
      </div>
    </div>
  )

  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Rutas
      </button>

      {/* HERO CARD: Recaudado del dia + Donut + Mood color */}
      {(() => {
        const heroColor = progreso >= 100 ? '#22c55e'
          : progreso >= 60 ? '#f5c518'
          : progreso >= 30 ? '#f97316'
          : ruta.esperadoHoy > 0 ? '#ef4444'
          : '#64748b'
        const heroLabel = progreso >= 100 ? 'Meta cumplida'
          : progreso >= 60 ? 'Buen ritmo'
          : progreso >= 30 ? 'Atrasada'
          : ruta.esperadoHoy > 0 ? 'Crítica'
          : 'Sin actividad esperada'
        return (
          <div
            className="cf-hero-card relative rounded-[20px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--color-bg-card)) 100%)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          >
            {/* Orb pulsante */}
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none hidden lg:block"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            {/* Patron de puntos */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              {/* Top: nombre + chip + boton eliminar */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${heroColor} 18%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${heroColor} 30%, transparent)`,
                    color: heroColor,
                  }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75v11.25m6-9v11.25m5.25-14.25L15 8.25l-6-2.25L3.75 8.25v12l5.25-2.25 6 2.25 5.25-2.25v-12z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  {editandoNombre ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nuevoNombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
                        className="flex-1 h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text-primary)] focus:outline-none"
                        style={{ borderColor: heroColor }}
                        autoFocus
                      />
                      <button onClick={guardarNombre} className="p-1" style={{ color: 'var(--color-success)' }}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></button>
                      <button onClick={() => setEditandoNombre(false)} className="p-1" style={{ color: 'var(--color-text-muted)' }}><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>{ruta.nombre}</h1>
                        {esOwner && (
                          <button onClick={() => { setNuevoNombre(ruta.nombre); setEditandoNombre(true) }} className="shrink-0 p-1 transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: `color-mix(in srgb, ${heroColor} 15%, transparent)`,
                            color: heroColor,
                            border: `1px solid color-mix(in srgb, ${heroColor} 25%, transparent)`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor }} />
                          {heroLabel}
                        </span>
                        {ruta.cobrador && (
                          <span className="text-[10px]" style={{ color: 'var(--color-purple)' }}>· {ruta.cobrador.nombre}</span>
                        )}
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>· {ruta.clientes?.length ?? 0} clientes</span>
                      </div>
                    </>
                  )}
                </div>
                {esOwner && !editandoNombre && (
                  <button onClick={eliminarRuta} disabled={eliminando} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                    aria-label="Eliminar ruta"
                    title="Eliminar ruta"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>

              {/* "Falta para la meta" como protagonista */}
              {(() => {
                const recaudado = ruta.recaudadoHoy ?? 0
                const meta = ruta.esperadoHoy ?? 0
                const falta = Math.max(0, meta - recaudado)
                const metaCumplida = meta > 0 && falta <= 0
                const sinMeta = meta <= 0
                return (
                  <div>
                    {sinMeta ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Meta del día
                        </p>
                        <p className="font-mono-display font-bold leading-none" style={{ color: 'var(--color-text-muted)', fontSize: 'clamp(24px, 7vw, 34px)' }}>
                          Sin cobros hoy
                        </p>
                        <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                          No hay cuotas programadas para cobrar hoy en esta ruta.
                        </p>
                      </div>
                    ) : metaCumplida ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-success)' }}>
                          Meta del día
                        </p>
                        <div className="flex items-center gap-2">
                          <svg className="w-7 h-7 shrink-0" fill="none" stroke="var(--color-success)" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="font-mono-display font-bold leading-none" style={{ color: 'var(--color-success)', fontSize: 'clamp(26px, 7vw, 36px)' }}>
                            Meta cumplida
                          </p>
                        </div>
                        <p className="text-[12px] mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                          Cobraste {formatMoney(recaudado)} de {formatMoney(meta)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {(ruta.pendientesHoy ?? 0) > 0 && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-warning)' }} />
                            <span className="text-[11px] font-bold" style={{ color: 'var(--color-warning)' }}>
                              {ruta.pendientesHoy} cliente{ruta.pendientesHoy === 1 ? '' : 's'} por cobrar
                            </span>
                          </div>
                        )}
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                          Te faltan
                        </p>
                        <p
                          className="font-mono-display font-bold leading-none tracking-tight"
                          style={{
                            color: heroColor,
                            fontSize: 'clamp(34px, 11vw, 52px)',
                            textShadow: `0 0 30px color-mix(in srgb, ${heroColor} 25%, transparent)`,
                          }}
                        >
                          {formatMoney(falta)}
                        </p>
                        <p className="text-[12px] mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                          para la meta de hoy
                        </p>
                      </div>
                    )}

                    {/* Barra de progreso gruesa */}
                    {!sinMeta && (
                      <div className="mt-4">
                        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(progreso, 2))}%`,
                              background: `linear-gradient(90deg, color-mix(in srgb, ${heroColor} 75%, transparent), ${heroColor})`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            Cobrado <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatMoney(recaudado)}</span> de {formatMoney(meta)}
                          </p>
                          <p className="text-[11px] font-mono-display font-bold" style={{ color: heroColor }}>{progreso}%</p>
                        </div>
                        {(ruta.clientesConCobroHoy ?? 0) > 0 && (
                          <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{ruta.pendientesHoy ?? 0}</span> por cobrar
                            {' · '}
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{ruta.clientesPagaronHoy ?? 0}</span> ya pagaron
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Controles de owner: cobrador + dias sin cobro + festivo hoy */}
              {esOwner && !editandoNombre && (
                <div className="mt-4 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 15%, transparent)` }}>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ruta.cobrador?.id ?? ''}
                      onChange={(e) => cambiarCobrador(e.target.value)}
                      className="h-9 rounded-[10px] border bg-transparent text-xs px-2 focus:outline-none transition-all cursor-pointer"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="">Sin cobrador</option>
                      {cobradores.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <button
                      onClick={abrirModalDSC}
                      className="flex items-center justify-between h-9 rounded-[10px] border bg-transparent text-xs px-2.5 hover:border-[#f59e0b] transition-all cursor-pointer"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Días sin cobro
                      </span>
                      {ruta.diasSinCobro && JSON.parse(ruta.diasSinCobro).length > 0 && (
                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-warning)' }}>
                          {JSON.parse(ruta.diasSinCobro).length}
                        </span>
                      )}
                    </button>
                  </div>
                  <button
                    onClick={festivoHoy ? quitarFestivoHoy : marcarFestivoHoy}
                    disabled={guardandoFestivo}
                    className={[
                      'flex items-center justify-center gap-1.5 h-9 rounded-[10px] border text-xs px-2.5 transition-all disabled:opacity-50',
                      festivoHoy
                        ? 'border-[#22c55e] text-[#22c55e] bg-[rgba(34,197,94,0.08)]'
                        : 'bg-transparent hover:border-[#22c55e] hover:text-[#22c55e]',
                    ].join(' ')}
                    style={!festivoHoy ? { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' } : {}}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5m-9-6h.008v.008H12V13.5zm0 3h.008v.008H12v-3zm-3 3h.008v.008H9V16.5zm0-3h.008v.008H9V13.5zm6 3h.008v.008H15V16.5zm0-3h.008v.008H15V13.5z" />
                    </svg>
                    {guardandoFestivo ? 'Guardando…' : festivoHoy ? 'Hoy es festivo — toca para quitar' : 'Festivo hoy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Tip IA contextual */}
      <AiTipBanner tip={generarTipRuta(ruta?.clientes)} pageKey={`ruta-${id}`} />

      {/* Modal días sin cobro de ruta */}
      <Modal open={modalDiasSC} onClose={() => setModalDiasSC(false)} title="Días sin cobro de la ruta" footer={
        <>
          <Button variant="secondary" onClick={() => setModalDiasSC(false)}>Cancelar</Button>
          <Button onClick={guardarDiasSCRuta} loading={guardandoDSC}>Guardar</Button>
        </>
      }>
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)] leading-snug">
            Los clientes de esta ruta no serán cobrados estos días y no se les generará mora.
          </p>
          <DiasSinCobroSelector value={diasSCRuta} onChange={setDiasSCRuta} />
          {diasSCRuta.length > 0 && (
            <p className="text-[10px] text-[var(--color-warning)]">
              Aplica a todos los clientes de esta ruta (salvo los que tengan configuración propia).
            </p>
          )}
        </div>
      </Modal>

      {/* Métricas adicionales: Cartera + Pendientes + Mora (Cobro hoy ya esta en Hero) */}
      {(() => {
        const denominadorCartera = ruta.totalAPagarRuta ?? ruta.capitalTotal
        const cobrado = Math.max(0, denominadorCartera - ruta.carteraTotal)
        const carteraPct = denominadorCartera > 0
          ? Math.min(100, Math.max(0, Math.round((cobrado / denominadorCartera) * 100)))
          : 0
        return (
          <>
            {/* Cartera total */}
            <div
              className="cf-hero-card rounded-[16px] px-4 py-3"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, #06b6d4 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                border: '1px solid color-mix(in srgb, #06b6d4 22%, var(--color-border))',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #06b6d4 18%, transparent)', color: '#06b6d4' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#06b6d4' }}>Cartera de la ruta</span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: '#06b6d4' }}>{carteraPct}% cobrado</span>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(ruta.carteraTotal)}</p>
                <p className="text-[11px] font-mono-display" style={{ color: 'var(--color-text-muted)' }}>de {formatMoney(denominadorCartera)}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: 'var(--color-bg-hover)' }}>
                <div className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${carteraPct}%`,
                    background: 'linear-gradient(90deg, color-mix(in srgb, #06b6d4 60%, transparent), #06b6d4)',
                  }}
                />
              </div>
            </div>

            {/* Capital de la ruta — sub-bolsa individual (solo owner) */}
            {esOwner && ruta.capitalHabilitado && (
              <div className="rounded-[16px] px-4 py-3.5"
                style={{ background: `linear-gradient(135deg, color-mix(in srgb, #6366f1 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`, border: '1px solid color-mix(in srgb, #6366f1 25%, var(--color-border))' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6366f1' }}>Capital de la ruta</span>
                  <span className="text-lg font-bold font-mono-display" style={{ color: ruta.saldoCapital >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
                    {formatMoney(ruta.saldoCapital)}
                  </span>
                </div>
                <p className="text-[10px] mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Dinero asignado a esta ruta para prestar.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setModalCapital('inyeccion'); setCapitalMonto(''); setCapitalDesc(''); setErrorCapital('') }}
                    className="flex-1 py-1.5 rounded-[8px] text-xs font-semibold"
                    style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
                    Inyectar
                  </button>
                  <button type="button" onClick={() => { setModalCapital('retiro'); setCapitalMonto(''); setCapitalDesc(''); setErrorCapital('') }}
                    className="flex-1 py-1.5 rounded-[8px] text-xs font-semibold"
                    style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }}>
                    Retirar
                  </button>
                </div>
              </div>
            )}
            {esOwner && !ruta.capitalHabilitado && (
              <button type="button"
                onClick={() => { setModalCapital('inyeccion'); setCapitalMonto(''); setCapitalDesc(''); setErrorCapital('') }}
                className="w-full rounded-[16px] px-4 py-3 text-left"
                style={{ background: 'var(--color-bg-card)', border: '1px dashed var(--color-border)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: 'color-mix(in srgb, #6366f1 15%, transparent)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: '#6366f1' }}>Habilitar capital de la ruta</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Controla cuanto dinero tiene asignado esta ruta</p>
                  </div>
                </div>
              </button>
            )}

            {/* Seguros de la ruta (solo owner) */}
            {esOwner && (ruta.segurosVigentes > 0 || ruta.segurosHoy > 0) && (
              <div className="rounded-[16px] px-4 py-3.5"
                style={{ background: `linear-gradient(135deg, color-mix(in srgb, #8b5cf6 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`, border: '1px solid color-mix(in srgb, #8b5cf6 25%, var(--color-border))' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#8b5cf6' }}>Seguros de la ruta</span>
                  <span className="text-lg font-bold font-mono-display" style={{ color: '#8b5cf6' }}>
                    {formatMoney(ruta.segurosVigentes)}
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  {ruta.segurosVigentesCount} préstamo{ruta.segurosVigentesCount !== 1 ? 's' : ''} activo{ruta.segurosVigentesCount !== 1 ? 's' : ''} con seguro
                  {ruta.segurosHoy > 0 ? ` · hoy: ${formatMoney(ruta.segurosHoy)} (${ruta.segurosHoyCount})` : ''}
                </p>
              </div>
            )}

            {/* Pendientes + Mora como filtros clickeables */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEstadoFiltro(estadoFiltro === 'pendientes' ? null : 'pendientes')}
                className="text-left rounded-[16px] px-4 py-3 transition-all kpi-lift"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, #f59e0b 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                  border: estadoFiltro === 'pendientes'
                    ? '1px solid #f59e0b'
                    : '1px solid color-mix(in srgb, #f59e0b 22%, var(--color-border))',
                  boxShadow: estadoFiltro === 'pendientes' ? '0 0 0 1px #f59e0b' : 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #f59e0b 18%, transparent)', color: '#f59e0b' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Pendientes</p>
                </div>
                <p className="text-2xl font-bold font-mono-display" style={{ color: ruta.pendientesHoy > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {ruta.pendientesHoy}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>de {ruta.clientesConCobroHoy ?? 0} hoy</p>
              </button>

              <button
                type="button"
                onClick={() => setEstadoFiltro(estadoFiltro === 'mora' ? null : 'mora')}
                className="text-left rounded-[16px] px-4 py-3 transition-all kpi-lift"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                  border: estadoFiltro === 'mora'
                    ? '1px solid #ef4444'
                    : '1px solid color-mix(in srgb, #ef4444 22%, var(--color-border))',
                  boxShadow: estadoFiltro === 'mora' ? '0 0 0 1px #ef4444' : 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, #ef4444 18%, transparent)', color: '#ef4444' }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>En mora</p>
                </div>
                <p className="text-2xl font-bold font-mono-display" style={{ color: ruta.enMora > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {ruta.enMora}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>del total de la ruta</p>
              </button>
            </div>
            {estadoFiltro && (
              <button
                type="button"
                onClick={() => setEstadoFiltro(null)}
                className="text-[11px] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
                style={{ color: 'var(--color-accent)' }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Quitar filtro ({estadoFiltro === 'pendientes' ? 'Pendientes hoy' : estadoFiltro === 'mora' ? 'En mora' : 'Pagaron hoy'})
              </button>
            )}
          </>
        )
      })()}

      {/* Banner: Continuar ruta */}
      {banner && (
        <div className="bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.2)] rounded-[16px] px-4 py-3">
          <p className="text-sm text-[var(--color-text-primary)]">
            {banner.label} <strong className="text-[var(--color-accent)]">{banner.clienteNombre}</strong>
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
              className="px-3 py-1.5 rounded-[10px] bg-[var(--color-accent)] text-[#1a1a2e] text-xs font-semibold active:scale-95 transition-transform"
            >
              Continuar ruta
            </button>
            <button
              onClick={() => {
                setBanner(null)
                localStorage.removeItem(`cf-ruta-progress-${id}`)
              }}
              className="px-3 py-1.5 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-medium active:scale-95 transition-transform"
            >
              Nueva ruta
            </button>
          </div>
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {puedeGestionarRutas && (
          <button onClick={abrirModalClientes} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[var(--color-bg-card)] text-[11px] text-[var(--color-text-secondary)] font-medium active:scale-95 transition-transform">
            + Agregar
          </button>
        )}
        {(ruta.clientes?.length ?? 0) >= 2 && clientesConCoords >= 2 && (
          <button onClick={() => setConfirmOptimizar(true)} disabled={optimizando} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[var(--color-bg-card)] text-[11px] text-[var(--color-text-secondary)] font-medium active:scale-95 transition-transform disabled:opacity-50">
            {optimizando ? 'Optimizando...' : 'Optimizar'}
          </button>
        )}
        {clientesConCoords >= 2 && (
          <>
            <button onClick={abrirGoogleMaps} className="shrink-0 h-8 px-3 rounded-[10px] border border-[rgba(66,133,244,0.2)] bg-[rgba(66,133,244,0.06)] text-[11px] text-[#4285f4] font-medium active:scale-95 transition-transform">
              Google Maps
            </button>
            <button onClick={() => setShowMap((v) => !v)} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[var(--color-bg-card)] text-[11px] text-[#666] font-medium active:scale-95 transition-transform">
              {showMap ? 'Ocultar mapa' : 'Ver mapa'}
            </button>
          </>
        )}
        {puedeGestionarRutas && (ruta.clientes?.length ?? 0) > 0 && (
          <button onClick={() => window.print()} className="shrink-0 h-8 px-3 rounded-[10px] border border-[#222] bg-[var(--color-bg-card)] text-[11px] text-[var(--color-text-secondary)] font-medium active:scale-95 transition-transform inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7m-12 0h12m-12 0a2 2 0 00-2 2v5a2 2 0 002 2h1m11-9a2 2 0 012 2v5a2 2 0 01-2 2h-1m-10 0v4h8v-4m-8 0h8" />
            </svg>
            Imprimir lista
          </button>
        )}
      </div>

      {/* Resultado de optimización */}
      {optimResult && (
        <div className="px-3 py-2 rounded-[12px] bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.12)]">
          <p className="text-xs text-[var(--color-success)] font-medium">
            Ruta optimizada {optimResult.ahorro > 0 && `· ${optimResult.ahorro}% mas corta`}
          </p>
        </div>
      )}

      {/* Mini-mapa */}
      {showMap && ruta.clientes && (
        <div className="rounded-[14px] overflow-hidden border border-[#222]">
          <RouteMap clientes={ruta.clientes} cobrosGeoHoy={ruta.cobrosGeoHoy ?? []} />
        </div>
      )}

      {/* Lista de clientes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
            Clientes ({clientesFiltrados.length}{grupoFiltro ? ` de ${ruta.clientes?.length ?? 0}` : ''})
          </span>
          <span className="text-[10px] text-[#777]">
            {guardandoOrden && <span className="text-[var(--color-text-muted)] flex items-center gap-1 inline-flex"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando</span>}
            {ordenGuardado && <span className="text-[var(--color-success)]">Guardado</span>}
            {ordenOffline && <span className="text-[var(--color-accent)]">Guardado offline</span>}
            {ordenError && <span className="text-[var(--color-danger)]">{ordenError}</span>}
          </span>
        </div>

        {/* Chips de filtro por grupo */}
        {ruta.gruposCobro?.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-2">
            <button
              onClick={() => setGrupoFiltro(null)}
              className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium transition-all ${!grupoFiltro ? 'bg-white text-black' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'}`}
            >
              Todos
            </button>
            {ruta.gruposCobro.map(g => (
              <button
                key={g.id}
                onClick={() => setGrupoFiltro(grupoFiltro === g.id ? null : g.id)}
                className={`shrink-0 h-7 px-3 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${grupoFiltro === g.id ? 'bg-white text-black' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color || '#666' }} />
                {g.nombre}
                <span className="text-[9px] opacity-60">{g._count?.clientes ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* Toggle de vista: Trabajo del dia (3 secciones) vs Ordenar ruta (drag) vs Auditoria (admin) */}
        {ruta.clientes?.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1 p-1 rounded-[12px] flex-1 min-w-0" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
              {[
                { key: 'trabajo', label: 'Cobros' },
                { key: 'ordenar', label: 'Ordenar' },
                ...(puedeGestionarRutas ? [{ key: 'auditoria', label: 'Auditoría' }] : []),
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setModoVista(t.key)}
                  className="flex-1 py-2 text-xs font-semibold rounded-[9px] transition-all"
                  style={modoVista === t.key
                    ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                    : { color: 'var(--color-text-muted)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {modoVista === 'trabajo' && (
              <div className="flex rounded-[10px] border border-[var(--color-border)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setVistaPlana(v => { if (v) return v; try { localStorage.setItem('cf-ruta-vistaPlana', 'plana') } catch {} return true })}
                  className="p-1.5 transition-colors"
                  title="Lista completa"
                  style={{
                    background: vistaPlana ? 'var(--color-accent)' : 'transparent',
                    color: vistaPlana ? '#000' : 'var(--color-text-muted)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setVistaPlana(v => { if (!v) return v; try { localStorage.setItem('cf-ruta-vistaPlana', 'agrupada') } catch {} return false })}
                  className="p-1.5 transition-colors"
                  title="Agrupados por estado"
                  style={{
                    background: !vistaPlana ? 'var(--color-accent)' : 'transparent',
                    color: !vistaPlana ? '#000' : 'var(--color-text-muted)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {(!ruta.clientes || ruta.clientes.length === 0) ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(245,197,24,0.08)] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-[#666]">Sin clientes asignados</p>
          </div>
        ) : (() => {
          // Render de una card de cliente. `conGrip` = true en modo ordenar (drag).
          const renderCard = (c, idx, { conGrip }) => {
              const globalIdx = conGrip && !grupoFiltro ? idx : (ruta.clientes ?? []).findIndex(x => x.id === c.id)
              const numPos = globalIdx + 1
              const isCompleted = c.estado === 'completado'
              const pendienteHoy = Boolean(
                c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado')
              )
              const tieneMora = c.diasMora > 0
              const abonoConPendiente = c.pagoHoy && pendienteHoy
              const statusColor = isCompleted
                ? '#666'
                : abonoConPendiente
                  ? 'var(--color-warning)'
                  : c.pagoHoy
                  ? 'var(--color-success)'
                  : c.hoySinCobro && !pendienteHoy
                    ? 'var(--color-warning)'
                    : pendienteHoy
                      ? 'var(--color-warning)'
                      : 'var(--color-success)'
              const statusText = isCompleted
                ? 'Sin deuda — se puede retirar'
                : abonoConPendiente
                  ? 'Abonó hoy · sigue pendiente'
                  : c.pagoHoy
                  ? 'Pagó hoy'
                  : c.hoySinCobro && !pendienteHoy
                    ? 'Hoy no se cobra'
                    : pendienteHoy
                      ? 'Pago pendiente hoy'
                      : 'Al día'
              const detalleMora = tieneMora
                ? `${c.diasMora}d mora${c.cuotasEnMora ? ` · ${c.cuotasEnMora} cuota${c.cuotasEnMora === 1 ? '' : 's'}` : ''}${c.montoEnMora ? ` · ${formatMoney(c.montoEnMora)}` : ''}`
                : null
              const cobroLabelContextual = c.diasParaCobro === 0
                ? 'Hoy'
                : c.diasParaCobro === 1
                  ? 'Mañana'
                  : c.diasParaCobro === -1
                    ? 'Ayer'
                    : c.proximoCobroLabel
              const prefijoCobro = c.diasParaCobro != null && c.diasParaCobro < 0 ? 'Debió cobrarse' : 'Próx. cobro'
              const detalleCobro = !isCompleted && cobroLabelContextual ? `${prefijoCobro}: ${cobroLabelContextual}` : null
              const dragActivo = conGrip && !grupoFiltro
              return (
                <div
                  key={c.id}
                  id={`cliente-${c.id}`}
                  data-idx={idx}
                  draggable={dragActivo}
                  onDragStart={dragActivo ? () => handleDragStart(idx) : undefined}
                  onDragOver={dragActivo ? (e) => handleDragOver(e, idx) : undefined}
                  onDrop={dragActivo ? () => handleDrop(idx) : undefined}
                  onDragEnd={dragActivo ? handleDragEnd : undefined}
                  onTouchStart={dragActivo ? (e) => handleTouchStart(e, idx) : undefined}
                  onTouchMove={dragActivo ? (e) => handleTouchMove(e, idx) : undefined}
                  onTouchEnd={dragActivo ? handleTouchEnd : undefined}
                  className={[
                    'flex items-stretch gap-0 rounded-[14px] transition-all overflow-hidden',
                    'border',
                    isCompleted ? 'opacity-50' : '',
                    dragIndex === idx ? 'opacity-30 scale-95' : '',
                    dragOverIdx === idx && dragIndex !== idx ? 'border-[#f5c518] bg-[rgba(245,197,24,0.05)]' : 'border-[#1f1f1f] bg-[rgba(255,255,255,0.02)]',
                    highlightId === c.id ? 'border-[#f5c518] bg-[rgba(245,197,24,0.08)]' : '',
                  ].join(' ')}
                >
                  {/* Borde lateral de color por estado (se lee de reojo en campo) */}
                  <div className="w-1 shrink-0 self-stretch" style={{ background: statusColor }} />

                  {/* Grip + input de posicion (modo Ordenar) */}
                  {conGrip && (
                  <div
                    data-grip="true"
                    className="flex flex-col items-center justify-center w-14 shrink-0 self-stretch cursor-grab active:cursor-grabbing touch-none select-none gap-0.5"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <svg className="w-3.5 h-3.5 text-[#555]" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
                      <circle cx="9" cy="13" r="1.5" /><circle cx="15" cy="13" r="1.5" />
                    </svg>
                    <input
                      type="number"
                      inputMode="numeric"
                      defaultValue={numPos}
                      key={`pos-${c.id}-${numPos}`}
                      onFocus={(e) => { e.target.select(); e.stopPropagation() }}
                      onClick={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        if (grupoFiltro) { e.target.value = numPos; return }
                        const newPos = parseInt(e.target.value, 10)
                        if (!newPos || newPos < 1 || newPos > ruta.clientes.length || newPos === numPos) {
                          e.target.value = numPos
                          return
                        }
                        const nuevos = [...ruta.clientes]
                        const [moved] = nuevos.splice(globalIdx, 1)
                        nuevos.splice(newPos - 1, 0, moved)
                        setRuta(prev => ({ ...prev, clientes: nuevos }))
                        guardarOrden(nuevos)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                      className="w-12 h-6 text-center text-[11px] font-bold tabular-nums rounded-[6px] border bg-transparent cursor-text
                        focus:bg-[var(--color-bg-card)] focus:border-[var(--color-accent)] focus:cursor-text focus:outline-none transition-colors"
                      style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
                      min={1}
                      max={ruta.clientes.length}
                    />
                  </div>
                  )}

                  {/* Numero racing (modo trabajo) — ocupa todo el alto de la card */}
                  {!conGrip && (
                    <div
                      className="flex items-center justify-center shrink-0 self-stretch relative"
                      style={{ width: numPos > 999 ? 44 : numPos > 99 ? 38 : numPos > 9 ? 36 : 30 }}
                    >
                      <span
                        className="absolute font-black tabular-nums italic select-none pointer-events-none"
                        style={{
                          fontSize: numPos > 999 ? '36px' : numPos > 99 ? '44px' : numPos > 9 ? '70px' : '80px',
                          lineHeight: 1,
                          color: 'var(--color-text-primary)',
                          opacity: 0.08,
                          letterSpacing: '-0.05em',
                          fontFamily: 'system-ui, sans-serif',
                          whiteSpace: 'nowrap',
                        }}
                      >{numPos}</span>
                    </div>
                  )}

                  {/* Client content — clickable */}
                  <div
                    className="flex-1 py-3 pl-3 pr-3 min-w-0 cursor-pointer active:opacity-80"
                    onClick={() => abrirClienteDesdeRuta(c, idx)}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                          {c.grupoCobro && !grupoFiltro && (
                            <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: c.grupoCobro.color || '#666' }} title={c.grupoCobro.nombre} />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor, boxShadow: `0 0 5px ${statusColor}50` }} />
                          <span className="text-[10px]" style={{ color: statusColor }}>{statusText}</span>
                          {c.frecuencia && c.frecuencia !== 'diario' && !isCompleted && (
                            <span className="text-[10px] ml-1" style={{ color: c.diasParaCobro < 0 ? 'var(--color-danger)' : c.diasParaCobro === 0 ? 'var(--color-success)' : c.diasParaCobro === 1 ? 'var(--color-accent)' : '#666' }}>
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

                      {/* Right side: cuota + WA + cobrar */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {c.cuota > 0 && (
                            <div className="flex items-baseline gap-1">
                              <p className="text-[13px] font-bold text-[var(--color-text-primary)] font-mono-display leading-none">{formatMoney(c.cuota)}</p>
                              <p className="text-[9px] text-[#777] leading-none">/{c.frecuencia === 'semanal' ? 'sem' : c.frecuencia === 'quincenal' ? 'qna' : c.frecuencia === 'mensual' ? 'mes' : 'dia'}</p>
                            </div>
                          )}
                          {c.telefono && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const p = c.prestamosActivos?.[0]
                                setModalWA({
                                  cliente: { id: c.id, nombre: c.nombre, telefono: c.telefono, cedula: c.cedula, direccion: c.direccion },
                                  prestamo: p ? {
                                    ...p,
                                    estado: c.estado === 'completado' ? 'completado' : 'activo',
                                    porcentajePagado: p.totalAPagar > 0 ? Math.round((p.totalPagado / p.totalAPagar) * 100) : 0,
                                  } : null,
                                })
                              }}
                              className="w-7 h-7 rounded-[8px] flex items-center justify-center transition-all active:scale-90"
                              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}
                              title="Enviar WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5" fill="#22c55e" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Quick pay button */}
                        {!isCompleted && c.cuota > 0 && c.prestamoActivo && (!c.pagoHoy || pendienteHoy) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirPagoRapido(c) }}
                            disabled={pagandoRapido === c.id}
                            title={abonoConPendiente ? 'El cliente aun tiene cuotas atrasadas pendientes' : 'Registrar cobro del día'}
                            className={[
                              'h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all active:scale-95 px-3 gap-1.5',
                              pagoRapidoOk === c.id
                                ? 'bg-[var(--color-success)]'
                                : abonoConPendiente
                                  ? 'bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.35)] hover:bg-[rgba(245,158,11,0.22)]'
                                  : 'bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.25)]',
                            ].join(' ')}
                          >
                            {pagandoRapido === c.id ? (
                              <svg className="w-3.5 h-3.5 text-[var(--color-success)] animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : pagoRapidoOk === c.id ? (
                              <svg className="w-3.5 h-3.5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <>
                                <svg
                                  className={`w-3 h-3 shrink-0 ${abonoConPendiente ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                                </svg>
                                <span className={`text-[11px] font-bold whitespace-nowrap font-mono-display ${abonoConPendiente ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}`}>
                                  Cobrar
                                </span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mora compacta (una linea) */}
                    {tieneMora && !isCompleted && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-[6px] text-[10px] font-semibold"
                        style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}
                      >
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                        </svg>
                        <span>{detalleMora}</span>
                      </div>
                    )}
                  </div>

                  {/* Remove button (owner o cobrador con permiso) — solo en modo ordenar */}
                  {puedeGestionarRutas && conGrip && (
                    <button
                      onClick={() => setConfirmQuitar({ id: c.id, nombre: c.nombre })}
                      disabled={quitando === c.id}
                      className="pr-2 pl-0 self-stretch flex items-center text-[#2a2a2a] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
          }

          // MODO ORDENAR: lista plana con drag-and-drop (comportamiento original).
          if (modoVista === 'ordenar') {
            return (
              <div className="space-y-1.5" ref={listRef}>
                {clientesFiltrados.map((c, idx) => renderCard(c, idx, { conGrip: true }))}
              </div>
            )
          }

          // MODO AUDITORIA (admin): lista compacta para revisar quien pago y quien no,
          // sin entrar/salir de cada tarjeta. Filtros rapidos + busqueda + fila expandible.
          if (modoVista === 'auditoria') {
            const formatHora = (fecha) => {
              const d = new Date(fecha)
              return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
            }
            const metodoLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia' }

            // Clasificacion de cada cliente para esta vista.
            const clasificar = (c) => {
              if (c.hoySinCobro) return 'sin_cobro'
              if (c.estado === 'completado') return 'completado'
              const tienePendiente = Boolean(c.cobroPendienteHoy)
              if (c.pagoHoy && !tienePendiente) return 'pagaron'
              if (c.pagoHoy && tienePendiente) return 'parcial'
              return 'pendientes'
            }

            let lista = clientesFiltrados.map(c => ({ ...c, _clase: clasificar(c) }))

            const counts = {
              todos: lista.length,
              pagaron: lista.filter(c => c._clase === 'pagaron').length,
              pendientes: lista.filter(c => c._clase === 'pendientes').length,
              parciales: lista.filter(c => c._clase === 'parcial').length,
            }

            if (auditoriaFiltro === 'pagaron') lista = lista.filter(c => c._clase === 'pagaron')
            else if (auditoriaFiltro === 'pendientes') lista = lista.filter(c => c._clase === 'pendientes')
            else if (auditoriaFiltro === 'parciales') lista = lista.filter(c => c._clase === 'parcial')

            if (auditoriaBusqueda.trim()) {
              const q = auditoriaBusqueda.trim().toLowerCase()
              lista = lista.filter(c => c.nombre?.toLowerCase().includes(q))
            }

            const filtros = [
              { key: 'todos', label: 'Todos', count: counts.todos },
              { key: 'pagaron', label: 'Pagaron', count: counts.pagaron },
              { key: 'pendientes', label: 'Pendientes', count: counts.pendientes },
              { key: 'parciales', label: 'Abonos parciales', count: counts.parciales },
            ]

            const pctCobradoHoy = ruta.esperadoHoy > 0 ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : (ruta.recaudadoHoy > 0 ? 100 : 0)

            return (
              <div className="space-y-3">
                {/* Resumen del dia: lo que necesita el admin de un vistazo */}
                <div className="rounded-[12px] p-3" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      Resumen del día
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      {pctCobradoHoy}%
                    </p>
                  </div>
                  {/* Barra de progreso cobrado/esperado */}
                  <div className="h-1.5 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--color-bg-hover)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${pctCobradoHoy}%`,
                      background: pctCobradoHoy >= 100 ? 'var(--color-success)' : 'var(--color-accent)',
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cobrado hoy</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                        {formatMoney(ruta.recaudadoHoy)}
                        <span className="text-[11px] font-normal" style={{ color: 'var(--color-text-muted)' }}> / {formatMoney(ruta.esperadoHoy)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Pagaron / esperados</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                        {ruta.clientesPagaronHoy} / {ruta.clientesConCobroHoy}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Pendientes hoy</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: ruta.pendientesHoy > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                        {ruta.pendientesHoy}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Clientes en mora</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: ruta.enMora > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                        {ruta.enMora}
                      </p>
                    </div>
                  </div>

                  {/* Cuadre de caja del cobrador, si ya cerro hoy */}
                  {ruta.cierre && (
                    <div className="mt-2.5 pt-2.5 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        Cierre del cobrador: {formatMoney(ruta.cierre.totalRecogido)}
                        {ruta.cierre.confirmadoEn ? ' · confirmado' : ' · sin confirmar'}
                      </span>
                      {Math.abs(ruta.cierre.diferencia) > 0 && (
                        <span className="font-mono-display font-semibold" style={{ color: 'var(--color-danger)' }}>
                          {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatMoney(ruta.cierre.diferencia)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actividad sospechosa: pagos editados/anulados o prestamos modificados hoy */}
                  {ruta.actividadHoy?.length > 0 && (
                    <div className="mt-2.5 pt-2.5 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-danger)' }}>
                        Actividad del día a revisar
                      </p>
                      {ruta.actividadHoy.map((a) => {
                        const labelMap = {
                          editar_pago: 'Editó la fecha de un pago',
                          anular_pago: 'Anuló un pago',
                          editar_prestamo: 'Editó un préstamo',
                          eliminar_prestamo: 'Eliminó un préstamo',
                        }
                        return (
                          <div key={a.id} className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                            <span style={{ color: 'var(--color-danger)' }}>{labelMap[a.accion] || a.accion}</span>
                            {a.user?.nombre ? ` · ${a.user.nombre}` : ''}
                            {' · '}{formatHora(a.createdAt)}
                            {a.detalle ? <span className="block text-[10px] opacity-80">{a.detalle}</span> : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Buscador */}
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                  <input
                    type="text"
                    value={auditoriaBusqueda}
                    onChange={(e) => setAuditoriaBusqueda(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-[10px] outline-none"
                    style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                </div>

                {/* Filtros rapidos con contador */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {filtros.map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setAuditoriaFiltro(f.key)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all"
                      style={auditoriaFiltro === f.key
                        ? { background: 'var(--color-accent)', color: 'white' }
                        : { background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                    >
                      {f.label}
                      <span className="px-1.5 py-px rounded-full text-[10px] font-bold"
                        style={auditoriaFiltro === f.key
                          ? { background: 'rgba(255,255,255,0.25)' }
                          : { background: 'var(--color-bg-card)' }}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Lista compacta */}
                {lista.length === 0 ? (
                  <div className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No hay clientes que coincidan
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {lista.map((c) => {
                      const auditNumPos = (ruta.clientes ?? []).findIndex(x => x.id === c.id) + 1
                      const expandido = auditoriaExpandido === c.id
                      const cfg = {
                        pagaron:    { color: 'var(--color-success)', label: 'Pagó hoy', icon: '✓' },
                        parcial:    { color: 'var(--color-warning)', label: 'Abono parcial', icon: '½' },
                        pendientes: { color: 'var(--color-danger)',  label: 'Pendiente', icon: '!' },
                        completado: { color: 'var(--color-text-muted)', label: 'Completado', icon: '✓' },
                        sin_cobro:  { color: 'var(--color-text-muted)', label: 'Sin cobro hoy', icon: '–' },
                      }[c._clase]

                      return (
                        <div key={c.id} className="rounded-[12px] overflow-hidden transition-all"
                          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderLeft: `3px solid ${cfg.color}` }}
                        >
                          <button
                            type="button"
                            onClick={() => setAuditoriaExpandido(expandido ? null : c.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                          >
                            {/* Numero de posicion */}
                            {auditNumPos > 0 && (
                              <span className="shrink-0 w-5 text-[11px] font-bold tabular-nums text-right" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}>
                                {auditNumPos}
                              </span>
                            )}

                            {/* Icono de estado */}
                            <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
                              style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}
                            >
                              {cfg.icon}
                            </div>

                            {/* Nombre + estado */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {c.nombre}
                              </p>
                              <p className="text-[10px]" style={{ color: cfg.color }}>
                                {cfg.label}
                                {c.diasMora > 0 ? ` · ${c.diasMora}d mora` : ''}
                              </p>
                            </div>

                            {/* Cobrado hoy / cuota */}
                            {c._clase !== 'completado' && c._clase !== 'sin_cobro' && (
                              <div className="shrink-0 text-right">
                                <p className="text-[12px] font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                                  {formatMoney(c.montoPagadoHoy || 0)}
                                  <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}> / {formatMoney(c.cuota)}</span>
                                </p>
                              </div>
                            )}

                            {/* Chevron */}
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
                              style={{ color: 'var(--color-text-muted)', transform: expandido ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease', flexShrink: 0 }}>
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>

                          {/* Detalle expandido */}
                          {expandido && (
                            <div className="px-3 pb-3 pt-0.5 space-y-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                              {/* Saldo restante por prestamo */}
                              {c.prestamosActivos?.length > 0 && (
                                <div className="pt-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Saldo restante
                                  </p>
                                  <div className="space-y-1">
                                    {c.prestamosActivos.map((p, i) => (
                                      <div key={p.id} className="flex items-center justify-between text-[12px]">
                                        <span style={{ color: 'var(--color-text-muted)' }}>
                                          {c.prestamosActivos.length > 1 ? `Préstamo ${i + 1}` : 'Préstamo'}
                                          {' · '}{formatMoney(p.cuotaDiaria)}/{frecuenciaPrestamoLabel(p.frecuencia)}
                                          {p.seguro && (
                                            <span style={{ color: 'var(--color-accent)' }}>
                                              {' · seguro'}{p.montoSeguro ? ` ${formatMoney(p.montoSeguro)}` : ''}
                                            </span>
                                          )}
                                        </span>
                                        <span className="font-mono-display font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                          {formatMoney(p.saldoPendiente)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Prestamos nuevos / renovaciones registrados hoy */}
                              {c.eventosHoy?.length > 0 && (
                                <div className="px-2 py-1.5 rounded-[8px] space-y-1"
                                  style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}
                                >
                                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                                    {c.eventosHoy.some(e => e.tipo === 'renovacion') ? 'Renovación / préstamo nuevo hoy' : 'Préstamo nuevo hoy'}
                                  </p>
                                  {c.eventosHoy.map((ev, i) => (
                                    <div key={i} className="flex items-center justify-between text-[12px]">
                                      <span style={{ color: 'var(--color-text-muted)' }}>
                                        {ev.tipo === 'renovacion' ? 'Renovación' : 'Préstamo nuevo'}
                                        {ev.seguro && (
                                          <span style={{ color: 'var(--color-accent)' }}>
                                            {' · seguro'}{ev.montoSeguro ? ` ${formatMoney(ev.montoSeguro)}` : ''}
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-mono-display font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {formatMoney(ev.montoPrestado)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Mora */}
                              {c.diasMora > 0 && (
                                <div className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-[8px]"
                                  style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)', color: 'var(--color-danger)' }}
                                >
                                  <span>{c.diasMora}d en mora{c.cuotasEnMora ? ` · ${c.cuotasEnMora} cuota${c.cuotasEnMora === 1 ? '' : 's'}` : ''}</span>
                                  <span className="font-mono-display font-semibold">{formatMoney(c.montoEnMora)}</span>
                                </div>
                              )}

                              {/* Moratorio pendiente */}
                              {c.diasMora > 0 && ruta?.configMoratorio?.tasaMoratorio > 0 && c.diasMora > (ruta.configMoratorio.diasGracia || 5) && (
                                <div className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-[8px]"
                                  style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', color: '#f59e0b' }}
                                >
                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Interes moratorio pendiente</span>
                                </div>
                              )}

                              {/* Pagos de hoy: metodo y hora */}
                              {c.pagosHoyDetalle?.length > 0 ? (
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                                    Cobros de hoy
                                  </p>
                                  <div className="space-y-1">
                                    {c.pagosHoyDetalle.map((pg, i) => {
                                      const d = pg.distanciaMetros
                                      let geoColor = 'var(--color-text-muted)'
                                      let geoLabel = null
                                      if (pg.clienteSinCoords) {
                                        geoLabel = 'sin ubicación de cliente'
                                      } else if (d != null) {
                                        geoColor = d <= 50 ? 'var(--color-success)' : d <= 200 ? '#f97316' : 'var(--color-danger)'
                                        geoLabel = `${d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`} del cliente`
                                      }
                                      return (
                                        <div key={i} className="flex items-center justify-between text-[12px]">
                                          <span style={{ color: 'var(--color-text-muted)' }}>
                                            {formatHora(pg.fechaPago)}
                                            {pg.metodoPago ? ` · ${metodoLabel[pg.metodoPago] || pg.metodoPago}` : ''}
                                            {geoLabel && <span style={{ color: geoColor }}> · {geoLabel}</span>}
                                            {pg.registradoTarde != null && (
                                              <span style={{ color: 'var(--color-warning)' }}>
                                                {' · registrado '}
                                                {pg.registradoTarde >= 60
                                                  ? `${Math.round(pg.registradoTarde / 60)}h`
                                                  : `${pg.registradoTarde}min`}
                                                {' después'}
                                              </span>
                                            )}
                                          </span>
                                          <span className="font-mono-display font-semibold" style={{ color: 'var(--color-success)' }}>
                                            {formatMoney(pg.monto)}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : (
                                c._clase !== 'completado' && c._clase !== 'sin_cobro' && (
                                  <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                                    Aun no se ha registrado un cobro hoy.
                                  </p>
                                )
                              )}

                              {/* Acciones rapidas */}
                              {c._clase !== 'completado' && (
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/clientes/${c.id}`)}
                                    className="flex-1 py-2 text-[12px] font-semibold rounded-[8px] transition-colors"
                                    style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                                  >
                                    Ver cliente
                                  </button>
                                  {c._clase !== 'pagaron' && (
                                    <button
                                      type="button"
                                      onClick={() => abrirPagoRapido(c)}
                                      className="flex-1 py-2 text-[12px] font-semibold rounded-[8px] transition-colors"
                                      style={{ background: 'var(--color-accent)', color: 'white' }}
                                    >
                                      Cobrar
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // MODO TRABAJO: 3 secciones (por cobrar hoy / pagaron hoy / proximos).
          const porCobrarHoy = []
          const yaPagaronHoy = []
          const proximosYAlDia = []
          for (const c of clientesFiltrados) {
            const pendiente = Boolean(c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado'))
            if (pendiente) porCobrarHoy.push(c)
            else if (c.pagoHoy) yaPagaronHoy.push(c)
            else proximosYAlDia.push(c)
          }

          const SectionHeader = ({ titulo, count, color }) => (
            <div className="flex items-center gap-2 mb-2 mt-1 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: color || 'var(--color-text-muted)' }}>
                {titulo}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
                {count}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
            </div>
          )

          return (
            <div className="space-y-5">
              {vistaPlana ? (
                <div className="space-y-1.5">
                  {clientesFiltrados.map((c, idx) => renderCard(c, idx, { conGrip: false }))}
                </div>
              ) : (
                <>
                  {/* Por cobrar hoy */}
                  {porCobrarHoy.length > 0 && (
                    <div>
                      <SectionHeader titulo="Por cobrar hoy" count={porCobrarHoy.length} color="var(--color-warning)" />
                      <div className="space-y-1.5">
                        {porCobrarHoy.map((c, i) => renderCard(c, i, { conGrip: false }))}
                      </div>
                    </div>
                  )}

                  {/* Ya pagaron hoy */}
                  {yaPagaronHoy.length > 0 && (
                    <div>
                      <SectionHeader titulo="Ya pagaron hoy" count={yaPagaronHoy.length} color="var(--color-success)" />
                      <div className="space-y-1.5">
                        {yaPagaronHoy.map((c, i) => renderCard(c, i, { conGrip: false }))}
                      </div>
                    </div>
                  )}

                  {/* Proximos y al dia (colapsable) */}
                  {proximosYAlDia.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setSeccionProximosAbierta(v => !v)}
                        className="w-full flex items-center gap-2 mb-2 mt-1 px-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"
                          style={{ color: 'var(--color-text-muted)', transform: seccionProximosAbierta ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                          Próximos y al día
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}>
                          {proximosYAlDia.length}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                      </button>
                      {seccionProximosAbierta && (
                        <div className="space-y-1.5">
                          {proximosYAlDia.map((c, i) => renderCard(c, i, { conGrip: false }))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* Cierre de caja */}
      <Card>
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
          Cierre de caja del día
        </p>
        {ruta.cierre ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Esperado</span>
              <span className="text-[var(--color-text-primary)] font-medium font-mono-display">{formatMoney(ruta.cierre.totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">Entregado</span>
              <span className="text-[var(--color-text-primary)] font-medium font-mono-display">{formatMoney(ruta.cierre.totalRecogido)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-2 mt-2">
              <span className="text-[var(--color-text-muted)]">Diferencia</span>
              <span className="font-mono-display" style={{ color: ruta.cierre.diferencia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatMoney(ruta.cierre.diferencia)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">No se ha registrado el cierre de hoy</p>
            <Button onClick={() => { setTotalRecogido(''); setModalCaja(true) }}>
              Registrar cierre de caja
            </Button>
          </div>
        )}
      </Card>

      {/* Historial de cobros */}
      <HistorialCobros rutaId={id} />

      {/* Hoja de cobro imprimible (oculta en pantalla, solo @media print) */}
      <HojaRutaImprimible ruta={ruta} clientes={ruta.clientes} />

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
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Todos los clientes ya tienen ruta asignada</p>
        ) : (
          <div className="space-y-1">
            {/* Buscador */}
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={buscarCliente}
                onChange={(e) => setBuscarCliente(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[#555] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                autoFocus
              />
            </div>
            {errorAsignar && (
              <div className="flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-xs rounded-[10px] px-3 py-2 mb-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {errorAsignar}
              </div>
            )}
            {clientesSinRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).length > 0 && (
              <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide px-1 pt-1">Sin ruta asignada ({clientesSinRuta.length})</p>
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
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,197,24,0.1)]' : 'hover:bg-[var(--color-bg-hover)]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[#f5c518]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{c.nombre}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">CC {c.cedula}</p>
                </div>
                {seleccionados.includes(c.id) && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                    <span className="text-[10px] text-[var(--color-text-muted)]">#</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Final"
                      value={posicionesNuevos[c.id] || ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setPosicionesNuevos(prev => ({ ...prev, [c.id]: v }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-14 h-7 text-center text-[11px] font-semibold tabular-nums rounded-[7px] border bg-[var(--color-bg-surface)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                      style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}
                      min={1}
                    />
                  </div>
                )}
              </label>
            ))}
            {clientesEnOtraRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).length > 0 && (
              <>
                <div className="border-t border-[var(--color-border)] my-2" />
                <p className="text-[10px] font-medium text-[var(--color-warning)] uppercase tracking-wide px-1">Ya en otra ruta ({clientesEnOtraRuta.length})</p>
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
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,158,11,0.1)]' : 'hover:bg-[var(--color-bg-hover)]',
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
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                    <span className="shrink-0 text-[10px] font-medium text-[var(--color-warning)] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] px-1.5 py-0.5 rounded-full">
                      En: {c.rutaNombre}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">CC {c.cedula}</p>
                </div>
                {seleccionados.includes(c.id) && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                    <span className="text-[10px] text-[var(--color-text-muted)]">#</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Final"
                      value={posicionesNuevos[c.id] || ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setPosicionesNuevos(prev => ({ ...prev, [c.id]: v }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-14 h-7 text-center text-[11px] font-semibold tabular-nums rounded-[7px] border bg-[var(--color-bg-surface)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                      style={{ color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}
                      min={1}
                    />
                  </div>
                )}
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
            <div className="text-[var(--color-danger)] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCaja}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">Total esperado hoy</span>
            <span className="font-semibold text-[var(--color-text-primary)] font-mono-display">{formatMoney(ruta.esperadoHoy)}</span>
          </div>
          <MoneyInput
            label="Dinero recogido (COP)"
            placeholder="Ej: 250.000"
            value={totalRecogido}
            onChange={(e) => setTotalRecogido(e.target.value)}
          />
          {totalRecogido && (
            <div className="text-sm">
              <span className="text-[var(--color-text-muted)]">Diferencia: </span>
              <span className="font-mono-display" style={{ color: Number(totalRecogido) >= ruta.esperadoHoy ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                {Number(totalRecogido) >= ruta.esperadoHoy ? '+' : ''}{formatMoney(Number(totalRecogido) - ruta.esperadoHoy)}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: inyectar/retirar capital de la ruta */}
      <Modal
        open={!!modalCapital}
        onClose={() => { setModalCapital(null); setErrorCapital(''); setCapitalAbsorber(false) }}
        title={modalCapital === 'inyeccion' ? 'Inyectar capital a la ruta' : 'Retirar capital de la ruta'}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setModalCapital(null); setErrorCapital(''); setCapitalAbsorber(false) }}>Cancelar</Button>
            <Button onClick={guardarCapitalRuta} loading={guardandoCapital}>
              {modalCapital === 'inyeccion' ? 'Inyectar' : 'Retirar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {errorCapital && (
            <div className="text-[var(--color-danger)] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCapital}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-text-muted)]">Saldo actual de la ruta</span>
            <span className="font-semibold font-mono-display" style={{ color: 'var(--color-info)' }}>{formatMoney(ruta.saldoCapital || 0)}</span>
          </div>
          <MoneyInput
            label="Monto (COP)"
            placeholder="Ej: 5.000.000"
            value={capitalMonto}
            onChange={(e) => setCapitalMonto(e.target.value)}
          />
          {/* Absorber: solo al inyectar si la ruta ya tiene cartera pendiente */}
          {modalCapital === 'inyeccion' && (ruta.carteraTotal || 0) > 0 && (
            <div className="rounded-[10px] border border-[var(--color-border)] p-3" style={{ background: 'var(--color-bg-card)' }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={capitalAbsorber} onChange={(e) => setCapitalAbsorber(e.target.checked)} className="mt-0.5 accent-[#6366f1]" />
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Esta ruta ya tiene {formatMoney(ruta.carteraTotal)} en préstamos por cobrar. Descontar lo pendiente de esta inyección.
                  {Number(capitalMonto) > 0 && (
                    <span className="block mt-1 text-[var(--color-text-muted)]">
                      Disponible quedaría: <span className="font-semibold" style={{ color: 'var(--color-info)' }}>{formatMoney(Math.max(0, Number(capitalMonto) - (ruta.carteraTotal || 0)))}</span>
                    </span>
                  )}
                </span>
              </label>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Descripción (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Capital para el mes"
              value={capitalDesc}
              onChange={(e) => setCapitalDesc(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
            />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
            Esto afecta el capital de esta ruta y también el saldo general de tu negocio.
          </p>
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
        <p className="text-sm text-[var(--color-text-muted)]">
          Se reordenarán los clientes según su ubicación GPS para crear la ruta mas corta. Esto puede cambiar el orden que configuraste manualmente.
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
              style={{ background: 'var(--color-danger)', color: 'var(--color-text-primary)' }}
            >
              Quitar
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-primary)] font-medium">{confirmQuitar?.nombre}</span> será removido de esta ruta. Podrás reasignarlo después.
        </p>
      </Modal>

      {/* Modal: elegir préstamo a cobrar (cuando el cliente tiene varios activos) */}
      <Modal
        open={!!modalSeleccionPrestamo}
        onClose={() => setModalSeleccionPrestamo(null)}
        title="Elegir préstamo para cobrar"
      >
        {modalSeleccionPrestamo && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-primary)] font-medium">{modalSeleccionPrestamo.clienteNombre}</span> tiene varios préstamos activos.
              Elige cuál quieres cobrar ahora.
            </p>
            <div className="space-y-2">
              {modalSeleccionPrestamo.prestamos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => irAPrestamoSeleccionado(p.id)}
                  className="w-full text-left px-3 py-3 rounded-[12px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(245,197,24,0.08)] hover:border-[rgba(245,197,24,0.3)] transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">Préstamo {i + 1}</p>
                    <span className="text-sm font-bold text-[var(--color-success)] font-mono-display">
                      {formatMoney(p.saldoPendiente ?? 0)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    {frecuenciaPrestamoLabel(p.frecuencia)} · Cuota {formatMoney(p.cuotaDiaria ?? 0)}
                    {p.diasMora > 0 ? ` · ${p.diasMora}d mora` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: cobro rápido — elegir método */}
      <Modal
        open={!!modalPagoRapido}
        onClose={() => setModalPagoRapido(null)}
        title="Cobro rápido"
      >
        {modalPagoRapido && !modalPagoRapido.prestamoActivo && Array.isArray(modalPagoRapido.prestamosActivos) && modalPagoRapido.prestamosActivos.length > 1 && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-primary)] font-medium">{modalPagoRapido.nombre}</span> tiene {modalPagoRapido.prestamosActivos.length} préstamos activos.
            </p>
            <div className="space-y-2">
              {modalPagoRapido.prestamosActivos.map((p, i) => {
                const modoLabel = ({ fijo: 'Clásico', solo_interes: 'Globo', lineal: 'Lineal', saldo: 'Sobre saldo', unico: 'Int. único', manual: 'Manual' })[p.modoInteres] || ''
                return (
                  <button
                    key={p.id}
                    onClick={() => elegirPrestamoPagoRapido(p.id, p.cuotaDiaria, p.modoInteres, { esBalloon: p.esBalloon, cuotaNumero: p.cuotaNumero })}
                    disabled={!p.cuotaDiaria || p.cuotaDiaria <= 0}
                    className="w-full text-left px-3 py-3 rounded-[12px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(34,197,94,0.08)] hover:border-[rgba(34,197,94,0.3)] transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {formatMoney(p.montoPrestado)}
                        </p>
                        {modoLabel && (
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                            {modoLabel}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-[var(--color-success)] font-mono-display shrink-0">
                        {formatMoney(p.cuotaDiaria ?? 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      {frecuenciaPrestamoLabel(p.frecuencia)} · Saldo {formatMoney(p.saldoPendiente ?? 0)}
                      {p.diasMora > 0 ? ` · ${p.diasMora}d mora` : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {modalPagoRapido && modalPagoRapido.prestamoActivo && (() => {
          const modo = modalPagoRapido.modoInteres
          const esEspecial = ['solo_interes', 'lineal'].includes(modo)
          const modoTag = ({ solo_interes: 'Globo', lineal: 'Lineal', saldo: 'Sobre saldo', unico: 'Int. único' })[modo]
          return (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-[var(--color-text-muted)]">Registrar pago para</p>
                <p className="text-base font-bold text-[var(--color-text-primary)] mt-1">{modalPagoRapido.nombre}</p>
                {modoTag && (
                  <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5"
                    style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
                    {modoTag}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">Monto a cobrar</label>
                <MoneyInput
                  value={String(modalPagoRapido.cuota || '')}
                  onChange={(e) => setModalPagoRapido(prev => prev ? { ...prev, cuota: Number(e.target.value) || 0 } : prev)}
                  placeholder="0"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Cuota: {formatMoney(modalPagoRapido.cuotaOriginal ?? modalPagoRapido.cuota)}
                  {esEspecial && !modalPagoRapido.esBalloon ? ' (interés del período)' : ''}
                  {modalPagoRapido.esBalloon ? ' (capital + interés)' : ''}
                </p>
              </div>
              {modalPagoRapido.esBalloon && (
                <div className="rounded-[12px] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-3 text-center">
                  <p className="text-xs text-[#ef4444] font-semibold">Cuota de capital + interés (globo)</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    Esta es la última cuota. Incluye la devolución del capital completo mas el interés del período.
                  </p>
                </div>
              )}
              {modalPagoRapido.cuotaNumero && esEspecial && (
                <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                  Cuota #{modalPagoRapido.cuotaNumero}
                </p>
              )}
              {modalPagoRapido.abonoConPendiente && (
                <div className="rounded-[12px] border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-3 text-center">
                  <p className="text-xs text-[var(--color-warning)] font-semibold">El cliente tiene cuotas atrasadas</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    Ya recibió un pago hoy, pero aún debe mas cuotas.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => ejecutarPagoRapido('efectivo')}
                  disabled={!modalPagoRapido.cuota || modalPagoRapido.cuota <= 0}
                  className="flex flex-col items-center gap-2 py-4 rounded-[14px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(34,197,94,0.08)] hover:border-[rgba(34,197,94,0.3)] transition-all active:scale-95 disabled:opacity-40"
                >
                  <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">Efectivo</span>
                </button>
                <button
                  onClick={() => ejecutarPagoRapido('transferencia')}
                  disabled={!modalPagoRapido.cuota || modalPagoRapido.cuota <= 0}
                  className="flex flex-col items-center gap-2 py-4 rounded-[14px] border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(59,130,246,0.08)] hover:border-[rgba(59,130,246,0.3)] transition-all active:scale-95 disabled:opacity-40"
                >
                  <svg className="w-6 h-6 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                  </svg>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">Transferencia</span>
                </button>
              </div>
              {esEspecial && (
                <button
                  onClick={() => {
                    setModalPagoRapido(null)
                    router.push(`/prestamos/${modalPagoRapido.prestamoActivo}`)
                  }}
                  className="w-full text-center text-[11px] font-medium py-2 rounded-[10px] transition-all"
                  style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-hover)' }}
                >
                  Abono a capital o intereses por separado
                </button>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Toast: deshacer pago */}
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] border border-[var(--color-success-border)] bg-[var(--color-bg-card)] sm:min-w-[320px]"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <svg className="w-4 h-4 text-[var(--color-success)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">Pago registrado — {undoPago.clienteNombre}</span>
            <button
              onClick={deshacerPago}
              className="text-sm font-bold text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors shrink-0"
            >
              Deshacer
            </button>
            <button
              onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }}
              className="text-[#666] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmEliminarRuta}
        title="Eliminar ruta"
        message={ruta ? `¿Eliminar la ruta "${ruta.nombre}"? Los clientes quedarán sin ruta asignada.` : ''}
        confirmLabel="Eliminar"
        confirmColor="red"
        onConfirm={_doEliminarRuta}
        onCancel={() => setConfirmEliminarRuta(false)}
      />

      {/* Modal: plantillas WhatsApp desde la ruta */}
      <ModalWhatsAppTemplates
        open={!!modalWA}
        onClose={() => setModalWA(null)}
        cliente={modalWA?.cliente}
        prestamo={modalWA?.prestamo}
        orgNombre={orgNombre}
      />
    </div>
  )
}
