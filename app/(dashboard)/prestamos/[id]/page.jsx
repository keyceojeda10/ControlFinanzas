'use client'
// app/(dashboard)/prestamos/[id]/page.jsx - Detalle del préstamo (página central del sistema)

import { useState, useEffect, useMemo, useRef, useCallback, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link                           from 'next/link'
import { useAuth }                    from '@/hooks/useAuth'
import { montoCrudo, montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'
import { useOffline }                 from '@/components/providers/OfflineProvider'
import { obtenerPrestamoOffline, resolverTempId }     from '@/lib/offline'
import { Badge }                      from '@/components/ui/Badge'
import { Button }                     from '@/components/ui/Button'
import { Card }                       from '@/components/ui/Card'
import { Modal }                      from '@/components/ui/Modal'
import { SkeletonPrestamoDetalle }     from '@/components/ui/Skeleton'
import MonedaCF                       from '@/components/ui/MonedaCF'
import RegistrarPago                  from '@/components/prestamos/RegistrarPago'
import MetodoPagoSelector             from '@/components/pagos/MetodoPagoSelector'
// AjusteSaldo absorbido por RegistrarPago via prop tabInicial.
import RenovarPrestamo                from '@/components/prestamos/RenovarPrestamo'
import ModificarPlazo                 from '@/components/prestamos/ModificarPlazo'
import EditarDiaCobro                 from '@/components/prestamos/EditarDiaCobro'
import EditarProximoCobro             from '@/components/prestamos/EditarProximoCobro'
import EditarPrestamo                 from '@/components/prestamos/EditarPrestamo'
import BotonWhatsApp                  from '@/components/ui/BotonWhatsApp'
import BotonAbrirHojaWA              from '@/components/ui/BotonAbrirHojaWA'
import BotonCompartir                 from '@/components/ui/BotonCompartir'
import BotonImprimirRecibo            from '@/components/ui/BotonImprimirRecibo'
import BotonCompartirRecibo          from '@/components/ui/BotonCompartirRecibo'
import OfflineBadge                   from '@/components/offline/OfflineBadge'
import HojaWhatsApp         from '@/components/whatsapp/HojaWhatsApp'
import FirmaDigital                   from '@/components/prestamos/FirmaDigital'
import {
  PrestamoHeroCard,
  HeaderClienteContexto,
  BotonPagoPersonalidad,
  ChipsAccionesSecundarias,
  GrillaDatosSecciones,
  TimelinePrestamo,
  PagoMiniCard,
  moodColorFromPrestamo,
} from '@/components/prestamos/PrestamoDetalleViews'
import { formatFechaCobroRelativa, tieneTablaAmortizacion } from '@/lib/calculos'
import { cifraProximoCobro } from '@/lib/adaptadores/clientes'
import { calendarioDeCobro } from '@/lib/dias-sin-cobro'
import { RegistrarAcciones } from '@/components/acciones/AccionesProvider'
import QueNecesitas from '@/components/acciones/QueNecesitas'
import { SINONIMOS_GESTION, EXTRAS_PRESTAMO } from '@/lib/acciones/prestamo'
// Para el total de cuotas de «Cómo va»: la MISMA fuente que usa
// `calcularPrestamo`, no una división que se parezca.
import { obtenerDiasPorPeriodo } from '@/lib/dinero/calendario'
import { formatMoney } from '@/lib/i18n'
import DiasSinCobroSelector from '@/components/ui/DiasSinCobroSelector'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import TablaAmortizacion from '@/components/pantallas/TablaAmortizacion'
import { adaptarTabla } from '@/lib/adaptadores/tabla'
import HojaInferior from '@/components/cf/HojaInferior'
import { MoverAPerdidos, CerrarAnticipado, PieGestion, Recargo, Descuento } from '@/components/pantallas/Gestion'
import { adaptarPerdidos, adaptarCerrar, resumenCerrar , adaptarRecargo, adaptarDescuento} from '@/lib/adaptadores/gestion'
import { ChecklistCamposRecibo, getDefaultCampos } from '@/components/recibos/CamposReciboEditor'
import FichaPrestamo from '@/components/pantallas/FichaPrestamo'
import { formatearTasa, moraEsGrave } from '@/lib/adaptadores/prestamos'
import { useCabecera } from '@/components/armazon/Armazon'
import { MenuGestion } from '@/components/pantallas/MenuGestion'
import { anotarReciente } from '@/lib/recientes'

// ─── Helpers de formato ──────────────────────────────────────────
const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

const estadoBadge = {
  pendiente_aprobacion: { variant: 'yellow', label: 'Pendiente aprobación' },
  activo:     { variant: 'blue',  label: 'Activo'     },
  completado: { variant: 'green', label: 'Completado' },
  cancelado:  { variant: 'gray',  label: 'Cancelado'  },
}

const tipoPagoBadge = {
  completo:  { variant: 'green',  label: 'Completo'  },
  parcial:   { variant: 'yellow', label: 'Parcial'   },
  capital:   { variant: 'purple', label: 'A Capital' },
  recargo:   { variant: 'red',    label: 'Recargo'   },
  descuento:  { variant: 'blue',   label: 'Descuento' },
  intereses:  { variant: 'yellow', label: 'Intereses' },
  liquidacion:{ variant: 'green',  label: 'Liquidación' },
}


export default function PrestamoDetallePage({ params }) {
  const { id }             = use(params)
  const router             = useRouter()
  // `?editar=<modo>` viene de la hoja de comparar calendarios, que vive en la ruta
  // de la tabla y no puede abrir un modal de esta pagina. El parametro es el
  // puente: sin el, «elegir este calendario» era un enlace a
  // /prestamos/[id]/editar, ruta que NO EXISTE y que habria escrito yo mismo —el
  // mismo enlace muerto que ya me pasó con ?diasMoraMin=30.
  const parametros         = useSearchParams()
  const modoPedido         = parametros.get('editar')
  const { session, esOwner, esCobrador, puedeGestionarPrestamos, puedeAplicarDescuentos, orgNombre, ocultarSaldoWA, camposRecibo: camposReciboOrg, modoAbreviado } = useAuth()

  const { lastSyncedAt }   = useOffline()

  const [prestamo,     setPrestamo]     = useState(null)

  // Deja constancia para «Últimos que abriste» del buscador (T34-03). Se anota
  // AQUI y no en el armazón porque la ruta sola trae el id: el nombre y el
  // estado solo los sabe esta pantalla.
  useEffect(() => {
    if (!prestamo?.cliente?.nombre) return
    anotarReciente({
      tipo: 'prestamo', id: prestamo.id, nombre: prestamo.cliente.nombre,
      detalle: prestamo.saldoPendiente > 0
        ? `debe $${Math.round(prestamo.saldoPendiente).toLocaleString('es-CO')}` : 'saldado',
      estado: prestamo.diasAtraso > 0 ? 'rojo' : undefined,
    })
  }, [prestamo])

  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [modalPago,    setModalPago]    = useState(false)
  const [modalAtajosCobro, setModalAtajosCobro] = useState(false)
  const [modalGestionPrestamo, setModalGestionPrestamo] = useState(false)
  const [presetPago,   setPresetPago]   = useState(null)
  const [exito,        setExito]        = useState(false)   // animación de éxito
  const [completado,   setCompletado]   = useState(false)   // celebración
  const [ultimoPago,   setUltimoPago]   = useState(null)    // para botón WA pago
  const [aprobando,    setAprobando]    = useState(false)
  const [rechazando,   setRechazando]   = useState(false)
  const [cancelando,   setCancelando]   = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [modoReversionCapital, setModoReversionCapital] = useState('devolver_todo')
  const [anulando,     setAnulando]     = useState(null)   // pagoId que se está anulando
  const [confirmAnularPago, setConfirmAnularPago] = useState(null) // { pagoId, monto }
  const [comprobante,  setComprobante]  = useState(null)   // pagoId del comprobante expandido
  const [editandoFecha, setEditandoFecha] = useState(null) // pagoId cuya fecha se edita
  const [filtroFecha,  setFiltroFecha]  = useState('')    // YYYY-MM-DD opcional para filtrar historial
  const [rutaNav,      setRutaNav]     = useState(null)
  // ── EL AJUSTE (recargo / descuento) ──
  // Un solo juego de estado para las dos hojas: nunca estan abiertas a la vez,
  // y duplicarlo era garantizar que una se quedara con el monto de la otra.
  const [ajusteMonto, setAjusteMonto] = useState('')

  // ── EL MODO ABREVIADO, TAMBIÉN AQUÍ ──────────────────────────────────────
  //
  // Con él encendido se escribe en MILES: «40» son $40.000. Esta pantalla NO lo
  // aplicaba en ninguno de sus tres campos de plata —recargo, descuento y el
  // monto pactado de la liquidación—, así que un cobrador con el interruptor
  // puesto tecleaba «40» para perdonar $40.000 y perdonaba $40.
  //
  // ⚠ LOS ATAJOS NO PASAN POR AQUÍ. Ponen la cifra EXACTA («ponerse al día son
  // $47.300»), no un número de miles. Por eso `onAtajo` sigue llamando a
  // `setAjusteMonto` directo: meterlo en la conversión lo multiplicaría por mil.
  // Es el mismo reparto que ya funciona en `RegistrarPago`.
  const [ajusteTecleado, setAjusteTecleado] = useState(null)
  const verAjuste = (v) => (ajusteTecleado != null ? ajusteTecleado : montoParaMostrarConModo(v, modoAbreviado, undefined))
  const leerAjuste = (v) => {
    const crudo = montoCrudo(v)
    setAjusteTecleado(crudo)
    return montoCrudoConModo(crudo, modoAbreviado)
  }
  // Al fijar una cifra exacta (atajo) se olvida lo tecleado, o el campo seguiría
  // pintando lo viejo encima del monto nuevo.
  const fijarAjuste = (v) => { setAjusteTecleado(null); setAjusteMonto(v) }
  const [ajusteNota, setAjusteNota] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [ajusteError, setAjusteError] = useState('')
  const [modalRecargo,  setModalRecargo]  = useState(false)
  const [modalDescuento, setModalDescuento] = useState(false)
  const [modalIntereses, setModalIntereses] = useState(false)
  // El selector es CONTROLADO con un objeto: `metodoPago` dice efectivo o
  // transferencia y `metodoPagoId` dice a que cuenta entro. Confundirlos
  // descuadra la caja por cuenta.
  const [interesMetodo,  setInteresMetodo]  = useState({ metodoPago: 'efectivo', metodoPagoId: null })
  const [metodosPagoOrg, setMetodosPagoOrg] = useState([])
  const [interesError,   setInteresError]   = useState('')
  const [pagandoInteres, setPagandoInteres] = useState(false)
  const [modalRenovar,  setModalRenovar]  = useState(false)
  const [modalPlazo,    setModalPlazo]    = useState(false)
  const [modalDiaCobro, setModalDiaCobro] = useState(false)
  const [modalProximoCobro, setModalProximoCobro] = useState(false)
  const [modalEditar,   setModalEditar]   = useState(false)
  const [sociosLista,   setSociosLista]   = useState([])
  const [modalWA, setModalWA] = useState(false)
  // Cuando se llega recien creado el prestamo (?nuevo=1), el modal debe sugerir
  // "Credito aprobado", no la primera aplicable. Sin esto, el modal agarraba
  // gracias_corto ("Gracias por tu pago") por ser la primera de la lista que
  // aplica a un prestamo activo — aunque no exista ningun pago. El prestamista
  // creaba el credito, tocaba WhatsApp, y le salia un mensaje de pago inventado.
  const [waSugerida, setWaSugerida] = useState(null)
  /* El pago que acompaña a la hoja cuando se abre desde un recibo. `null` en
     los demás caminos: sin él la hoja abre en las familias normales, con él
     abre directa en la confirmación del pago con su detalle. */
  const [waPago, setWaPago] = useState(null)
  const [modalDscPrestamo, setModalDscPrestamo] = useState(false)
  const [dscDias, setDscDias] = useState([])
  // Tarjeta clavo
  const [modalClavo, setModalClavo] = useState(false)
  const [clavoPerdida, setClavoPerdida] = useState(false)
  const [clavoEnviando, setClavoEnviando] = useState(false)
  const [clavoError, setClavoError] = useState('')
  // Liquidacion anticipada (cierre por pago total antes del plazo)
  const [modalMoratorio, setModalMoratorio] = useState(false)
  const [moratorioMonto, setMoratorioMonto] = useState(0)
  const [moratorioNota, setMoratorioNota] = useState('')
  const [moratorioEnviando, setMoratorioEnviando] = useState(false)
  const [moratorioError, setMoratorioError] = useState('')
  const [modalLiquidacion, setModalLiquidacion] = useState(false)
  // ── LO QUE DEBE SI CANCELA HOY ──
  //
  // Se pide al ABRIR LA FICHA, no al abrir el menú de gestión. Es la primera
  // pregunta que hace un cliente que llegó con plata —«¿cuánto por cerrarlo
  // ya?»— y hasta ahora la respuesta estaba a dos toques y solo para quien
  // tuviera permiso de descuentos.
  //
  // Va en su propio estado, aparte de `liqData`: ese lo maneja el modal y lo
  // limpia al abrirlo, así que compartirlo dejaría la cifra de la ficha en
  // blanco cada vez que alguien entra al menú.
  const [cierreHoy, setCierreHoy] = useState(null)
  const [liqData, setLiqData] = useState(null)        // calculo del backend
  const [liqModalidad, setLiqModalidad] = useState('mesCompleto') // mesCompleto | proporcional
  const [liqMonto, setLiqMonto] = useState(0)          // monto editable del cierre
  // Lo TECLEADO, aparte. `liqMonto` guarda siempre pesos reales —es lo que
  // viaja al servidor como el pago de liquidación— y esto es lo que se pinta
  // mientras se escribe, para que en modo abreviado no se reformatee a cada
  // tecla. Se limpia al elegir una de las opciones calculadas.
  const [liqTecleado, setLiqTecleado] = useState(null)
  const [liqNota, setLiqNota] = useState('')
  const [liqCargando, setLiqCargando] = useState(false)
  const [liqEnviando, setLiqEnviando] = useState(false)
  const [liqError, setLiqError] = useState('')
  const [statsCliente, setStatsCliente] = useState(null) // { totalPrestamos, completados, numeroEsteDe }
  // CERRADO, como decia el comentario de mas abajo y NO hacia el codigo.
  //
  // Abierto por defecto, la pantalla enseñaba LA MISMA LISTA DE PAGOS DOS VECES:
  // «Cada pago que ha hecho» del rediseño, con el saldo en que quedo cada uno, y
  // debajo esta con las mismas filas. Esta se queda porque es la unica que deja
  // compartir el recibo y borrar un pago mal metido — pero es la de GESTIONAR, no
  // la de consultar, y se abre cuando hace falta.
  const [historialOpen, setHistorialOpen] = useState(false)
  const [camposReciboCliente, setCamposReciboCliente] = useState(null)
  const [guardandoCamposRecibo, setGuardandoCamposRecibo] = useState(false)
  const [modalRecibo, setModalRecibo] = useState(null)
  const hasLoadedOnceRef = useRef(false)

  // Leer contexto de ruta activa
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cf-ruta-nav')
      if (saved) setRutaNav(JSON.parse(saved))
    } catch {}
  }, [])

  const fetchPrestamo = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)

    // Temp ID (creado offline) — si ya se sincronizó, redirigir al ID real
    if (typeof id === 'string' && id.startsWith('offline-')) {
      try {
        const realId = await resolverTempId(id)
        if (realId) {
          router.replace(`/prestamos/${realId}`)
          return
        }
      } catch {}
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }

    // Offline: prefer IndexedDB (has locally-updated data, SW cache may be stale)
    if (!navigator.onLine) {
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
    }
    try {
      const res  = await fetch(`/api/prestamos/${id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      setPrestamo(data)
    } catch {
      try {
        const cached = await obtenerPrestamoOffline(id)
        if (cached) {
          setPrestamo(cached)
          if (!shouldUseSoftRefresh) setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      if (!shouldUseSoftRefresh) setError('No se pudo cargar el préstamo.')
    } finally {
      if (!shouldUseSoftRefresh) setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [id])

  useEffect(() => { fetchPrestamo() }, [fetchPrestamo])

  useEffect(() => {
    if (esOwner) fetch('/api/socios').then(r => r.ok ? r.json() : []).then(d => setSociosLista(Array.isArray(d) ? d.map(s => ({ id: s.id, nombre: s.nombre })) : []))
  }, [esOwner])

  // Re-fetch silently when offline payments get synced
  useEffect(() => {
    if (lastSyncedAt > 0) {
      fetchPrestamo({ soft: true })
    }
  }, [lastSyncedAt, fetchPrestamo])

  // ── Tarjeta clavo ───────────────────────────────────────────────
  async function confirmarClavo() {
    if (clavoEnviando) return
    setClavoEnviando(true); setClavoError('')
    try {
      const res = await fetch(`/api/prestamos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esClavo: true, clavoPerdida }),
      })
      const data = await res.json()
      if (!res.ok) { setClavoError(data.error || 'No se pudo marcar'); return }
      setModalClavo(false); setClavoPerdida(false)
      await fetchPrestamo()
    } catch {
      setClavoError('Error de red')
    } finally {
      setClavoEnviando(false)
    }
  }

  async function quitarClavo() {
    try {
      const res = await fetch(`/api/prestamos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ esClavo: false }),
      })
      if (res.ok) await fetchPrestamo()
    } catch {}
  }

  // ── Liquidacion anticipada ──────────────────────────────────────
  async function abrirLiquidacion() {
    setLiqError(''); setLiqData(null); setLiqNota('')
    setModalLiquidacion(true)
    setLiqCargando(true)
    try {
      const res = await fetch(`/api/prestamos/${id}/liquidacion`)
      const data = await res.json()
      if (!res.ok) { setLiqError(data.error || 'No se pudo calcular'); return }
      setLiqData(data)
      // Por defecto, modalidad mes completo (la mas comun en gota a gota)
      setLiqModalidad('mesCompleto')
      setLiqTecleado(null); setLiqMonto(data.mesCompleto?.restanteHoy ?? 0)
    } catch {
      setLiqError('Error de red')
    } finally {
      setLiqCargando(false)
    }
  }

  useEffect(() => {
    // Solo para préstamos vivos: el endpoint responde 400 si no está activo, y
    // en uno cerrado la pregunta no tiene sentido.
    if (!prestamo || prestamo.estado !== 'activo') { setCierreHoy(null); return }
    let vivo = true
    fetch(`/api/prestamos/${id}/liquidacion`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setCierreHoy(d) })
      // Si falla, NO se enseña nada. Es plata: un hueco es mejor que una cifra
      // que no se sabe de dónde salió.
      .catch(() => {})
    return () => { vivo = false }
  }, [prestamo?.id, prestamo?.estado, prestamo?.totalPagado, id])

  function seleccionarModalidad(mod) {
    setLiqModalidad(mod)
    if (liqData?.[mod]) { setLiqTecleado(null); setLiqMonto(liqData[mod].restanteHoy) }
  }

  async function confirmarLiquidacion() {
    if (liqEnviando) return
    // monto puede ser 0: el cliente ya pago lo justo y solo se perdona el interes futuro
    if (liqMonto < 0) { setLiqError('El monto no puede ser negativo'); return }
    if (!liqNota.trim()) { setLiqError('Indica el motivo (ej: pago anticipado pactado)'); return }
    setLiqEnviando(true); setLiqError('')
    try {
      const res = await fetch(`/api/prestamos/${id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: Math.round(liqMonto || 0), tipo: 'liquidacion', nota: liqNota.trim(), modalidad: liqModalidad }),
      })
      const data = await res.json()
      if (!res.ok) { setLiqError(data.error || 'No se pudo cerrar el préstamo'); return }
      setModalLiquidacion(false)
      await fetchPrestamo()
    } catch {
      setLiqError('Error de red')
    } finally {
      setLiqEnviando(false)
    }
  }

  // Intent param desde rutas: abrir modal de pago al entrar
  useEffect(() => {
    if (!prestamo || modalPago) return
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('openPago') !== '1') return
    if (prestamo.estado !== 'activo' || prestamo.pagoHoy) return

    setModalPago(true)
    params.delete('openPago')
    const search = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
  }, [prestamo, modalPago])

  // Recien creado (?nuevo=1): abrir el modal de WhatsApp con "Credito aprobado".
  // OJO: usar prestamo?.cliente, NO el `cliente` desestructurado — ese se
  // declara ~65 lineas mas abajo (const { cliente, ... } = ...), asi que
  // referenciarlo aca lo accede en su zona muerta temporal y tira
  // "Cannot access 'cliente' before initialization", tumbando toda la pagina.
  useEffect(() => {
    if (!prestamo) return
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevo') !== '1') return
    if (!prestamo?.cliente?.telefono) { // sin telefono no hay a quien mandarle
      params.delete('nuevo')
      const s = params.toString()
      window.history.replaceState({}, '', `${window.location.pathname}${s ? `?${s}` : ''}`)
      return
    }
    setWaSugerida('credito_aprobado')
    setModalWA(true)
    params.delete('nuevo')
    const search = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
  }, [prestamo])

  // Cargar stats del cliente para mostrar comparativo "vs prestamos anteriores"
  useEffect(() => {
    const clienteId = prestamo?.cliente?.id
    if (!clienteId) return
    let cancel = false
    fetch(`/api/clientes/${clienteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancel || !data?.prestamos) return
        const todos = data.prestamos
        const completados = todos.filter(p => p.estado === 'completado').length
        // Numero de este prestamo: ordenamos por fecha createdAt asc, este indice + 1
        const ordenados = [...todos].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const idx = ordenados.findIndex(p => p.id === prestamo.id)
        setStatsCliente({
          totalPrestamos: todos.length,
          completados,
          numeroEsteDe: idx >= 0 ? idx + 1 : 1,
        })
      })
      .catch(() => {})
    return () => { cancel = true }
  }, [prestamo?.cliente?.id, prestamo?.id])

  const handlePagoExito = (prestamoActualizado, pagoRegistrado) => {
    setPrestamo(prestamoActualizado)
    setUltimoPago(pagoRegistrado ?? null)
    setExito(true)
    if (prestamoActualizado.estado === 'completado') setCompletado(true)
    setTimeout(() => setExito(false), 3000)
  }

  // ─── Loading ────────────────────────────────────────────────────
  // ── La cabecera de detalle de T41-01 ──
  //
  // «Steven Olmos» y debajo «$20.000 diarios · 36 dias de atraso». La cabecera
  // decia solo «‹ Prestamos»: el nombre vivia en una tarjeta DENTRO del
  // contenido, asi que al bajar por la ficha se perdia de quien es el prestamo. En
  // una pantalla que se abre para discutir con alguien, el nombre va fijo arriba.
  //
  // VA AQUI, ANTES DE LOS RETURNS TEMPRANOS. `useCabecera` es un hook: puesto
  // despues del `if (loading) return`, el orden de hooks cambia entre renders y
  // React rompe la pantalla entera — salio con el triangulo rojo de error.
  // Por eso lee del ESTADO (`prestamo?.…`) y no de los valores derivados, que se
  // calculan mas abajo.
  // Las cuentas de la organizacion. VA AQUI POR LO MISMO QUE `useCabecera`: es
  // un hook, y detras del `if (loading) return` el orden cambia entre renders.
  // Se pidio despues de montar y ya me tiro la pantalla una vez.
  //
  // ⚠ TAMBIEN AL RENOVAR, no solo en la hoja de intereses.
  // Solo se pedian con `modalIntereses`, asi que al abrir la renovacion la
  // lista llegaba VACIA y el selector de «¿por donde le entregas?» no se
  // pintaba: el arreglo del API estaba desplegado y en pantalla no habia nada
  // que elegir. Reportado por el dueño: «aun las renovaciones no dejan escoger
  // de que medio salen».
  useEffect(() => {
    if ((!modalIntereses && !modalRenovar) || metodosPagoOrg.length) return
    fetch('/api/metodos-pago').then((r) => (r.ok ? r.json() : [])).then(setMetodosPagoOrg).catch(() => {})
  }, [modalIntereses, modalRenovar, metodosPagoOrg.length])

  useCabecera({
    titulo: prestamo?.cliente?.nombre,
    subtitulo: prestamo ? (
      // En `unico` NO hay cuota ni frecuencia que contar, asi que el subtitulo se
      // quedaba VACIO: la cabecera solo decia el nombre. T41-02 pone «un solo
      // pago · faltan 9 dias», que es lo que distingue esta ficha de las otras de
      // un vistazo — y los dias que faltan son la unica cuenta que corre aca.
      prestamo.modoInteres === 'unico'
        ? ['un solo pago', (() => {
            if (!prestamo.fechaFin) return null
            const d = Math.ceil((new Date(prestamo.fechaFin) - Date.now()) / 86400000)
            if (d > 0) return `faltan ${d} día${d === 1 ? '' : 's'}`
            if (d === 0) return 'vence hoy'
            return `venció hace ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}`
          })()].filter(Boolean).join(' · ')
        : [
            prestamo.cuotaDiaria > 0
              ? `${formatMoney(Math.round(prestamo.cuotaDiaria))} ${({ diario: 'diarios', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' }[prestamo.frecuencia] ?? '')}`.trim()
              : null,
            prestamo.diasMora > 0 ? `${prestamo.diasMora} día${prestamo.diasMora === 1 ? '' : 's'} de atraso` : 'al día',
          ].filter(Boolean).join(' · ') || null
    ) : null,
  })

  if (loading) {
    return <SkeletonPrestamoDetalle />
  }

  if (error || !prestamo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto">
        <div className="mb-4"><MonedaCF pose="busca" size={100} /></div>
        <p className="text-sm font-medium text-[var(--cf-ink)]">No pudimos cargar el préstamo</p>
        <p className="text-xs text-[var(--cf-ink-3)] mt-1">Revisa tu conexión e intenta de nuevo</p>
        <div className="flex gap-3 mt-4">
          <Button size="sm" onClick={() => fetchPrestamo()}>Reintentar</Button>
          <Button size="sm" variant="ghost" onClick={() => router.back()}>Volver</Button>
        </div>
      </div>
    )
  }

  const {
    cliente, estado, montoPrestado, totalAPagar, cuotaDiaria, frecuencia,
    tasaInteres, diasPlazo, fechaInicio, fechaFin, nombreProducto,
    totalPagado, saldoPendiente, capitalRestante, porcentajePagado, diasMora,
    cuotasPendientes = 0,
    cuotasEnMora = 0,
    montoEnMora = 0,
    montoParaPonerseAlDia = 0,
    pagoHoy: yaPagoHoy, pagos = [], proximoCobro,
    seguro = false, montoSeguro,
    modoInteres, interesAdelantado = false, renovadoDeId, esClavo = false,
    cuotasAmortizacion = [],
    creadoPor,
    moratorio = null,
  } = prestamo

  const frecuenciaLabel = {
    diario: 'diario',
    semanal: 'semanal',
    quincenal: 'quincenal',
    mensual: 'mensual',
  }[frecuencia] || 'diario'

  const badge      = estadoBadge[estado] ?? estadoBadge.activo
  const estaActivo = estado === 'activo'
  const enMora     = diasMora > 3
  const totalPagadoReal = Math.round(totalPagado || 0)
  const montoPrestadoRedondeado = Math.round(montoPrestado || 0)
  const saldoFinancieroPendiente = Math.max(0, montoPrestadoRedondeado - totalPagadoReal)
  const hayCobrosRegistrados = totalPagadoReal > 0
  const hayMontoMora = estaActivo && !completado && montoEnMora > 0
  const hayMontoAlDia = estaActivo && !completado && montoParaPonerseAlDia > 0
  const mostrarAtajosCobro = estaActivo && !completado && saldoPendiente > 0

  // ── Lo que pide la ficha de T41-01 ──
  //
  // «LE FALTAN 24 cuotas». Se deriva del saldo y la cuota, que es exacto en los
  // modos SIN tabla —la cuota no cambia— y es el 93,7% de la cartera. En los que
  // tienen tabla se cuentan las filas pendientes, que es el numero de verdad.
  const cuotasFaltantesTexto = (() => {
    if (cuotasAmortizacion.length > 0) {
      const pend = cuotasAmortizacion.filter((c) => (c.pagado || 0) < c.cuotaTotal).length
      return `${pend} cuota${pend === 1 ? '' : 's'}`
    }
    if (!(cuotaDiaria > 0) || !(saldoPendiente > 0)) return '—'
    const n = Math.ceil(saldoPendiente / cuotaDiaria)
    return `${n} cuota${n === 1 ? '' : 's'}`
  })()

  // «30 cuotas diarias». El numero de cuotas del PLAZO PACTADO, no las que
  // quedan: es la segunda linea de «como se pacto», y ahi se cuenta el trato
  // completo. Los numeros feos se dejan feos: «39 semanas» no se redondea a 40,
  // porque el dueño va a cobrar 39 veces y un plazo redondeado es un plazo
  // mentiroso.
  const plazoPactadoTexto = (() => {
    const porPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] ?? 1
    const n = cuotasAmortizacion.length > 0
      ? cuotasAmortizacion.length
      : (diasPlazo > 0 ? Math.round(diasPlazo / porPeriodo) : 0)
    if (!n) return null
    /* ⚠ EN SINGULAR CUANDO ES UNA. Salía «1 cuotas mensuales» en la pantalla,
       que es el mismo descuido que ya se corrigió en «pagó completos sus 1
       préstamo»: el plural entero, no solo la «s». */
    const uno = n === 1
    const adj = uno
      ? ({ diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }[frecuencia] ?? '')
      : ({ diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' }[frecuencia] ?? '')
    return `${n} cuota${uno ? '' : 's'} ${adj}`.trim()
  })()

  // Los ultimos pagos, con el SALDO QUE LE QUEDO despues de cada uno. Esa es la
  // palabra que usa el prestamista cuando el cliente reclama, y para eso se abre
  // la ficha. Se calcula hacia atras desde el saldo actual: sumando el pago se
  // recupera el saldo que habia justo despues del anterior.
  // ── Lo propio de cada variante (T41-02, T42-01, T42-02) ──
  //
  // `unico` (18,6%): no tiene cuotas, asi que el bloque oscuro cuenta DIAS en vez
  // de plata pagada. Y hace falta «empezo el», porque sin cuotas que marquen el
  // tiempo no hay forma de saber si el trato es de la semana pasada o de hace
  // tres meses — y eso cambia cuanto se puede insistir.
  const esUnicoModo = modoInteres === 'unico'
  // ⚠ EN UTC: `fechaFin` es una fecha de CALENDARIO, no un instante (se calcula
  // con `setUTCDate`/`Date.UTC`). Sin fijarlo aquí, un `2026-03-02T00:00:00Z`
  // se leía desde Bogotá —UTC−5— como el 1 de marzo a las 19:00, y la ficha
  // decía un día menos. Es el mismo fallo del comprobante que reportó un
  // prestamista. Ver `formatFechaCalendario` en lib/i18n.
  const fechaVencTexto = fechaFin
    ? new Date(fechaFin).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    })
    : null
  const diasParaVencerTexto = (() => {
    if (!fechaFin) return null
    const dias = Math.ceil((new Date(fechaFin) - Date.now()) / 86400000)
    if (dias > 0) return `en ${dias} día${dias === 1 ? '' : 's'}`
    if (dias === 0) return 'vence hoy'
    return `venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
  })()
  const empezoElTexto = fechaInicio ? (() => {
    const d = new Date(fechaInicio)
    const dias = Math.floor((Date.now() - d) / 86400000)
    const fecha = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
    return dias > 0 ? `${fecha} · hace ${dias} día${dias === 1 ? '' : 's'}` : fecha
  })() : null

  // `manual` (10,6%): la cuota la puso el dueño a mano y el plazo salio de esa
  // decision. Se dice CON la cifra, porque el verbo ya reconoce que la eligio el.
  const cuotaQuePusisteTexto = modoInteres === 'manual' && cuotaDiaria > 0
    ? formatMoney(Math.round(cuotaDiaria))
    : null

  // `proporcional` (9,8%): el UNICO modo sin tabla donde el porcentaje si se
  // muestra, y con su explicacion al lado. En `fijo` y `unico` el dueño pacto un
  // total redondo y traducirlo a tasa le diria algo que nunca penso; aca el total
  // NO es redondo —salio de una regla de tres— y sin ver el 20% sobre los dias
  // esa cifra parece arbitraria.
  const tasaProporcional = modoInteres === 'proporcional' && tasaInteres > 0
    ? { tasa: `${formatearTasa(tasaInteres)}%`, explicacion: `al mes, repartido sobre ${diasPlazo} días — de ahí sale el total` }
    : null

  // El pie del historial DICE EL ATRASO EN PALABRAS. Lo pide T42-02: «le vence
  // una cuota hace 3 dias» en vez de dejar el numero solo. Y solo cuando el
  // atraso es CORTO sobre su propio ciclo: si ya es mora grave, el rojo de arriba
  // lo dice de sobra y esta frase suavizaria.
  const notaDelHistorial = (!esUnicoModo && diasMora > 0 && !moraEsGrave({ diasMora, frecuencia }))
    ? `Le vence una cuota hace ${diasMora} día${diasMora === 1 ? '' : 's'}.`
    : null

  // La tabla, recortada a las 4 primeras como en la lamina: mas abajo no cabe sin
  // que la ficha se vuelva un scroll infinito, y el aviso «Ves 4 de las 6» lleva a
  // la pantalla completa. El recorte va DECLARADO —`totalCuotas` sigue siendo el
  // total— para que la suma de lo visible mas lo declarado cuadre con el total de
  // arriba; si no, un «total $1.699.999» sobre cuatro filas que suman $1.266.668
  // deja al dueño creyendo que ya vio la tabla entera.
  const tablaParaFicha = (() => {
    if (!tieneTablaAmortizacion(prestamo)) return null
    const t = adaptarTabla(prestamo)
    const visibles = t.cuotas.slice(0, 4)
    const ocultas = t.cuotas.length - visibles.length
    return {
      ...t,
      cuotas: visibles,
      montoOculto: ocultas > 0
        ? formatMoney(Math.round(cuotasAmortizacion.slice(4).reduce((a, c) => a + (c.cuotaTotal || 0), 0)))
        : null,
    }
  })()

  const pagosParaFicha = (() => {
    const orden = [...pagos]
      .filter((p) => !['recargo', 'descuento'].includes(p.tipo))
      .sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago))
    let saldo = Math.round(saldoPendiente || 0)
    const filas = []
    for (const p of orden.slice(0, 3)) {
      const monto = Math.round(p.montoPagado || 0)
      filas.push({
        fecha: new Date(p.fechaPago).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }),
        detalle: [
          p.metodoPago === 'transferencia' ? 'transferencia' : 'efectivo',
          p.tipo && p.tipo !== 'completo' ? p.tipo : null,
          `quedó en ${formatMoney(saldo)}`,
        ].filter(Boolean).join(' · '),
        // Suelto ademas del texto: en 1440 tiene columna propia.
        saldo: formatMoney(saldo),
        // Y sin el saldo dentro, para no decirlo dos veces cuando hay columna.
        // ── EL MEDIO DE VERDAD, NO «transferencia» a secas ──
        // Se degradaba a mano a «efectivo»/«transferencia» cuando el nombre de
        // la cuenta —Nequi, Daviplata— viene en el propio pago. La lámina
        // T11-03 pone «Nequi» en su columna, y para el que revisa un cobro no
        // es lo mismo: dice POR DÓNDE entró la plata.
        comoPago: [
          p.metodoPago === 'transferencia' ? (p.plataforma || 'transferencia') : 'efectivo',
          p.tipo && p.tipo !== 'completo' ? p.tipo : null,
        ].filter(Boolean).join(' · '),
        // ── QUIÉN LO COBRÓ (T11-03) ──
        // El comentario de `FichaPrestamo` decía que este dato «no llega hasta
        // aquí» y era FALSO: la API lo devuelve en cada pago
        // (`app/api/prestamos/[id]/route.js:41`). Con varios cobradores, saber
        // quién recibió un pago es la mitad de una auditoría.
        cobrador: p.cobrador?.nombre ?? null,
        monto: formatMoney(monto),
      })
      saldo += monto
    }
    return filas
  })()

  // Sparkline 14 dias: monto cobrado por dia (excluye recargos/descuentos)
  const sparkline14d = (() => {
    const buckets = Array(14).fill(0)
    const hoyCO = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const inicioHoyMs = Date.UTC(hoyCO.getUTCFullYear(), hoyCO.getUTCMonth(), hoyCO.getUTCDate())
    for (const pg of pagos) {
      if (!pg.fechaPago) continue
      if (['recargo', 'descuento'].includes(pg.tipo)) continue
      const pagoCO = new Date(new Date(pg.fechaPago).getTime() - 5 * 60 * 60 * 1000)
      const diaCO = Date.UTC(pagoCO.getUTCFullYear(), pagoCO.getUTCMonth(), pagoCO.getUTCDate())
      const diasAtras = Math.floor((inicioHoyMs - diaCO) / (24 * 60 * 60 * 1000))
      if (diasAtras >= 0 && diasAtras < 14) {
        buckets[13 - diasAtras] += pg.montoPagado
      }
    }
    return buckets
  })()

  // Cuotas pagadas
  const cuotasPagadas = cuotasAmortizacion.length > 0
    ? cuotasAmortizacion.length - cuotasPendientes
    : (cuotaDiaria > 0 ? Math.floor(totalPagadoReal / cuotaDiaria) : 0)

  // Campos recibo: prioridad cliente > org
  const camposReciboActuales = camposReciboCliente ?? (Array.isArray(cliente?.camposRecibo) ? cliente.camposRecibo : null)
  const camposRecibo = camposReciboActuales ?? (Array.isArray(camposReciboOrg) && camposReciboOrg.length > 0 ? camposReciboOrg : getDefaultCampos())

  const guardarCamposReciboCliente = async (campos) => {
    if (!cliente?.id) return
    setGuardandoCamposRecibo(true)
    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camposRecibo: campos }),
      })
      if (res.ok) {
        setCamposReciboCliente(campos)
      }
    } catch {}
    setGuardandoCamposRecibo(false)
  }

  // Stats contextuales
  // Iconos SVG para narrativa (sin emojis)
  const ICON_TROFEO = <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" /></svg>
  const ICON_CHECK = <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  const ICON_SPARKLE = <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
  const ICON_ALERT = <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
  const ICON_TREND = <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" /></svg>

  // Narrativa para el HeroCard (con icono SVG en vez de emoji)
  const narrativaSaldo = (() => {
    if (estado === 'completado') return { icon: ICON_TROFEO, text: '¡Préstamo completado!' }
    if (estado === 'cancelado') return 'Préstamo cancelado'
    if (porcentajePagado >= 90) return { icon: ICON_SPARKLE, text: '¡Casi listo! Falta poco' }
    if (diasMora > 7) return { icon: ICON_ALERT, text: `${diasMora} días en mora — atención urgente` }
    if (diasMora > 0) return { icon: ICON_ALERT, text: `${diasMora} día${diasMora === 1 ? '' : 's'} vencido` }
    if (yaPagoHoy) return { icon: ICON_CHECK, text: 'Pagó hoy' }
    if (porcentajePagado >= 50) return { icon: ICON_TREND, text: 'Va por buen camino' }
    return null
  })()
  // El modal de gestión se muestra si puede gestionar préstamos O aplicar descuentos
  // (un cobrador con solo permiso de descuentos también debe poder abrirlo).
  const mostrarGestionPrestamo = estaActivo && !completado && (puedeGestionarPrestamos || puedeAplicarDescuentos)

  const esDeHoy = (() => {
    if (!prestamo?.createdAt) return false
    const col = new Date(Date.now() - 5 * 60 * 60 * 1000)
    const hoyISO = col.toISOString().slice(0, 10)
    const creadoISO = new Date(prestamo.createdAt).toISOString().slice(0, 10)
    return creadoISO === hoyISO
  })()
  const puedeEditar = esOwner || esDeHoy

  // ── LO QUE VE CADA FILA DE «GESTIONAR EL PRÉSTAMO» ──
  //
  // Cada acción trae su VALOR ACTUAL. Es la diferencia con el menú anterior:
  // antes había que abrir «Día de cobro» para enterarse de cuál era.
  //
  // Las condiciones son las mismas de antes, una por una: sin permiso la fila
  // no se pinta, en vez de pintarse y fallar al pulsarla.
  // ── LOS DOS TEXTOS DEL CIERRE ──
  //
  // Manda `proporcional`: es la modalidad que perdona mas interes, la que el
  // cliente esperaria si pregunta «cuanto por cerrarlo hoy». La del mes
  // completo se elige dentro de la hoja, si se quiere.
  const cierre = cierreHoy?.proporcional ?? cierreHoy?.mesCompleto ?? null
  // SOLO SE ENSEÑA SI HAY ALGO QUE AHORRAR. En un prestamo pasado de plazo ya
  // corrio todo el interes, asi que cerrarlo hoy cuesta exactamente lo que
  // debe: la linea repetiria la cifra de arriba sin decir nada, y dos veces el
  // mismo numero en un bloque de plata se lee como un error.
  // EL INTERES VENCIDO Y SIN PAGAR. Estaba calculado dentro del `onClick` del
  // boton que abria el modal, asi que solo existia en el instante de pulsarlo.
  // La hoja necesita el mismo numero para enseñarlo y para mandarlo.
  const interesMonto = Math.round(
    (prestamo?.cuotasAmortizacion ?? [])
      .filter((f) => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
      .reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0),
  )

  const pagarIntereses = async () => {
    if (!(interesMonto > 0)) return
    setPagandoInteres(true)
    setInteresError('')
    try {
      const res = await fetch(`/api/prestamos/${id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPagado: interesMonto,
          tipo: 'intereses',
          metodoPago: interesMetodo?.metodoPago ?? 'efectivo',
          ...(interesMetodo?.metodoPagoId ? { metodoPagoId: interesMetodo.metodoPagoId } : {}),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setInteresError(d.error || 'No se pudo registrar el pago')
        return
      }
      setPrestamo(await res.json())
      setModalIntereses(false)
    } catch {
      setInteresError('No se pudo registrar el pago')
    } finally {
      setPagandoInteres(false)
    }
  }

  const hayCierre = cierre && cierre.interesPerdonado > 0
  const cierreTexto = hayCierre ? formatMoney(Math.round(cierre.restanteHoy ?? 0)) : null
  const cierrePerdonaTexto = hayCierre
    ? `se ahorra ${formatMoney(Math.round(cierre.interesPerdonado))} de interés`
    : null

  // ⚠ VA AQUI Y NO ARRIBA: `atajosAjuste` lee `cuotaDiaria`, que se define en
  // el bloque de derivados de mas arriba. Puesto antes reventaba con «Cannot
  // access 'cuotaDiaria' before initialization» — el mismo fallo que ya ha
  // aparecido tres veces en este rediseño por insertar bloques a ojo.
  const ajusteNum = Math.max(0, Math.round(Number(String(ajusteMonto).replace(/\./g, '').replace(',', '.')) || 0))

  // Los atajos del ajuste: fracciones de la cuota, que es la unidad en que se
  // piensa un recargo por mora. Sin esto habria que teclear siempre.
  const atajosAjuste = (() => {
    const c = Math.round(Number(cuotaDiaria) || 0)
    if (!(c > 0)) return []
    return [
      { id: 'media', etiqueta: formatMoney(Math.round(c / 2 / 100) * 100), monto: Math.round(c / 2 / 100) * 100 },
      { id: 'una', etiqueta: formatMoney(c), monto: c },
      { id: 'dos', etiqueta: formatMoney(c * 2), monto: c * 2 },
    ]
  })()

  /**
   * Manda el ajuste. MISMO CONTRATO que el formulario anterior: POST /pagos con
   * `tipo` y `nota`. Lo unico que cambia es la pantalla desde la que se manda.
   *
   * La nota es OBLIGATORIA en los dos casos, igual que antes: un recargo sin
   * motivo es una subida de deuda que nadie sabe explicar tres meses despues,
   * y un descuento sin motivo es plata que se fue sin rastro.
   */
  const aplicarAjuste = async (tipo) => {
    if (!(ajusteNum > 0) || !ajusteNota.trim() || ajustando) return
    setAjustando(true)
    setAjusteError('')
    try {
      const res = await fetch(`/api/prestamos/${id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montoPagado: ajusteNum, tipo, nota: ajusteNota.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAjusteError(data?.error || 'No se pudo aplicar')
        return
      }
      if (data?.prestamo) {
        setPrestamo(data.prestamo)
        if (data.prestamo.estado === 'completado') setCompletado(true)
      }
      setModalRecargo(false)
      setModalDescuento(false)
      setAjusteMonto('')
      setAjusteNota('')
    } catch {
      setAjusteError('Sin conexión. El ajuste no quedó aplicado.')
    } finally {
      setAjustando(false)
    }
  }


  const detalleGestion = [
    cliente?.nombre,
    frecuencia && tasaInteres != null ? `${frecuenciaLabel} ${tasaInteres}%` : null,
    cuotasAmortizacion.length > 0 ? `cuota ${cuotasPagadas} de ${cuotasAmortizacion.length}` : null,
  ].filter(Boolean).join(' · ')

  const gruposGestion = (() => {
    const g = []

    const cobra = []
    if (puedeGestionarPrestamos) {
      cobra.push({ id: 'recargo', nombre: 'Recargo por mora', hacer: () => setModalRecargo(true) })
    }
    if (puedeAplicarDescuentos) {
      cobra.push({ id: 'descuento', nombre: 'Descuento', hacer: () => setModalDescuento(true) })
    }
    if (puedeGestionarPrestamos) {
      cobra.push({
        id: 'plazo', nombre: 'Modificar el plazo',
        valor: diasPlazo ? `${diasPlazo} días` : null,
        hacer: () => setModalPlazo(true),
      })
    }
    if (cobra.length) g.push({ titulo: 'Cambia lo que se cobra', acciones: cobra })

    const cuando = []
    if (puedeGestionarPrestamos) {
      // «Día de cobro» solo existe si NO es diario: en diario no hay día que elegir.
      if (frecuencia && frecuencia !== 'diario') {
        cuando.push({ id: 'dia', nombre: 'Día de cobro', valor: frecuenciaLabel, hacer: () => setModalDiaCobro(true) })
      }
      cuando.push({
        id: 'proximo', nombre: 'Próximo cobro',
        valor: proximoCobro ? fmtFecha(proximoCobro) : null,
        hacer: () => setModalProximoCobro(true),
      })
      cuando.push({
        id: 'sincobro', nombre: 'Días sin cobro',
        hacer: () => {
          try { setDscDias(prestamo?.diasSinCobro ? JSON.parse(prestamo.diasSinCobro) : []) } catch { setDscDias([]) }
          // ⚠ `setModalDscPrestamo`, que es el estado que de verdad abre la
          // hoja (línea 164). Aquí decía `setModalDiasSinCobro`, que NO EXISTE:
          // pulsar «Días sin cobro» tiraba un `ReferenceError` y la pantalla
          // entera caía a la frontera de error — que es parte del «parpadeo»
          // que reportó el dueño.
          //
          // No lo cazó ninguna prueba: una función inexistente dentro de un
          // manejador no falla al compilar ni al importar, solo al PULSAR.
          setModalDscPrestamo(true)
        },
      })
    }
    if (cuando.length) g.push({ titulo: 'Cambia cuándo se cobra', acciones: cuando })

    const cierra = []
    if ((puedeGestionarPrestamos || esOwner) && puedeEditar) {
      cierra.push({ id: 'editar', nombre: 'Editar el préstamo', hacer: () => setModalEditar(true) })
    }
    if (puedeGestionarPrestamos) {
      cierra.push({
        id: 'renovar', nombre: 'Renovar el préstamo',
        valor: porcentajePagado > 0 ? `${Math.round(porcentajePagado)}% pagado` : null,
        hacer: () => setModalRenovar(true),
      })
    }
    if (puedeAplicarDescuentos) {
      cierra.push({ id: 'anticipado', nombre: 'Cerrar anticipado', valor: cierreTexto, hacer: () => abrirLiquidacion() })
    }
    if (puedeGestionarPrestamos) {
      cierra.push(esClavo
        ? { id: 'recuperar', nombre: 'Sacar de perdidos', hacer: () => quitarClavo() }
        : { id: 'perdidos', nombre: 'Mover a perdidos', peligro: true, hacer: () => setModalClavo(true) })
    }
    /* ── ⚠ CANCELAR ENTRA AQUÍ, Y BAJA DEL PIE DE LA PANTALLA ──
       Vivía suelto al final de la página: en el teléfono había que bajar tres
       pantallas para encontrarlo, y en escritorio salía **a todo el ancho de
       6xl** —un rectángulo rosa de 1.200px— que es como lo fotografió el dueño.

       Su sitio es este grupo: cancelar es la última forma de cerrar un
       préstamo, al lado de renovar, cerrar anticipado y mover a perdidos. Y de
       paso deja de ser la acción más grande de la pantalla siendo la más
       destructiva.

       `peligro: true` la pinta en rojo, igual que «Mover a perdidos». */
    if (estaActivo && esOwner && !completado) {
      cierra.push({
        id: 'cancelar', nombre: 'Cancelar el préstamo', peligro: true,
        hacer: () => {
          setModoReversionCapital(hayCobrosRegistrados ? 'devolver_restante' : 'devolver_todo')
          setConfirmCancel(true)
        },
      })
    }
    if (cierra.length) g.push({ titulo: 'Cierra el préstamo', acciones: cierra })

    return g
  })()

  /* ══ LO QUE SE PUEDE HACER AQUÍ, PARA QUE SE PUEDA BUSCAR ═════════════════
   *
   * «La gente entra a un préstamo y no sabe cómo cancelarlo o renovarlo,
   * entonces escriben por WhatsApp.» Y es verdad: renovar y cancelar están en
   * el TERCER nivel, dentro de la hoja «Gestión».
   *
   * ⚠ Se DERIVAN de `gruposGestion`, no se vuelven a listar. Duplicarlas sería
   * garantizar que un día se separen: se añade una fila al menú y la búsqueda
   * no la encuentra. Lo único que se añade son los sinónimos, que es lo que no
   * está escrito en ninguna parte — cómo llama la gente a cada cosa.
   *
   * `hacer()` abre su modal directamente, así que no hace falta abrir antes la
   * hoja: se llega en un toque en vez de tres. */
  const accionesBuscables = [
    ...gruposGestion.flatMap((g) => g.acciones).map((a) => ({
      id: `prestamo-${a.id}`,
      label: a.nombre,
      pista: a.valor ? String(a.valor) : 'En este préstamo',
      sinonimos: SINONIMOS_GESTION[a.id] ?? [],
      ejecutar: () => a.hacer?.(),
    })),
    { id: 'prestamo-pagar', label: 'Registrar un pago', pista: 'En este préstamo',
      sinonimos: EXTRAS_PRESTAMO[0].sinonimos,
      disponible: estaActivo && !completado,
      ejecutar: () => abrirPagoNormal() },
    { id: 'prestamo-abonos', label: 'Abonos y atajos de cobro', pista: 'En este préstamo',
      sinonimos: EXTRAS_PRESTAMO[1].sinonimos,
      disponible: mostrarAtajosCobro,
      ejecutar: () => setModalAtajosCobro(true) },
    { id: 'prestamo-historial', label: 'Ver y gestionar los pagos', pista: 'En este préstamo',
      sinonimos: EXTRAS_PRESTAMO[2].sinonimos,
      // El acordeón arranca cerrado a propósito; desde aquí se abre.
      ejecutar: () => setHistorialOpen(true) },
    { id: 'prestamo-whatsapp', label: 'Escribirle por WhatsApp', pista: 'En este préstamo',
      sinonimos: EXTRAS_PRESTAMO[4].sinonimos,
      disponible: Boolean(cliente?.telefono),
      ejecutar: () => setModalWA(true) },
  ]

  const abrirPagoNormal = () => {
    setPresetPago(null)
    setModalPago(true)
  }

  const abrirPagoConMonto = (monto, tipo = 'completo') => {
    const montoSeguro = Math.max(0, Math.min(Math.round(monto || 0), Math.round(saldoPendiente || 0)))
    if (!montoSeguro) {
      abrirPagoNormal()
      return
    }
    setPresetPago({ monto: montoSeguro, tipo })
    setModalPago(true)
  }

  const getRutaCobroUrl = (clienteRuta) => {
    const prestamosIds = Array.isArray(clienteRuta?.prestamosActivosIds)
      ? clienteRuta.prestamosActivosIds.filter(Boolean)
      : (clienteRuta?.prestamoActivo ? [clienteRuta.prestamoActivo] : [])

    if (prestamosIds.length === 1) {
      return `/prestamos/${prestamosIds[0]}?openPago=1&fromRuta=1`
    }
    return `/clientes/${clienteRuta.id}`
  }
  /* ── ⚠ AQUÍ VIVÍA UN CONTROL MUERTO ──
     `cobroInfo` se calculaba con su rótulo y su color… y NO SE PINTABA EN
     NINGÚN SITIO. Por eso el dueño reportó que dentro del préstamo no se dice
     nunca cuándo se cobra: el dato estaba y no llegaba a la pantalla.

     Ahora sale de `cifraProximoCobro`, la misma función que las tarjetas y la
     tabla, y entra como cuarta columna de la tira. Una regla, cuatro pantallas.

     `estaActivo`: en un préstamo cerrado no hay próximo cobro que enseñar. */
  const cobro = estaActivo ? cifraProximoCobro({ proximoCobro }) : null

  /* ── QUÉ DÍAS SE COBRA ──
     Reportado dos veces: «sigo sin ver los días o día de pagos». No es el
     próximo cobro —eso ya sale en la tira— sino el CALENDARIO: en un préstamo
     diario, «30 cuotas diarias» no son treinta días seguidos si la ruta no
     cobra domingos.

     `diasExcluidos` lo resuelve el servidor con la jerarquía Préstamo >
     Cliente > Ruta > Organización, y hasta ahora no salía del endpoint: aquí
     solo había el campo crudo del préstamo, sin la herencia. */
  const diasDeCobroTexto = calendarioDeCobro(prestamo, prestamo?.diasExcluidos ?? [])

  // ⚠ SIN `pb-28`. El hueco de la pastilla lo reserva el ARMAZÓN, que es el
  // único que sabe si la hay: `Armazon.jsx:185` pinta un espaciador de 112px
  // cuando toca. Poner aquí otros 112 los SUMABA, y el dueño lo fotografió:
  // 164px de nada entre «Cancelar préstamo» y la pastilla.
  // Medido con `.auditoria/hueco-real.mjs`. Ojo: `hueco-del-pie.mjs` daba «ok»
  // —mide el último elemento con contenido, no el hueco que se ve—.
  return (
    <div className="max-w-2xl lg:max-w-6xl mx-auto space-y-4 pb-4">

      {/* ── UNA SOLA FRANJA ROJA ──
          Iban dos apiladas: «Préstamo perdido» y debajo «62 días en mora · 62
          cuotas vencidas · $204.000». Las dos ciertas, pero dos muros rojos
          seguidos no alarman el doble: se leen como uno solo y mal. Cuando el
          préstamo está dado por perdido, esa es LA noticia, y la mora entra
          dentro como el detalle que la sostiene. */}
      {esClavo && (
        <div className="flex items-start gap-2.5 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[16px] px-4 py-3">
          <span className="w-2 h-2 rounded-full bg-[var(--cf-red-dark)] shrink-0 mt-1.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--cf-red-dark)]">
              Préstamo perdido — apartado de tus números normales
            </p>
            {enMora && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--cf-red-dark)', opacity: .85 }}>
                {diasMora} días en mora
                {cuotasEnMora > 0 ? ` · ${cuotasEnMora} cuota${cuotasEnMora === 1 ? '' : 's'} vencida${cuotasEnMora === 1 ? '' : 's'}` : ''}
                {montoEnMora > 0 ? ` · ${formatMoney(montoEnMora)}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── RENOVADO DE (continuidad) ────────────────────────────── */}
      {renovadoDeId && (
        <Link
          href={`/prestamos/${renovadoDeId}`}
          className="flex items-center gap-2 bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.25)] rounded-[12px] px-3 py-2 text-xs"
          style={{ color: 'var(--cf-ink-2)' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Renovado del préstamo anterior — ver historial
        </Link>
      )}

      {/* ── CELEBRACIÓN ──────────────────────────────────────────── */}
      {completado && (
        <div className="bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[20px] cf-card-shadow p-4 text-center">
          <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 20%, transparent)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--cf-green-dark)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[var(--cf-green-dark)] font-bold">Préstamo completado</p>
          <p className="text-xs text-[var(--cf-ink-3)] mt-0.5">El cliente terminó de pagar</p>
        </div>
      )}

      {/* La franja de mora NO se pinta si ya está dentro de la del clavo. */}
      {enMora && estaActivo && !completado && !esClavo && (
        <div className="flex items-center gap-3 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[16px] px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-[var(--cf-red-dark)] animate-pulse shrink-0" />
          <p className="text-sm text-[var(--cf-red-dark)] font-semibold">
            {diasMora} días en mora
            {cuotasEnMora > 0 ? ` · ${cuotasEnMora} cuota${cuotasEnMora === 1 ? '' : 's'} vencida${cuotasEnMora === 1 ? '' : 's'}` : ''}
            {montoEnMora > 0 ? ` · ${formatMoney(montoEnMora)}` : ''}
          </p>
        </div>
      )}

      {/* ── AVISO INTERES MORATORIO ──────────────────────────────── */}
      {moratorio?.aplicable && estaActivo && !completado && esOwner && (
        <div className="bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] rounded-[20px] cf-card-shadow p-4 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-[var(--cf-gold-dark)] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--cf-gold-dark)]">
                Interés moratorio: {formatMoney(moratorio.montoMoratorio)}
              </p>
              <p className="text-xs text-[var(--cf-ink-3)] mt-1">
                {moratorio.diasMoraEfectivos} dias efectivos de mora sobre {formatMoney(moratorio.montoBase)} en mora
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setMoratorioMonto(moratorio.montoMoratorio)
              setMoratorioNota(`Interés moratorio: ${moratorio.diasMoraEfectivos} días sobre ${formatMoney(moratorio.montoBase)}`)
              setMoratorioError('')
              setModalMoratorio(true)
            }}
            className="w-full h-10 rounded-[12px] text-sm font-semibold text-[var(--cf-gold-dark)] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.18)] transition-all"
          >
            Aplicar como recargo
          </button>
        </div>
      )}

      {/* ── ANIMACIÓN ÉXITO PAGO ────────────────────────────────── */}
      {exito && !completado && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] px-4 py-3">
            <svg className="w-5 h-5 text-[var(--cf-green-dark)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[var(--cf-green-dark)] font-medium">Pago registrado exitosamente</p>
          </div>
          {ultimoPago && cliente?.telefono && (
            <BotonAbrirHojaWA onClick={() => { setWaPago(ultimoPago); setModalWA(true) }} />
          )}
          {ultimoPago && (
            <div className="flex gap-2">
              <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
              <BotonAbrirRecibo onClick={() => setModalRecibo({ tipo: 'pago', pago: ultimoPago })} />
            </div>
          )}
        </div>
      )}

      {/* ── WA PAGO (persiste después de cerrar animación) ───────── */}
      {!exito && ultimoPago && !completado && (
        <>
          {cliente?.telefono && (
            <BotonAbrirHojaWA onClick={() => { setWaPago(ultimoPago); setModalWA(true) }} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
            <BotonAbrirRecibo onClick={() => setModalRecibo({ tipo: 'pago', pago: ultimoPago })} />
          </div>
        </>
      )}

      {/* ── WA PRÉSTAMO COMPLETADO ───────────────────────────────── */}
      {completado && ultimoPago && (
        <>
          {cliente?.telefono && (
            <BotonAbrirHojaWA onClick={() => { setWaPago(ultimoPago); setModalWA(true) }} />
          )}
          <div className="flex gap-2">
            <BotonCompartir cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
            <BotonAbrirRecibo onClick={() => setModalRecibo({ tipo: 'pago', pago: ultimoPago })} />
          </div>
        </>
      )}

      {/* ── SIGUIENTE EN RUTA (después de pago) ──────────────────── */}
      {rutaNav && (exito || yaPagoHoy) && (() => {
        const idx = rutaNav.clientes?.findIndex(c => c.id === cliente?.id) ?? -1
        if (idx < 0) return null
        const isLast = idx >= rutaNav.clientes.length - 1
        const nextCliente = !isLast ? rutaNav.clientes[idx + 1] : null

        const navigateNext = () => {
          if (!nextCliente) return
          const newNav = { ...rutaNav, currentIndex: idx + 1 }
          sessionStorage.setItem('cf-ruta-nav', JSON.stringify(newNav))
          const getDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
          localStorage.setItem(`cf-ruta-progress-${rutaNav.rutaId}`, JSON.stringify({
            clienteId: nextCliente.id, clienteNombre: nextCliente.nombre, index: idx + 1, date: getDate(),
          }))
          const url = getRutaCobroUrl(nextCliente)
          navigator.onLine ? router.push(url) : (window.location.href = url)
        }

        if (isLast || !nextCliente) return (
          <button
            onClick={() => { sessionStorage.removeItem('cf-ruta-nav'); const u = `/rutas/${rutaNav.rutaId}`; navigator.onLine ? router.push(u) : (window.location.href = u) }}
            className="w-full py-3.5 rounded-[12px] bg-[var(--cf-green-dark)] text-[var(--cf-ink)] text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Ruta finalizada · Volver a {rutaNav.rutaNombre}
          </button>
        )

        return (
          <button
            onClick={navigateNext}
            className="w-full py-3.5 rounded-[12px] text-sm font-semibold active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, var(--cf-gold), var(--cf-gold))', color: 'var(--cf-ink)' }}
          >
            Siguiente → {nextCliente.nombre}
          </button>
        )
      })()}

      {/* ── DOS COLUMNAS EN ESCRITORIO (T11-03) ─────────────────────────
          A 1440 esto era una columna de tarjetas móviles apiladas: la tabla de
          amortización y el historial quedaban a varias pantallas de scroll del
          saldo, y media pantalla en blanco.

          La lámina reparte por USO: a la izquierda lo que se opera —cobrar, el
          estado del préstamo, su tabla, sus pagos—, a la derecha lo que se
          consulta mientras se opera: quién es el cliente, sus documentos y la
          firma. Lo de la izquierda es largo y lo de la derecha corto, así que
          el carril no se estira.

          En móvil sigue siendo una sola columna, en el mismo orden: `lg:grid`
          no aplica por debajo de 1024. */}
      <div className="lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-5 lg:items-start space-y-4 lg:space-y-0">
        <div className="space-y-4 min-w-0">

      {/* ── 2. HEADER CLIENTE CON CONTEXTO ─────────────────────────── */}
      <HeaderClienteContexto
        cliente={cliente}
        prestamo={prestamo}
        /* ⚠ E03 · «cliente recurrente» SOLO UNA VEZ POR PANTALLA.
           Salía en la cabecera, en un chip y en una tarjeta: tres veces. Ahora,
           para el DUEÑO, vive una sola vez en «Cómo va» y dicho como lo diría un
           prestamista: «es su segundo préstamo contigo · pagó el anterior» —lo
           que importa de un cliente repetido no es que se repita, es cómo
           terminó las veces anteriores.

           Al COBRADOR se le sigue diciendo aquí: «Cómo va» es solo del dueño
           (`esOwner` en su condición), así que quitarlo de la cabecera le
           borraría el dato en vez de moverlo. */
        statsCliente={!esOwner && statsCliente && statsCliente.totalPrestamos > 1
          ? `${statsCliente.completados} préstamo${statsCliente.completados === 1 ? '' : 's'} completado${statsCliente.completados === 1 ? '' : 's'} · cliente recurrente`
          : null}
        onWhatsApp={cliente?.telefono ? () => setModalWA(true) : null}
      />

      {/* ── 3. BOTÓN PRINCIPAL DE PAGO CON PERSONALIDAD ────────────── */}
      {estaActivo && !yaPagoHoy && !completado && (
        <BotonPagoPersonalidad
          enMora={enMora}
          frecuenciaLabel={frecuenciaLabel}
          monto={cuotaDiaria}
          onClick={abrirPagoNormal}
        />
      )}

      {/* ── PAGÓ HOY (banner verde con misma estructura que el boton de pago) ── */}
      {estaActivo && yaPagoHoy && !completado && (
        <div
          className="w-full h-16 rounded-[16px] flex items-center px-4"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(22, 163, 74, 0.10))',
            border: '1px solid rgba(34, 197, 94, 0.35)',
          }}
        >
          {/* Icono circular fijo a la izquierda */}
          <span
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3"
            style={{ background: 'rgba(34, 197, 94, 0.25)', color: 'var(--cf-green-dark)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {/* Texto en 2 lineas */}
          <span className="flex-1 flex flex-col items-start min-w-0 text-left leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80" style={{ color: 'var(--cf-green-dark)' }}>
              Pago {frecuenciaLabel} registrado
            </span>
            <span className="text-[18px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--cf-green-dark)' }}>
              {formatMoney(cuotaDiaria)}
            </span>
          </span>
        </div>
      )}

      {/* ── 5. ACCIONES SECUNDARIAS COMO CHIPS ─────────────────── */}
      {(mostrarAtajosCobro || mostrarGestionPrestamo || cliente?.telefono) && (
        <ChipsAccionesSecundarias
          acciones={[
            // ── «ENVIAR POR WHATSAPP», SIEMPRE Y A LA VISTA ──────────────
            //
            // En esta pantalla SÍ había `BotonCompartir`, pero los tres son
            // CONDICIONALES: aparecen tras registrar un pago o al completarse
            // el préstamo. En un préstamo activo, sin pago recién hecho, no
            // había ninguno — y es justo el caso del que se quejó un cobrador
            // en video: «le estoy haciendo el crédito, le quiero mandar crédito
            // aprobado y no puedo, no veo la opción».
            //
            // Va PRIMERO porque su ciclo es crear el crédito y mandarlo. El
            // envío automático al crear (`?nuevo=1`) sigue igual; esto es para
            // volver a mandarlo, que es lo que él no encontraba.
            ...(cliente?.telefono ? [{
              // «WhatsApp» a secas: en el chip, «Enviar por WhatsApp» se cortaba
              // en «Enviar por Wh…». El icono verde ya dice de qué se trata, y
              // el sublabel dice qué se manda.
              label: 'WhatsApp',
              sublabel: 'Enviar crédito o recibo',
              color: '#25D366',
              icon: (
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M20.52 3.449C12.831-3.984.106 1.407.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 0 0 5.68 1.448h.005c9.6 0 15.24-10.4 10.5-18.35a11.83 11.83 0 0 0-2-2.997zM12.02 21.785h-.004a9.87 9.87 0 0 1-5.03-1.378l-.36-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.263c.001-8.708 10.59-13.067 16.752-6.909 6.16 6.158 1.812 16.805-6.87 16.805z" />
                </svg>
              ),
              onClick: () => { setWaSugerida('credito_aprobado'); setModalWA(true) },
            }] : []),
            ...(mostrarAtajosCobro ? [{
              // «Abonos», una palabra: «Cobros» y «Abonos y atajos» decían lo
              // mismo dos veces, y el subtítulo era una lista, no una
              // explicación. La mora pasa a ser un punto rojo sobre el icono.
              label: 'Abonos',
              sublabel: hayMontoMora ? `Mora ${formatMoney(montoEnMora)}` : 'Abonos y atajos',
              alerta: hayMontoMora,
              color: hayMontoMora ? 'var(--cf-red-dark)' : 'var(--cf-gold)',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
              onClick: () => setModalAtajosCobro(true),
            }] : []),
            ...(mostrarGestionPrestamo ? [{
              label: 'Gestión',
              sublabel: 'Renovar, plazo, ajustes',
              color: 'var(--cf-ink-2)',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.425-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /></svg>,
              onClick: () => setModalGestionPrestamo(true),
            }] : []),
          ]}
        />

      )}

        {/* ⚠ LA ENTRADA PARA QUIEN NO SABE QUE HAY UN BUSCADOR.
            Va JUSTO DEBAJO de los chips a propósito: los chips son la puerta a
            los tres niveles de escondite —«Gestión · Renovar, plazo, ajustes»—
            y esto es el atajo para quien no los va a abrir. Escribe «quiero
            renovar este préstamo» y se abre la hoja de renovar, sin pasar por
            el chip ni por el menú. */}
        <RegistrarAcciones clave="prestamo" acciones={accionesBuscables} />
        <QueNecesitas ejemplos={['renovar', 'cancelar', 'cambiar el plazo']} />

      {/* ── LA FICHA DE T41-01 ──
          Sustituye al hero con donut y sparkline, y a la grilla de datos en tres
          secciones. La lamina se llama «Ficha fijo — el 54,7% de la cartera» y
          trae tres decisiones que no son de estilo:

          1 · EN EL LUGAR DEL DESGLOSE VA EL HISTORIAL DE PAGOS, no un calendario
              proyectado. En un prestamo `fijo` el calendario es una sola frase
              —«$20.000 diarios durante 30 dias»— y ya esta arriba; dibujar 30
              filas identicas es relleno. El historial es lo que el cliente
              discute y lo unico que no se puede deducir de memoria.

          2 · EL INTERES SE MUESTRA UNA SOLA VEZ, en «como se pacto», escrito como
              lo diria el prestamista: «le preste $500.000, me paga $600.000 · tu
              ganancia $100.000». NUNCA por pago — el sistema sabe el interes
              TOTAL, no cuanto de cada pago fue interes, e inventar ese reparto es
              justo el tipo de dato que hace que alguien deje de confiar en la app.

          3 · Dice «LE FALTA PAGAR», no «saldo pendiente». Aca no hay
              amortizacion, asi que no hay razon para hablar como un banco.

          LO QUE LA LAMINA NO TIENE y aqui se queda mas abajo: la linea de tiempo,
          el comparativo de prestamos del cliente, los chips de stats y el tip de
          IA. No los borro — son cosas que el dueño puede estar usando, y quitar
          features no es rediseñar. Si sobran, se van cuando lo digas. */}
      <FichaPrestamo
        sinMargen
        cierreHoy={cierreTexto}
        cierrePerdona={cierrePerdonaTexto}
        onCerrarHoy={puedeAplicarDescuentos ? () => abrirLiquidacion() : null}
        modo={modoInteres === 'unico' ? 'unico' : modoInteres === 'manual' ? 'manual' : modoInteres === 'proporcional' ? 'proporcional' : 'fijo'}
        faltaPagar={formatMoney(Math.round(saldoPendiente || 0))}
        // Lo mismo SIN intereses: «¿cuánto de eso es mi plata?». El API ya lo
        // calcula con `calcularCapitalRestante` —la misma que usa la renovación
        // para saber cuánto absorbe—, así que aquí solo se pasa: no hay una
        // segunda cuenta de «capital que aún debe».
        capitalPendiente={prestamo?.capitalRestante != null
          ? formatMoney(Math.round(prestamo.capitalRestante))
          : null}
        pagado={formatMoney(totalPagadoReal)}
        totalAPagar={formatMoney(Math.round(totalAPagar || 0))}
        porcentaje={Math.min(100, Math.max(0, Math.round(porcentajePagado || 0)))}
        cuota={formatMoney(Math.round(cuotaDiaria || 0))}
        enMora={hayMontoMora ? formatMoney(Math.round(montoEnMora)) : '$0'}
        cuotasFaltantes={cuotasFaltantesTexto}
        cobro={cobro}
        diasDeCobro={diasDeCobroTexto}
        prestado={formatMoney(montoPrestadoRedondeado)}
        ganancia={formatMoney(Math.max(0, Math.round((totalAPagar || 0) - montoPrestadoRedondeado)))}
        plazoTexto={plazoPactadoTexto}
        fechaVencimiento={fechaVencTexto}
        diasParaVencer={diasParaVencerTexto}
        empezoEl={empezoElTexto}
        cuotaQuePusiste={cuotaQuePusisteTexto}
        tasaTexto={tasaProporcional}
        notaHistorial={notaDelHistorial}
        pagos={pagosParaFicha}
        totalPagos={pagos.length}
        // SIN `onRegistrar` NI `onGestionar`: la pagina ya tiene su propia pila de
        // acciones arriba —el boton rojo «PAGAR AHORA · VENCIDO» con el monto, y
        // los chips «Cobros» y «Gestion»— y son mas informativas que un
        // «Registrar pago» neutro: el rojo con la cifra dice que esta vencido y
        // cuanto, sin tener que leer nada mas.
        //
        // La lamina pone las suyas abajo porque dibuja la pantalla SIN esa pila.
        // Tener las dos es peor que cualquiera de las dos: cuatro botones de
        // cobrar en una pantalla de cobrar. Si prefieres las de la lamina y que
        // se vaya la pila de arriba, es cambiar estas dos lineas.
        onRegistrar={undefined}
        onVerTodos={pagos.length > pagosParaFicha.length ? () => {
          // Abre el historial completo que YA vive mas abajo en la pantalla, y
          // lleva la vista hasta el. No se inventa una pantalla nueva.
          setHistorialOpen(true)
          setTimeout(() => {
            document.getElementById('cf-historial-pagos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 60)
        } : undefined}
      />

      {/* Banner aprobación — solo owner y préstamos pendientes */}
      {esOwner && estado === 'pendiente_aprobacion' && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
                Pendiente de tu aprobacion
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
              {creadoPor?.nombre ?? 'Un cobrador'} solicita crear este prestamo de {formatMoney(montoPrestado)} para {cliente?.nombre ?? 'el cliente'}. El dinero no se ha desembolsado todavia.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={aprobando}
                disabled={rechazando}
                onClick={async () => {
                  setAprobando(true)
                  try {
                    const res = await fetch(`/api/prestamos/${id}/aprobar`, { method: 'POST' })
                    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Error al aprobar'); return }
                    fetchPrestamo()
                  } catch { alert('Error de conexion') }
                  finally { setAprobando(false) }
                }}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={rechazando}
                disabled={aprobando}
                onClick={async () => {
                  setRechazando(true)
                  try {
                    const res = await fetch(`/api/prestamos/${id}/rechazar`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    })
                    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Error al rechazar'); return }
                    router.push('/prestamos')
                  } catch { alert('Error de conexion') }
                  finally { setRechazando(false) }
                }}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Rechazar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Cobrador: aviso de que su préstamo está pendiente */}
      {esCobrador && estado === 'pendiente_aprobacion' && (
        <Card>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--cf-ink-2)' }}>
              Este prestamo esta pendiente de aprobacion por el administrador.
            </p>
          </div>
        </Card>
      )}

      {/* ══ E03 · CUATRO BLOQUES → UNO ═══════════════════════════════════
          Aquí había, seguidos: el banner de la IA con su ✕, los chips, la
          tarjeta «Cliente recurrente» que repetía el chip palabra por palabra,
          y la línea de tiempo. Cuatro cajas para tres datos.

          Se van los tres primeros y su contenido entra en «Cómo va»:
          · el banner  → un aviso que se puede cerrar es un aviso que no
            importaba, y decía lo mismo que la barra de progreso
          · los chips  → «N cuotas pagadas» ahora va EN la línea de tiempo,
            donde significa algo
          · la tarjeta → «cliente recurrente» pasa a la frase que diría un
            prestamista: cómo terminó las veces anteriores

          `StatsContextuales`, `AiTipBanner` y `ComparativoPrestamosCliente`
          siguen existiendo y se usan en otras pantallas: aquí solo dejan de
          montarse. */}

      {/* ── CÓMO VA — solo owner ────────────────────────────────────── */}
      {esOwner && estaActivo && fechaInicio && fechaFin && (
        <TimelinePrestamo
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          porcentajePagado={porcentajePagado}
          color={moodColorFromPrestamo(prestamo)}
          cuotasPagadas={cuotasPagadas}
          /* Con tabla, el total son sus filas. Sin tabla, el PLAZO partido por
             los días del periodo — la misma fórmula que usa `calcularPrestamo`
             (`lib/calculos.js:652`).

             ⚠ NO vale `totalAPagar / cuotaDiaria`: lo probé y en este préstamo
             daba «2 de 5 cuotas» cuando son 3, porque la última cuota no es
             igual que las demás. La cifra se veía plausible y estaba mal. */
          cuotasTotales={cuotasAmortizacion.length > 0
            ? cuotasAmortizacion.length
            : (diasPlazo > 0 ? Math.ceil(diasPlazo / obtenerDiasPorPeriodo(frecuencia)) : null)}
          prestamoNumeroCliente={statsCliente?.numeroEsteDe}
          prestamosCompletadosCliente={statsCliente?.completados}
        />
      )}

      {/* La grilla de datos en tres secciones se fue: lo que decia —credito,
          plazo, cobro— ya lo dice «como se pacto» en una frase, y lo que no cabia
          ahi no responde ninguna pregunta que se haga mirando un prestamo. Era el
          desglose que T41-01 sustituye por el historial. */}

      {/* ── LA TABLA (T12-01) ──────────────────────────────────────
          Solo los 4 modos que TIENEN calendario: `lineal`, `lineal_dinamico`,
          `solo_interes` y `saldo`, el 6,2% de la cartera. En los otros cuatro no
          hay tabla guardada y dibujar treinta filas identicas seria inventar un
          desglose que el sistema no tiene.

          Es la tabla NUEVA, la de barras partidas. La vieja era una lista de
          acordeones, que es literalmente lo que la lamina dice que deja de ser.

          Sin `onCompartir`/`onImprimir`: aqui NO va la barra de accion, porque la
          ficha ya tiene la suya. Compartir e imprimir viven en /prestamos/[id]/tabla,
          que es su propia pantalla porque una tabla que se le manda al cliente
          necesita cabecera propia y no puede ser un trozo de otra pagina.

          Lo que si se conserva es pulsar la cuota para dejar el pago listo: eso lo
          tenia el montaje viejo, es funcion real, y rehacer la pantalla no es
          excusa para perderla. */}
      {tablaParaFicha && (
        <TablaAmortizacion
          {...tablaParaFicha}
          onTocarCuota={estaActivo && !completado ? (c) => {
            const faltante = Math.max(0, c.faltanteNum || 0)
            if (faltante <= 0) return
            setPresetPago({ monto: Math.round(faltante), tipo: 'completo' })
            setModalPago(true)
          } : undefined}
          onVerTodas={() => router.push(`/prestamos/${prestamo.id}/tabla`)}
        />
      )}

        </div>

        {/* ── EL CARRIL DERECHO: lo que se consulta mientras se opera ── */}
        <div className="space-y-4 min-w-0">

      {/* ── BOTONES WHATSAPP ─────────────────────────────────────── */}
      {cliente?.telefono && estaActivo && enMora && !completado && (
        <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={prestamo} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
      )}
      {/* ⚠ AQUÍ HABÍA UN SEGUNDO «ENVIAR RESUMEN POR WHATSAPP» (E02).
          Hacía lo MISMO que el chip «WhatsApp» de la columna izquierda —los dos
          `setWaSugerida('credito_aprobado')`—, así que WhatsApp salía dos veces
          en la misma pantalla con el mismo destino. De la lámina: «se queda uno
          solo, en los cuatro botones».
          El de mora, justo encima, NO se toca: manda otro mensaje y solo sale
          cuando hay atraso. */}

      {/* ── FIRMA DIGITAL ──────────────────────────────────────── */}
      <FirmaDigital
        prestamo={prestamo}
        onSave={(url) => setPrestamo(prev => ({ ...prev, firmaUrl: url }))}
      />

      {/* ── MODAL CAMPOS RECIBO (se abre al generar comprobante) ── */}
      {modalRecibo && (
        <ModalCamposRecibo
          tipo={modalRecibo.tipo}
          pago={modalRecibo.pago}
          cliente={cliente}
          prestamo={prestamo}
          orgNombre={orgNombre}
          ocultarSaldo={ocultarSaldoWA}
          campos={camposRecibo}
          camposOrg={Array.isArray(camposReciboOrg) ? camposReciboOrg : []}
          usandoOrg={camposReciboActuales === null}
          guardando={guardandoCamposRecibo}
          onSave={guardarCamposReciboCliente}
          onClose={() => setModalRecibo(null)}
          esOwner={esOwner}
        />
      )}

      {/* ── HISTORIAL DE PAGOS (colapsado por defecto) ────────────
          `id` para que «Ver los N pagos» de la ficha pueda traer aqui. */}
      <div id="cf-historial-pagos" />
      <Card>
        <button
          type="button"
          onClick={() => setHistorialOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 focus-visible:outline-none"
        >
          <p className="text-[11px] font-extrabold text-[var(--cf-ink-3)] uppercase tracking-[.07em]">
            Gestionar los pagos ({pagos.length})
          </p>
          <svg
            className="w-4 h-4 shrink-0 transition-transform duration-200"
            style={{ color: 'var(--cf-ink-3)', transform: historialOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {historialOpen && <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs text-[var(--cf-ink-3)]">
            {filtroFecha ? `${pagos.filter(p => {
              const d = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
              return d === filtroFecha
            }).length} de ${pagos.length} en esta fecha` : `${pagos.length} pago${pagos.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-1">
            <label
              className="relative h-8 flex items-center gap-1.5 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-2 cursor-pointer hover:border-[var(--cf-ink-2)] transition-colors"
              title="Filtrar por fecha"
            >
              <svg className="w-3.5 h-3.5 text-[var(--cf-ink-3)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] text-[var(--cf-ink)] whitespace-nowrap">
                {filtroFecha || 'Fecha'}
              </span>
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            {filtroFecha && (
              <button
                type="button"
                onClick={() => setFiltroFecha('')}
                className="text-[10px] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] px-2 py-1"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {cliente?.telefono && (
            <BotonWhatsApp tipo="historial" cliente={cliente} prestamo={prestamo} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
          )}
          <BotonAbrirRecibo label="Generar estado de cuenta" onClick={() => setModalRecibo({ tipo: 'historial', pago: null })} />
        </div>

        {(() => {
          const pagosFiltrados = filtroFecha
            ? pagos.filter((p) => {
                const d = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000)
                  .toISOString().slice(0, 10)
                return d === filtroFecha
              })
            : pagos
          return pagosFiltrados.length === 0 ? (
            <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">
              {filtroFecha ? 'Sin pagos en esta fecha' : 'Sin pagos registrados'}
            </p>
          ) : (
          <div className="space-y-2.5">
            {pagosFiltrados.map((pago) => {
              const esAjuste = ['recargo', 'descuento'].includes(pago.tipo)
              const comprobanteAbierto = comprobante === pago.id
              return (
                <PagoMiniCard key={pago.id} pago={pago} isOffline={pago.id?.startsWith?.('offline-')}>
                  {/* Botones de accion (comprobante, editar fecha, anular) */}
                  <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid var(--cf-border)' }}>
                    {!esAjuste && (
                      <button
                        onClick={() => setComprobante(comprobanteAbierto ? null : pago.id)}
                        className={[
                          'flex items-center gap-1 px-2 h-7 rounded-[8px] text-[10px] font-medium transition-colors',
                          comprobanteAbierto
                            ? 'text-[var(--cf-gold)] bg-[rgba(245,197,24,0.1)]'
                            : 'text-[var(--cf-ink-3)] hover:text-[var(--cf-gold)] hover:bg-[rgba(245,197,24,0.08)]',
                        ].join(' ')}
                        title="Enviar comprobante"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Compartir
                      </button>
                    )}
                    {pago.tipo === 'capital' && tasaInteres > 0 && (
                      <span className="text-[10px] px-2 py-1 rounded-[6px] font-mono-display" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--cf-ink-2)' }}>
                        -{formatMoney(Math.round(pago.montoPagado * tasaInteres / 100))} int.
                      </span>
                    )}
                    <div className="flex-1" />
                    {session?.user?.rol === 'owner' && (
                      <button
                        onClick={() => setEditandoFecha(editandoFecha === pago.id ? null : pago.id)}
                        className={[
                          'w-9 h-9 flex items-center justify-center rounded-[8px] transition-colors',
                          editandoFecha === pago.id
                            ? 'text-[var(--cf-ink-2)] bg-[rgba(59,130,246,0.1)]'
                            : 'text-[var(--cf-ink-3)] hover:text-[var(--cf-ink-2)] hover:bg-[rgba(59,130,246,0.08)]',
                        ].join(' ')}
                        title="Editar fecha"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                    {session?.user?.rol === 'owner' && (
                      <button
                        onClick={() => {
                          if (anulando) return
                          setConfirmAnularPago({ pagoId: pago.id, monto: pago.montoPagado })
                        }}
                        disabled={anulando === pago.id}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[var(--cf-ink-3)] hover:text-[var(--cf-red-dark)] hover:bg-[var(--cf-red-pill-bg)] transition-colors disabled:opacity-50"
                        title="Anular pago"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Panel de comprobante expandible */}
                  {comprobanteAbierto && (
                    <div className="pb-3 pl-1 space-y-2">
                      {cliente?.telefono && (
                        <BotonWhatsApp
                          tipo="pago"
                          cliente={cliente}
                          prestamo={prestamo}
                          pago={{ montoPagado: pago.montoPagado, fechaPago: pago.fechaPago }}
                          orgNombre={orgNombre}
                          ocultarSaldo={ocultarSaldoWA}
                          camposRecibo={camposRecibo}
                          organizationId={session?.user?.organizationId}
                        />
                      )}
                      <BotonAbrirRecibo
                        small
                        onClick={() => setModalRecibo({ tipo: 'pago', pago: { id: pago.id, montoPagado: pago.montoPagado, fechaPago: pago.fechaPago } })}
                      />
                    </div>
                  )}
                  {/* Panel de editar fecha expandible */}
                  {editandoFecha === pago.id && (
                    <div className="pb-3 pl-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          defaultValue={new Date(new Date(pago.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                          className="h-9 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-ink-2)] transition-colors"
                          id={`fecha-pago-${pago.id}`}
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById(`fecha-pago-${pago.id}`)
                            if (!input?.value) return
                            // Crear fecha a mediodía para evitar problemas de timezone
                            const nuevaFecha = new Date(input.value + 'T12:00:00')
                            try {
                              const res = await fetch(`/api/pagos/${pago.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fechaPago: nuevaFecha.toISOString() }),
                              })
                              if (!res.ok) throw new Error()
                              setEditandoFecha(null)
                              await fetchPrestamo()
                            } catch {
                              setError('No se pudo cambiar la fecha.')
                            }
                          }}
                          className="h-9 px-3 rounded-[12px] text-xs font-medium text-[var(--cf-ink)] bg-[var(--cf-ink-2)] hover:bg-[#2563eb] transition-colors active:scale-[0.97]"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoFecha(null)}
                          className="h-9 px-2 rounded-[12px] text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </PagoMiniCard>
              )
            })}
          </div>
          )
        })()}
        </div>}
      </Card>

        </div>
      </div>

      {/* ── CANCELAR PRÉSTAMO ─────────────────────────────────────────────
          El disparador vive ahora en la hoja de Gestión, grupo «Cierra el
          préstamo». Aquí solo queda la confirmación, y en un MODAL: al fondo de
          la página el usuario tendría que bajar tres pantallas para leer lo que
          está a punto de aceptar, y en escritorio ocupaba los 1.200px de ancho.

          ⚠ Los colores dejan de ser `rgba(239,68,68,…)`, que es el rojo de
          Tailwind y NO el del sistema (`--cf-red`, #E5484D). Se veía parecido y
          era otro: por eso este bloque «tenía el diseño anterior». */}
      <Modal
        open={!!confirmCancel && estaActivo && session?.user?.rol === 'owner' && !completado}
        onClose={() => setConfirmCancel(false)}
        title="¿Cancelar este préstamo?"
      >
            <div className="space-y-3">
              <p className="text-xs text-[var(--cf-ink-3)]">
                Se marcará como cancelado. El saldo pendiente de {formatMoney(saldoPendiente)} quedará sin cobrar.
              </p>

              {hayCobrosRegistrados && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--cf-ink-2)]">El préstamo ya tiene cobros registrados ({formatMoney(totalPagadoReal)}). Elige cómo reversar en caja:</p>

                  <label className="flex items-start gap-2.5 rounded-[14px] border border-[var(--cf-border)] bg-[var(--cf-fill)] px-3 py-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_todo"
                      checked={modoReversionCapital === 'devolver_todo'}
                      onChange={() => setModoReversionCapital('devolver_todo')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--cf-ink)]">Devolver todo el préstamo a caja (+{formatMoney(montoPrestadoRedondeado)})</p>
                      <p className="text-[11px] text-[var(--cf-ink-3)]">Conserva los cobros ya registrados y regresa el monto completo prestado.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-[14px] border border-[var(--cf-border)] bg-[var(--cf-fill)] px-3 py-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_restante"
                      checked={modoReversionCapital === 'devolver_restante'}
                      onChange={() => setModoReversionCapital('devolver_restante')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--cf-ink)]">Devolver solo lo pendiente (+{formatMoney(saldoFinancieroPendiente)})</p>
                      <p className="text-[11px] text-[var(--cf-ink-3)]">Calculado como prestado menos cobrado real.</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 h-[46px] rounded-[14px] text-sm font-bold text-[var(--cf-ink-2)] border border-[var(--cf-border-strong)] hover:bg-[var(--cf-surface)] transition-colors"
                >
                  No, volver
                </button>
                <button
                  onClick={async () => {
                    setCancelando(true)
                    try {
                      const res = await fetch(`/api/prestamos/${id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          estado: 'cancelado',
                          modoReversionCapital: hayCobrosRegistrados ? modoReversionCapital : 'devolver_todo',
                        }),
                      })
                      if (!res.ok) {
                        let mensaje = 'No se pudo cancelar el préstamo.'
                        try {
                          const payload = await res.json()
                          if (payload?.error) mensaje = payload.error
                        } catch {}
                        throw new Error(mensaje)
                      }
                      await fetchPrestamo()
                      setConfirmCancel(false)
                    } catch (err) {
                      setError(err.message || 'No se pudo cancelar el préstamo.')
                    } finally {
                      setCancelando(false)
                    }
                  }}
                  disabled={cancelando}
                  className="flex-1 h-[46px] rounded-[14px] text-sm font-bold text-white bg-[var(--cf-red-dark)] hover:bg-[color-mix(in_srgb,var(--cf-red-dark)_85%,black)] disabled:opacity-50 transition-colors"
                >
                  {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
      </Modal>

      {/* Modal: atajos de cobro */}
      <Modal
        open={modalAtajosCobro}
        onClose={() => setModalAtajosCobro(false)}
        title="Opciones de cobro"
      >
        <div className="space-y-2">
          {hayMontoMora && (
            <button
              onClick={() => {
                setModalAtajosCobro(false)
                abrirPagoConMonto(montoEnMora)
              }}
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--cf-red-dark)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] hover:bg-[rgba(239,68,68,0.15)] transition-all"
            >
              Pagar mora
              {cuotasEnMora > 0 ? ` (${cuotasEnMora} cuota${cuotasEnMora === 1 ? '' : 's'})` : ''}
              {' · '}
              {formatMoney(montoEnMora)}
            </button>
          )}

          {hayMontoAlDia && montoParaPonerseAlDia !== montoEnMora && (
            <button
              onClick={() => {
                setModalAtajosCobro(false)
                abrirPagoConMonto(montoParaPonerseAlDia)
              }}
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--cf-gold)] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.3)] hover:bg-[rgba(245,197,24,0.15)] transition-all"
            >
              Ponerse al día · {formatMoney(montoParaPonerseAlDia)}
            </button>
          )}

          {/* Este atajo se queda SOLO en los modos con tabla, a propósito. Enseña
              una cifra exacta —«Pagar intereses · $12.400»— y esa cifra sólo
              existe cuando hay filas que la digan. En modo clásico el monto lo
              pacta el prestamista con cada cliente, así que el camino es abrir la
              hoja y escribirlo; inventar aquí un número sería sugerir un cobro
              que nadie acordó. El botón «Interés» de la hoja sí sale en todos. */}
          {['lineal', 'lineal_dinamico', 'solo_interes', 'saldo'].includes(prestamo?.modoInteres) && (() => {
            const interesesPend = prestamo?.cuotasAmortizacion
              ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
              ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
            return interesesPend > 0 ? (
              <button
                onClick={() => {
                  setModalAtajosCobro(false)
                  setModalIntereses(true)
                }}
                className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--cf-gold-dark)] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] hover:bg-[rgba(245,158,11,0.15)] transition-all"
              >
                Pagar intereses · {formatMoney(interesesPend)}
              </button>
            ) : null
          })()}

          <button
            onClick={() => {
              setModalAtajosCobro(false)
              abrirPagoNormal()
            }}
            className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--cf-green-dark)] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] hover:bg-[rgba(34,197,94,0.15)] transition-all"
          >
            Hacer abono extraordinario
          </button>
        </div>
      </Modal>

      {/* ── T05-01 · GESTIÓN DEL PRÉSTAMO ─────────────────────────────
          Aquí había un `<Modal>` con nueve botones en mosaico de dos columnas,
          cada uno teñido de un color distinto: morado renovar, azul el plazo,
          ámbar el próximo cobro, naranja el recargo, verde el descuento. El
          color no significaba nada —no hay forma de saber por qué renovar es
          morado— y con nueve mosaicos hay que leerlos todos para encontrar uno.

          Comparado con `main`, este bloque solo había cambiado en siete sitios,
          y los siete eran renombres de variable de color. El usuario lo dijo
          exacto: «está completamente igual a como estaba antes».

          Ahora son filas agrupadas por QUÉ CAMBIA cada una —lo que se cobra,
          cuándo se cobra, o el préstamo entero— y cada fila trae SU VALOR
          ACTUAL a la derecha. Antes había que abrir «Día de cobro» para saber
          cuál era el día de cobro, y salir sin tocar nada si ya estaba bien.

          El rojo se queda para una sola fila, la de mover a perdidos: no es un
          aviso genérico, es la única acción que reconoce una pérdida. */}
      <HojaInferior
        abierta={modalGestionPrestamo}
        onCerrar={() => setModalGestionPrestamo(false)}
        titulo="Gestionar el préstamo"
        subtitulo={detalleGestion}
      >
        <MenuGestion
          cabecera={false}
          grupos={gruposGestion}
          consejo={diasMora >= 15 && cuotaDiaria > 0
            ? `Con ${diasMora} días de atraso, lo que suele funcionar es bajar la cuota antes que el recargo. Un cliente que no puede pagar ${formatMoney(Math.round(cuotaDiaria))} tampoco va a pagar ${formatMoney(Math.round(cuotaDiaria * 2))}.`
            : null}
          onAccion={(a) => { setModalGestionPrestamo(false); a.hacer?.() }}
        />
      </HojaInferior>


      {/* Modal: confirmar mover a préstamos perdidos */}
      {/* ── T13-03 · MOVER A PERDIDOS ──────────────────────────────────────
          LA ÚNICA PANTALLA DEL SISTEMA DONDE EL DORADO NO VA EN LA ACCIÓN
          PRINCIPAL: aquí la acción destacada es «seguir cobrando» y «dar por
          perdido» queda en rojo de contorno. `PieGestion peligro` invierte los pesos.

          SE CONSERVA LA CASILLA de «registrar como dinero en riesgo», que la lámina
          no dibuja y que decide si el capital se resta de verdad o el préstamo solo
          se aparta. Y ahora su consecuencia SE VE: la fila de pérdida del bloque
          negro sale solo cuando está marcada, que es cuando de verdad hay pérdida.

          PENDIENTE-BACKEND · el motivo. La lámina dice que «alimenta la estadística
          de por qué se pierde plata», pero el endpoint solo acepta
          `{ esClavo, clavoPerdida }` y no hay columna donde guardarlo. No se dibuja:
          un selector que se mueve y no se guarda es el patrón que ya lleva ocho
          apariciones en este rediseño. */}
      {modalClavo && (() => {
        const datos = adaptarPerdidos(prestamo, null, null, null) ?? {}
        return (
          <HojaInferior
            abierta={modalClavo}
            onCerrar={() => setModalClavo(false)}
            titulo="Mover a perdidos"
            subtitulo={[
              cliente?.nombre,
              diasMora > 0 ? `${diasMora} ${diasMora === 1 ? 'día' : 'días'} sin pagar` : null,
            ].filter(Boolean).join(' · ') || null}
            accion={
              <PieGestion
                peligro
                textoCancelar="Seguir cobrando"
                onCancelar={() => setModalClavo(false)}
                textoAceptar="Dar por perdido"
                onAceptar={confirmarClavo}
                aceptando={clavoEnviando}
                error={clavoError}
              />
            }
          >
            <MoverAPerdidos
              {...datos}
              // La pérdida del mes solo si se marca: sin marcar, el préstamo se
              // aparta de los números pero el capital no se resta.
              perdidaEtiqueta={clavoPerdida ? datos.perdidaEtiqueta : null}
              perdidaValor={clavoPerdida ? datos.perdidaValor : null}
            />

            {/* La casilla, con su consecuencia escrita. Va DESPUÉS del bloque negro a
                propósito: primero se ve qué pasa, después se decide cuánto duele. */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, flex: 'none',
              padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            }}>
              <input
                type="checkbox"
                checked={clavoPerdida}
                onChange={(e) => setClavoPerdida(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, flex: 'none', accentColor: 'var(--cf-red)' }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
                  Registrarlo como dinero perdido
                </span>
                <span style={{ display: 'block', fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', marginTop: 3 }}>
                  Resta de tu capital lo que no recuperaste. Sin marcar, el préstamo
                  solo sale de tus números y el capital se queda como está.
                </span>
              </span>
            </label>
          </HojaInferior>
        )
      })()}

      {/* Modal: días sin cobro del préstamo */}
      <Modal
        open={modalDscPrestamo}
        onClose={() => setModalDscPrestamo(false)}
        title="Días sin cobro del préstamo"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalDscPrestamo(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/prestamos/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ diasSinCobro: dscDias }),
                  })
                  const data = await res.json()
                  if (!res.ok) { alert(data.error || 'Error'); return }
                  setPrestamo(prev => ({ ...prev, diasSinCobro: data.diasSinCobro ?? JSON.stringify(dscDias) }))
                  setModalDscPrestamo(false)
                } catch { alert('Error al guardar') }
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--cf-ink-2)] leading-snug">
            Este préstamo no generará mora en los días seleccionados. Vacío = hereda la configuración del cliente, ruta u organización.
          </p>
          <DiasSinCobroSelector value={dscDias} onChange={setDscDias} />
          {dscDias.length > 0 && (
            <button
              onClick={() => setDscDias([])}
              className="text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] transition-colors"
            >
              Limpiar (heredar de cliente/ruta/org)
            </button>
          )}
        </div>
      </Modal>

      {/* Modal de pago */}
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalPago}
        onClose={() => {
          setModalPago(false)
          setPresetPago(null)
        }}
        onSuccess={handlePagoExito}
        cliente={cliente}
        prestamo={prestamo}
        rutaNav={rutaNav}
        presetPago={presetPago}
        // ── LOS DOS ATAJOS NUEVOS ──
        // Sustituyen a «Mitad» y «Todo». «Mitad» era la mitad del SALDO —con
        // cuota $17.334 y saldo $553.658 escribía $276.829, que no se cobra en
        // ninguna visita— y «Todo» ponía el saldo entero, con TODO el interés
        // futuro dentro, cuando el sistema sabe perdonarlo.
        //
        // Los dos datos ya vivían en esta página; solo no llegaban al modal.
        montoAlDia={montoParaPonerseAlDia}
        cancelarHoy={hayCierre ? Math.round(cierre.restanteHoy ?? 0) : 0}
      />

      {/* ── RECARGO Y DESCUENTO, EN SU HOJA ──
          Abrian `RegistrarPago` con `tabInicial`, o sea el formulario ANTERIOR
          de 1.315 lineas: se pulsaba una fila del menu rediseñado y encima
          aparecia la pantalla vieja. El usuario lo describio exacto: «cuando se
          le dan las opciones como abonar a intereses o descuentos, recargos, se
          pone el otro modal».

          Las hojas ya estaban construidas y cotejadas en Gestion.jsx, sin
          montar. Lo unico que hacia falta era enchufarlas — el contrato con la
          API es el mismo POST /pagos con `tipo` y `nota`. */}
      <HojaInferior
        abierta={modalRecargo}
        onCerrar={() => { setModalRecargo(false); setAjusteMonto(''); setAjusteNota('') }}
        titulo="Recargo por mora"
        subtitulo={cliente?.nombre}
        accion={
          <PieGestion
            onCancelar={() => { setModalRecargo(false); setAjusteMonto(''); setAjusteNota('') }}
            onAceptar={() => aplicarAjuste('recargo')}
            textoAceptar={ajusteNum > 0 ? `Aplicar ${formatMoney(ajusteNum)}` : 'Aplicar'}
            deshabilitado={!(ajusteNum > 0) || !ajusteNota.trim() || ajustando}
            aceptando={ajustando}
            error={ajusteError}
          />
        }
      >
        <Recargo
          monto={verAjuste(ajusteMonto)}
          onMonto={(v) => setAjusteMonto(leerAjuste(v))}
          atajos={atajosAjuste}
          atajoActivo={atajosAjuste.find((a) => a.monto === ajusteNum)?.id ?? null}
          onAtajo={(a) => fijarAjuste(String(a.monto))}
          motivo={ajusteNota}
          onMotivo={setAjusteNota}
          {...(adaptarRecargo({ saldoPendiente, cuotaDiaria, ...(prestamo ?? {}) }, ajusteNum) ?? {})}
        />
      </HojaInferior>

      <HojaInferior
        abierta={modalDescuento}
        onCerrar={() => { setModalDescuento(false); setAjusteMonto(''); setAjusteNota('') }}
        titulo="Descuento"
        subtitulo={cliente?.nombre}
        accion={
          <PieGestion
            onCancelar={() => { setModalDescuento(false); setAjusteMonto(''); setAjusteNota('') }}
            onAceptar={() => aplicarAjuste('descuento')}
            textoAceptar={ajusteNum > 0 ? `Perdonar ${formatMoney(ajusteNum)}` : 'Perdonar'}
            deshabilitado={!(ajusteNum > 0) || !ajusteNota.trim() || ajustando}
            aceptando={ajustando}
            error={ajusteError}
          />
        }
      >
        <Descuento
          monto={verAjuste(ajusteMonto)}
          onMonto={(v) => setAjusteMonto(leerAjuste(v))}
          atajos={atajosAjuste}
          atajoActivo={atajosAjuste.find((a) => a.monto === ajusteNum)?.id ?? null}
          onAtajo={(a) => fijarAjuste(String(a.monto))}
          motivo={ajusteNota}
          onMotivo={setAjusteNota}
          {...(adaptarDescuento({ saldoPendiente, cuotaDiaria, ...(prestamo ?? {}) }, ajusteNum) ?? {})}
        />
      </HojaInferior>

      {/* -- PAGAR INTERESES, EN SU HOJA --
          Era el ULTIMO camino que saltaba al formulario de 1.315 lineas: se
          pulsaba «Pagar intereses · $X» en el menu rediseñado y encima aparecia
          la pantalla anterior entera, con sus siete pestañas, para escribir un
          numero que la propia pantalla ya sabia.

          Aqui viene con el monto puesto y lo unico que queda es confirmar. El
          contrato con la API es el mismo: POST /pagos con `tipo: 'intereses'`. */}
      <HojaInferior
        abierta={modalIntereses}
        onCerrar={() => { setModalIntereses(false); setInteresError('') }}
        titulo="Pagar los intereses"
        subtitulo={cliente?.nombre}
        accion={
          <PieGestion
            onCancelar={() => { setModalIntereses(false); setInteresError('') }}
            onAceptar={pagarIntereses}
            textoAceptar={interesMonto > 0 ? `Cobrar ${formatMoney(interesMonto)}` : 'Cobrar'}
            deshabilitado={!(interesMonto > 0) || pagandoInteres}
            aceptando={pagandoInteres}
            error={interesError}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '2px 0 6px' }}>
          <div style={{
            background: '#15161A', borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 5, flex: 'none',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: '#A3A8B2',
            }}>Interés vencido y sin pagar</span>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', color: '#F5B824',
            }}>{formatMoney(interesMonto)}</span>
          </div>

          {/* QUE HACE Y QUE NO. Pagar interes SI baja el saldo —es menos plata
              por pagar en total— pero NO baja el capital, que es sobre lo que
              corre el interes del mes siguiente. Sin decirlo, se cobra tres
              meses seguidos y el capital sigue clavado, y parece un fallo. */}
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)', margin: 0 }}>
            Cubre el interés que ya corrió. <strong>El capital no baja</strong>
            {prestamo?.capitalRestante > 0
              ? `: sigue en ${formatMoney(Math.round(prestamo.capitalRestante))}, y el mes que viene vuelve a generar interés.`
              : ' — el mes que viene vuelve a generar interés.'}
          </p>

          <MetodoPagoSelector
            metodosPago={metodosPagoOrg}
            value={interesMetodo}
            onSelect={(v) => setInteresMetodo(v)}
          />
        </div>
      </HojaInferior>

      {/* Modal: Liquidación anticipada (cierre por pago total antes del plazo) */}
      {/* ── T19-04 · CERRAR ANTICIPADO ─────────────────────────────────────
          El cliente paga todo hoy. Solo se cobra capital más el interés de lo que ya
          corrió; el interés futuro se perdona.

          LAS TRES OPCIONES SON LAS QUE EL MODELO CALCULA, no las de la lámina. La
          lámina dice «solo el capital que debe», y esa cifra lleva interés devengado
          dentro: ponerle ese nombre sería mentir sobre plata en la pantalla donde se
          cierra un préstamo. Se enseñan prorrateado por días, mes completo y todo lo
          pactado, de la que más perdona a la que menos, y cada una dice cuánto
          perdona. Ver la nota de `adaptarCerrar`.

          SE CONSERVA el motivo obligatorio y el monto editable, que es lo que
          permite «un punto medio» de la lámina sin inventar una cuarta modalidad. */}
      {modalLiquidacion && (() => {
        const comp = adaptarCerrar(liqData)
        const resumen = resumenCerrar(liqData, liqModalidad) ?? {}
        // Cuando el dueño teclea un monto propio, ninguna de las tres queda marcada:
        // marcar una que no coincide con la cifra sería decirle que eligió algo que no
        // eligió.
        const coincide = comp?.opciones.find((o) => o.monto === Math.round(liqMonto || 0))
        return (
          <HojaInferior
            abierta={modalLiquidacion}
            onCerrar={() => setModalLiquidacion(false)}
            titulo="Quiere pagar todo hoy"
            subtitulo={[
              cliente?.nombre,
              cuotasPendientes > 0 ? `le faltan ${cuotasPendientes} cuotas` : null,
            ].filter(Boolean).join(' · ') || null}
            accion={
              <PieGestion
                onCancelar={() => setModalLiquidacion(false)}
                onAceptar={confirmarLiquidacion}
                textoAceptar={liqMonto > 0 ? `Cerrar por ${formatMoney(Math.round(liqMonto))}` : 'Cerrar'}
                aceptando={liqEnviando}
                deshabilitado={liqMonto < 0 || !liqNota.trim()}
                error={liqError || (!liqNota.trim() && liqMonto > 0
                  ? 'Escribe el motivo: queda en el historial.' : null)}
              />
            }
          >
            {liqCargando && (
              <p style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>Calculando…</p>
            )}

            {/* El aviso de cálculo APROXIMADO. Va arriba y en ámbar: cerrar por una
                cifra aproximada sin avisar es cómo se generan las discusiones que
                acaban en el préstamo reabierto. */}
            {comp?.aproximado && (
              <div style={{
                flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
                padding: '13px 16px', borderRadius: 14,
                background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
              }}>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-gold-text-2)' }}>
                  Este préstamo es modo <strong>{comp.modo}</strong>: el cálculo es
                  aproximado. Ajusta el monto a lo que pactaste.
                </span>
              </div>
            )}

            {comp && (
              <CerrarAnticipado
                opciones={comp.opciones}
                opcion={coincide?.id ?? null}
                onOpcion={(o) => {
                  if (o.monto == null) return
                  // «todo lo pactado» no es una modalidad del cálculo: es el saldo tal
                  // cual. Se guarda la modalidad más cercana para que el servidor no
                  // reciba un valor que no conoce.
                  if (o.id !== 'todo') setLiqModalidad(o.id)
                  setLiqTecleado(null); setLiqMonto(o.monto)
                }}
                {...resumen}
              />
            )}

            {/* El monto a mano, que es «un punto medio» de la lámina. Y el motivo,
                obligatorio, que ya lo era. */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>O pon el monto que pactaste</span>
              <input
                type="text" inputMode="decimal"
                value={liqTecleado != null ? liqTecleado : (liqMonto ? montoParaMostrarConModo(String(Math.round(liqMonto)), modoAbreviado, undefined) : '')}
                onChange={(e) => {
                  const crudo = montoCrudo(e.target.value)
                  setLiqTecleado(crudo)
                  setLiqMonto(Number(montoCrudoConModo(crudo, modoAbreviado)) || 0)
                }}
                style={{
                  height: 52, padding: '0 16px', borderRadius: 14, width: '100%',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 16, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>Motivo (queda en el historial)</span>
              <input
                value={liqNota}
                onChange={(e) => setLiqNota(e.target.value)}
                placeholder="Pago anticipado pactado"
                style={{
                  height: 52, padding: '0 16px', borderRadius: 14, width: '100%',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 16, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
            </label>
          </HojaInferior>
        )
      })()}

      {/* Modal de renovación */}
      <RenovarPrestamo
        prestamoId={id}
        saldoPendiente={saldoPendiente}
        capitalRestante={capitalRestante}
        prestamoAnterior={{ tasaInteres, diasPlazo, frecuencia, modoInteres, cuotaDiaria, montoPrestado, interesAdelantado }}
        clienteNombre={cliente?.nombre}
        montoMaximoPrestamo={cliente?.montoMaximoPrestamo}
        // Ya estaban cargadas para la hoja de pago; sin pasarlas, la renovación
        // no puede decir por dónde entregó y todo se cuenta como efectivo.
        metodosPago={metodosPagoOrg}
        open={modalRenovar}
        onClose={() => setModalRenovar(false)}
      />

      {/* Modal de modificar plazo */}
      <ModificarPlazo
        prestamoId={id}
        prestamo={prestamo}
        open={modalPlazo}
        onClose={() => setModalPlazo(false)}
        onSuccess={fetchPrestamo}
      />

      {/* Modal de dia de cobro */}
      <EditarDiaCobro
        prestamoId={id}
        prestamo={prestamo}
        open={modalDiaCobro}
        onClose={() => setModalDiaCobro(false)}
        onSuccess={fetchPrestamo}
      />

      <EditarProximoCobro
        prestamoId={id}
        prestamo={prestamo}
        open={modalProximoCobro}
        onClose={() => setModalProximoCobro(false)}
        onSuccess={fetchPrestamo}
      />

      {/* Modal editar préstamo */}
      <EditarPrestamo
        prestamo={prestamo}
        modoInicial={modoPedido || undefined}
        open={modalEditar || Boolean(modoPedido)}
        onClose={() => {
          setModalEditar(false)
          // Y se limpia el parametro: si se queda, cerrar el modal y volver atras
          // lo vuelve a abrir, y el dueño no puede salir de la pantalla.
          if (modoPedido) router.replace(`/prestamos/${prestamo?.id}`)
        }}
        onSuccess={() => {
          setModalEditar(false)
          if (modoPedido) router.replace(`/prestamos/${prestamo?.id}`)
          fetchPrestamo()
        }}
        socios={sociosLista}
      />

      {/* Modal selector de plantillas WhatsApp (boton circular del header) */}
      <HojaWhatsApp
        open={modalWA}
        onClose={() => { setModalWA(false); setWaSugerida(null); setWaPago(null) }}
        cliente={cliente}
        prestamo={prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={session?.user?.organizationId}
        camposRecibo={camposRecibo}
        preselectedTemplateId={waSugerida}
        pago={waPago}
      />

      {/* Modal: aplicar interes moratorio como recargo */}
      <Modal
        open={modalMoratorio}
        onClose={() => setModalMoratorio(false)}
        title="Aplicar interés moratorio"
      >
        <div className="space-y-4">
          <div className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.2)] rounded-[12px] p-3">
            <p className="text-xs text-[var(--cf-ink-3)]">
              Calculado: {formatMoney(moratorio?.montoMoratorio ?? 0)} ({moratorio?.diasMoraEfectivos ?? 0} dias sobre {formatMoney(moratorio?.montoBase ?? 0)})
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--cf-ink-3)]">Monto a aplicar</label>
            <input
              type="number"
              min="0"
              value={moratorioMonto}
              onChange={(e) => setMoratorioMonto(Number(e.target.value) || 0)}
              className="w-full h-11 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] text-lg font-semibold font-mono-display text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-all"
            />
            <p className="text-[10px] text-[var(--cf-ink-3)]">
              Puedes editar el monto. El sistema sugiere {formatMoney(moratorio?.montoMoratorio ?? 0)}.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--cf-ink-3)]">Nota (opcional)</label>
            <input
              type="text"
              value={moratorioNota}
              onChange={(e) => setMoratorioNota(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-surface)] text-sm text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-all"
            />
          </div>
          {moratorioError && (
            <p className="text-xs text-[var(--cf-red-dark)]">{moratorioError}</p>
          )}
          <button
            disabled={moratorioEnviando || moratorioMonto <= 0}
            onClick={async () => {
              setMoratorioEnviando(true)
              setMoratorioError('')
              try {
                const nota = moratorioNota || `Interés moratorio: ${moratorio?.diasMoraEfectivos ?? 0} días`
                const notaFull = moratorioMonto !== (moratorio?.montoMoratorio ?? 0)
                  ? `${nota} (calculado: ${formatMoney(moratorio?.montoMoratorio ?? 0)}, aplicado: ${formatMoney(moratorioMonto)})`
                  : nota
                const res = await fetch(`/api/prestamos/${id}/pagos`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ monto: moratorioMonto, tipo: 'recargo', nota: notaFull }),
                })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error al aplicar recargo')
                }
                setModalMoratorio(false)
                await fetchPrestamo()
              } catch (e) {
                setMoratorioError(e.message)
              } finally {
                setMoratorioEnviando(false)
              }
            }}
            className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--cf-gold-ink)] bg-[var(--cf-gold-dark)] hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {moratorioEnviando ? 'Aplicando...' : `Aplicar ${formatMoney(moratorioMonto)} como recargo`}
          </button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmAnularPago}
        title="Anular pago"
        message={confirmAnularPago ? `¿Anular pago de ${formatMoney(confirmAnularPago.monto)}?` : ''}
        confirmLabel="Anular"
        confirmColor="red"
        onConfirm={async () => {
          const { pagoId } = confirmAnularPago
          setConfirmAnularPago(null)
          setAnulando(pagoId)
          try {
            const res = await fetch(`/api/pagos/${pagoId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            await fetchPrestamo()
          } catch {
            setError('No se pudo anular el pago.')
          } finally {
            setAnulando(null)
          }
        }}
        onCancel={() => setConfirmAnularPago(null)}
      />
    </div>
  )
}

