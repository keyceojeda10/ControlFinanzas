'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { formatMoney } from '@/lib/i18n'
import { LoPuestoAqui, LoDeHoy } from '@/components/pantallas/DetalleRuta'
import { loPuestoAqui, loDeHoy, formatearKm, partirRecorrido, adaptarParadaActual } from '@/lib/adaptadores/ruta'
import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import dynamic                       from 'next/dynamic'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerRutaOffline, guardarOrdenPendiente, guardarPagoPendiente, guardarEnCache, leerDeCache } from '@/lib/offline'
import { obtenerCoordsRapido } from '@/lib/geo'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { Modal }                     from '@/components/ui/Modal'
import MoneyInput                    from '@/components/ui/MoneyInput'
import { SkeletonRutaDetalle }        from '@/components/ui/Skeleton'
import MonedaCF                      from '@/components/ui/MonedaCF'
import AiTipBanner                   from '@/components/ui/AiTipBanner'
import { generarTipRuta }            from '@/lib/tips/rutaTips'
import DiasSinCobroSelector          from '@/components/ui/DiasSinCobroSelector'
import { ConfirmModal }              from '@/components/ui/ConfirmModal'
import HojaRutaImprimible            from '@/components/rutas/HojaRutaImprimible'
import ModalWhatsAppTemplates        from '@/components/ui/ModalWhatsAppTemplates'
import MetodoPagoSelector            from '@/components/pagos/MetodoPagoSelector'
import AtajosCobro                   from '@/components/pantallas/AtajosCobro'
import ModoRuta                      from '@/components/pantallas/ModoRuta'
import { anotarReciente } from '@/lib/recientes'

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
        <span className="text-[11px] font-extrabold uppercase tracking-[.07em] text-[var(--cf-ink-3)]">Historial de cobros</span>
        <svg className={`w-4 h-4 text-[var(--cf-ink-3)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          {/* Filtro por rango de fechas (calendario nativo del dispositivo) */}
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] text-[var(--cf-ink-2)] uppercase tracking-wide mb-1">Desde</label>
              <div className="relative">
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="w-full h-9 px-2 pr-8 rounded-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[12px] text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-colors appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-date-and-time-value]:text-left"
                />
                {!desde && (
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[#555]">dd/mm/aaaa</span>
                )}
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[10px] text-[var(--cf-ink-2)] uppercase tracking-wide mb-1">Hasta</label>
              <div className="relative">
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="w-full h-9 px-2 pr-8 rounded-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[12px] text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-colors appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-date-and-time-value]:text-left"
                />
                {!hasta && (
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[#555]">dd/mm/aaaa</span>
                )}
                <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <button
              onClick={aplicarFiltro}
              disabled={loading}
              className="h-9 px-3 rounded-[12px] bg-[var(--cf-gold)] text-black text-[11px] font-semibold hover:bg-[#e0b014] transition-colors disabled:opacity-50"
            >
              Buscar
            </button>
            {(desde || hasta) && (
              <button
                onClick={limpiarFiltro}
                disabled={loading}
                className="h-9 px-3 rounded-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] text-[11px] font-medium hover:text-[var(--cf-ink)] transition-colors disabled:opacity-50"
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
            <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">No hay historial aún</p>
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
                        <p className="text-[13px] text-[var(--cf-ink)] font-medium capitalize">{formatFecha(dia.fecha)}</p>
                        <p className="text-[10px] text-[var(--cf-ink-2)] mt-0.5">
                          <span className="text-[var(--cf-green-dark)]">{cantPagaron} pagaron</span>
                          {cantNoPagaron > 0 && <span className="text-[var(--cf-red-dark)]"> · {cantNoPagaron} sin pagar</span>}
                        </p>
                      </div>
                      <p className="text-[14px] font-bold font-mono-display text-[var(--cf-green-dark)] shrink-0">
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
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'pagaron' ? 'text-[var(--cf-green-dark)] border-b-2 border-[var(--cf-green-dark)]' : 'text-[var(--cf-ink-3)]'}`}
                          >
                            Pagaron ({cantPagaron})
                          </button>
                          <button
                            onClick={() => setTab('noPagaron')}
                            className={`flex-1 text-[11px] font-semibold py-2 transition-colors ${tab === 'noPagaron' ? 'text-[var(--cf-red-dark)] border-b-2 border-[var(--cf-red-dark)]' : 'text-[var(--cf-ink-3)]'}`}
                          >
                            No pagaron ({cantNoPagaron})
                          </button>
                        </div>

                        {/* Contenido tab */}
                        <div className="px-3 py-2 max-h-[200px] overflow-y-auto">
                          {tab === 'pagaron' ? (
                            cantPagaron === 0 ? (
                              <p className="text-[11px] text-[var(--cf-ink-3)] text-center py-2">Nadie pagó este día</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.pagaron.map((c, i) => (
                                  <div key={i} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--cf-green-dark)] shrink-0" />
                                      <span className="text-[12px] text-[#ccc] truncate">{c.nombre}</span>
                                    </div>
                                    <span className="text-[12px] font-bold font-mono-display text-[var(--cf-ink)] shrink-0 ml-2">{formatMoney(c.monto)}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            cantNoPagaron === 0 ? (
                              <p className="text-[11px] text-[var(--cf-green-dark)] text-center py-2">Todos pagaron</p>
                            ) : (
                              <div className="space-y-1">
                                {dia.noPagaron.map((nombre, i) => (
                                  <div key={i} className="flex items-center gap-2 py-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cf-red-dark)] shrink-0" />
                                    <span className="text-[12px] text-[var(--cf-ink-2)]">{nombre}</span>
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
  const { esOwner, puedeGestionarRutas, puedeVerCapitalRuta, orgNombre, ocultarSaldoWA, organizationId } = useAuth()

    const { lastSyncedAt } = useOffline()

  const [ruta,          setRuta]          = useState(null)

  // Deja constancia para «Últimos que abriste» del buscador (T34-03). Se anota
  // AQUI y no en el armazón porque la ruta sola trae el id: el nombre y el
  // estado solo los sabe esta pantalla.
  useEffect(() => {
    if (!ruta?.nombre) return
    anotarReciente({ tipo: 'ruta', id: ruta.id, nombre: ruta.nombre })
  }, [ruta])

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
  const [cobradorUbi,    setCobradorUbi]    = useState(null)
  const [cobradorTrail,  setCobradorTrail]  = useState([])
  const [highlightId,    setHighlightId]    = useState(null)
  const [banner,         setBanner]         = useState(null)
  const [pagandoRapido,  setPagandoRapido]  = useState(null) // clienteId while paying
  const [pagoRapidoOk,   setPagoRapidoOk]   = useState(null) // clienteId after success
  const [modalPagoRapido, setModalPagoRapido] = useState(null)
  // Con QUE paga, elegido arriba y valido para todas las tarjetas de abajo.
  // Efectivo por defecto, que es como se cobra en la calle: si no se toca, el
  // cobro sale igual que antes.
  const [metodoRapido, setMetodoRapido] = useState({ metodoPago: 'efectivo', metodoPagoId: null }) // { id, nombre, cuota, prestamoActivo }
  const [modalSeleccionPrestamo, setModalSeleccionPrestamo] = useState(null) // { clienteId, clienteNombre, idxRuta, prestamos }
  const [undoPago,       setUndoPago]       = useState(null)  // { pagoId, prestamoId, clienteNombre, timer }
  const undoTimerRef = useRef(null)
  const [metodosPago,   setMetodosPago]   = useState([])
  const [modalWA,        setModalWA]        = useState(null) // { cliente, prestamo }
  const [modalDiasSC,    setModalDiasSC]    = useState(false)
  const [diasSCRuta,     setDiasSCRuta]     = useState([])
  const [guardandoDSC,   setGuardandoDSC]   = useState(false)
  const [festivoHoy,     setFestivoHoy]     = useState(null)
  const [guardandoFestivo, setGuardandoFestivo] = useState(false)
  const [grupoFiltro,    setGrupoFiltro]    = useState(null)
  const [estadoFiltro,   setEstadoFiltro]   = useState(null) // 'pendientes' | 'mora' | 'pagados' | null
  const [busquedaRuta,   setBusquedaRuta]   = useState('')
  // Vista de la lista: 'trabajo' = 3 secciones (por cobrar/pagados/proximos) sin drag.
  // 'ordenar' = lista plana con drag-and-drop para reordenar la ruta.
  const [modoVista, setModoVista] = useState('trabajo')
  // ── EL MODO RECORRIDO (T28-01) ──
  // NO EXISTIA EN LA APP, ni siquiera en version anterior: `ModoRuta` llevaba
  // construido y cotejado en el banco desde hace semanas y nadie lo veia. Es la
  // pantalla que el cobrador tiene delante toda la mañana — una parada a la
  // vez, con el siguiente ya preparado— y hasta hoy la jornada se hacia sobre
  // una lista de veinte nombres.
  const [enRecorrido, setEnRecorrido] = useState(false)
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

  /** «Ana Milena Guzman» → «AM». Dos letras, que es lo que cabe en el circulo. */
  const inicialesDe = (nombre = '') => {
    const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
    if (!partes.length) return '·'
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[1][0]).toUpperCase()
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

    try {
      const cached = await leerDeCache(`ruta:${id}`)
      if (cached) { setRuta(cached); setLoading(false) }
    } catch {}

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
      if (data.offline) throw new Error('offline')
      setRuta(data)
      guardarEnCache(`ruta:${id}`, data).catch(() => {})
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
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(setMetodosPago).catch(() => {})
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

  useEffect(() => {
    if (!ruta?.cobrador?.id || !esOwner) return
    const minsDesde = ruta.cobrador.ubicacionUpdatedAt
      ? (Date.now() - new Date(ruta.cobrador.ubicacionUpdatedAt).getTime()) / 60000
      : Infinity
    if (minsDesde < 10 && !showMap) setShowMap(true)
  }, [ruta?.cobrador?.id, ruta?.cobrador?.ubicacionUpdatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showMap || !ruta?.cobrador?.id) return
    setCobradorUbi({ latitud: ruta.cobrador.latitud, longitud: ruta.cobrador.longitud, ubicacionUpdatedAt: ruta.cobrador.ubicacionUpdatedAt, nombre: ruta.cobrador.nombre })
    async function fetchUbi() {
      try {
        const res = await fetch(`/api/ubicacion/${ruta.cobrador.id}`)
        if (res.ok) {
          const data = await res.json()
          setCobradorUbi(prev => ({ ...prev, ...data }))
          if (data.trail) setCobradorTrail(data.trail)
        }
      } catch {}
    }
    fetchUbi()
    const interval = setInterval(fetchUbi, 20_000)
    return () => clearInterval(interval)
  }, [showMap, ruta?.cobrador?.id])

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

    // ── SIEMPRE TODOS LOS PRESTAMOS ──
    // Habia dos caminos: con uno solo se preparaba el cobro directo, y con
    // varios se abria una lista para elegir. T15-02 los junta —cada prestamo es
    // una tarjeta con su cuota y sus tres botones— asi que el modal solo
    // necesita saber a quien se le cobra y que tiene abierto.
    //
    // `prestamoActivo` y `cuota` se quedan por compatibilidad: los usa el
    // reintento tras un duplicado (`ejecutarPagoRapido`), que reconstruye el
    // estado con un solo prestamo dentro.
    setModalPagoRapido({
      id: cliente.id,
      nombre: cliente.nombre,
      abonoConPendiente,
      prestamosActivos: activos,
      prestamoActivo: activos.length === 1 ? activos[0].id : null,
      cuota: activos.length === 1 ? (activos[0].cuotaDiaria || cliente.cuota) : null,
    })
  }

  const elegirPrestamoPagoRapido = (prestamoId, cuota, modoInteres, extra = {}) => {
    if (!modalPagoRapido) return
    if (!cuota || cuota <= 0) return
    setModalPagoRapido(prev => prev ? {
      ...prev, prestamoActivo: prestamoId, cuota, cuotaOriginal: cuota, modoInteres,
      esBalloon: extra.esBalloon || false, cuotaNumero: extra.cuotaNumero ?? null,
      diasMora: extra.diasMora || 0, cuotasEnMora: extra.cuotasEnMora || 0,
      montoEnMora: extra.montoEnMora || 0, montoAlDia: extra.montoAlDia || 0,
      saldoPendiente: extra.saldoPendiente || 0,
      cuotaExtraHoy: extra.cuotaExtraHoy || false,
      montoCuotaExtra: extra.montoCuotaExtra || 0,
    } : prev)
  }

  // `destino` permite cobrar un préstamo CONCRETO sin pasar antes por el estado.
  //
  // Hasta ahora esto solo sabía cobrar lo que hubiera en `modalPagoRapido`, y
  // por eso el modal tenía que ser de dos pasos: primero elegir el préstamo
  // —que era un `setState`— y solo después cobrar. En T15-02 los tres botones
  // están en la tarjeta de cada préstamo, así que pulsar «Cuota» tiene que
  // cobrar ESE préstamo ya; encadenarlo a un `setState` cobraría el anterior,
  // porque el estado nuevo no ha llegado todavía cuando la función lee.
  /**
   * «No pago» — la tercera salida de cada tarjeta en T15-02.
   *
   * Antes NO EXISTIA: la unica forma de cerrar la visita sin cobrar era cerrar
   * el modal, y eso no deja rastro de que se paso por ahi. El cliente aparecia
   * al dia siguiente igual de pendiente, sin saber si no se le visito o si se
   * le visito y no tenia.
   *
   * Se guarda como `VisitaReagendada`, que ya existe con sus cuatro motivos.
   * La fecha reagendada es MAÑANA: es lo que hace el cobrador de todas formas,
   * y dejarla vacia obligaria a pedir una fecha en la puerta.
   */
  const registrarNoPago = async (prestamoId, motivo) => {
    const hoy = new Date()
    const maniana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000)
    const cliente = modalPagoRapido
    setModalPagoRapido(null)
    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: cliente?.id,
          prestamoId,
          rutaId: ruta?.id,
          fechaOriginal: hoy.toISOString(),
          fechaReagendada: maniana.toISOString(),
          motivo,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || 'No se pudo anotar la visita')
        return
      }
      await fetchRuta()
    } catch {
      // Sin red no se pierde el gesto en silencio: se dice, porque el cobrador
      // acaba de decidir algo sobre este cliente y tiene que saber si quedo.
      alert('Sin conexión: la visita no quedó anotada. Vuelve a intentarlo.')
    }
  }

  const ejecutarPagoRapido = async (metodoPago, { confirmarDuplicado = false, metodoPagoId = null, destino = null } = {}) => {
    const objetivo = destino ?? modalPagoRapido
    if (!objetivo || pagandoRapido) return
    const { id: clienteId, nombre, cuota, cuotaOriginal, prestamoActivo } = objetivo
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
        ? { montoPagado: cuota, tipo: 'completo', diasAbonados: 1, metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), ...(coords ?? {}) }
        : { montoPagado: cuota, tipo: 'parcial', metodoPago, ...(metodoPagoId ? { metodoPagoId } : {}), ...(coords ?? {}) }
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
            return ejecutarPagoRapido(metodoPago, { confirmarDuplicado: true, metodoPagoId })
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
      try {
        await guardarPagoPendiente({
          prestamoId: prestamoActivo,
          montoPagado: cuota,
          tipo: esCuotaExacta ? 'completo' : 'parcial',
          diasAbonados: esCuotaExacta ? 1 : undefined,
          metodoPago,
          ...(metodoPagoId ? { metodoPagoId } : {}),
          clienteNombre: nombre,
          ...(coords ?? {}),
        })
        setPagoRapidoOk(clienteId)
        setTimeout(() => setPagoRapidoOk(null), 1200)
      } catch {
        alert('No se pudo guardar el pago. Intenta de nuevo.')
        setRuta(prev => prev ? {
          ...prev,
          clientes: prev.clientes.map(c => c.id === clienteId ? { ...c, pagoHoy: false, cobroPendienteHoy: true } : c)
        } : prev)
      }
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
        clone.style.background = 'var(--cf-card)'
        clone.style.border = '1px solid var(--cf-gold)'
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
    if (busquedaRuta.trim()) {
      const q = busquedaRuta.trim().toLowerCase()
      list = list.filter(c => c.nombre?.toLowerCase().includes(q) || c.cedula?.toLowerCase().includes(q))
    }
    return list
  })()

  const clientesConCoords = ruta?.clientes?.filter((c) => c.latitud != null && c.longitud != null).length ?? 0

  if (loading) return <SkeletonRutaDetalle />

  if (error || !ruta) return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto">
      <div className="mb-4"><MonedaCF pose="busca" size={100} /></div>
      <p className="text-sm font-medium text-[var(--cf-ink)]">No pudimos cargar la ruta</p>
      <p className="text-xs text-[var(--cf-ink-3)] mt-1">Revisa tu conexión e intenta de nuevo</p>
      <div className="flex gap-3 mt-4">
        <Button size="sm" onClick={() => fetchRuta()}>Reintentar</Button>
        <Button size="sm" variant="ghost" onClick={() => router.back()}>Volver</Button>
      </div>
    </div>
  )

    // ── LAS PARADAS, EN EL ORDEN DEL RECORRIDO ──
  // `partirRecorrido` reparte en actual / faltan / cobrados y calcula «parada 3
  // de 5». Se le dan los clientes de HOY, no todos: en la calle no se camina
  // hacia quien no toca.
  const paradasDeHoy = (ruta?.clientes ?? [])
    .filter((c) => c.cobroPendienteHoy || c.pagoHoy)
    .map((c, i) => ({
      id: c.id,
      orden: i + 1,
      nombre: c.nombre,
      direccion: c.direccion,
      telefono: c.telefono,
      diasMora: c.diasMora,
      // `cobradoHoy` es como lo llama el adaptador; la API lo llama `pagoHoy`.
      cobradoHoy: !!c.pagoHoy,
      montoACobrar: c.cuota,
      montoCobrado: c.montoPagadoHoy,
      debe: c.saldoPendiente,
      metros: c.distanciaMetros,
    }))

  const recorrido = partirRecorrido(paradasDeHoy, (n) => formatMoney(n))

  if (enRecorrido) {
    // SIN ARMAZON Y SIN NADA MAS. La lamina la dibuja a pantalla completa: el
    // cobrador esta de pie, con una mano, y cualquier cosa de mas es un toque
    // equivocado. Por eso se devuelve AQUI y no envuelto en el resto.
    return (
      <ModoRuta
        ruta={ruta?.nombre}
        posicion={recorrido.posicion}
        onAtras={() => setEnRecorrido(false)}
        hoy={loDeHoy({
          esperadoHoy: ruta?.esperadoHoy,
          recaudadoHoy: ruta?.recaudadoHoy,
          clientesConCobroHoy: ruta?.clientesConCobroHoy,
          clientesPagaronHoy: ruta?.clientesPagaronHoy,
          recaudadoEfectivoHoy: ruta?.recaudadoEfectivoHoy,
          recaudadoDigitalHoy: ruta?.recaudadoDigitalHoy,
        }, (n) => formatMoney(n))}
        actual={recorrido.actual ? adaptarParadaActual(recorrido.actual, (n) => formatMoney(n)) : null}
        faltan={recorrido.faltan}
        cobrados={recorrido.cobrados}
        cobradosTitulo={recorrido.cobradosTitulo}
        cobradosTotal={recorrido.cobradosTotal}
        onCobrar={() => {
          // El cobro es EL MISMO de la lista: la hoja de atajos, con su cola
          // offline y su deshacer. No hay un segundo camino para la plata.
          const c = ruta?.clientes?.find((x) => x.id === recorrido.actual?.id)
          if (c) abrirPagoRapido(c)
        }}
        onAvisar={() => {
          const c = ruta?.clientes?.find((x) => x.id === recorrido.actual?.id)
          if (c?.telefono) window.open(`https://wa.me/${String(c.telefono).replace(/\D/g, '')}`, '_blank')
        }}
        onParada={(pa) => {
          const c = ruta?.clientes?.find((x) => x.id === pa?.id)
          if (c) abrirPagoRapido(c)
        }}
      />
    )
  }

  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4 pb-28 lg:pb-4">

      {/* -- T24 - Lo que tienes puesto aqui, y lo de hoy --
          Sustituye al heroe con donut de cinco colores segun el ritmo y a las
          tres tarjetas de metricas que venian debajo. Eran CUATRO TARJETAS
          GRANDES antes de llegar a la lista de clientes, que es a lo que se
          entra.

          Dos preguntas, dos bloques, y no se mezclan:

            - EL CARBON es la ruta como inversion: cuanta plata tienes metida
              aqui y cuanta esperas ganar. No cambia de un dia para otro.
            - EL BLANCO es hoy: lo recaudado contra lo que falta. Cambia con
              cada cobro.

          El donut se va. Un anillo de colores con un porcentaje dentro cuenta lo
          mismo que una barra, y peor: el color pasaba de verde a naranja a rojo
          segun el ritmo, asi que el mismo 60% se leia como bueno o como malo
          segun la hora del dia.

          El nombre de la ruta y su edicion se quedan, encima. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {editandoNombre ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
              className="flex-1 h-10 px-3 rounded-[12px] text-sm focus:outline-none"
              style={{
                background: 'var(--cf-card)', border: '1.5px solid var(--cf-gold)',
                color: 'var(--cf-ink)',
              }}
              autoFocus
            />
            <button onClick={guardarNombre} className="p-1" style={{ color: 'var(--cf-green-dark)' }} aria-label="Guardar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </button>
            <button onClick={() => setEditandoNombre(false)} className="p-1" style={{ color: 'var(--cf-ink-3)' }} aria-label="Cancelar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{ruta.nombre}</span>
              {/* QUIEN Y CUANTOS, no una pastilla de estado de colores. «Buen
                  ritmo» a las nueve de la maniana no significa nada. */}
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                {[
                  ruta.cobrador?.nombre ?? 'sin cobrador',
                  `${ruta.clientes?.length ?? 0} ${(ruta.clientes?.length ?? 0) === 1 ? 'cliente' : 'clientes'}`,
                  // ── «3,4 km» (T27-02) ──
                  // Lo que se camina hoy. Es lo que decide si la ruta cabe en
                  // una mañana, y no estaba en ninguna pantalla.
                  //
                  // Solo sale si de verdad se pudo medir: la API devuelve `null`
                  // cuando hay menos de dos clientes con coordenadas, y ahí es
                  // mejor no decir nada que decir «0 km» — que se leería como
                  // que están todos en el mismo portal.
                  ruta.distanciaMetros != null ? formatearKm(ruta.distanciaMetros) : null,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
            {esOwner && (
              <button
                onClick={() => { setNuevoNombre(ruta.nombre); setEditandoNombre(true) }}
                className="shrink-0 p-1"
                style={{ color: 'var(--cf-ink-3)' }}
                aria-label="Cambiar el nombre"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            )}
          </>
        )}
      </div>

      {(esOwner || puedeVerCapitalRuta) && (
        <LoPuestoAqui {...loPuestoAqui({
          carteraTotal: ruta.carteraTotal,
          capitalPendiente: ruta.capitalPendiente,
          capitalTotal: ruta.capitalTotal,
          totalAPagarRuta: ruta.totalAPagarRuta,
          clientes: ruta.clientes,
        }, (n) => formatMoney(n))} />
      )}

      <LoDeHoy {...loDeHoy({
        esperadoHoy: ruta.esperadoHoy,
        recaudadoHoy: ruta.recaudadoHoy,
        clientesConCobroHoy: ruta.clientesConCobroHoy,
        clientesPagaronHoy: ruta.clientesPagaronHoy,
        // ── «efectivo $34.500 · digital $0» (T27-02) ──
        // La API los calcula y los devuelve, y `loDeHoy` sabe pintarlos desde
        // que se escribió. Solo faltaba pasárselos: la banda decía «0 de 1
        // cobros» a secas.
        //
        // Y es lo que el pie de la lámina llama esencial: «la banda de hoy suma
        // efectivo y digital, que es lo que hace posible cuadrar la caja de la
        // noche». Sin el desglose, el cobrador entrega un fajo y nadie sabe
        // cuánto de lo recaudado entró por transferencia y NO tiene que venir
        // en ese fajo.
        recaudadoEfectivoHoy: ruta.recaudadoEfectivoHoy,
        recaudadoDigitalHoy: ruta.recaudadoDigitalHoy,
      }, (n) => formatMoney(n))} />

      {/* Acciones rápidas.
          "Hoja para salir a cobrar" estaba de quinta en esta fila con scroll
          horizontal y nacia fuera de pantalla en un movil de 390px. Se subio
          para que se vea sin arrastrar — pero NO va primera ni en dorado: eso
          le robaba el primer lugar a "+ Agregar", que es lo que de verdad usa
          a diario quien administra rutas con cobradores. Un cliente lo
          reporto. Visible != protagonista. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {puedeGestionarRutas && (
          <button onClick={abrirModalClientes} className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform">
            + Agregar
          </button>
        )}
        {(ruta.clientes?.length ?? 0) > 0 && (
          <button onClick={() => window.print()} className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7m-12 0h12m-12 0a2 2 0 00-2 2v5a2 2 0 002 2h1m11-9a2 2 0 012 2v5a2 2 0 01-2 2h-1m-10 0v4h8v-4m-8 0h8" />
            </svg>
            Imprimir hoja
          </button>
        )}
        {(ruta.clientes?.length ?? 0) >= 2 && clientesConCoords >= 2 && (
          <button onClick={() => setConfirmOptimizar(true)} disabled={optimizando} className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform disabled:opacity-50">
            {optimizando ? 'Optimizando...' : 'Optimizar'}
          </button>
        )}
        {clientesConCoords >= 2 && (
          <>
            <button onClick={abrirGoogleMaps} className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[rgba(66,133,244,0.2)] bg-[rgba(66,133,244,0.06)] text-[11px] text-[#4285f4] font-medium active:scale-95 transition-transform">
              Google Maps
            </button>
            <button onClick={() => setShowMap((v) => !v)} className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform">
              {showMap ? 'Ocultar mapa' : 'Ver mapa'}
            </button>
          </>
        )}
        {/* La ruta era un callejon: se entraba y no habia forma de saltar a su
            cartera. Ahora que los filtros viven en la URL, estos dos links
            existen. Un grep de "?rutaId=" en el repo daba cero resultados. */}
        <Link
          href={`/prestamos?rutaId=${ruta.id}`}
          className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Préstamos de esta ruta
        </Link>
        <Link
          href={`/clientes?rutaId=${ruta.id}`}
          className="shrink-0 h-10 px-3.5 rounded-[12px] border border-[#222] bg-[var(--cf-card)] text-[11px] text-[var(--cf-ink-2)] font-medium active:scale-95 transition-transform inline-flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          Clientes de esta ruta
        </Link>
      </div>

      {/* Resultado de optimización */}
      {optimResult && (
        <div className="px-3 py-2 rounded-[12px] bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.12)]">
          <p className="text-xs text-[var(--cf-green-dark)] font-medium">
            Ruta optimizada {optimResult.ahorro > 0 && `· ${optimResult.ahorro}% mas corta`}
          </p>
        </div>
      )}

      {/* Mini-mapa */}
      {showMap && ruta.clientes && (
        <div className="rounded-[12px] overflow-hidden border border-[#222]">
          <RouteMap clientes={ruta.clientes} cobrosGeoHoy={ruta.cobrosGeoHoy ?? []} cobrador={cobradorUbi} trail={cobradorTrail} />
        </div>
      )}

      {/* Lista de clientes */}
      <div>
        <div className="flex items-center justify-between mb-2 sticky top-0 z-10 bg-[var(--cf-surface)] py-2 -mx-1 px-1">
          <span className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-wide">
            Clientes ({clientesFiltrados.length}{grupoFiltro ? ` de ${ruta.clientes?.length ?? 0}` : ''})
          </span>
          <span className="text-[10px] text-[#777]">
            {guardandoOrden && <span className="text-[var(--cf-ink-3)] flex items-center gap-1 inline-flex"><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Guardando</span>}
            {ordenGuardado && <span className="text-[var(--cf-green-dark)]">Guardado</span>}
            {ordenOffline && <span className="text-[var(--cf-gold)]">Guardado offline</span>}
            {ordenError && <span className="text-[var(--cf-red-dark)]">{ordenError}</span>}
          </span>
        </div>

        {/* Buscador de clientes */}
        {(ruta.clientes?.length ?? 0) > 5 && (
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--cf-ink-3)] pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={busquedaRuta}
              onChange={(e) => setBusquedaRuta(e.target.value)}
              placeholder="Buscar cliente por nombre o cédula..."
              className="w-full h-9 pl-9 pr-8 rounded-[12px] text-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] placeholder:text-[var(--cf-ink-3)] focus:outline-none focus:border-[var(--cf-gold)] transition-colors"
            />
            {busquedaRuta && (
              <button
                onClick={() => setBusquedaRuta('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Chips de filtro por grupo */}
        {ruta.gruposCobro?.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-2">
            <button
              onClick={() => setGrupoFiltro(null)}
              className={`shrink-0 h-9 px-3.5 rounded-full text-[11px] font-medium transition-all ${!grupoFiltro ? 'bg-white text-black' : 'bg-[var(--cf-surface)] text-[var(--cf-ink-3)] border border-[var(--cf-border)]'}`}
            >
              Todos
            </button>
            {ruta.gruposCobro.map(g => (
              <button
                key={g.id}
                onClick={() => setGrupoFiltro(grupoFiltro === g.id ? null : g.id)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${grupoFiltro === g.id ? 'bg-white text-black' : 'bg-[var(--cf-surface)] text-[var(--cf-ink-3)] border border-[var(--cf-border)]'}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color || 'var(--cf-ink-2)' }} />
                {g.nombre}
                <span className="text-[9px] opacity-60">{g._count?.clientes ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* Toggle de vista: Trabajo del dia (3 secciones) vs Ordenar ruta (drag) vs Auditoria (admin) */}
        {ruta.clientes?.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1 p-1 rounded-[12px] flex-1 min-w-0" style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
              {[
                { key: 'trabajo', label: 'Cobros' },
                { key: 'ordenar', label: 'Ordenar' },
                ...(puedeGestionarRutas ? [{ key: 'auditoria', label: 'Auditoría' }] : []),
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setModoVista(t.key)}
                  className="flex-1 py-2 text-xs font-semibold rounded-[8px] transition-all"
                  style={modoVista === t.key
                    ? { background: 'var(--cf-card)', color: 'var(--cf-ink)', boxShadow: '0 1px 3px rgba(20,20,28,.10)' }
                    : { color: 'var(--cf-ink-3)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {modoVista === 'trabajo' && (
              <div className="flex rounded-[12px] border border-[var(--cf-border)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setVistaPlana(v => { if (v) return v; try { localStorage.setItem('cf-ruta-vistaPlana', 'plana') } catch {} return true })}
                  className="p-1.5 transition-colors"
                  title="Lista completa"
                  style={{
                    background: vistaPlana ? 'var(--cf-fill-2)' : 'transparent',
                    color: vistaPlana ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
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
                    background: !vistaPlana ? 'var(--cf-fill-2)' : 'transparent',
                    color: !vistaPlana ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
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
              <svg className="w-6 h-6 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--cf-ink-2)]">Sin clientes asignados</p>
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
                ? (c.tieneClavo ? 'var(--cf-red-dark)' : '#666')
                : abonoConPendiente
                  ? 'var(--cf-gold-dark)'
                  : c.pagoHoy
                  ? 'var(--cf-green-dark)'
                  : c.hoySinCobro && !pendienteHoy
                    ? 'var(--cf-gold-dark)'
                    : pendienteHoy
                      ? 'var(--cf-gold-dark)'
                      : 'var(--cf-green-dark)'
              const statusText = isCompleted
                ? (c.tieneClavo ? 'Préstamo perdido' : 'Sin deuda — se puede retirar')
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
                    'flex items-stretch gap-0 rounded-[12px] transition-all overflow-hidden',
                    'border',
                    isCompleted && !c.tieneClavo ? 'opacity-50' : '',
                    dragIndex === idx ? 'opacity-30 scale-95' : '',
                    dragOverIdx === idx && dragIndex !== idx ? 'border-[var(--cf-gold)] bg-[rgba(245,197,24,0.05)]' : 'border-[#1f1f1f] bg-[rgba(255,255,255,0.02)]',
                    highlightId === c.id ? 'border-[var(--cf-gold)] bg-[rgba(245,197,24,0.08)]' : '',
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
                        focus:bg-[var(--cf-card)] focus:border-[var(--cf-gold)] focus:cursor-text focus:outline-none transition-colors"
                      style={{ color: 'var(--cf-ink-3)', borderColor: 'var(--cf-border)' }}
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
                          color: 'var(--cf-ink)',
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
                        <p className="text-[14px] font-bold text-[var(--cf-ink)] leading-snug">{c.nombre}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {c.tieneClavo && (
                            <span
                              className="shrink-0 text-[8px] font-extrabold uppercase tracking-[.07em] px-1.5 py-0.5 rounded-md"
                              style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}
                            >Clavo</span>
                          )}
                          {c.grupoCobro && !grupoFiltro && (
                            <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: c.grupoCobro.color || 'var(--cf-ink-2)' }} title={c.grupoCobro.nombre} />
                          )}
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor, boxShadow: `0 0 5px ${statusColor}50` }} />
                          <span className="text-[10px]" style={{ color: statusColor }}>{statusText}</span>
                          {c.frecuencia && c.frecuencia !== 'diario' && !isCompleted && (
                            <span className="text-[10px] ml-1" style={{ color: c.diasParaCobro < 0 ? 'var(--cf-red-dark)' : c.diasParaCobro === 0 ? 'var(--cf-green-dark)' : c.diasParaCobro === 1 ? 'var(--cf-gold)' : '#666' }}>
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
                              <p className="text-[13px] font-bold text-[var(--cf-ink)] font-mono-display leading-none">{formatMoney(c.cuota)}</p>
                              <p className="text-[9px] text-[#777] leading-none">/{c.frecuencia === 'semanal' ? 'sem' : c.frecuencia === 'quincenal' ? 'qna' : c.frecuencia === 'mensual' ? 'mes' : 'dia'}</p>
                            </div>
                          )}
                          {c.telefono && (
                            <a
                              href={`tel:${c.telefono}`}
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all active:scale-90"
                              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)' }}
                              title="Llamar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="var(--cf-ink-2)" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </a>
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
                              className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all active:scale-90"
                              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)' }}
                              title="Enviar WhatsApp"
                            >
                              <svg className="w-3.5 h-3.5" fill="#25D366" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                            </button>
                          )}
                          {c.latitud != null && c.longitud != null && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitud},${c.longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-all active:scale-90"
                              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)' }}
                              title="Cómo llegar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="var(--cf-ink-2)" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                              </svg>
                            </a>
                          )}
                        </div>

                        {/* New loan button — shown for clients without active loans */}
                        {isCompleted && !c.tieneClavo && puedeGestionarRutas && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/prestamos/nuevo?clienteId=${c.id}`) }}
                            className="h-8 rounded-[12px] flex items-center justify-center shrink-0 transition-all active:scale-95 px-3 gap-1.5 bg-[rgba(245,197,24,0.10)] border border-[rgba(245,197,24,0.25)] hover:bg-[rgba(245,197,24,0.20)]"
                          >
                            <svg className="w-3 h-3 shrink-0 text-[var(--cf-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span className="text-[11px] font-bold whitespace-nowrap text-[var(--cf-gold)]">Prestar</span>
                          </button>
                        )}

                        {/* Quick pay button */}
                        {(!isCompleted || c.tieneClavo) && c.cuota > 0 && c.prestamoActivo && (!c.pagoHoy || pendienteHoy) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirPagoRapido(c) }}
                            disabled={pagandoRapido === c.id}
                            title={abonoConPendiente ? 'El cliente aun tiene cuotas atrasadas pendientes' : 'Registrar cobro del día'}
                            className="h-9 rounded-[11px] flex items-center justify-center shrink-0 transition-all active:scale-95 px-3.5 gap-1.5"
                            style={{
                              // COBRAR ES LA ACCION DE LA PANTALLA: va solida.
                              // Antes era una pastilla translucida con el texto
                              // del mismo verde que el fondo — la accion mas
                              // importante de la ruta se leia como una etiqueta.
                              //
                              // El ambar avisa de que el cliente arrastra cuotas:
                              // no bloquea el cobro, pero no deja que se pulse en
                              // automatico.
                              background: abonoConPendiente ? 'var(--cf-gold)' : 'var(--cf-green)',
                              color: abonoConPendiente ? 'var(--cf-gold-ink)' : '#FFF',
                              border: 0,
                            }}
                          >
                            {pagandoRapido === c.id ? (
                              <svg className="w-3.5 h-3.5 text-[var(--cf-green-dark)] animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : pagoRapidoOk === c.id ? (
                              <svg className="w-3.5 h-3.5 text-[var(--cf-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <>
                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor"
                                  viewBox="0 0 24 24" strokeWidth={2.2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                                </svg>
                                <span className="text-[12px] font-bold whitespace-nowrap">Cobrar</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sección inferior: saldo, barra progreso, mora, detalles */}
                    {(!isCompleted || c.tieneClavo) && c.prestamosActivos?.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {c.prestamosActivos.map((p, i) => {
                          const pct = p.totalAPagar > 0 ? Math.min(100, Math.round(((p.totalPagado ?? 0) / p.totalAPagar) * 100)) : 0
                          const barColor = tieneMora ? 'var(--cf-red-dark)' : pct >= 80 ? 'var(--cf-green-dark)' : 'var(--cf-gold)'
                          return (
                            <div key={p.id}>
                              {c.prestamosActivos.length > 1 && (
                                <p className="text-[9px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-3)' }}>
                                  Prestamo {i + 1}
                                </p>
                              )}
                              <div className="flex items-baseline justify-between">
                                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Saldo pendiente</p>
                                <p className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(p.saldoPendiente)}</p>
                              </div>
                              <div className="mt-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-semibold" style={{ color: barColor }}>{pct}% pagado</span>
                                  {pct >= 80 && pct < 100 && !tieneMora && (
                                    <span className="text-[8px] font-bold uppercase px-1 py-px rounded" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)', color: 'var(--cf-green-dark)' }}>
                                      Renovar
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>de {formatMoney(p.totalAPagar)}</span>
                              </div>
                            </div>
                          )
                        })}

                        {/* Grid: pagado / cuota / prox cobro */}
                        <div className="grid grid-cols-3 gap-px rounded-[8px] overflow-hidden" style={{ background: 'var(--cf-border)' }}>
                          <div className="px-2 py-1.5" style={{ background: 'var(--cf-surface)' }}>
                            <p className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>Pagado</p>
                            <p className="text-[11px] font-bold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>
                              {formatMoney(c.prestamosActivos.reduce((s, p) => s + (p.totalPagado ?? 0), 0))}
                            </p>
                          </div>
                          <div className="px-2 py-1.5" style={{ background: 'var(--cf-surface)' }}>
                            <p className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>Cuota</p>
                            <p className="text-[11px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                              {formatMoney(c.cuota)}
                            </p>
                          </div>
                          <div className="px-2 py-1.5" style={{ background: 'var(--cf-surface)' }}>
                            <p className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>Prox. cobro</p>
                            <p className="text-[11px] font-bold capitalize" style={{ color: tieneMora ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}>
                              {cobroLabelContextual || '—'}
                            </p>
                          </div>
                        </div>

                        {/* Mora badge */}
                        {tieneMora && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[10px] font-semibold"
                            style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)', color: 'var(--cf-red-dark)' }}
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                            </svg>
                            <span className="capitalize">{detalleMora}</span>
                          </div>
                        )}

                        {/* Moratorio pendiente */}
                        {tieneMora && ruta?.configMoratorio?.tasaMoratorio > 0 && c.diasMora > (ruta.configMoratorio.diasGracia || 5) && (
                          <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-[6px]"
                            style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, transparent)', color: 'var(--cf-gold-dark)' }}
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Interés moratorio pendiente</span>
                          </div>
                        )}

                        {/* Cuota extra programada */}
                        {c.cuotaExtraHoy && (
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-[6px]"
                            style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 12%, transparent)', color: 'var(--cf-ink-2)' }}
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span className="font-mono-display">Cuota extra: {formatMoney(c.montoCuotaExtra)}</span>
                          </div>
                        )}

                        {/* Geo badge */}
                        {c.pagoHoy && (() => {
                          const geo = c.pagoHoyGeo
                          if (!geo) return (
                            <div className="flex items-center gap-1 text-[9px]" style={{ color: '#555' }}>
                              <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                              sin geolocalización
                            </div>
                          )
                          if (geo.clienteSinCoords || geo.distanciaMetros == null) return (
                            <div className="flex items-center gap-1 text-[9px]" style={{ color: '#555' }}>
                              <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                              cliente sin ubicación fijada
                            </div>
                          )
                          const d = geo.distanciaMetros
                          const geoColor = d <= 50 ? 'var(--cf-green-dark)' : d <= 200 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)'
                          return (
                            <div className="flex items-center gap-1 text-[9px] font-medium" style={{ color: geoColor }}>
                              <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                              a {d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Remove button (owner o cobrador con permiso) — solo en modo ordenar */}
                  {puedeGestionarRutas && conGrip && (
                    <button
                      onClick={() => setConfirmQuitar({ id: c.id, nombre: c.nombre })}
                      disabled={quitando === c.id}
                      className="pr-2 pl-0 self-stretch flex items-center text-[var(--cf-ink-2)] hover:text-[var(--cf-red-dark)] transition-colors disabled:opacity-50"
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
                <div className="rounded-[12px] p-3" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
                      Resumen del día
                    </p>
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink-3)' }}>
                      {pctCobradoHoy}%
                    </p>
                  </div>
                  {/* Barra de progreso cobrado/esperado */}
                  <div className="h-1.5 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--cf-fill)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${pctCobradoHoy}%`,
                      background: pctCobradoHoy >= 100 ? 'var(--cf-green-dark)' : 'var(--cf-gold)',
                    }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Cobrado hoy</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                        {formatMoney(ruta.recaudadoHoy)}
                        <span className="text-[11px] font-normal" style={{ color: 'var(--cf-ink-3)' }}> / {formatMoney(ruta.esperadoHoy)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Pagaron / esperados</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                        {ruta.clientesPagaronHoy} / {ruta.clientesConCobroHoy}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Pendientes hoy</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: ruta.pendientesHoy > 0 ? 'var(--cf-gold-dark)' : 'var(--cf-ink)' }}>
                        {ruta.pendientesHoy}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Clientes en mora</p>
                      <p className="text-[14px] font-bold font-mono-display" style={{ color: ruta.enMora > 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}>
                        {ruta.enMora}
                      </p>
                    </div>
                  </div>

                  {/* Cuadre de caja del cobrador, si ya cerro hoy */}
                  {ruta.cierre && (
                    <div className="mt-2.5 pt-2.5 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid var(--cf-border)' }}>
                      <span className="font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                        Cierre del cobrador: {formatMoney(ruta.cierre.totalRecogido)}
                        {ruta.cierre.confirmadoEn ? ' · confirmado' : ' · sin confirmar'}
                      </span>
                      {Math.abs(ruta.cierre.diferencia) > 0 && (
                        <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-red-dark)' }}>
                          {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatMoney(ruta.cierre.diferencia)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actividad sospechosa: pagos editados/anulados o prestamos modificados hoy */}
                  {ruta.actividadHoy?.length > 0 && (
                    <div className="mt-2.5 pt-2.5 space-y-1" style={{ borderTop: '1px solid var(--cf-border)' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-red-dark)' }}>
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
                          <div key={a.id} className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                            <span style={{ color: 'var(--cf-red-dark)' }}>{labelMap[a.accion] || a.accion}</span>
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
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                  <input
                    type="text"
                    value={auditoriaBusqueda}
                    onChange={(e) => setAuditoriaBusqueda(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-[12px] outline-none"
                    style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
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
                        ? { background: 'var(--cf-gold)', color: 'white' }
                        : { background: 'var(--cf-fill)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }}
                    >
                      {f.label}
                      <span className="px-1.5 py-px rounded-full text-[10px] font-bold"
                        style={auditoriaFiltro === f.key
                          ? { background: 'rgba(255,255,255,0.25)' }
                          : { background: 'var(--cf-card)' }}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Lista compacta */}
                {lista.length === 0 ? (
                  <div className="text-center py-10 text-sm" style={{ color: 'var(--cf-ink-3)' }}>
                    No hay clientes que coincidan
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {lista.map((c) => {
                      const auditNumPos = (ruta.clientes ?? []).findIndex(x => x.id === c.id) + 1
                      const expandido = auditoriaExpandido === c.id
                      const cfg = {
                        pagaron:    { color: 'var(--cf-green-dark)', label: 'Pagó hoy', icon: '✓' },
                        parcial:    { color: 'var(--cf-gold-dark)', label: 'Abono parcial', icon: '½' },
                        pendientes: { color: 'var(--cf-red-dark)',  label: 'Pendiente', icon: '!' },
                        completado: { color: 'var(--cf-ink-3)', label: 'Completado', icon: '✓' },
                        sin_cobro:  { color: 'var(--cf-ink-3)', label: 'Sin cobro hoy', icon: '–' },
                      }[c._clase]

                      return (
                        <div key={c.id} className="rounded-[12px] overflow-hidden transition-all"
                          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderLeft: `3px solid ${cfg.color}` }}
                        >
                          <button
                            type="button"
                            onClick={() => setAuditoriaExpandido(expandido ? null : c.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                          >
                            {/* Numero de posicion */}
                            {auditNumPos > 0 && (
                              <span className="shrink-0 w-5 text-[11px] font-bold tabular-nums text-right" style={{ color: 'var(--cf-ink-3)', opacity: 0.5 }}>
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
                              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>
                                {c.nombre}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {c.tieneClavo && (
                                  <span className="shrink-0 text-[8px] font-extrabold uppercase tracking-[.07em] px-1.5 py-0.5 rounded-md"
                                    style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)' }}
                                  >Clavo</span>
                                )}
                                <p className="text-[10px] truncate" style={{ color: c.tieneClavo && c._clase === 'completado' ? 'var(--cf-red-dark)' : cfg.color }}>
                                  {c.tieneClavo && c._clase === 'completado' ? 'Préstamo perdido' : cfg.label}
                                  {c.diasMora > 0 ? ` · ${c.diasMora}d mora` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Cobrado hoy / cuota */}
                            {(c._clase !== 'completado' || c.tieneClavo) && c._clase !== 'sin_cobro' && (
                              <div className="shrink-0 text-right">
                                <p className="text-[12px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                                  {formatMoney(c.montoPagadoHoy || 0)}
                                  <span className="font-normal" style={{ color: 'var(--cf-ink-3)' }}> / {formatMoney(c.cuota)}</span>
                                </p>
                              </div>
                            )}

                            {/* Chevron */}
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
                              style={{ color: 'var(--cf-ink-3)', transform: expandido ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease', flexShrink: 0 }}>
                              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                            </svg>
                          </button>

                          {/* Detalle expandido */}
                          {expandido && (
                            <div className="px-3 pb-3 pt-0.5 space-y-2.5" style={{ borderTop: '1px solid var(--cf-border)' }}>
                              {/* Saldo restante por prestamo */}
                              {c.prestamosActivos?.length > 0 && (
                                <div className="pt-2.5">
                                  <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-3)' }}>
                                    Saldo restante
                                  </p>
                                  <div className="space-y-1.5">
                                    {c.prestamosActivos.map((p, i) => (
                                      <div key={p.id} className="flex items-center justify-between text-[12px] gap-2">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            {p.pagadoHoy && (
                                              <svg className="w-3 h-3 shrink-0 text-[var(--cf-green-dark)]" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                              </svg>
                                            )}
                                            <span className="font-mono-display" style={{ color: p.pagadoHoy ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)' }}>
                                              {c.prestamosActivos.length > 1 ? `Préstamo ${i + 1}` : 'Préstamo'}
                                              {' · '}{formatMoney(p.cuotaDiaria)}/{frecuenciaPrestamoLabel(p.frecuencia)}
                                              {p.seguro && (
                                                <span style={{ color: 'var(--cf-gold)' }}>
                                                  {' · seguro'}{p.montoSeguro ? ` ${formatMoney(p.montoSeguro)}` : ''}
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                          {p.diasMora > 0 && (
                                            <p className="text-[10px] font-mono-display mt-0.5" style={{ color: 'var(--cf-red-dark)' }}>
                                              {p.diasMora}d mora · {p.cuotasEnMora} cuota{p.cuotasEnMora === 1 ? '' : 's'} · {formatMoney(p.montoEnMora)}
                                            </p>
                                          )}
                                        </div>
                                        <span className="font-mono-display font-semibold shrink-0" style={{ color: 'var(--cf-ink)' }}>
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
                                  style={{ background: 'color-mix(in srgb, var(--cf-gold) 8%, transparent)' }}
                                >
                                  <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-gold)' }}>
                                    {c.eventosHoy.some(e => e.tipo === 'renovacion') ? 'Renovación / préstamo nuevo hoy' : 'Préstamo nuevo hoy'}
                                  </p>
                                  {c.eventosHoy.map((ev, i) => (
                                    <div key={i} className="flex items-center justify-between text-[12px]">
                                      <span style={{ color: 'var(--cf-ink-3)' }}>
                                        {ev.tipo === 'renovacion' ? 'Renovación' : 'Préstamo nuevo'}
                                        {ev.seguro && (
                                          <span style={{ color: 'var(--cf-gold)' }}>
                                            {' · seguro'}{ev.montoSeguro ? ` ${formatMoney(ev.montoSeguro)}` : ''}
                                          </span>
                                        )}
                                      </span>
                                      <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-ink)' }}>
                                        {formatMoney(ev.montoPrestado)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Mora */}
                              {c.diasMora > 0 && (
                                <div className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-[8px]"
                                  style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 8%, transparent)', color: 'var(--cf-red-dark)' }}
                                >
                                  <span>{c.diasMora}d en mora{c.cuotasEnMora ? ` · ${c.cuotasEnMora} cuota${c.cuotasEnMora === 1 ? '' : 's'}` : ''}</span>
                                  <span className="font-mono-display font-semibold">{formatMoney(c.montoEnMora)}</span>
                                </div>
                              )}

                              {/* Moratorio pendiente */}
                              {c.diasMora > 0 && ruta?.configMoratorio?.tasaMoratorio > 0 && c.diasMora > (ruta.configMoratorio.diasGracia || 5) && (
                                <div className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-[8px]"
                                  style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, transparent)', color: 'var(--cf-gold-dark)' }}
                                >
                                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Interés moratorio pendiente</span>
                                </div>
                              )}

                              {/* Pagos de hoy: metodo y hora */}
                              {c.pagosHoyDetalle?.length > 0 ? (
                                <div>
                                  <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-3)' }}>
                                    Cobros de hoy
                                  </p>
                                  <div className="space-y-1">
                                    {c.pagosHoyDetalle.map((pg, i) => {
                                      const d = pg.distanciaMetros
                                      let geoColor = 'var(--cf-ink-3)'
                                      let geoLabel = null
                                      if (pg.clienteSinCoords) {
                                        geoLabel = 'sin ubicación de cliente'
                                      } else if (d != null) {
                                        geoColor = d <= 50 ? 'var(--cf-green-dark)' : d <= 200 ? 'var(--cf-gold-dark)' : 'var(--cf-red-dark)'
                                        geoLabel = `${d < 1000 ? `${d}m` : `${(d / 1000).toFixed(1)}km`} del cliente`
                                      }
                                      return (
                                        <div key={i} className="flex items-center justify-between text-[12px]">
                                          <span style={{ color: 'var(--cf-ink-3)' }}>
                                            {formatHora(pg.fechaPago)}
                                            {pg.metodoPago ? ` · ${metodoLabel[pg.metodoPago] || pg.metodoPago}` : ''}
                                            {geoLabel && <span style={{ color: geoColor }}> · {geoLabel}</span>}
                                            {pg.registradoTarde != null && (
                                              <span style={{ color: 'var(--cf-gold-dark)' }}>
                                                {' · registrado '}
                                                {pg.registradoTarde >= 60
                                                  ? `${Math.round(pg.registradoTarde / 60)}h`
                                                  : `${pg.registradoTarde}min`}
                                                {' después'}
                                              </span>
                                            )}
                                          </span>
                                          <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-green-dark)' }}>
                                            {formatMoney(pg.monto)}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ) : (
                                (c._clase !== 'completado' || c.tieneClavo) && c._clase !== 'sin_cobro' && (
                                  <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
                                    Aun no se ha registrado un cobro hoy.
                                  </p>
                                )
                              )}

                              {/* Acciones rapidas */}
                              {(c._clase !== 'completado' || c.tieneClavo) && (
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/clientes/${c.id}`)}
                                    className="flex-1 py-2 text-[12px] font-semibold rounded-[8px] transition-colors"
                                    style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border)' }}
                                  >
                                    Ver cliente
                                  </button>
                                  {c._clase !== 'pagaron' && (
                                    <button
                                      type="button"
                                      onClick={() => abrirPagoRapido(c)}
                                      className="flex-1 py-2 text-[12px] font-semibold rounded-[8px] transition-colors"
                                      style={{ background: 'var(--cf-gold)', color: 'white' }}
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
              <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: color || 'var(--cf-ink-3)' }}>
                {titulo}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                {count}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--cf-border)' }} />
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
                      <SectionHeader titulo="Por cobrar hoy" count={porCobrarHoy.length} color="var(--cf-gold-dark)" />
                      <div className="space-y-1.5">
                        {porCobrarHoy.map((c, i) => renderCard(c, i, { conGrip: false }))}
                      </div>
                    </div>
                  )}

                  {/* Ya pagaron hoy */}
                  {yaPagaronHoy.length > 0 && (
                    <div>
                      <SectionHeader titulo="Ya pagaron hoy" count={yaPagaronHoy.length} color="var(--cf-green-dark)" />
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
                          style={{ color: 'var(--cf-ink-3)', transform: seccionProximosAbierta ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms ease' }}>
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
                          Próximos y al día
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                          {proximosYAlDia.length}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--cf-border)' }} />
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
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">
          Cierre de caja del día
        </p>
        {ruta.cierre ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--cf-ink-3)]">Esperado</span>
              <span className="text-[var(--cf-ink)] font-medium font-mono-display">{formatMoney(ruta.cierre.totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--cf-ink-3)]">Entregado</span>
              <span className="text-[var(--cf-ink)] font-medium font-mono-display">{formatMoney(ruta.cierre.totalRecogido)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[var(--cf-border)] pt-2 mt-2">
              <span className="text-[var(--cf-ink-3)]">Diferencia</span>
              <span className="font-mono-display" style={{ color: ruta.cierre.diferencia >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatMoney(ruta.cierre.diferencia)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-[var(--cf-ink-3)] mb-3">No se ha registrado el cierre de hoy</p>
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
          <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">Todos los clientes ya tienen ruta asignada</p>
        ) : (
          <div className="space-y-1">
            {/* Buscador */}
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={buscarCliente}
                onChange={(e) => setBuscarCliente(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-[12px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)] placeholder-[#555] focus:outline-none focus:border-[var(--cf-gold)] transition-colors"
                autoFocus
              />
            </div>
            {errorAsignar && (
              <div className="flex items-center gap-2 bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-xs rounded-[12px] px-3 py-2 mb-2">
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {errorAsignar}
              </div>
            )}
            {clientesSinRuta.filter(c => {
              if (!buscarCliente.trim()) return true
              const q = buscarCliente.toLowerCase()
              return c.nombre.toLowerCase().includes(q) || c.cedula?.includes(q)
            }).length > 0 && (
              <p className="text-[10px] font-medium text-[var(--cf-ink-3)] uppercase tracking-wide px-1 pt-1">Sin ruta asignada ({clientesSinRuta.length})</p>
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
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,197,24,0.1)]' : 'hover:bg-[var(--cf-fill)]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[var(--cf-gold)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--cf-ink)]">{c.nombre}</p>
                  <p className="text-xs text-[var(--cf-ink-3)]">CC {c.cedula}</p>
                </div>
                {seleccionados.includes(c.id) && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                    <span className="text-[10px] text-[var(--cf-ink-3)]">#</span>
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
                      className="w-14 h-7 text-center text-[11px] font-semibold tabular-nums rounded-[8px] border bg-[var(--cf-surface)] focus:border-[var(--cf-gold)] focus:outline-none transition-colors"
                      style={{ color: 'var(--cf-ink)', borderColor: 'var(--cf-border)' }}
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
                <div className="border-t border-[var(--cf-border)] my-2" />
                <p className="text-[10px] font-medium text-[var(--cf-gold-dark)] uppercase tracking-wide px-1">Ya en otra ruta ({clientesEnOtraRuta.length})</p>
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
                  seleccionados.includes(c.id) ? 'bg-[rgba(245,158,11,0.1)]' : 'hover:bg-[var(--cf-fill)]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[var(--cf-gold-dark)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--cf-ink)] truncate">{c.nombre}</p>
                    <span className="shrink-0 text-[10px] font-medium text-[var(--cf-gold-dark)] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.2)] px-1.5 py-0.5 rounded-full">
                      En: {c.rutaNombre}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--cf-ink-3)]">CC {c.cedula}</p>
                </div>
                {seleccionados.includes(c.id) && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                    <span className="text-[10px] text-[var(--cf-ink-3)]">#</span>
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
                      className="w-14 h-7 text-center text-[11px] font-semibold tabular-nums rounded-[8px] border bg-[var(--cf-surface)] focus:border-[var(--cf-gold)] focus:outline-none transition-colors"
                      style={{ color: 'var(--cf-ink)', borderColor: 'var(--cf-border)' }}
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
            <div className="text-[var(--cf-red-dark)] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCaja}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--cf-ink-3)]">Total esperado hoy</span>
            <span className="font-semibold text-[var(--cf-ink)] font-mono-display">{formatMoney(ruta.esperadoHoy)}</span>
          </div>
          <MoneyInput
            label="Dinero recogido (COP)"
            placeholder="Ej: 250.000"
            value={totalRecogido}
            onChange={(e) => setTotalRecogido(e.target.value)}
          />
          {totalRecogido && (
            <div className="text-sm">
              <span className="text-[var(--cf-ink-3)]">Diferencia: </span>
              <span className="font-mono-display" style={{ color: Number(totalRecogido) >= ruta.esperadoHoy ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)', fontWeight: 700 }}>
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
            <div className="text-[var(--cf-red-dark)] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCapital}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[var(--cf-ink-3)]">Saldo actual de la ruta</span>
            <span className="font-semibold font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(ruta.saldoCapital || 0)}</span>
          </div>
          <MoneyInput
            label="Monto (COP)"
            placeholder="Ej: 5.000.000"
            value={capitalMonto}
            onChange={(e) => setCapitalMonto(e.target.value)}
          />
          {/* Absorber: solo al inyectar si la ruta ya tiene cartera pendiente */}
          {modalCapital === 'inyeccion' && (ruta.carteraTotal || 0) > 0 && (
            <div className="rounded-[12px] border border-[var(--cf-border)] p-3" style={{ background: 'var(--cf-card)' }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={capitalAbsorber} onChange={(e) => setCapitalAbsorber(e.target.checked)} className="mt-0.5 accent-[var(--cf-gold)]" />
                <span className="text-xs font-mono-display text-[var(--cf-ink-2)]">
                  Esta ruta ya tiene {formatMoney(ruta.carteraTotal)} en préstamos por cobrar. Descontar lo pendiente de esta inyección.
                  {Number(capitalMonto) > 0 && (
                    <span className="block mt-1 text-[var(--cf-ink-3)]">
                      Disponible quedaría: <span className="font-semibold" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(Math.max(0, Number(capitalMonto) - (ruta.carteraTotal || 0)))}</span>
                    </span>
                  )}
                </span>
              </label>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--cf-ink-3)]">Descripción (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Capital para el mes"
              value={capitalDesc}
              onChange={(e) => setCapitalDesc(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-sm text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)] focus:outline-none focus:border-[var(--cf-gold)] transition-all"
            />
          </div>
          <p className="text-[11px] text-[var(--cf-ink-3)] leading-snug">
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
        <p className="text-sm text-[var(--cf-ink-3)]">
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
              style={{ background: 'var(--cf-red-dark)', color: 'var(--cf-ink)' }}
            >
              Quitar
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--cf-ink-3)]">
          <span className="text-[var(--cf-ink)] font-medium">{confirmQuitar?.nombre}</span> será removido de esta ruta. Podrás reasignarlo después.
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
            <p className="text-sm text-[var(--cf-ink-3)]">
              <span className="text-[var(--cf-ink)] font-medium">{modalSeleccionPrestamo.clienteNombre}</span> tiene varios préstamos activos.
              Elige cuál quieres cobrar ahora.
            </p>
            <div className="space-y-2">
              {modalSeleccionPrestamo.prestamos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => irAPrestamoSeleccionado(p.id)}
                  className="w-full text-left px-3 py-3 rounded-[12px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(245,197,24,0.08)] hover:border-[rgba(245,197,24,0.3)] transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--cf-ink)]">Préstamo {i + 1}</p>
                    <span className="text-sm font-bold text-[var(--cf-green-dark)] font-mono-display">
                      {formatMoney(p.saldoPendiente ?? 0)}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono-display text-[var(--cf-ink-3)] mt-1">
                    {frecuenciaPrestamoLabel(p.frecuencia)} · Cuota {formatMoney(p.cuotaDiaria ?? 0)}
                    {p.diasMora > 0 ? ` · ${p.diasMora}d mora` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── EMPEZAR RECORRIDO ──
          La accion que abre la jornada, y la unica de esta pantalla que el
          cobrador pulsa todos los dias. Va fija abajo, sobre la pastilla, para
          que se alcance con el pulgar sin mirar. Solo sale si queda algo por
          cobrar: en una ruta terminada seria un boton que no lleva a ninguna
          parte. */}
      {(ruta?.pendientesHoy ?? 0) > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 92, zIndex: 40,
          padding: '0 var(--cf-pad-screen)', pointerEvents: 'none',
        }}>
          <button
            type="button"
            onClick={() => setEnRecorrido(true)}
            style={{
              pointerEvents: 'auto', width: '100%', height: 54, cursor: 'pointer',
              borderRadius: 'var(--cf-r-control)', border: 0,
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
              fontSize: 15.5, fontWeight: 700,
              boxShadow: '0 6px 20px rgba(20,20,28,.18)',
            }}
          >
            Empezar recorrido · {ruta.pendientesHoy}
          </button>
        </div>
      )}

      {/* ── ATAJOS DE COBRO (T15-02) ──
          Sustituye al modal de «Cobro rápido», que eran 246 líneas y DOS PASOS:
          con varios préstamos había que elegir uno de una lista y solo entonces
          aparecía el formulario. El pie de la lámina explica por qué eso está
          mal, y es el gesto que más se repite en todo el producto:

            «Con dos préstamos activos hay que elegir cuál, y ahí está el valor —
             hoy el cobrador tiene que salir, abrir el otro préstamo y volver.
             El botón cierra el bucle: cobrar y pasar al siguiente, sin volver a
             la lista.»

          Ahora los préstamos están todos a la vez, cada uno con su cuota y tres
          salidas. El método se elige ARRIBA y vale para las tres.

          NO CAMBIA NADA DE LO QUE MUEVE PLATA: sigue pasando por
          `ejecutarPagoRapido`, con su cola offline, su deshacer de 10 segundos y
          su detección de duplicados. */}
      <Modal
        open={!!modalPagoRapido}
        onClose={() => setModalPagoRapido(null)}
        title="Cobrar"
      >
        {/* Sin `pais`: TODA esta pantalla llama a `formatMoney(n)` a secas y se
            apoya en el valor por defecto. Pasarlo solo aquí metía una segunda
            convención en el mismo archivo — y `user` ni siquiera existe: esta
            página usa `useAuth()`, con otros campos. Reventó en pantalla con
            «ReferenceError: user is not defined». */}
        {modalPagoRapido && (
          <AtajosCobro
            nombre={modalPagoRapido.nombre}
            iniciales={inicialesDe(modalPagoRapido.nombre)}
            ocupado={!!pagandoRapido}
            prestamos={(modalPagoRapido.prestamosActivos ?? []).map((pr) => ({
              id: pr.id,
              cuota: pr.cuotaDiaria,
              saldoPendiente: pr.saldoPendiente,
              diasMora: pr.diasMora,
              frecuencia: frecuenciaPrestamoLabel(pr.frecuencia),
              pagadoHoy: pr.pagadoHoy,
            }))}
            selectorMetodo={
              <MetodoPagoSelector
                metodosPago={metodosPago}
                /* Aquí SOLO elige; antes cobraba al pulsarlo. Con un préstamo
                   era equivalente, pero con tres tarjetas debajo el método tiene
                   que quedar puesto y esperar a que se diga QUÉ se cobra. */
                onSelect={({ metodoPago: mp, metodoPagoId: mpId }) =>
                  setMetodoRapido({ metodoPago: mp, metodoPagoId: mpId })}
              />
            }
            onCobrarCuota={(pr) => ejecutarPagoRapido(metodoRapido.metodoPago, {
              metodoPagoId: metodoRapido.metodoPagoId,
              // El préstamo va EXPLÍCITO. Pasarlo por el estado cobraría el
              // anterior: `setState` no ha llegado cuando la función lee.
              destino: {
                id: modalPagoRapido.id,
                nombre: modalPagoRapido.nombre,
                cuota: pr.cuota,
                cuotaOriginal: pr.cuota,
                prestamoActivo: pr.id,
              },
            })}
            onOtroMonto={(pr, cuanto) => ejecutarPagoRapido(metodoRapido.metodoPago, {
              metodoPagoId: metodoRapido.metodoPagoId,
              destino: {
                id: modalPagoRapido.id,
                nombre: modalPagoRapido.nombre,
                cuota: cuanto,
                // `cuotaOriginal` distinta hace que se registre como PARCIAL y
                // no como cuota completa. Es la diferencia entre abonar y
                // marcar la cuota del día como saldada.
                cuotaOriginal: pr.cuota,
                prestamoActivo: pr.id,
              },
            })}
            onNoPago={(pr, motivo) => registrarNoPago(pr.id, motivo)}
          />
        )}
      </Modal>

      {/* Toast: deshacer pago */}
      {undoPago && (
        <div className="fixed bottom-24 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-6 sm:w-auto z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] border border-[var(--cf-green)] bg-[var(--cf-card)] sm:min-w-[320px]"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <svg className="w-4 h-4 text-[var(--cf-green-dark)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-[var(--cf-ink)] flex-1 truncate">Pago registrado — {undoPago.clienteNombre}</span>
            <button
              onClick={deshacerPago}
              className="text-sm font-bold text-[var(--cf-gold)] hover:text-[var(--cf-gold)]/80 transition-colors shrink-0"
            >
              Deshacer
            </button>
            <button
              onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUndoPago(null) }}
              className="text-[var(--cf-ink-2)] hover:text-[var(--cf-ink)] transition-colors shrink-0"
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
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
      />
    </div>
  )
}
