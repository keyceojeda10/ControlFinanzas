'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { formatMoney } from '@/lib/i18n'
import { abreviaturaDocumento } from '@/lib/documento'
import { LoPuestoAqui, LoDeHoy } from '@/components/pantallas/DetalleRuta'
import { loPuestoAqui, loDeHoy, formatearKm, partirRecorrido, adaptarParadaActual, cierreDelDia, resumenDeCierre, tramosDelRecorrido, moverParada, moverParadaEnRuta, propuestaPorCercania, paradasDeRuta, gruposDeRuta } from '@/lib/adaptadores/ruta'
// La tarjeta de parada es la MISMA que pinta /cobros-hoy. Ver la nota de
// components/cf/ParadaDeCobro: aqui habia una segunda tarjeta para lo mismo.
import { Carril, FilaCobro } from '@/components/cf/ParadaDeCobro'
import { desplazamientoActual, volverAlSitio, MS_RESALTADO } from '@/lib/sitio-de-la-lista'
import { useArrastreLargo } from '@/hooks/useArrastreLargo'

// El id que lleva puesta cada tarjeta en el DOM. Se declara una vez y se usa
// en los dos sitios —al pintarla y al buscarla— para que no se puedan separar.
const ANCLA_CLIENTE = (id) => `cliente-${id}`
import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback, useMemo, use } from 'react'
import { useRouter }                 from 'next/navigation'
import Link                          from 'next/link'
import dynamic                       from 'next/dynamic'
import { useAuth }                   from '@/hooks/useAuth'
import { useOffline }                from '@/components/providers/OfflineProvider'
import { obtenerRutaOffline, guardarOrdenPendiente, guardarPagoPendiente, guardarEnCache, leerDeCache } from '@/lib/offline'
import { useCabecera } from '@/components/armazon/Armazon'
import { obtenerCoordsRapido } from '@/lib/geo'
// Las mismas que usa el servidor para el «3,4 km» de la cabecera.
import { optimizeRoute, totalDistance } from '@/lib/routeOptimizer'
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
import HojaWhatsApp        from '@/components/whatsapp/HojaWhatsApp'
import MetodoPagoSelector            from '@/components/pagos/MetodoPagoSelector'
import AtajosCobro                   from '@/components/pantallas/AtajosCobro'
import ModoRuta                      from '@/components/pantallas/ModoRuta'
import RutaCerrada                   from '@/components/pantallas/RutaCierre'
import { OrdenRecorrido }            from '@/components/pantallas/RutaEditar'
import { PieGestion }                from '@/components/pantallas/Gestion'
import FichaRuta                     from '@/components/pantallas/FichaRuta'
import RutaEscritorio                from '@/components/pantallas/RutaEscritorio'
import { Recibo, CAPA_RECIBO }        from '@/components/pantallas/Recibo'
import { imprimirRecibo, guardarReciboImagen } from '@/lib/recibo-acciones'
import { RegistrarAcciones } from '@/components/acciones/AccionesProvider'
import QueNecesitas from '@/components/acciones/QueNecesitas'
import HojaInferior                  from '@/components/cf/HojaInferior'
import { anotarReciente } from '@/lib/recientes'
import { rotulo } from '@/lib/dinero/definiciones'

// Cargar mapa dinámicamente (evitar SSR con Leaflet)
const RouteMap = dynamic(() => import('@/components/rutas/RouteMap'), { ssr: false })

/**
 * La capa del modo recorrido: pantalla completa POR ENCIMA del armazón.
 *
 * Sin esto, la barra de navegación —que va en z-index 45— se queda flotando
 * sobre el botón «Cobrarle a Ana Milena» y SE COME EL CLIC. Lo descubrió el
 * script de pulsar: «<nav aria-label="Navegación principal"> subtree intercepts
 * pointer events». En la calle eso es un cobrador dando toques a la pantalla
 * sin que pase nada.
 *
 * Y ademas es lo que pide la lámina: el recorrido se dibuja a pantalla
 * completa, sin pastilla ni cabecera. Quien está de pie con una mano no navega
 * a otra sección — sale por la flecha de atrás.
 */