function BotonAbrirRecibo({ onClick, label = 'Imprimir', small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center justify-center gap-2 rounded-[12px] font-medium transition-all cursor-pointer w-full',
        'bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] hover:border-[var(--cf-gold)]',
        small ? 'px-3 h-8 text-xs' : 'px-4 h-10 text-sm',
      ].join(' ')}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {label}
    </button>
  )
}

function ModalCamposRecibo({ tipo, pago, cliente, prestamo, orgNombre, ocultarSaldo, campos, camposOrg, usandoOrg, guardando, onSave, onClose, esOwner }) {
  const [camposLocal, setCamposLocal] = useState(campos)
  const [dirty, setDirty] = useState(false)

  const guardarYCerrar = () => {
    if (dirty) onSave(camposLocal)
  }

  const handleChange = (next) => {
    setCamposLocal(next)
    setDirty(true)
    onSave(next)
  }

  const tituloModal = tipo === 'historial' ? 'Imprimir estado de cuenta' : 'Imprimir comprobante'

  return (
    <Modal open onClose={() => { guardarYCerrar(); onClose() }} title={tituloModal}>
      <div className="space-y-4">
        {esOwner && (
          <ChecklistCamposRecibo campos={camposLocal} onChange={handleChange} />
        )}

        <div className="pt-2 border-t border-[var(--cf-border)] flex gap-2">
          {tipo !== 'historial' && (
            <BotonCompartirRecibo
              cliente={cliente}
              prestamo={prestamo}
              pago={pago}
              orgNombre={orgNombre}
              camposRecibo={camposLocal}
              label="Compartir"
            />
          )}
          <BotonImprimirRecibo
            tipo={tipo === 'historial' ? 'historial' : 'recibo'}
            label={tipo === 'historial' ? 'Imprimir estado de cuenta' : 'Imprimir comprobante'}
            cliente={cliente}
            prestamo={prestamo}
            pago={pago}
            orgNombre={orgNombre}
            camposRecibo={camposLocal}
          />
        </div>
      </div>
    </Modal>
  )
}