function CapaRecorrido({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      // `--cf-surface`. Decia `--cf-bg`, que no existe, asi que esta capa —la
      // del recorrido, a pantalla completa— se pintaba TRANSPARENTE y dejaba
      // ver la lista de debajo.
      background: 'var(--cf-surface)', overflowY: 'auto',
    }}>{children}</div>
  )
}

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
  // ── EL COBRO HECHO (T15-03 / T07-04) ──
  // Hasta ahora un cobro solo dejaba un aviso de 1,2 segundos. El pie de la
  // lamina dice lo que falta, y es de producto, no de estilo:
  //
  //   «La accion dorada NO es "listo": es el nombre del siguiente, porque en la
  //    calle el cobro no termina, SIGUE. Volver a la lista queda de segunda.»
  const [reciboCobro, setReciboCobro] = useState(null)
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
  // T24-03: la ficha de capital de la ruta. Se abre tocando el bloque negro,
  // que es justo la cifra sobre la que responde («¿me rinde meter plata aqui?»).
  const [fichaCapital, setFichaCapital] = useState(false)
  // «Solo hoy»: esconder a quien no toca cobrar hoy. Apagado por defecto —
  // quitar clientes de la vista sin que nadie lo haya pedido es peor que
  // mostrarlos de más—, pero se recuerda para quien lo enciende.
  const [soloHoy, setSoloHoy] = useState(() => {
    try { return localStorage.getItem('cf-ruta-soloHoy') === '1' } catch { return false }
  })
  const [vistaPlana, setVistaPlana] = useState(() => {
    try { return localStorage.getItem('cf-ruta-vistaPlana') !== 'agrupada' } catch { return true }
  })
  /* ── TABLA O TARJETAS, PERO SOLO EN PC ─────────────────────────────────
     La clave lleva `:pc` como en clientes y en préstamos: son dos vistas para
     dos pantallas distintas, y elegir tarjetas sentado no puede cambiarle nada
     al teléfono, que es donde se cobra. */
  const [vistaPC, setVistaPC] = useState(() => {
    try { return localStorage.getItem('cf-ruta-vista:pc') === 'tarjetas' ? 'tarjetas' : 'tabla' } catch { return 'tabla' }
  })
  const cambiarVistaPC = (v) => {
    setVistaPC(v)
    try { localStorage.setItem('cf-ruta-vista:pc', v) } catch {}
  }
  /* ══ LOS GRUPOS SE PLIEGAN ══════════════════════════════════════════════
   *
   * Reportado con el caso que lo hace obvio, y es de ruta grande:
   *
   *   «si yo tengo 100 clientes por cobrar hoy y quiero ver a los que están
   *    para prestarle de nuevo, tengo que desplazarme hacia abajo todos esos
   *    100 clientes para poder ver la lista de los que están por prestar»
   *
   * O sea: agrupar SEPARABA pero no ACERCABA. La sección más larga es siempre
   * la primera —«Por cobrar hoy»— así que las cuatro de abajo quedaban a cien
   * tarjetas de distancia, que es justo lo que la vista agrupada venía a
   * evitar. Con las medidas de la RUTA #1 son 206 clientes en seis secciones.
   *
   * Se guarda QUÉ ESTÁ CERRADO, no qué está abierto: así una sección nueva
   * —o un grupo que hoy está vacío y mañana no— sale abierta por defecto, que
   * es lo que el cobrador espera al abrir la pantalla por la mañana.
   *
   * Un `Set` en el estado y no un array: `has()` se llama una vez por sección
   * en cada pintado. */
  const [gruposCerrados, setGruposCerrados] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cf-ruta-grupos-cerrados') ?? '[]')) } catch { return new Set() }
  })
  const plegarGrupo = (clave) => setGruposCerrados((prev) => {
    const s = new Set(prev)
    if (s.has(clave)) s.delete(clave)
    else s.add(clave)
    try { localStorage.setItem('cf-ruta-grupos-cerrados', JSON.stringify([...s])) } catch {}
    return s
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

  /* ── VOLVER A DONDE SE IBA ─────────────────────────────────────────────
     ⚠ LA MÁQUINA SE MUDÓ A `lib/sitio-de-la-lista`, ENTERA Y SIN CAMBIOS.
     Buscar el contenedor que desplaza de verdad, guardar el sitio, volver por
     el id del cliente y dejar los píxeles de respaldo: todo eso estaba escrito
     AQUÍ DENTRO, y por eso «Cobros de hoy», la lista de clientes y la de
     préstamos no lo tenían. Ahora las cuatro llaman a lo mismo.

     Lo que se queda es lo propio de esta pantalla —el modo de vista, el
     progreso del recorrido y la navegación al siguiente cliente—, abajo en
     `guardarContextoRuta`. */
  const scrollTopDeLaLista = () => desplazamientoActual()

  const volverASuSitio = (clienteId, savedY) => {
    const el = volverAlSitio({ itemId: clienteId, y: savedY }, { ancla: ANCLA_CLIENTE })
    // Se resalta SOLO si aterrizó en la ficha. Por píxeles no se sabe en cuál
    // se cayó, y marcar la de al lado señala a quien no es.
    if (!el) return
    setHighlightId(clienteId)
    setTimeout(() => setHighlightId(null), MS_RESALTADO)
  }

  const guardarContextoRuta = (clienteRuta, idxRuta) => {
    if (!ruta?.clientes?.length) return

    const currentIndex = idxRuta >= 0 ? idxRuta : ruta.clientes.findIndex((cl) => cl.id === clienteRuta.id)
    if (currentIndex < 0) return

    sessionStorage.setItem(`ruta-scroll-${id}`, clienteRuta.id)
    // ⚠ EL SCROLL NO ES EL DE LA VENTANA. La lista va dentro de un contenedor
    // con `overflowY: auto`, así que `window.scrollY` es SIEMPRE 0 — y como se
    // guardaba como cadena, al volver `"0"` daba verdadero y la restauración
    // entraba por `window.scrollTo(0, 0)`: subía arriba del todo y ni siquiera
    // llegaba a probar el `scrollIntoView` de respaldo. Con 200 clientes eso es
    // volver a bajar a mano cada vez que se cobra a uno.
    sessionStorage.setItem(`ruta-scrollY-${id}`, String(scrollTopDeLaLista()))
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
      // ── «LLEVAS HOY $X DE $Y» (T15-03) ──
      // La pantalla de «cobro hecho» la enseña justo después de cobrar, que es
      // cuando el cobrador quiere saber cuánto le falta para cerrar el día.
      // Viaja aquí porque `RegistrarPago` no tiene la ruta: recibe el contexto
      // por `sessionStorage` y hasta ahora solo llevaba la lista de clientes.
      //
      // Es una FOTO del momento en que se entró al recorrido; el pago que se
      // acaba de hacer se suma aparte en la pantalla, para no tener que volver
      // a pedir la ruta entera.
      recaudadoHoy: Math.round(ruta.recaudadoHoy ?? 0),
      esperadoHoy: Math.round(ruta.esperadoHoy ?? 0),
    }))
  }

  /* ⚠ TODA SALIDA DE ESTA PANTALLA PASA POR AQUÍ.
     El fallo que reportó el cobrador el 24 ago 2026 es que guardar el sitio
     estaba escrito destino por destino, así que el que se añadiera después
     salía pelado. Le pasó con «Prestarle»: en la vista AGRUPADA hay un grupo
     «Listos para prestarles» que le pone el botón delante, presta desde ahí y
     al volver la ruta aparecía arriba del todo. En la vista plana no lo notaba
     porque llega por el nombre del cliente, que sí guardaba.

     Es el mismo fallo del comprobante de pago: arreglar una vía y dejar la
     otra. Medido en el navegador antes de tocar nada —el sessionStorage venía
     vacío por el botón y lleno por el nombre, en LAS DOS vistas—, así que no
     era cosa de agrupar: era del botón. */
  const irGuardando = (clienteRuta, idxRuta, url) => {
    guardarContextoRuta(clienteRuta, idxRuta)
    router.push(url)
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

  // Puertas que quedan por tocar hoy: pendientes menos las que el cobrador ya
  // dio por cerradas. Ver la nota del botón «Empezar recorrido».
  const paradasPorHacer = (ruta?.clientes ?? []).filter((c) => {
    const pendiente = Boolean(c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado'))
    return pendiente && !c.visitaCerradaHoy
  }).length

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
      volverASuSitio(scrollTo, savedY)
    })
  }, [ruta, id])

  useEffect(() => {
    if (!pendingScrollRef.current) return
    const { scrollTo, savedY } = pendingScrollRef.current
    pendingScrollRef.current = null
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        volverASuSitio(scrollTo, savedY)
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

  /* ══ QUIÉN COBRA ESTA RUTA ════════════════════════════════════════════════
   *
   * ⚠ ESTO NO TENÍA BOTÓN, Y ERA LO MÁS PEDIDO. `cambiarCobrador` llevaba aquí
   * escrita desde siempre sin que nada la llamara, y la acción del buscador
   * mandaba a `/cobradores` con la idea de que el asignador «de verdad» vivía
   * allí. No servía: en esa pantalla el botón «Asignar» solo sale para los
   * cobradores que NO tienen ruta, así que reasignar era imposible.
   *
   * El dueño: «cuando ya la ruta está creada no hay un lugar para escoger el
   * cobrador. Si uno quiere cambiar ese cobrador o asignar uno, no hay nada».
   *
   * No son dos sitios que puedan divergir: los dos llaman al mismo
   * `PATCH /api/rutas/[id]`. Lo que había era una función huérfana. */
  const [modalCobrador,     setModalCobrador]     = useState(false)
  const [guardandoCobrador, setGuardandoCobrador] = useState(false)
  const [errorCobrador,     setErrorCobrador]     = useState('')

  const cambiarCobrador = async (cobradorId) => {
    const r = await fetch(`/api/rutas/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cobradorId: cobradorId || null }),
    })
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || 'No se pudo cambiar el cobrador')
  }

  /* ⚠ EL MODAL SE CIERRA CON EL GUARDADO, NO CON LA RECARGA. Esperaba también
     a `fetchRuta()`, y esta ruta trae 205 clientes: medido en el espejo, el
     modal seguía abierto y sin señal 2,5 s después de elegir, con el nombre
     viejo todavía en pantalla. Eso es lo que hace que se toque dos veces.
     El PATCH es lo que decide; la lista se refresca por detrás. */
  const asignarCobrador = async (cobradorId) => {
    setGuardandoCobrador(true)
    setErrorCobrador('')
    try {
      await cambiarCobrador(cobradorId)
      /* Lo que ya se sabe, en pantalla: el nombre cambia sin esperar al
         servidor. ⚠ SOLO `id` y `nombre`, no el objeto entero de
         `/api/cobradores`: el `cobrador` de la ruta trae además latitud,
         longitud y `ubicacionUpdatedAt`, y volcar aquí la otra forma dejaría
         al nuevo cobrador con el sitio del anterior debajo del nombre hasta
         el refresco. Lo demás lo repone `fetchRuta()`. */
      const elegido = cobradores.find((c) => c.id === cobradorId)
      setRuta((prev) => (prev
        ? { ...prev, cobrador: elegido ? { id: elegido.id, nombre: elegido.nombre } : null }
        : prev))
      setModalCobrador(false)
      fetchRuta()
    } catch (e) {
      setErrorCobrador(e.message)
    } finally {
      setGuardandoCobrador(false)
    }
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
        // ── EL RECIBO, ANTES DE RECARGAR ──
        // Estaba despues de `await fetchRuta()`, y ahi no llegaba a verse. Y
        // ademas es lo correcto: la confirmacion de que la plata entro no debe
        // esperar a una segunda peticion — el servidor ya dijo que si.
        //
        // Se arma con lo que devolvio el servidor, no con lo que se tecleo: si
        // el backend ajusto el monto —excedente, redondeo, saldo menor que la
        // cuota— el papel tiene que decir lo que de VERDAD entro.
        setReciboCobro({
          clienteId,
          nombre,
          // LA RESPUESTA ES EL PRESTAMO, PLANO. No `data.pago` ni
          // `data.prestamo`: la API devuelve `{...prestamo, saldoPendiente,
          // proximoCobro, …}`. Buscarlo anidado daba `undefined` en silencio y
          // el recibo salia sin saldo y con el monto de reserva.
          // `pagos[0]`, que es el recien hecho: vienen en orden descendente
          // (lo dice la linea del `pagoId` de arriba).
          monto: Math.round(data?.pagos?.[0]?.montoPagado ?? cuota),
          saldo: data?.saldoPendiente ?? null,
          proximoCobro: data?.proximoCobro ?? null,
          numero: pagoId ? String(pagoId).slice(-6).toUpperCase() : null,
          /* ⚠ EL PRÉSTAMO, TAL COMO LO DEVOLVIÓ EL PAGO. Y esto es lo que
             arreglaba el comprobante.

             Los botones de «guardar imagen» e «imprimir» lo sacaban de
             `ruta.clientes[…].prestamosActivos[0]`, o sea del estado de la
             pantalla. Ese estado se recarga con el `fetchRuta()` de aquí abajo,
             pero al pulsar el botón seguía llegando el de ANTES del cobro: un
             cliente que acababa de abonar $30.000 sobre $124.000 recibía un
             papel que decía «Total pagado $0 · Saldo pendiente $124.000 ·
             Progreso 0%», con el saldo intacto. Reportado por PRESTA MIL, y
             reproducido aquí al peso: el API ya decía 19.400 y 446.200, y al
             generador le llegaban 0 y 465.600.

             La respuesta del POST trae `totalPagado`, `saldoPendiente` y
             `porcentajePagado` ya recalculados. Es la única foto que no puede
             ir atrasada, porque es la del servidor en el instante del cobro. */
          prestamo: data ?? null,
          // El id del pago: sin él, el comprobante sale sin «Referencia», que
          // es por donde se reclama.
          pagoId,
          fechaPago: data?.pagos?.[0]?.fechaPago ?? new Date().toISOString(),
        })
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

  const deshacerCobroDeParada = async () => {
    if (!confirmDeshacer || deshaciendo) return
    setDeshaciendo(true)
    try {
      const res = await fetch(`/api/pagos/${confirmDeshacer.pagoId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'No se pudo deshacer el cobro.')
        return
      }
      setConfirmDeshacer(null)
      fetchRuta()
    } catch {
      alert('No se pudo deshacer el cobro. Revisa la conexión.')
    } finally { setDeshaciendo(false) }
  }

  /**
   * Lo que se le entrega al comprobante —imagen o impreso— tras un cobro
   * rápido. UN SOLO SITIO: los dos botones pedían lo mismo por su cuenta y solo
   * se arregló uno la primera vez que apareció este fallo.
   *
   * El préstamo sale de `reciboCobro`, que guarda la respuesta del POST, NO del
   * estado de la pantalla: ver el porqué largo donde se rellena.
   */
  const datosDelComprobante = () => {
    const c = ruta?.clientes?.find((x) => x.id === reciboCobro?.clienteId)
    return {
      cliente: c ?? { nombre: reciboCobro?.nombre },
      prestamo: reciboCobro?.prestamo ?? c?.prestamosActivos?.[0] ?? null,
      pago: {
        id: reciboCobro?.pagoId ?? null,
        montoPagado: reciboCobro?.monto,
        fechaPago: reciboCobro?.fechaPago ?? new Date().toISOString(),
      },
      orgNombre,
    }
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
  /* ── DESHACER EL COBRO DESDE LA PROPIA PARADA ─────────────────────────────
     PRESTA MIL, 20 ago: «la vez pasada, ahí donde se coloca el abono, aparecía
     un potecito». Era el aviso flotante de «Deshacer», que dura 10 segundos.
     Ver el porqué largo en `components/cf/ParadaDeCobro.jsx`.
     Solo al owner: el API deja al cobrador borrar únicamente su propio pago y
     antes de 10 minutos, así que a él se le ofrecería un 403 la mayoría de las
     veces. */
  const [confirmDeshacer, setConfirmDeshacer] = useState(null) // { pagoId, nombre, monto }
  const [deshaciendo, setDeshaciendo] = useState(false)

  /* ══ LO QUE SE PUEDE HACER EN ESTA RUTA ═══════════════════════════════════
   *
   * ⚠ DOS DE ESTAS NO TENÍAN NINGÚN BOTÓN. `eliminarRuta` y `cambiarCobrador`
   * estaban escritas y no se llamaban desde ninguna parte del JSX: no se podía
   * borrar una ruta ni cambiarle el cobrador DESDE la ruta. El modal de
   * confirmar el borrado también estaba, esperando a que alguien lo abriera.
   *
   * ⚠ Y LO DE «CAMBIAR DE COBRADOR SE RESUELVE LLEVANDO A /cobradores» ERA
   * FALSO, aunque lo dijera este mismo comentario: allí el botón «Asignar»
   * solo sale para los cobradores SIN ruta, así que reasignar no se podía. Ya
   * se hace desde aquí, con la misma llamada al API.
   *
   * El resto son chips de una fila que se desplaza: en un móvil de 390px la
   * mitad nace fuera de la pantalla. */
  const accionesRuta = [
    { id: 'ruta-agregar', label: 'Agregar clientes a la ruta', pista: 'En esta ruta',
      sinonimos: ['agregar cliente', 'meter cliente', 'enrutar', 'añadir clientes',
        'poner un cliente en la ruta', 'asignar clientes'],
      disponible: puedeGestionarRutas,
      ejecutar: () => abrirModalClientes() },
    { id: 'ruta-quitar', label: 'Quitar un cliente de la ruta', pista: 'Se hace en «Ordenar»',
      sinonimos: ['quitar cliente', 'sacar de la ruta', 'desenrutar', 'sacar un cliente'],
      disponible: puedeGestionarRutas,
      ejecutar: () => setModoVista('ordenar') },
    { id: 'ruta-ordenar', label: 'Cambiar el orden del recorrido', pista: 'Arrastrando o con flechas',
      sinonimos: ['ordenar', 'reordenar', 'cambiar el orden', 'mover un cliente de puesto'],
      disponible: puedeGestionarRutas,
      ejecutar: () => setModoVista('ordenar') },
    { id: 'ruta-optimizar', label: 'Optimizar el recorrido', pista: 'Ordena por cercanía',
      sinonimos: ['optimizar', 'ruta mas corta', 'ordenar por cercania', 'que camine menos'],
      ejecutar: () => setConfirmOptimizar(true) },
    { id: 'ruta-mapa', label: 'Ver la ruta en el mapa', pista: 'En esta ruta',
      sinonimos: ['mapa', 'ver en el mapa', 'google maps', 'como llego'],
      ejecutar: () => setShowMap((v) => !v) },
    { id: 'ruta-empezar', label: 'Empezar el recorrido', pista: 'Cliente por cliente',
      sinonimos: ['empezar', 'salir a cobrar', 'recorrido', 'arrancar la ruta'],
      ejecutar: () => setEnRecorrido(true) },
    /* ⚠ `/api/rutas/[id]/hoja` NO EXISTE Y NUNCA EXISTIÓ.
     * Abría una pestaña con un 404 en blanco. El botón de verdad —el de la
     * fila de chips— usa `window.print()`, que imprime esta misma pantalla con
     * su CSS de impresión. Yo copié la llamada inventada en vez de mirar qué
     * hacía el botón que ya estaba. */
    { id: 'ruta-hoja', label: 'Imprimir la hoja de la ruta', pista: 'Para llevarla en papel',
      sinonimos: ['imprimir', 'hoja', 'papel', 'planilla', 'listado para la calle'],
      disponible: (ruta?.clientes?.length ?? 0) > 0,
      ejecutar: () => window.print() },
    { id: 'ruta-caja', label: 'Cerrar la caja del día', pista: 'De esta ruta',
      sinonimos: ['cerrar caja', 'cuadrar', 'entregar la plata', 'cierre del dia'],
      ejecutar: () => setModalCaja(true) },
    { id: 'ruta-capital', label: 'Ver el capital de la ruta', pista: 'Lo que tienes puesto aquí',
      sinonimos: ['capital de la ruta', 'cuanto tengo aqui', 'plata de la ruta'],
      disponible: esOwner || puedeVerCapitalRuta,
      ejecutar: () => setFichaCapital(true) },
    { id: 'ruta-nombre', label: 'Cambiar el nombre de la ruta', pista: 'En esta ruta',
      sinonimos: ['renombrar', 'cambiar el nombre', 'ponerle otro nombre'],
      disponible: esOwner,
      ejecutar: () => setEditandoNombre(true) },
    { id: 'ruta-cobrador', label: 'Cambiar el cobrador de la ruta', pista: 'En esta ruta',
      sinonimos: ['cambiar cobrador', 'asignar cobrador', 'quien cobra esta ruta',
        'poner otro cobrador', 'quitar el cobrador', 'dejarla sin cobrador'],
      disponible: esOwner,
      ejecutar: () => setModalCobrador(true) },
    { id: 'ruta-eliminar', label: 'Eliminar esta ruta', pista: 'No borra los clientes',
      sinonimos: ['eliminar ruta', 'borrar ruta', 'quitar la ruta'],
      disponible: esOwner,
      ejecutar: () => eliminarRuta() },
  ]

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
    if (estadoFiltro === 'pendientes') list = list.filter(c => c.cobroPendienteHoy)
    else if (estadoFiltro === 'mora') list = list.filter(c => c.diasMora > 0)
    else if (estadoFiltro === 'pagados') list = list.filter(c => c.pagoHoy)
    if (busquedaRuta.trim()) {
      const q = busquedaRuta.trim().toLowerCase()
      list = list.filter(c => c.nombre?.toLowerCase().includes(q) || c.cedula?.toLowerCase().includes(q))
    }
    // «Solo hoy»: los que TOCAN hoy, más los que ya pagaron hoy. Estos últimos
    // se quedan a propósito: son parte de la jornada y esconderlos haría dudar
    // de si el cobro se registró. La misma cuenta que usa el agrupador, para
    // que el filtro y las secciones no digan cosas distintas.
    //
    // Solo en «Cobros»: en «Ordenar» se está armando el recorrido con TODOS y
    // en «Auditoría» se revisa la ruta entera.
    if (soloHoy && modoVista === 'trabajo') {
      list = list.filter((c) => {
        const pendiente = Boolean(c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado'))
        return pendiente || c.pagoHoy
      })
    }
    return list
  })()

  /* ⚠ ESTOS DOS VAN DESPUES DE `clientesFiltrados`, Y NO ES UN DETALLE.
     Los puse ARRIBA, junto a `guardarOrden`, y usan `clientesFiltrados` —que se
     declara aqui abajo—: un `const` leido antes de existir revienta al
     renderizar con «Cannot access before initialization». La pagina de detalle
     de ruta dejo de abrir EN PRODUCCION y los cobradores no pudieron trabajar.
     `next build` COMPILO SIN QUEJARSE: el fallo solo aparece al ejecutar. */
  /* Teclear la posición: mismo camino que arrastrar, pero con el número.
     `moverParadaEnRuta` traduce el índice visible al de la ruta completa, así
     que con un filtro puesto tampoco se pierde a nadie. */
  const reordenarPorNumero = useCallback((desde, hasta) => {
    const movidos = moverParadaEnRuta(ruta?.clientes ?? [], clientesFiltrados, desde, hasta)
    setRuta((prev) => (prev ? { ...prev, clientes: movidos } : prev))
    guardarOrden(movidos)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, clientesFiltrados])

  /* ── DEJARLA APRETADA Y MOVERLA, SIN SALIR DE «COBROS» ──────────────────
     «De pronto están haciendo el cobro y rápidamente necesitan moverla hacia
     arriba o hacia abajo.» El modo «Ordenar» sigue siendo el bueno para armar
     el recorrido entero; esto es el movimiento suelto que se hace en la calle.

     ⚠ VA AQUÍ ARRIBA, no dentro del render. Es un hook, y los hooks no pueden
     vivir dentro del `(() => …)()` que pinta la lista: en cuanto la lista
     cambiara de rama —agrupada, vacía, error— React se quedaría con un número
     de hooks distinto entre renders y la pantalla revienta.

     Los índices son los de `clientesFiltrados`, y `moverParadaEnRuta` los
     traduce a la ruta completa: con «Solo hoy» puesto se sigue guardando el
     orden de todos, que fue el fallo que ya dejó una ruta revuelta. */
  const arrastre = useArrastreLargo({
    activo: modoVista === 'trabajo',
    cantidad: clientesFiltrados.length,
    onReordenar: reordenarPorNumero,
  })

  /* Quitar de la ruta. NO borra al cliente ni su préstamo: le deja `rutaId` en
     null, que es lo que hace el endpoint. Con confirmación porque quitar por
     error a alguien le rompe el día al cobrador. */
  const quitarDeLaRuta = useCallback(async (parada) => {
    if (!parada?.id) return
    const nombre = parada.nombre ?? 'este cliente'
    if (!confirm(`¿Quitar a ${nombre} de la ruta?

Sigue siendo tu cliente y su préstamo no se toca: solo deja de salir en este recorrido.`)) return
    try {
      const res = await fetch(`/api/rutas/${id}/clientes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: parada.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setOrdenError(d.error || 'No se pudo quitar de la ruta')
        return
      }
      setRuta((prev) => (prev
        ? { ...prev, clientes: (prev.clientes ?? []).filter((c) => c.id !== parada.id) }
        : prev))
    } catch {
      setOrdenError('Sin conexión: no se pudo quitar de la ruta')
    }
  }, [id])

  /* ══ LA PARADA, UNA SOLA VEZ PARA LAS DOS PANTALLAS ═══════════════════════
   *
   * Todo esto vivía DENTRO de la rama de móvil, así que el escritorio no podía
   * pintar la misma tarjeta ni aunque quisiera: solo tenía la tabla. El dueño lo
   * pidió con las dos capturas al lado —«la vista de tarjeta de móvil está mucho
   * mejor construida, tiene más opciones»— y la salida NO era copiarla arriba.
   * Copiar la tarjeta es el fallo del comprobante otra vez: se arregla una y la
   * otra se queda como estaba.
   *
   * Así que sube aquí tal cual y las dos ramas la llaman. Lo único que cambia
   * entre ellas es el arrastre, que en escritorio no va (ver `sinArrastre`).
   */
  // El cliente crudo por id: la tarjeta recibe la fila ya adaptada
  // —textos, no campos— y las acciones necesitan el original (telefono,
  // coordenadas, prestamoActivo).
  const porId = new Map(clientesFiltrados.map((c) => [c.id, c]))

  const abrirWhatsApp = (c) => {
    const p = c.prestamosActivos?.[0]
    setModalWA({
      cliente: { id: c.id, nombre: c.nombre, telefono: c.telefono, cedula: c.cedula, direccion: c.direccion },
      prestamo: p ? {
        ...p,
        estado: c.estado === 'completado' ? 'completado' : 'activo',
        porcentajePagado: p.totalAPagar > 0 ? Math.round((p.totalPagado / p.totalAPagar) * 100) : 0,
      } : null,
    })
  }

  /* ── CERRAR Y REABRIR LA VISITA DEL DÍA ─────────────────────────
     Se anota como `VisitaReagendada`, que ya existía con sus motivos
     y hasta ahora no la leía nadie. `pago_parcial` es el motivo nuevo:
     los otros cuatro dicen por qué NO pagó, y aquí sí pagó.

     La fecha reagendada es el próximo cobro que ya tiene calculado —o
     mañana si no hay—: es lo que pasa de todas formas, y pedirla en la
     puerta es un paso más de pie en la calle. */
  const cerrarVisita = async (c) => {
    const hoyIso = new Date().toISOString()
    const prox = c.proximoCobroAt ?? new Date(Date.now() + 86400000).toISOString()
    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: c.id, prestamoId: c.prestamoActivo ?? null, rutaId: ruta?.id,
          fechaOriginal: hoyIso, fechaReagendada: prox, motivo: 'pago_parcial',
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d?.error || 'No se pudo cerrar la visita')
        return
      }
      await fetchRuta()
    } catch {
      // El cobrador acaba de decidir algo sobre este cliente: si no
      // quedó guardado tiene que saberlo, no descubrirlo al recargar.
      alert('Sin conexión: la visita no quedó cerrada. Vuelve a intentarlo.')
    }
  }

  const reabrirVisita = async (c) => {
    try {
      const res = await fetch(`/api/visitas?clienteId=${c.id}&hoy=1`, { method: 'DELETE' })
      if (!res.ok) { alert('No se pudo volver a abrir la visita'); return }
      await fetchRuta()
    } catch {
      alert('Sin conexión: no se pudo volver a abrir la visita.')
    }
  }

  const abrirMapa = (c) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${c.latitud},${c.longitud}`, '_blank', 'noopener,noreferrer')
  }

  /* ── LA PARADA (Adenda 5 · E07 + E08) ──────────────────────────
     Era otra tarjeta distinta a la de /cobros-hoy, siendo LA MISMA
     parada de LA MISMA ruta. La lámina la retrata entera: el número de
     orden como marca de agua al 8% detrás del texto, nueve cifras
     —tres saldos, tres barras, tres columnas y la franja de mora— y
     «ninguna es la que se va a pedir». Más un riel lateral de color y
     un `bg-[rgba(255,255,255,0.02)]` fijo, que en tema claro es un gris
     invisible sobre blanco.

     Ahora es `FilaCobro`, la misma que pinta /cobros-hoy, y el número
     sale al carril de `Carril`. Arreglar una arregla las dos: por no
     tenerlo así, el recibo de WhatsApp se reportó roto dos días
     seguidos. */
  /* `sinArrastre` es para el escritorio.
     El gesto es una pulsación LARGA con el dedo y en PC no hay forma de hacerlo;
     para eso está «Reordenar recorrido», que es su propia pantalla. Y hay una
     razón más fuerte: `arrastre.lista` es UN solo `ref`, y las dos vistas están
     montadas a la vez —`hidden lg:block` esconde por CSS, no desmonta—, así que
     colgarlo también de las tarjetas de PC dejaría al móvil midiendo el nodo
     equivocado. Sin error, sin pista y solo en el teléfono. */
  const renderCard = (fila, { actual, sinArrastre = false } = {}) => {
    // El índice REAL dentro de `clientesFiltrados`, que es el que
    // entiende `moverParadaEnRuta`. Agrupar no renumera —el número es la
    // posición en la ruta— así que sale del propio `orden`.
    const i = fila.orden - 1
    const g = sinArrastre ? {} : arrastre.gestos(i)
    return (
    <Carril
      key={fila.id}
      {...g}
      tenue={fila.zona !== 'hoy'}
      levantada={!sinArrastre && arrastre.arrastrando?.desde === i}
      destino={!sinArrastre && arrastre.arrastrando != null
        && arrastre.arrastrando.hasta === i
        && arrastre.arrastrando.desde !== i}
      /* ⚠ EL ANCLA DE VOLVER. `ruta-scroll-<id>` guarda a quién se
         entró y al volver se busca por este `id`. Me lo llevé por
         delante al sustituir la tarjeta: sin él `getElementById`
         devuelve null, no se restaura nada y el cobrador aparece
         arriba del todo con 200 clientes por debajo.

         ⚠ En escritorio NO: el `id` tiene que ser único en la página y las dos
         vistas están montadas a la vez. Dos nodos con el mismo `id` y
         `getElementById` devuelve el primero, que es el que está escondido. */
      ancla={sinArrastre ? undefined : ANCLA_CLIENTE(fila.id)}
      resaltada={highlightId === fila.id}
      orden={fila.orden}
      carrilSiempre={sinArrastre}
      cobrada={fila.cobrada}
      actual={actual}
      ultima={fila.ultima}
    >
      <FilaCobro
        {...fila}
        activa={actual}
        onClick={() => abrirPagoRapido(porId.get(fila.id))}
        /* ── EL NOMBRE Y LA FOTO LLEVAN A LA FICHA ──
           A la ficha del cliente, NO al cobro: `onMas` y `onClick` ya
           van los dos al cobro por caminos distintos, y lo que faltaba
           era ver a la persona —su historial, sus datos, sus otros
           préstamos—. En la tarjeta compacta, además, era el único
           destino posible: sin préstamo vivo el cobro rápido se sale
           por su propio `return` y la tarjeta no hacía nada. */
        /* ⚠ GUARDA EL SITIO ANTES DE SALTAR.
           Este era el camino roto: `onClick` y `onMas` pasaban los dos
           por `navegarACobroCliente`, que guarda, y el nombre saltaba
           pelado. Al volver de la ficha la lista aparecía arriba del
           todo — con 322 clientes en una ruta, eso es bajar a mano.
           Y es justo el ÚNICO destino de la tarjeta compacta cuando el
           cliente no tiene préstamo vivo. */
        onAbrirCliente={() => irGuardando(porId.get(fila.id) ?? fila, i, `/clientes/${fila.id}`)}
        onLlamar={porId.get(fila.id)?.telefono
          ? () => { window.location.href = `tel:${porId.get(fila.id).telefono}` }
          : undefined}
        onWhatsApp={porId.get(fila.id)?.telefono ? () => abrirWhatsApp(porId.get(fila.id)) : undefined}
        onMapa={porId.get(fila.id)?.latitud != null ? () => abrirMapa(porId.get(fila.id)) : undefined}
        onMas={() => abrirClienteDesdeRuta(porId.get(fila.id), i)}
        onDeshacerCobro={esOwner && fila.pagoHoyId
          ? () => setConfirmDeshacer({
              pagoId: fila.pagoHoyId,
              nombre: fila.nombre,
              monto:  fila.montoCobrado,
            })
          : undefined}
        onCerrarVisita={() => cerrarVisita(porId.get(fila.id))}
        onReabrir={() => reabrirVisita(porId.get(fila.id))}
        /* ── LO QUE HACE EL BOTÓN GRANDE CUANDO HOY NO HAY COBRO ──
           Cobrar antes / Cobrar (recuperación) / Prestarle / Sacar de
           la ruta. Con «Cobrar» en los cuatro, el cobrador le pide la
           cuota a quien no debe nada. */
        onAccion={() => {
          const c = porId.get(fila.id)
          if (fila.contexto?.zona === 'sindeuda') irGuardando(porId.get(fila.id) ?? fila, i, `/prestamos/nuevo?clienteId=${fila.id}`)
          else if (fila.contexto?.zona === 'inactivo') setConfirmQuitar({ id: fila.id, nombre: fila.nombre })
          else abrirPagoRapido(c)
        }}
      />
    </Carril>
    )
  }

  /* Las paradas ya adaptadas: las MISMAS para la tabla de escritorio, para las
     tarjetas de escritorio y para la lista de móvil. Estaban dentro de la rama
     de móvil y por eso la tabla se calculaba sus propias filas por otro camino:
     dos cuentas del mismo número es como acaban diciendo cosas distintas. */
  const conMoratorio = clientesFiltrados.map((c) => ({
    ...c,
    // El moratorio depende de la CONFIGURACIÓN DE LA RUTA (tasa y días
    // de gracia), no del cliente, así que no puede salir del adaptador
    // compartido: se resuelve aquí y viaja ya resuelto.
    moratorioPendiente: c.diasMora > 0
      && (ruta?.configMoratorio?.tasaMoratorio ?? 0) > 0
      && c.diasMora > (ruta.configMoratorio.diasGracia || 5),
  }))
  /* ── UNA SOLA LISTA, TODOS DENTRO ──────────────────────────────
     Antes esto devolvía `{ visitas, tambien }` y la pantalla pintaba
     las visitas numeradas y a los demás en un fondo de saco sin número
     ni datos. El dueño lo rebatió con la pantalla delante: «salen hasta
     abajo, sin ninguna numeración, sin ningún dato de sus préstamos,
     sin ningún contexto, nada».

     `visitas` sigue saliendo, pero solo para CONTAR: el «Empezar
     recorrido · 67» y las paradas por hacer cuentan cobros, no
     clientes, y ahí la regla de la lámina sigue en pie. */
  const { filas, visitas } = paradasDeRuta(conMoratorio, { formatear: (n) => formatMoney(n) })
  const pendientes = visitas.filter((f) => !f.cobrada)
  // La parada actual es la PRIMERA sin cobrar de toda la lista, no la
  // primera de cada grupo: es donde el cobrador está parado ahora.
  const idActual = pendientes[0]?.id

  /* Lo que enseña el escritorio con cada pastilla: «Hoy» son las paradas del
     día y «Todos» la ruta entera. Sale de las mismas `filas` que la tabla, para
     que cambiar de vista no cambie a quién se ve. */
  const filasEscritorio = modoVista === 'auditoria' ? filas : filas.filter((f) => f.zona === 'hoy')




  const clientesConCoords = ruta?.clientes?.filter((c) => c.latitud != null && c.longitud != null).length ?? 0

  /* ── LA CABECERA DEL SISTEMA, EN LUGAR DE LA HECHA A MANO ─────────────────
   * Aquí abajo había una copia divergente: 21px de título contra los 17 del
   * sistema, y 12 de subtítulo contra 11. Se retiró; esto la sustituye.
   *
   * El lápiz de renombrar va en `acciones`, que es su sitio: la cabecera de
   * detalle acepta «las acciones DE ESE objeto» (`CabeceraMovil.jsx:162`). El
   * campo de edición y sus botones de guardar/cancelar siguen donde estaban.
   *
   * ⚠ `acciones` NO entra en la clave de re-suscripción de `useCabecera`, así
   * que va memoizada — lo pide el docblock del hook y `asistente/page.jsx` es
   * el ejemplo de lo que pasa cuando no se hace.
   */
  const accionesCabecera = useMemo(() => (
    esOwner && ruta && !editandoNombre ? (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {/* ⚠ AQUÍ Y NO SOLO EN ESCRITORIO: el subtítulo de esta misma cabecera
            es el único sitio de la app donde el teléfono dice quién cobra la
            ruta, así que el botón para cambiarlo va pegado a ese dato. */}
        <button
          type="button"
          onClick={() => setModalCobrador(true)}
          aria-label={ruta.cobrador ? 'Cambiar el cobrador de la ruta' : 'Asignar un cobrador a la ruta'}
          title={ruta.cobrador ? 'Cambiar el cobrador' : 'Asignar un cobrador'}
          style={{
            width: 40, height: 40, borderRadius: 12, border: 0, background: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: ruta.cobrador ? 'var(--cf-ink-3)' : 'var(--cf-gold-dark)',
            flex: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 20v-1.5a4 4 0 00-4-4H7a4 4 0 00-4 4V20" />
            <circle cx="9.5" cy="7" r="3.5" />
            <path d="M18 6.5v5M20.5 9h-5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => { setNuevoNombre(ruta.nombre); setEditandoNombre(true) }}
          aria-label="Cambiar el nombre de la ruta"
          style={{
            width: 40, height: 40, borderRadius: 12, border: 0, background: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--cf-ink-3)', flex: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    ) : null
  ), [esOwner, ruta, editandoNombre])

  useCabecera({
    titulo: ruta?.nombre,
    subtitulo: ruta ? [
      ruta.cobrador?.nombre ?? 'sin cobrador',
      `${ruta.clientes?.length ?? 0} ${(ruta.clientes?.length ?? 0) === 1 ? 'cliente' : 'clientes'}`,
      // Solo si se pudo medir: con menos de dos clientes con coordenadas la API
      // devuelve null, y «0 km» se leería como que están todos en el mismo portal.
      ruta.distanciaMetros != null ? formatearKm(ruta.distanciaMetros) : null,
    ].filter(Boolean).join(' · ') : null,
    acciones: accionesCabecera,
  })

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
      // ── «HECHO» NO ES «PAGO ALGO» ──
      // Estaba en `!!c.pagoHoy`, y eso da por cerrada la parada de quien pago
      // UNO de sus dos prestamos: Ana Milena aparecia como cobrada con la mitad
      // del dia sin cobrar, y el recorrido pasaba de largo por su casa.
      // La API ya distingue las dos cosas — `pagoHoy` es «pago algo» y
      // `cobroPendienteHoy` es «le queda algo». La que manda es la segunda.
      cobradoHoy: !c.cobroPendienteHoy,
      montoACobrar: c.cuota,
      montoCobrado: c.montoPagadoHoy,
      debe: c.saldoPendiente,
      metros: c.distanciaMetros,
    }))

  const recorrido = partirRecorrido(paradasDeHoy, (n) => formatMoney(n))

  // El cuadre del fajo: cobrado en efectivo - entregado en prestamos - gastos.
  // Lo usan la pantalla de cierre (T04-03) y el modal de registrar cierre, y
  // sale del MISMO sitio en los dos — que es lo que evita tener dos cifras
  // distintas para la misma pregunta.
  // Lo que ahorraria reordenar por cercania. Se calcula con las MISMAS
  // funciones que el «3,4 km» de la cabecera —`optimizeRoute` y
  // `totalDistance`, las dos ya existian— para que las dos cifras no puedan
  // contradecirse. `null` con menos de tres paradas con coordenadas: con dos no
  // hay nada que reordenar.
  const propuestaOptimizar = (() => {
    const conCoords = (ruta?.clientes ?? []).filter((c) => c.latitud != null && c.longitud != null)
    if (conCoords.length < 3) return null
    const actual = totalDistance(conCoords)
    const propuesta = totalDistance(optimizeRoute(conCoords))
    if (!(actual > propuesta)) return null
    return propuestaPorCercania({ actualMetros: actual, propuestaMetros: propuesta })
  })()

  const cierreHoyRuta = cierreDelDia({
    cobradoEfectivo: ruta?.recaudadoEfectivoHoy,
    prestadoEfectivo: ruta?.desembolsadoEfectivoHoy,
    gastos: ruta?.gastosEfectivoHoy,
  }, (n) => formatMoney(n))

  // ── LA HOJA DE COBRO, FUERA DEL JSX PRINCIPAL ──
  // Vive en una variable porque hace falta en LAS DOS pantallas: la lista y
  // el modo recorrido. Estaba solo en el `return` de abajo, y como el
  // recorrido sale antes, pulsar «Cobrarle a Ana Milena» no abria nada — el
  // cobrador daba toques a la pantalla sin que pasara nada.
  // La pantalla de «cobro hecho». Se pinta encima de todo —tambien del modo
  // recorrido— porque es la confirmacion de que la plata entro, y eso no puede
  // quedar debajo de nada.
  //
  // POR UN PORTAL, no en su sitio del arbol. `position: fixed` se ancla al
  // ancestro con `transform` mas cercano, no a la ventana, y la ruta tiene
  // varios (las transiciones de pagina). El resultado era una capa que empezaba
  // a media pantalla y dejaba la lista de clientes viendose por detras: no
  // parecia una confirmacion, parecia un fallo de pintado.
  //
  // z-index por encima de la hoja de cobro (10001): el recibo la sustituye.
  const pantallaRecibo = reciboCobro && typeof document !== 'undefined' ? createPortal(
    <div data-recibo="1" className={CAPA_RECIBO.className} style={CAPA_RECIBO.style}>
      <Recibo
        monto={formatMoney(reciboCobro.monto)}
        cliente={reciboCobro.nombre}
        saldo={reciboCobro.saldo != null ? formatMoney(Math.round(reciboCobro.saldo)) : null}
        proximoCobro={reciboCobro.proximoCobro
          ? new Date(reciboCobro.proximoCobro).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
          : null}
        numero={reciboCobro.numero}
        // Cómo va el día. `ruta` ya está recargada cuando esto se pinta.
        progresoDia={(ruta?.esperadoHoy ?? 0) > 0 ? {
          texto: `${formatMoney(ruta.recaudadoHoy ?? 0)} de ${formatMoney(ruta.esperadoHoy)}`,
          porcentaje: Math.round(((ruta.recaudadoHoy ?? 0) / ruta.esperadoHoy) * 100),
        } : null}
        negocio={orgNombre}
        cuando={new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
        recibidoPor={ruta?.cobrador?.nombre ?? null}
        telefono={ruta?.clientes?.find((c) => c.id === reciboCobro.clienteId)?.telefono ?? null}
        onWhatsApp={() => {
          const c = ruta?.clientes?.find((x) => x.id === reciboCobro.clienteId)
          // Sin exigir teléfono: la hoja ya avisa y deja copiar el mensaje,
          // que es más útil que no abrir nada.
          /* El préstamo, de la respuesta del cobro. El recibo de WhatsApp leía
             el estado de la pantalla igual que la imagen, así que decía el
             mismo saldo viejo. Arreglar solo la imagen habría dejado el mismo
             fallo por el otro camino, que ya pasó una vez con este recibo. */
          if (c) setModalWA({ cliente: c, prestamo: reciboCobro?.prestamo ?? c.prestamosActivos?.[0] ?? null })
        }}
        onSiguiente={() => {
          setReciboCobro(null)
          // «El nombre del siguiente» es la accion dorada: se busca la proxima
          // parada pendiente y se abre su cobro. Si no queda ninguna, el
          // recorrido ha terminado y la pantalla de cierre toma el relevo.
          const siguiente = (ruta?.clientes ?? []).find((c) => c.cobroPendienteHoy && c.id !== reciboCobro.clienteId)
          if (siguiente) abrirPagoRapido(siguiente)
        }}
        siguienteNombre={(ruta?.clientes ?? []).find((c) => c.cobroPendienteHoy && c.id !== reciboCobro.clienteId)?.nombre ?? null}
        /* ⚠ ESTOS DOS NO ESTABAN, y sus botones se pintaban igual: «Guardar
           imagen» e «Imprimir» llevaban aquí sin hacer NADA desde que se montó
           la pantalla. Un botón sin función detrás no da error ni se ve
           distinto — apareció al unificar el comprobante con la ficha del
           préstamo, que sí los tenía conectados.

           Las dos acciones viven en `lib/recibo-acciones.js` para que los tres
           caminos impriman lo mismo. */
        onGuardarImagen={() => guardarReciboImagen(datosDelComprobante())}
        onImprimir={() => imprimirRecibo(datosDelComprobante())}
        onCerrar={() => setReciboCobro(null)}
      />
    </div>,
    document.body,
  ) : null

  const hojaCobro = (
    <>
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
            // Cuál está dado por perdido. La hoja de cobro es donde peor se
            // notaba: es la pantalla en la que se decide sobre cuál entra la
            // plata, y las dos filas se leían igual.
            esClavo: !!pr.esClavo,
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
    </>
  )

  if (enRecorrido) {
    // ── SE ACABO EL RECORRIDO → LA PANTALLA DE CIERRE (T04-03) ──
    //
    // No hay una tercera pantalla ni un boton de «terminar»: cuando ya no queda
    // parada actual, el recorrido ES el cierre. Su propia ayuda lo dice —
    // «aparece cuando terminas el recorrido, no todo el dia»— y hasta ahora el
    // cobrador cerraba caja tecleando un total a secas, de noche y con el fajo
    // en la mano.
    if (!recorrido.actual) {
      return (
        <CapaRecorrido>
        <RutaCerrada
          titulo={ruta?.nombre}
          terminado={recorrido.posicion}
          onAtras={() => setEnRecorrido(false)}
          resumen={resumenDeCierre(ruta ?? {}, (n) => formatMoney(n))}
          // LA RESTA QUE SE HACIA DE CABEZA: lo cobrado en efectivo menos lo
          // que se entrego en prestamos y menos los gastos. Las tres salen de
          // `MovimientoCapital`, que es el libro unico — no se recalculan por
          // otro camino, que es como se acaban teniendo dos cifras distintas.
          cierre={cierreDelDia({
            cobradoEfectivo: ruta?.recaudadoEfectivoHoy,
            prestadoEfectivo: ruta?.desembolsadoEfectivoHoy,
            gastos: ruta?.gastosEfectivoHoy,
          }, (n) => formatMoney(n))}
          onCerrar={() => setModalCaja(true)}
          cerrando={guardandoCaja}
        />
        {hojaCobro}
        {pantallaRecibo}
        </CapaRecorrido>
      )
    }

    // SIN ARMAZON Y SIN NADA MAS. La lamina la dibuja a pantalla completa: el
    // cobrador esta de pie, con una mano, y cualquier cosa de mas es un toque
    // equivocado.
    return (
      <CapaRecorrido>
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
          // ⚠ LA HOJA DE PLANTILLAS, no un `wa.me` pelado. Abría el chat VACÍO:
          // el cobrador, en la puerta del cliente, tenía que escribir el aviso a
          // mano. Es el mismo fallo que el botón de la tarjeta de cobrar hoy.
          const c = ruta?.clientes?.find((x) => x.id === recorrido.actual?.id)
          if (!c) return
          const pr = c.prestamosActivos?.[0]
          setModalWA({
            cliente: c,
            prestamo: pr ? {
              ...pr,
              estado: c.estado === 'completado' ? 'completado' : 'activo',
              porcentajePagado: pr.totalAPagar > 0 ? Math.round((pr.totalPagado / pr.totalAPagar) * 100) : 0,
            } : null,
          })
        }}
        onParada={(pa) => {
          const c = ruta?.clientes?.find((x) => x.id === pa?.id)
          if (c) abrirPagoRapido(c)
        }}
      />
      {hojaCobro}
      {pantallaRecibo}
      </CapaRecorrido>
    )
  }

  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0

  return (
    <>
    {/* ── T04-09 · LA RUTA EN ESCRITORIO ──
        En 1440 la ruta es una TABLA, no nueve tarjetas apiladas. El pie de la
        lamina lo explica: sentado y con ancho de sobra, comparar dos cifras que
        estan en la misma columna no deberia costar recorrer nueve bloques.
        El resumen del dueño se va a la derecha «donde no estorba el trabajo», y
        la fila de botones que hoy se sale de la pantalla sube al encabezado.

        Se pinta por CSS y no por JavaScript —`hidden lg:block`— igual que el
        resto de la app: sin medir la ventana no hay parpadeo al cargar ni dos
        arboles con estado distinto. Las dos vistas comparten handlers, asi que
        cobrar es el mismo cobro en las dos. */}
    {/* ── ORDENAR EL RECORRIDO, TAMBIEN SENTADO ──
        «Reordenar recorrido» de la tabla llamaba a `setModoVista('ordenar')`,
        pero la rama de PC solo miraba si era `'auditoria'`: cualquier otro
        valor pintaba la tabla de siempre. O sea que el enlace estaba a la
        vista, se pulsaba, y NO PASABA NADA.

        Se monta el MISMO `OrdenRecorrido` que usa el movil —con su arrastre,
        su rebote de un segundo y su cola offline—, no una segunda version para
        escritorio: dos implementaciones del mismo orden acabarian discrepando.

        ⚠ Y EN UNA COLUMNA CENTRADA, no a todo el ancho. Medido con el armazón
        real: las filas salían a 1.134px para llevar «⠿ · 1 · Carlos Julián ·
        410 m» — el nombre pegado a un extremo, la distancia al otro y un metro
        de vacío en medio. Y arrastrar de una esquina a la otra en una fila de
        metro y medio es peor que en una de 720: lo que cuesta es el recorrido
        del ratón. Es la misma medida que usan las demás fichas de escritorio. */}
    {modoVista === 'ordenar' && (
      <div className="hidden lg:block max-w-[720px] mx-auto">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setModoVista('trabajo')}
            style={{
              background: 'none', border: 0, padding: 0, cursor: 'pointer',
              font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}
          >← Volver a los cobros</button>
        </div>
        <OrdenRecorrido
          detalle={[
            `${clientesFiltrados.length} ${clientesFiltrados.length === 1 ? 'parada' : 'paradas'}`,
            ruta.distanciaMetros != null ? formatearKm(ruta.distanciaMetros) : null,
          ].filter(Boolean).join(' · ')}
          paradas={tramosDelRecorrido(clientesFiltrados.map((c, i) => ({
            /* ⚠ EL `id` NO ESTABA, y sin él «quitar de la ruta» no podía
               funcionar: el botón manda `parada.id` al API y llegaba
               `undefined`, así que el servidor respondía «cliente no encontrado
               en esta ruta» y la pantalla enseñaba «No se pudo quitar de la
               ruta» sin decir por qué.
               `RutaEditar` además usa `key={p.id}`: React estaba pintando la
               lista entera con claves vacías. */
            id: c.id,
            orden: i + 1,
            nombre: c.nombre,
            direccion: c.direccion,
            diasMora: c.diasMora,
            metros: c.distanciaMetros,
          })))}
          onReordenar={(desde, hasta) => {
            // ⚠ SOBRE LA RUTA ENTERA, no sobre lo filtrado.
            // Reordenar `clientesFiltrados` y guardarlo mandaba SOLO esos ids:
            // el servidor les pone ordenRuta 0,1,2… y los que no salían se
            // quedaban con números viejos que ahora chocan. Con «Solo hoy»
            // puesto —un botón que está al lado de «Ordenar»— la ruta quedaba
            // revuelta.
            const movidos = moverParadaEnRuta(ruta?.clientes ?? [], clientesFiltrados, desde, hasta)
            setRuta((prev) => (prev ? { ...prev, clientes: movidos } : prev))
            guardarOrden(movidos)
          }}
          estado={ordenError ?? (ordenOffline ? 'Guardado en el teléfono, se sube al volver la señal'
            : ordenGuardado ? 'Guardado' : null)}
          onPosicion={reordenarPorNumero}
          onQuitar={quitarDeLaRuta}
        />
      </div>
    )}

    <div className={modoVista === 'ordenar' ? 'hidden' : 'hidden lg:block'}>
      <RutaEscritorio
        nombre={ruta.nombre}
        subtitulo={[
          ruta.cobrador?.nombre ? `Cobra ${ruta.cobrador.nombre}` : 'Sin cobrador',
          `${ruta.clientes?.length ?? 0} ${(ruta.clientes?.length ?? 0) === 1 ? 'cliente' : 'clientes'}`,
          `${paradasPorHacer} ${paradasPorHacer === 1 ? 'cobro programado hoy' : 'cobros programados hoy'}`,
          ruta.distanciaMetros != null ? formatearKm(ruta.distanciaMetros) : null,
        ].filter(Boolean).join(' · ')}
        /* ⚠ SIN `migaVolver`: EN PC SALÍAN DOS BOTONES DE VOLVER, uno encima
           del otro. La misma queja del dueño —«no se puede volver atrás con un
           botón a la ruta»— se arregló dos veces sin que ninguna supiera de la
           otra: aquí con la miga, y en `VolverEscritorio` (Armazon.jsx), que
           es la salida de TODAS las pantallas de detalle y sale sola encima de
           esta. Se queda la del armazón, que es la que la gente ya conoce del
           resto de la app. Si esta miga vuelve, vuelven los dos botones. */
        acciones={[
          // Con rótulo, no solo el icono de la cabecera: en PC hay sitio y este
          // es el botón que el dueño buscó y no encontró.
          ...(esOwner ? [{
            id: 'cobrador',
            texto: ruta.cobrador ? 'Cambiar cobrador' : 'Asignar cobrador',
            onClick: () => setModalCobrador(true),
          }] : []),
          // Mismo 404 que arriba: en escritorio llevaba meses abriendo una
          // pestaña vacía. `window.print()` es lo que hace el botón de móvil.
          { id: 'imprimir', texto: 'Imprimir hoja', onClick: () => window.print() },
          // ⚠ `abrirModalClientes`, NO `setModalClientes`: la que trae la lista
          // es la primera (hace el fetch de `/api/clientes` y separa los que no
          // tienen ruta). Con `setModalClientes` el modal abria VACIO y decia
          // «Todos los clientes ya tienen ruta asignada», que era mentira.
          { id: 'agregar', texto: 'Agregar cliente', onClick: () => abrirModalClientes() },
          /* ⚠ CUENTA PUERTAS POR TOCAR, no deudas abiertas.
             `ruta.pendientesHoy` viene del servidor e incluye al que el
             cobrador ya cerró a mano —y eso está bien ahí: ese cliente sigue
             debiendo y sigue contando en el esperado del día—. Pero como
             número de paradas mentiría: diría 134 cuando quedan 133 puertas,
             que es exactamente lo que la Adenda 5 reprocha —«un contador que
             incluye paradas que no se hacen es peor que no tener contador»—. */
          ...(paradasPorHacer > 0
            ? [{ id: 'recorrido', texto: `Empezar recorrido · ${paradasPorHacer}`, principal: true, onClick: () => setEnRecorrido(true) }]
            : []),
        ]}
        chips={[{ id: 'trabajo', texto: 'Hoy', conteo: paradasPorHacer },
                { id: 'auditoria', texto: 'Todos', conteo: ruta.clientes?.length ?? 0 }]}
        chipActivo={modoVista === 'auditoria' ? 'auditoria' : 'trabajo'}
        onChip={(v) => setModoVista(v)}
        onReordenar={() => setModoVista('ordenar')}
        vista={vistaPC}
        onVista={cambiarVistaPC}
        /* ── LAS MISMAS TARJETAS DEL TELÉFONO, AQUÍ ────────────────────────
           `renderCard` es la que pinta la lista de móvil; se llama igual y con
           las mismas `filas`. Lo único distinto es `sinArrastre`, porque el
           gesto es una pulsación larga con el dedo.

           La rejilla se acomoda sola: una columna en pantallas justas y dos
           cuando caben 420px cada una. Sin `auto-fit` habría que elegir un
           número de columnas y en el portátil del dueño saldrían dos tarjetas
           espachurradas. */
        tarjetas={(
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 10, alignItems: 'start',
          }}>
            {filasEscritorio.map((f) => renderCard(f, { actual: f.id === idActual, sinArrastre: true }))}
            {filasEscritorio.length === 0 && (
              <p style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13, color: 'var(--cf-ink-3)' }}>
                Ningún cliente tiene cobro con este filtro.
              </p>
            )}
          </div>
        )}
        onQuitar={(f) => setConfirmQuitar({ id: f.id, nombre: f.nombre })}
        filas={(modoVista === 'auditoria'
          ? (ruta.clientes ?? [])
          : (ruta.clientes ?? []).filter((c) => c.cobroPendienteHoy || c.pagoHoy)
        ).map((c, i) => ({
          id: c.id,
          orden: i + 1,
          iniciales: inicialesDe(c.nombre),
          nombre: c.nombre,
          donde: [c.direccion, (c.prestamosActivos?.length ?? 0) > 1
            ? `${c.prestamosActivos.length} préstamos` : null].filter(Boolean).join(' · '),
          diasMora: c.diasMora ?? 0,
          cuotaHoy: formatMoney(c.cuota ?? 0),
          atraso: formatMoney(c.montoParaPonerseAlDia ?? 0),
          atrasoNumero: c.montoParaPonerseAlDia ?? 0,
          // `null` no es 0%: al cliente recien prestado no le ha vencido nada.
          cumple: c.cumplimiento != null ? `${c.cumplimiento}%` : '—',
          cumpleNumero: c.cumplimiento,
          // `saldoPendiente` NO existe a nivel de cliente en esta API — vive en
          // cada prestamo. Ponia «Debe $0» a gente que debe $638.000, que es la
          // clase de error que hace desconfiar de toda la pantalla.
          debe: formatMoney((c.prestamosActivos ?? []).reduce((n, pr) => n + (pr.saldoPendiente ?? 0), 0)),
          cobrada: !c.cobroPendienteHoy && !!c.pagoHoy,
        }))}
        onCobrar={(f) => {
          const c = ruta.clientes?.find((x) => x.id === f.id)
          if (c) abrirPagoRapido(c)
        }}
        onWhatsApp={(f) => {
          const c = ruta.clientes?.find((x) => x.id === f.id)
          if (!c) return
          const pr = c.prestamosActivos?.[0]
          setModalWA({
            cliente: c,
            prestamo: pr ? {
              ...pr,
              estado: c.estado === 'completado' ? 'completado' : 'activo',
              porcentajePagado: pr.totalAPagar > 0 ? Math.round((pr.totalPagado / pr.totalAPagar) * 100) : 0,
            } : null,
          })
        }}
        onFila={(f) => {
          const c = ruta.clientes?.find((x) => x.id === f.id)
          if (c) abrirClienteDesdeRuta(c, 0)
        }}
        porCobrarHoy={formatMoney(Math.max(0, (ruta.esperadoHoy ?? 0) - (ruta.recaudadoHoy ?? 0)))}
        recaudadoHoy={formatMoney(ruta.recaudadoHoy ?? 0)}
        progreso={ruta.esperadoHoy > 0 ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0}
        conteoCobros={`${ruta.clientesPagaronHoy ?? 0} de ${ruta.clientesConCobroHoy ?? 0}`}
        cartera={[
          { texto: 'Pendiente por cobrar', valor: formatMoney(ruta.carteraTotal ?? 0) },
          { texto: 'Prestado (capital)', valor: formatMoney(ruta.capitalPendiente ?? 0) },
          { texto: 'Atraso acumulado', valor: formatMoney((ruta.clientes ?? []).reduce((n, c) => n + (c.montoParaPonerseAlDia ?? 0), 0)), tono: 'mora' },
          { texto: rotulo('clientesEnMora'), valor: `${ruta.enMora ?? 0} de ${ruta.clientes?.length ?? 0}`, tono: (ruta.enMora ?? 0) > 0 ? 'mora' : undefined },
        ]}
        cierreTexto={ruta.cierre
          ? 'El cierre de hoy ya está registrado.'
          : (ruta.recaudadoHoy ?? 0) > 0
            ? `Tienes ${cierreHoyRuta.total} para entregar.`
            : 'Se habilita al terminar el recorrido. Hoy no hay cobros registrados todavía.'}
        cierreListo={!ruta.cierre && (ruta.recaudadoHoy ?? 0) > 0}
        onCierre={() => { setTotalRecogido(''); setModalCaja(true) }}
      />
    </div>

    {/* La vista de movil, que es la que se usa en la calle. */}
    <div className="lg:hidden">
    <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4 pb-44 lg:pb-4">

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
          /* ── EL NOMBRE Y SUS DATOS SE FUERON A LA CABECERA ────────────────
             Aquí había una cabecera hecha a mano que copiaba la del sistema
             carácter por carácter pero con OTRAS medidas: 21px de título contra
             los 17 del sistema, y subtítulo a 12 contra 11. Es de las que hacían
             que dos pantallas equivalentes parecieran de apps distintas.

             Lo que se conserva entero es la EDICIÓN DEL NOMBRE: el campo, el
             guardar y el cancelar siguen aquí arriba, y el lápiz que la abre se
             pasa a `acciones` de la cabecera, que es su sitio —«las acciones DE
             ESE objeto», dice `CabeceraMovil.jsx:162`—.

             Rediseñar no puede llevarse una función por delante. */
          null
        )}
      </div>

      {/* Tocar el bloque negro abre la ficha de capital (T24-03). Era una cifra
          sin salida: el dueño la miraba y no tenia donde ir a entenderla. */}
      {/* ══ ORDENANDO, LO DE COBRAR ESTORBA ══════════════════════════════
          Al entrar en «Ordenar» seguían saliendo el capital de la ruta, lo
          recaudado hoy y la fila de herramientas: 740px de cosas que no sirven
          para ordenar. Medido en el navegador a 393px, la primera parada
          arrancaba en y=817 de una pantalla de 852 — o sea, había que bajar
          media pantalla para ver la lista que se viene a tocar.

          En escritorio esto ya se resolvía (`modoVista === 'ordenar' ? 'hidden'`
          en la rama de PC); en móvil se quedó sin hacer, que es justo donde el
          cobrador ordena su ruta. */}
      {modoVista !== 'ordenar' && (esOwner || puedeVerCapitalRuta) && (
      <div
        onClick={(esOwner || puedeVerCapitalRuta) ? () => setFichaCapital(true) : undefined}
        style={{ cursor: (esOwner || puedeVerCapitalRuta) ? 'pointer' : 'default' }}
      >
      <LoPuestoAqui {...loPuestoAqui({
          carteraTotal: ruta.carteraTotal,
          capitalPendiente: ruta.capitalPendiente,
          capitalTotal: ruta.capitalTotal,
          totalAPagarRuta: ruta.totalAPagarRuta,
          clientes: ruta.clientes,
        }, (n) => formatMoney(n))} />
      </div>
      )}

      {modoVista !== 'ordenar' && (
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
      )}

      {/* Acciones rápidas.
          "Hoja para salir a cobrar" estaba de quinta en esta fila con scroll
          horizontal y nacia fuera de pantalla en un movil de 390px. Se subio
          para que se vea sin arrastrar — pero NO va primera ni en dorado: eso
          le robaba el primer lugar a "+ Agregar", que es lo que de verdad usa
          a diario quien administra rutas con cobradores. Un cliente lo
          reporto. Visible != protagonista. */}
      {/* ⚠ LOS CHIPS SE SALEN DE LA PANTALLA. La fila se desplaza en horizontal,
          así que en un móvil de 390px «Optimizar», «Mapa» y los demás nacen
          fuera de la vista: hay que arrastrar para saber que existen. La caja
          los alcanza a todos sin arrastrar nada.
          Medido: cada negocio crea 1,5 rutas en dos meses. Es lo que menos se
          repite de todo lo que se mide, o sea lo que más se olvida. */}
      <RegistrarAcciones clave="ruta" acciones={accionesRuta} />
      <QueNecesitas ejemplos={['agregar clientes', 'optimizar', 'cerrar la caja']} />

      <div className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 ${modoVista === 'ordenar' ? 'hidden' : ''}`}>
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
            Clientes ({clientesFiltrados.length})
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


        {/* Toggle de vista: Trabajo del dia (3 secciones) vs Ordenar ruta (drag) vs Auditoria (admin) */}
        {ruta.clientes?.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1 p-1 rounded-[12px] flex-1 min-w-0 shrink-0 basis-[58%]" style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
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
            {/* ── «SOLO HOY»: ESCONDER A QUIEN NO TOCA ─────────────────────
                Reportado por un cobrador: «no me aparece la opción de quitar el
                cliente de la ruta si no le toca hoy».
                La lista YA se agrupa en «Por cobrar hoy / Ya pagaron / Próximos»,
                pero agrupar no es filtrar: con 33 clientes y 24 por cobrar,
                seguía pasando por todos. Y los dos iconos de al lado son
                plana/agrupada, no un filtro — por eso decía que la opción «no
                aparece»: no existía.
                Se recuerda entre visitas: quien trabaja así lo quiere siempre. */}
            {modoVista === 'trabajo' && (
              <button
                type="button"
                onClick={() => setSoloHoy(v => {
                  const nuevo = !v
                  try { localStorage.setItem('cf-ruta-soloHoy', nuevo ? '1' : '0') } catch {}
                  return nuevo
                })}
                className="shrink-0 h-10 px-2.5 rounded-[12px] border text-[12px] font-semibold transition-colors inline-flex items-center gap-1.5"
                title={soloHoy ? 'Mostrando solo los de hoy' : 'Mostrar todos los clientes'}
                aria-pressed={soloHoy}
                style={{
                  background: soloHoy ? 'var(--cf-gold-tint)' : 'transparent',
                  borderColor: soloHoy ? 'var(--cf-gold-border)' : 'var(--cf-border)',
                  color: soloHoy ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
                }}
              >
                {/* ⚠ «Hoy», no «Solo hoy». Con el segmentado de tres pestañas,
                    este botón y los dos iconos de vista compitiendo por 393px,
                    «Cobros · Ordenar · Auditoría» se apretaba hasta no leerse.
                    El icono de reloj y el estado encendido/apagado dicen lo
                    mismo que la palabra «solo», y el `title` lo explica. */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                </svg>
                Hoy
              </button>
            )}
            {modoVista === 'trabajo' && (
              <div className="flex rounded-[12px] border border-[var(--cf-border)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setVistaPlana(v => { if (v) return v; try { localStorage.setItem('cf-ruta-vistaPlana', 'plana') } catch {} return true })}
                  className="h-10 w-10 flex items-center justify-center transition-colors"
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
                  className="h-10 w-10 flex items-center justify-center transition-colors"
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


          // MODO ORDENAR: lista plana con drag-and-drop (comportamiento original).
          if (modoVista === 'ordenar') {
            // ── T24-02 «REORDENAR EL RECORRIDO — NUNCA EXISTIO» ──
            //
            // Eran las MISMAS tarjetas de cobro con un asa pegada: se arrastraba
            // sobre una lista pensada para otra cosa, con el monto, el boton de
            // cobrar y el de WhatsApp compitiendo con el gesto de arrastrar.
            //
            // `OrdenRecorrido` las reduce a lo unico que importa cuando ordenas:
            // el numero, el nombre, donde vive y cuanto hay de una a la
            // siguiente. Y añade el consejo, que es lo que nadie sabia: «asi es
            // como te van a salir los cobros cada dia».
            //
            // El guardado NO cambia: sigue `guardarOrden`, con su rebote de un
            // segundo, su cancelacion de la peticion anterior y su cola offline.
            return (
              <OrdenRecorrido
                detalle={[
                  `${clientesFiltrados.length} ${clientesFiltrados.length === 1 ? 'parada' : 'paradas'}`,
                  ruta.distanciaMetros != null ? formatearKm(ruta.distanciaMetros) : null,
                ].filter(Boolean).join(' · ')}
                paradas={tramosDelRecorrido(clientesFiltrados.map((c, i) => ({
                  // El `id`: sin él «quitar de la ruta» manda `undefined` y el
                  // API responde que no encuentra al cliente. Ver la nota del
                  // otro montaje, en la rama de escritorio.
                  id: c.id,
                  orden: i + 1,
                  nombre: c.nombre,
                  direccion: c.direccion,
                  diasMora: c.diasMora,
                  metros: c.distanciaMetros,
                })))}
                onReordenar={(desde, hasta) => {
                  // ⚠ SOBRE LA RUTA ENTERA, no sobre lo filtrado.
                  // Reordenar `clientesFiltrados` y guardarlo mandaba SOLO esos ids:
                  // el servidor les pone ordenRuta 0,1,2… y los que no salían se
                  // quedaban con números viejos que ahora chocan. Con «Solo hoy»
                  // puesto —un botón que está al lado de «Ordenar»— la ruta quedaba
                  // revuelta.
                  const movidos = moverParadaEnRuta(ruta?.clientes ?? [], clientesFiltrados, desde, hasta)
                  setRuta((prev) => (prev ? { ...prev, clientes: movidos } : prev))
                  guardarOrden(movidos)
                }}
                estado={ordenError ?? (ordenOffline ? 'Guardado en el teléfono, se sube al volver la señal'
                  : ordenGuardado ? 'Guardado' : null)}
                onPosicion={reordenarPorNumero}
                onQuitar={quitarDeLaRuta}
              />
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
                      <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{rotulo('clientesEnMora')}</p>
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
                                  <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-[.07em] px-1.5 py-0.5 rounded-md"
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
                                    /* La tercera vía, en la vista de auditoría. Con `-1` el
                                       índice lo busca ella sola. */
                                    onClick={() => irGuardando(c, -1, `/clientes/${c.id}`)}
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

          /* ── MODO TRABAJO · LA RUTA EN DOS ZONAS (E09) ─────────────────
             Arriba las VISITAS, numeradas en el carril; abajo «también en esta
             ruta», sin número.

             La regla de la lámina es de aritmética, no de estética: «el carril
             numera visitas, no clientes». Un contador que incluye paradas que
             no se hacen es PEOR que no tener contador — el cobrador lee «16
             cobros», hace los diez que había de verdad y se cree atrasado
             yendo al día. Antes las tres secciones numeraban sobre la ruta
             entera, así que el que hoy no tocaba también gastaba número. */

          /* El rótulo es AHORA EL PLEGADOR, y no un botón al lado: es la única
             pieza fija de la sección, la que se sigue viendo con cien tarjetas
             debajo, y es donde se toca por instinto.

             La cuenta se queda puesta con la sección cerrada —«Por cobrar hoy ·
             100»— porque plegada es lo único que dice cuánto hay ahí dentro. */
          const Rotulo = ({ titulo, cuantos, color, clave, cerrado }) => (
            <button
              type="button"
              onClick={() => plegarGrupo(clave)}
              aria-expanded={!cerrado}
              className="w-full flex items-center gap-2 mb-2 mt-1 px-1 text-left"
              style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit', minHeight: 34 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color || 'var(--cf-ink-3)'}
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                style={{ flex: 'none', transform: cerrado ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
              <span className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color: color || 'var(--cf-ink-3)' }}>
                {titulo}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                {cuantos}
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--cf-border)' }} />
            </button>
          )

          return (
            /* El hueco es para la barra flotante de «Empezar recorrido», que va
               `fixed` sobre la pastilla de navegación. Sin él tapa la última
               ficha para siempre —y ahora tapa justo su botón de cobrar, que
               pasó a ser el pie de la tarjeta—: la lista se acaba y no hay a
               dónde seguir bajando. */
            <div className="space-y-5" style={{
              paddingBottom: paradasPorHacer > 0
                ? 'calc(var(--cf-nav-inset) + var(--cf-h-nav) + env(safe-area-inset-bottom, 0px) + 78px)'
                : undefined,
            }}>
              {/* ⚠ EL `ref` DEL ARRASTRE ENVUELVE A LAS DOS VISTAS.
                  El gesto mide las tarjetas buscándolas DENTRO de este nodo, y
                  la página monta la lista en dos ramas: si el `ref` colgara de
                  una sola, al cambiar de vista el arrastre dejaría de encontrar
                  nada y no pasaría nada al soltar — sin error y sin pista. */}
              <div ref={arrastre.lista} className="space-y-5">
              {vistaPlana ? (
                /* LA LISTA COMPLETA: todos, en el orden de la ruta, cada uno con
                   su número y su tarjeta entera. Los que hoy no tienen cobro
                   llevan su pastilla —«Al día», «Clavo», «Sin préstamo»— y su
                   propio botón, pero por lo demás son la misma tarjeta. */
                <div className="flex flex-col gap-1.5">
                  {filas.map((f) => renderCard(f, { actual: f.id === idActual }))}
                </div>
              ) : (
                /* AGRUPADA: las mismas tarjetas, repartidas por situación.
                   «Si se va a agrupar, que aparezcan los que se cobran hoy, los
                   que están al día, los que están con tarjeta clavo o los que
                   están sin préstamo.» El número NO se renumera por grupo: sigue
                   siendo la posición en la ruta. */
                <>
                  {gruposDeRuta(filas).map((g) => {
                    const cerrado = gruposCerrados.has(g.clave)
                    return (
                    <div key={g.clave}>
                      <Rotulo titulo={g.titulo} cuantos={g.filas.length} color={g.color}
                        clave={g.clave} cerrado={cerrado} />
                      {/* Cerrada NO SE PINTA, no se esconde con CSS: con 206
                          clientes en la ruta más grande, dejar las tarjetas
                          montadas y taparlas cuesta el mismo trabajo de pintado
                          que tenerlas a la vista, y el teléfono en el que se
                          cobra es el que lo paga. */}
                      {!cerrado && (
                        <div className="flex flex-col gap-1.5">
                          {g.filas.map((f) => renderCard(f, { actual: f.id === idActual }))}
                        </div>
                      )}
                    </div>
                    )
                  })}
                </>
              )}
              </div>
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
                  <p className="text-xs text-[var(--cf-ink-3)]">{abreviaturaDocumento()} {c.cedula}</p>
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
                  <p className="text-xs text-[var(--cf-ink-3)]">{abreviaturaDocumento()} {c.cedula}</p>
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
          {/* ── SE COMPARA CONTRA LO QUE DEBE TENER, NO CONTRA LA META ──
              Decia «Total esperado hoy» y restaba lo recogido MENOS lo esperado.
              Eso responde otra pregunta: si un cliente no pago, al cobrador le
              salia «Diferencia -$50.000» EN ROJO, como si le faltara plata a
              el. Y no le falta — es que ese cliente no pago, cosa que ya se
              sabe. Confundir «no cobre todo» con «me falta plata» acusa a quien
              acaba de trabajar todo el dia.

              Lo que hay que cuadrar es EL FAJO: lo cobrado en efectivo, menos
              lo que entrego en prestamos, menos lo que gasto. `cierreDelDia` ya
              lo calcula, y es el mismo que usa la pantalla de cierre. */}
          <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--cf-border)' }}>
            {cierreHoyRuta.lineas.map((l, i) => (
              <div key={l.id} className="flex justify-between items-center text-sm px-3.5 py-2.5"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)' }}>
                <span style={{ color: 'var(--cf-ink-3)' }}>{l.texto}</span>
                <span className="font-mono-display" style={{ fontWeight: 600, color: l.resta ? 'var(--cf-ink-2)' : 'var(--cf-ink)' }}>
                  {l.valor}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center px-3.5 py-3"
              style={{ borderTop: '1px solid var(--cf-border)', background: 'var(--cf-fill)' }}>
              <span style={{ fontWeight: 700, color: 'var(--cf-ink)' }}>{cierreHoyRuta.totalTexto}</span>
              <span className="font-mono-display" style={{ fontWeight: 700, fontSize: 17, color: cierreHoyRuta.aFavor ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}>
                {cierreHoyRuta.total}
              </span>
            </div>
          </div>

          <MoneyInput
            label="Cuanto traes de verdad"
            placeholder={cierreHoyRuta.total}
            value={totalRecogido}
            onChange={(e) => setTotalRecogido(e.target.value)}
          />

          {/* La diferencia, contra el fajo que TOCA. */}
          {totalRecogido && (() => {
            const debe = Math.abs(cierreHoyRuta.numeros?.neto ?? 0)
            const trae = Math.round(Number(String(totalRecogido).replace(/\./g, '')) || 0)
            const dif = trae - debe
            if (dif === 0) {
              return <p className="text-sm" style={{ color: 'var(--cf-green-dark)', fontWeight: 700 }}>Cuadra exacto.</p>
            }
            return (
              <p className="text-sm">
                <span style={{ color: 'var(--cf-ink-3)' }}>{dif > 0 ? 'Traes de mas: ' : 'Falta: '}</span>
                <span className="font-mono-display" style={{ fontWeight: 700, color: dif > 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                  {formatMoney(Math.abs(dif))}
                </span>
              </p>
            )
          })()}
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

      {/* ── Modal: quién cobra esta ruta ─────────────────────────────────────
           Un toque en el renglón asigna y cierra: elegir cobrador y luego
           «Guardar» son dos gestos para una sola decisión.

           ⚠ Se dice si el cobrador YA lleva otra ruta. Un cobrador puede
           llevar varias —el modelo lo permite y hay quien lo hace a propósito—
           pero asignarle una segunda sin enterarse es de donde salen los días
           en que nadie pasa por media cartera. */}
      <Modal
        open={modalCobrador}
        onClose={() => { setModalCobrador(false); setErrorCobrador('') }}
        title="¿Quién cobra esta ruta?"
        footer={<Button variant="secondary" onClick={() => { setModalCobrador(false); setErrorCobrador('') }}>Cerrar</Button>}
      >
        <div className="flex flex-col gap-2">
          {errorCobrador && (
            <div className="text-[var(--cf-red-dark)] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCobrador}
            </div>
          )}
          {cobradores.filter(c => c.activo !== false).length === 0 && (
            <p className="text-sm text-[var(--cf-ink-3)] py-2">
              Todavía no has creado ningún cobrador. Puedes crearlo desde la pantalla de Cobradores.
            </p>
          )}

          {[{ id: null, nombre: 'Sin cobrador', suelto: true },
            ...cobradores.filter(c => c.activo !== false)].map((c) => {
            const puesto = (ruta.cobrador?.id ?? null) === (c.id ?? null)
            const otraRuta = c.ruta && c.ruta.id !== ruta.id ? c.ruta.nombre : null
            return (
              <button
                key={c.id ?? 'ninguno'}
                type="button"
                disabled={guardandoCobrador || puesto}
                onClick={() => asignarCobrador(c.id)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] border text-left transition-colors"
                style={{
                  background: puesto ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
                  borderColor: puesto ? 'var(--cf-gold-border)' : 'var(--cf-border)',
                  cursor: puesto ? 'default' : 'pointer',
                  opacity: guardandoCobrador && !puesto ? 0.5 : 1,
                }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: c.suelto ? 'var(--cf-ink-3)' : 'var(--cf-ink)' }}>
                    {c.nombre}
                  </span>
                  {otraRuta && (
                    <span className="block text-[11px] mt-0.5 text-[var(--cf-ink-3)]">
                      Ya cobra en {otraRuta}
                    </span>
                  )}
                  {c.suelto && !puesto && (
                    <span className="block text-[11px] mt-0.5 text-[var(--cf-ink-3)]">
                      La ruta queda sin nadie asignado
                    </span>
                  )}
                </span>
                {puesto && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flex: 'none' }} aria-hidden="true">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                )}
              </button>
            )
          })}
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
        {/* ── SE DICE CUANTO SE AHORRA, NO SOLO QUE SE VA A REORDENAR ──
            Pedia confirmar a ciegas: «se reordenaran los clientes… esto puede
            cambiar el orden que configuraste». O sea, todo el riesgo enunciado
            y ninguna ganancia. Nadie acepta eso, y quien lo acepta no sabe que
            gano.

            `propuestaPorCercania` compara el recorrido de hoy con el que
            saldria, y la cuenta se hace AQUI con las mismas funciones que usa
            el servidor para el «3,4 km» de la cabecera. Si no hay coordenadas
            suficientes no se inventa nada: se cae al aviso de siempre. */}
        {propuestaOptimizar ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-[12px] px-3.5 py-3" style={{
              background: 'color-mix(in srgb, var(--cf-green) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--cf-green) 22%, transparent)',
            }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
                {propuestaOptimizar.titulo}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--cf-green-dark)', fontWeight: 600 }}>
                {propuestaOptimizar.detalle}
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
              Cambia el orden que hayas puesto a mano. Se puede volver a ordenar cuando quieras.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--cf-ink-3)]">
            Se reordenarán los clientes según su ubicación para crear la ruta más corta.
            Cambia el orden que hayas puesto a mano.
          </p>
        )}
      </Modal>

      {/* Modal: confirmar quitar cliente */}
      <Modal
        open={!!confirmQuitar}
        onClose={() => setConfirmQuitar(null)}
        title="Quitar cliente de la ruta"
        footer={
          /* ── DOS COSAS MAL, Y LA PRIMERA ERA ILEGIBLE ──
             1. El boton decia `color: var(--cf-ink)` sobre `--cf-red-dark`. En
                tema CLARO `--cf-ink` es casi negro: texto negro sobre rojo
                oscuro no se lee. Solo funcionaba de casualidad en oscuro.
             2. La accion destructiva llevaba TODO el peso visual. T13-03 lo
                invierte a proposito: quitar a un cliente de la ruta se deshace,
                pero hay que quererlo — el boton lleno es «Cancelar» y el rojo
                va de contorno. `PieGestion peligro` ya implementa esa regla. */
          <PieGestion
            peligro
            textoCancelar="Cancelar"
            onCancelar={() => setConfirmQuitar(null)}
            textoAceptar="Quitar de la ruta"
            onAceptar={() => confirmQuitar && quitarCliente(confirmQuitar.id)}
          />
        }
      >
        <p className="text-sm text-[var(--cf-ink-3)]">
          <span className="text-[var(--cf-ink)] font-medium">{confirmQuitar?.nombre}</span> será removido de esta ruta. Podrás reasignarlo después.
        </p>
      </Modal>

      {/* Modal: confirmar deshacer el cobro de hoy */}
      <Modal
        open={!!confirmDeshacer}
        onClose={() => setConfirmDeshacer(null)}
        title="Deshacer el cobro"
        footer={
          <PieGestion
            peligro
            textoCancelar="Cancelar"
            onCancelar={() => setConfirmDeshacer(null)}
            textoAceptar={deshaciendo ? 'Deshaciendo…' : 'Deshacer el cobro'}
            onAceptar={deshacerCobroDeParada}
          />
        }
      >
        <p className="text-sm text-[var(--cf-ink-3)]">
          Se borra el cobro de{' '}
          <span className="text-[var(--cf-ink)] font-medium">{confirmDeshacer?.monto}</span> de{' '}
          <span className="text-[var(--cf-ink)] font-medium">{confirmDeshacer?.nombre}</span>.
          La deuda vuelve como estaba y la caja de hoy deja de contarlo.
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

      {/* ── T24-03 · CAPITAL DE LA RUTA ──
          La pregunta que el dueño se hace mirando el bloque negro y que hasta
          hoy no tenia respuesta en ninguna pantalla: si tiene plata quieta,
          ¿conviene meterla en ESTA ruta? Por eso se abre desde ahi.

          `entroMes` y `salioAPrestarMes` salen de `MovimientoCapital`, el libro
          unico. La comparacion con las otras rutas usa el cumplimiento, que es
          la unica metrica que ya calculan todas por igual. */}
      {(esOwner || puedeVerCapitalRuta) && (
        <HojaInferior
          abierta={fichaCapital}
          onCerrar={() => setFichaCapital(false)}
          titulo="Capital de la ruta"
          subtitulo={ruta?.nombre}
        >
          <FichaRuta
            sinMargen
            puesto={formatMoney(Math.round(ruta?.capitalPendiente ?? 0))}
            prestado={formatMoney(Math.round(ruta?.capitalTotal ?? 0))}
            porGanar={formatMoney(Math.round((ruta?.carteraTotal ?? 0) - (ruta?.capitalPendiente ?? 0)))}
            rinde={ruta?.capitalPendiente > 0
              ? `${Math.round((((ruta.carteraTotal ?? 0) - ruta.capitalPendiente) / ruta.capitalPendiente) * 100)}%`
              : '—'}
            entro={formatMoney(ruta?.entroMes ?? 0)}
            salioAPrestar={formatMoney(ruta?.salioAPrestarMes ?? 0)}
            crecio={formatMoney(Math.abs((ruta?.entroMes ?? 0) - (ruta?.salioAPrestarMes ?? 0)))}
            crecioFavor={(ruta?.entroMes ?? 0) >= (ruta?.salioAPrestarMes ?? 0)}
            nombreRuta={ruta?.nombre}
            totalPrestamos={(ruta?.clientes ?? []).reduce((n, c) => n + (c.prestamosActivos?.length ?? 0), 0)}
            onVerPrestamos={() => router.push(`/prestamos?rutaId=${id}`)}
          />
        </HojaInferior>
      )}

      {/* ── EMPEZAR RECORRIDO ──
          La accion que abre la jornada, y la unica de esta pantalla que el
          cobrador pulsa todos los dias. Va fija abajo, sobre la pastilla, para
          que se alcance con el pulgar sin mirar. Solo sale si queda algo por
          cobrar: en una ruta terminada seria un boton que no lleva a ninguna
          parte. */}
      {/* Solo en «Cobros»: mientras se ordena o se audita, empezar el recorrido
          no es lo que se viene a hacer — y ahi el boton TAPABA la lista, que es
          justo lo que se esta manipulando. */}
      {/* ── ⚠ POR ENCIMA DE LA PASTILLA, NO DEBAJO ────────────────────────
          Estaba en `bottom: 92` con `zIndex: 40`, y la pastilla de navegación
          va en `zIndex: 45`: le ganaba y le pintaba encima. En el teléfono se
          veía «Empezar recorrido · 24» cortado por la mitad — con el botón
          que arranca la jornada.

          Las medidas, de los tokens: la pastilla se separa 18px del borde
          (`--cf-nav-inset`) y mide 62 de alto (`--cf-h-nav`), así que ocupa
          hasta los 80px. Los 92 de antes dejaban 12px de aire... pero el
          z-index lo mandaba detrás igual.

          Ahora se calcula desde los tokens en vez de un número a mano: si un
          día la pastilla cambia de alto, esto se mueve con ella. */}
      {/* ⚠ SON DOS BOTONES DISTINTOS. Este flotante es el que se ve en el
          teléfono; el de la barra de acciones de arriba casi no sale. Arreglé
          el contador solo en aquel y en la captura seguía diciendo 134 con 133
          puertas: hay que buscarlos TODOS, que es el fallo del comprobante. */}
      {modoVista === 'trabajo' && paradasPorHacer > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0,
          bottom: 'calc(var(--cf-nav-inset) + var(--cf-h-nav) + env(safe-area-inset-bottom, 0px) + 12px)',
          zIndex: 46,
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
            Empezar recorrido · {paradasPorHacer}
          </button>
        </div>
      )}

      {/* ⚠ `hojaCobro`, el recibo y el toast de «Deshacer» YA NO VAN AQUI:
          se subieron FUERA del `lg:hidden`, al final del componente. Estaban
          dentro, o sea dentro de un `display:none` en escritorio, asi que
          «Cobrar» en la tabla de PC no abria NADA. Ver el comentario de alla. */}

      <ConfirmModal
        open={confirmEliminarRuta}
        title="Eliminar ruta"
        message={ruta ? `¿Eliminar la ruta "${ruta.nombre}"? Los clientes quedarán sin ruta asignada.` : ''}
        confirmLabel="Eliminar"
        confirmColor="red"
        onConfirm={_doEliminarRuta}
        onCancel={() => setConfirmEliminarRuta(false)}
      />

    </div>
    </div>

    {/* ── LO QUE VALE PARA LAS DOS VISTAS VA AQUI, FUERA DEL `lg:hidden` ──
        La hoja de cobro, el recibo y el toast de «Deshacer» estaban DENTRO de
        la rama de movil. En escritorio esa rama es `display:none`, asi que:

          · «Cobrar» en la tabla de PC no abria nada. El handler corria
            (`onCobrar` -> `abrirPagoRapido`), el estado cambiaba, y la hoja
            se montaba dentro de un contenedor oculto. La accion principal de
            la tabla de escritorio estaba muerta.
          · Tras cobrar, el toast de «Deshacer» tampoco salia: en PC no habia
            forma de echar atras un cobro mal hecho dentro de los 10 segundos.

        El recibo se salvaba de casualidad porque va por `createPortal` a
        `document.body`. Los otros dos no.

        Aqui abajo los ven las dos vistas y siguen siendo el MISMO cobro: el
        estado y los handlers son unicos, no hay dos arboles con vida propia. */}
    {hojaCobro}
    {pantallaRecibo}

    {/* La hoja de plantillas estaba DENTRO del `lg:hidden`, igual que le pasó
        a la hoja de cobro: en PC se montaba en un `display:none` y el botón de
        WhatsApp de la tabla no abría nada. El estado cambiaba y no se veía.
        Se descubrió pulsando en el espejo — leyendo el archivo no se nota,
        porque el `<HojaWhatsApp>` sí está y sí recibe sus datos. */}
    <HojaWhatsApp
      open={!!modalWA}
      onClose={() => setModalWA(null)}
      cliente={modalWA?.cliente}
      prestamo={modalWA?.prestamo}
      orgNombre={orgNombre}
      ocultarSaldo={ocultarSaldoWA}
      organizationId={organizationId}
    />

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
    </>
  )
}
