'use client'
// app/(dashboard)/prestamos/[id]/page.jsx - Detalle del préstamo (página central del sistema)

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter }                  from 'next/navigation'
import Link                           from 'next/link'
import { useAuth }                    from '@/hooks/useAuth'
import { useOffline }                 from '@/components/providers/OfflineProvider'
import { obtenerPrestamoOffline, resolverTempId }     from '@/lib/offline'
import { Badge }                      from '@/components/ui/Badge'
import { Button }                     from '@/components/ui/Button'
import { Card }                       from '@/components/ui/Card'
import { Modal }                      from '@/components/ui/Modal'
import { SkeletonPrestamoDetalle }     from '@/components/ui/Skeleton'
import MonedaCF                       from '@/components/ui/MonedaCF'
import RegistrarPago                  from '@/components/prestamos/RegistrarPago'
// AjusteSaldo absorbido por RegistrarPago via prop tabInicial.
import RenovarPrestamo                from '@/components/prestamos/RenovarPrestamo'
import ModificarPlazo                 from '@/components/prestamos/ModificarPlazo'
import EditarDiaCobro                 from '@/components/prestamos/EditarDiaCobro'
import EditarProximoCobro             from '@/components/prestamos/EditarProximoCobro'
import EditarPrestamo                 from '@/components/prestamos/EditarPrestamo'
import BotonWhatsApp                  from '@/components/ui/BotonWhatsApp'
import BotonCompartir                 from '@/components/ui/BotonCompartir'
import BotonImprimirRecibo            from '@/components/ui/BotonImprimirRecibo'
import OfflineBadge                   from '@/components/offline/OfflineBadge'
import ModalWhatsAppTemplates         from '@/components/ui/ModalWhatsAppTemplates'
import FirmaDigital                   from '@/components/prestamos/FirmaDigital'
import {
  PrestamoHeroCard,
  HeaderClienteContexto,
  BotonPagoPersonalidad,
  StatsContextuales,
  generarStatsContextuales,
  ChipsAccionesSecundarias,
  GrillaDatosSecciones,
  TimelinePrestamo,
  PagoMiniCard,
  ComparativoPrestamosCliente,
  moodColorFromPrestamo,
} from '@/components/prestamos/PrestamoDetalleViews'
import { formatFechaCobroRelativa } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import AiTipBanner from '@/components/ui/AiTipBanner'
import { generarTipPrestamo } from '@/lib/tips/prestamoTips'
import DiasSinCobroSelector from '@/components/ui/DiasSinCobroSelector'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import TablaAmortizacion from '@/components/prestamos/TablaAmortizacion'
import { ChecklistCamposRecibo, getDefaultCampos } from '@/components/recibos/CamposReciboEditor'

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

function GestionBtn({ label, desc, color, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2.5 p-2.5 rounded-[12px] text-left transition-all active:scale-[0.97]"
      style={{ background: `rgba(${color},0.06)`, border: `1px solid rgba(${color},0.2)` }}
    >
      <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `rgba(${color},0.12)`, color: `rgb(${color})` }}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: `rgb(${color})` }}>{label}</p>
        <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
      </div>
    </button>
  )
}

export default function PrestamoDetallePage({ params }) {
  const { id }             = use(params)
  const router             = useRouter()
  const { session, esOwner, esCobrador, puedeGestionarPrestamos, puedeAplicarDescuentos, orgNombre, ocultarSaldoWA, camposRecibo: camposReciboOrg } = useAuth()

  const { lastSyncedAt }   = useOffline()

  const [prestamo,     setPrestamo]     = useState(null)
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
  const [modalRecargo,  setModalRecargo]  = useState(false)
  const [modalDescuento, setModalDescuento] = useState(false)
  const [modalIntereses, setModalIntereses] = useState(false)
  const [modalRenovar,  setModalRenovar]  = useState(false)
  const [modalPlazo,    setModalPlazo]    = useState(false)
  const [modalDiaCobro, setModalDiaCobro] = useState(false)
  const [modalProximoCobro, setModalProximoCobro] = useState(false)
  const [modalEditar,   setModalEditar]   = useState(false)
  const [sociosLista,   setSociosLista]   = useState([])
  const [modalWA, setModalWA] = useState(false)
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
  const [liqData, setLiqData] = useState(null)        // calculo del backend
  const [liqModalidad, setLiqModalidad] = useState('mesCompleto') // mesCompleto | proporcional
  const [liqMonto, setLiqMonto] = useState(0)          // monto editable del cierre
  const [liqNota, setLiqNota] = useState('')
  const [liqCargando, setLiqCargando] = useState(false)
  const [liqEnviando, setLiqEnviando] = useState(false)
  const [liqError, setLiqError] = useState('')
  const [statsCliente, setStatsCliente] = useState(null) // { totalPrestamos, completados, numeroEsteDe }
  const [historialOpen, setHistorialOpen] = useState(true)
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
      setLiqMonto(data.mesCompleto?.restanteHoy ?? 0)
    } catch {
      setLiqError('Error de red')
    } finally {
      setLiqCargando(false)
    }
  }

  function seleccionarModalidad(mod) {
    setLiqModalidad(mod)
    if (liqData?.[mod]) setLiqMonto(liqData[mod].restanteHoy)
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
  if (loading) {
    return <SkeletonPrestamoDetalle />
  }

  if (error || !prestamo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-2xl mx-auto">
        <div className="mb-4"><MonedaCF pose="busca" size={100} /></div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">No pudimos cargar el préstamo</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Revisa tu conexión e intenta de nuevo</p>
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
  const statsContexto = generarStatsContextuales({
    prestamo,
    totalPagado: totalPagadoReal,
    cuotasPagadas,
    fechaInicio,
    fechaFin,
    diasMora,
    porcentajePagado,
    prestamoNumeroCliente: statsCliente?.numeroEsteDe,
    totalPrestamosCliente: statsCliente?.totalPrestamos,
  })

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
  const cobroVencido = estaActivo && proximoCobro && new Date(proximoCobro) < new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }).split(',')[0])
  const cobroInfo = estaActivo && proximoCobro
    ? {
        label: cobroVencido ? 'Debió cobrarse' : 'Próximo cobro',
        value: formatFechaCobroRelativa(proximoCobro),
        color: cobroVencido ? 'var(--color-danger)' : 'var(--color-accent)',
      }
    : null

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4 pb-4">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Préstamos
      </button>

      {/* ── BADGE TARJETA CLAVO ──────────────────────────────────── */}
      {esClavo && (
        <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[12px] px-3 py-2 text-xs font-semibold text-[var(--color-danger)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-danger)]" />
          Préstamo perdido — apartado de tus números normales
        </div>
      )}

      {/* ── RENOVADO DE (continuidad) ────────────────────────────── */}
      {renovadoDeId && (
        <Link
          href={`/prestamos/${renovadoDeId}`}
          className="flex items-center gap-2 bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.25)] rounded-[12px] px-3 py-2 text-xs"
          style={{ color: 'var(--color-purple)' }}
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
          <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-success) 20%, transparent)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[var(--color-success)] font-bold">Préstamo completado</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">El cliente terminó de pagar</p>
        </div>
      )}

      {/* ── ALERTA MORA ──────────────────────────────────────────── */}
      {enMora && estaActivo && !completado && (
        <div className="flex items-center gap-3 bg-[rgba(239,68,68,0.12)] border border-[rgba(239,68,68,0.3)] rounded-[16px] px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-[var(--color-danger)] animate-pulse shrink-0" />
          <p className="text-sm text-[var(--color-danger)] font-semibold">
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
            <svg className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-warning)]">
                Interés moratorio: {formatMoney(moratorio.montoMoratorio)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
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
            className="w-full h-10 rounded-[12px] text-sm font-semibold text-[var(--color-warning)] bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.18)] transition-all"
          >
            Aplicar como recargo
          </button>
        </div>
      )}

      {/* ── ANIMACIÓN ÉXITO PAGO ────────────────────────────────── */}
      {exito && !completado && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.3)] rounded-[16px] px-4 py-3">
            <svg className="w-5 h-5 text-[var(--color-success)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[var(--color-success)] font-medium">Pago registrado exitosamente</p>
          </div>
          {ultimoPago && cliente?.telefono && (
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
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
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
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
            <BotonWhatsApp tipo="pago" cliente={cliente} prestamo={prestamo} pago={ultimoPago} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
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
            className="w-full py-3.5 rounded-[12px] bg-[var(--color-success)] text-[var(--color-text-primary)] text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Ruta finalizada · Volver a {rutaNav.rutaNombre}
          </button>
        )

        return (
          <button
            onClick={navigateNext}
            className="w-full py-3.5 rounded-[12px] text-sm font-semibold active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), #f0b800)', color: '#0a0a0a' }}
          >
            Siguiente → {nextCliente.nombre}
          </button>
        )
      })()}

      {/* ── 2. HEADER CLIENTE CON CONTEXTO ─────────────────────────── */}
      <HeaderClienteContexto
        cliente={cliente}
        prestamo={prestamo}
        statsCliente={statsCliente && statsCliente.totalPrestamos > 1
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
            style={{ background: 'rgba(34, 197, 94, 0.25)', color: 'var(--color-success)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          {/* Texto en 2 lineas */}
          <span className="flex-1 flex flex-col items-start min-w-0 text-left leading-tight">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80" style={{ color: 'var(--color-success)' }}>
              Pago {frecuenciaLabel} registrado
            </span>
            <span className="text-[18px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-success)' }}>
              {formatMoney(cuotaDiaria)}
            </span>
          </span>
        </div>
      )}

      {/* ── 5. ACCIONES SECUNDARIAS COMO CHIPS ─────────────────── */}
      {(mostrarAtajosCobro || mostrarGestionPrestamo) && (
        <ChipsAccionesSecundarias
          acciones={[
            ...(mostrarAtajosCobro ? [{
              label: 'Cobros',
              sublabel: hayMontoMora ? `Mora ${formatMoney(montoEnMora)}` : 'Abonos y atajos',
              color: hayMontoMora ? 'var(--color-danger)' : 'var(--color-accent)',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
              onClick: () => setModalAtajosCobro(true),
            }] : []),
            ...(mostrarGestionPrestamo ? [{
              label: 'Gestión',
              sublabel: 'Renovar, plazo, ajustes',
              color: 'var(--color-purple)',
              icon: <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.425-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /></svg>,
              onClick: () => setModalGestionPrestamo(true),
            }] : []),
          ]}
        />
      )}

      {/* ── 1. HERO CARD: SALDO PENDIENTE EN GRANDE + DONUT + SPARKLINE ── */}
      <PrestamoHeroCard
        prestamo={prestamo}
        narrativa={narrativaSaldo}
        sparklineData={esOwner && sparkline14d.some(v => v > 0) ? sparkline14d : null}
      />

      {/* Banner aprobación — solo owner y préstamos pendientes */}
      {esOwner && estado === 'pendiente_aprobacion' && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Pendiente de tu aprobacion
              </p>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
            <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Este prestamo esta pendiente de aprobacion por el administrador.
            </p>
          </div>
        </Card>
      )}

      {/* Tip IA contextual */}
      <AiTipBanner tip={generarTipPrestamo(prestamo, pagos)} pageKey={`prestamo-${prestamo.id}`} />

      {/* ── 4. STATS INTELIGENTES CONTEXTUALES (chips) — solo owner ── */}
      {esOwner && statsContexto.length > 0 && <StatsContextuales stats={statsContexto} />}

      {/* ── 9. COMPARATIVO PRÉSTAMOS DEL CLIENTE — solo owner ──────── */}
      {esOwner && (
        <ComparativoPrestamosCliente
          totalPrestamosCliente={statsCliente?.totalPrestamos}
          prestamoNumeroCliente={statsCliente?.numeroEsteDe}
          prestamosCompletadosCliente={statsCliente?.completados}
        />
      )}

      {/* ── 7. LÍNEA DE TIEMPO DEL PRÉSTAMO — solo owner ─────────── */}
      {esOwner && estaActivo && fechaInicio && fechaFin && (
        <TimelinePrestamo
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          porcentajePagado={porcentajePagado}
          color={moodColorFromPrestamo(prestamo)}
        />
      )}

      {/* ── 6. GRILLA DE DATOS EN 3 SECCIONES ─────────────────────── */}
      <GrillaDatosSecciones
        secciones={[
          {
            titulo: 'Crédito',
            color: 'var(--color-accent)',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            items: [
              ...(nombreProducto ? [{ label: 'Producto', value: nombreProducto }] : []),
              { label: nombreProducto ? 'Valor artículo' : 'Prestado', value: formatMoney(montoPrestado), hero: true },
              { label: 'Total a pagar', value: formatMoney(totalAPagar), hero: true },
              ...(nombreProducto ? [] : [{ label: 'Tasa', value: `${tasaInteres}%` }]),
              { label: 'Plazo', value: `${diasPlazo} días` },
              { label: 'Tipo de interés', value: (({
                fijo: 'Cuota fija (clásico)',
                unico: 'Interés único',
                saldo: 'Sobre saldo',
                lineal: 'Decreciente (lineal)',
                lineal_dinamico: 'Decreciente dinámico',
                solo_interes: 'Solo interés (globo)',
                manual: 'Cuota manual',
                proporcional: 'Proporcional',
              })[modoInteres] || modoInteres || 'Clásico') + (interesAdelantado ? ' (adelantado)' : '') },
              ...(prestamo.socio ? [{ label: 'Socio', value: prestamo.socio.nombre }] : []),
            ],
          },
          {
            titulo: 'Pagos',
            color: 'var(--color-success)',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            items: [
              { label: `Cuota ${frecuenciaLabel}`, value: formatMoney(cuotaDiaria), hero: true,
                ...(modoInteres === 'solo_interes' && cuotasAmortizacion.length > 0
                  ? { sub: `Última cuota: ${formatMoney(cuotasAmortizacion[cuotasAmortizacion.length - 1]?.cuotaTotal || 0)}` }
                  : {}) },
              { label: 'Cuotas pendientes', value: `${cuotasPendientes}`, hero: true },
              ...(cobroInfo ? [{ label: cobroInfo.label, value: cobroInfo.value, color: cobroInfo.color }] : []),
              {
                label: diasMora > 0 ? 'Días en mora' : 'Estado',
                value: diasMora > 0 ? `${diasMora} días${cuotasEnMora > 0 ? ` · ${cuotasEnMora}c` : ''}` : 'Al día',
                color: diasMora > 0 ? 'var(--color-danger)' : 'var(--color-success)',
              },
            ],
          },
          {
            titulo: 'Fechas',
            color: 'var(--color-info)',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            items: [
              { label: 'Inicio', value: fmtFecha(fechaInicio) },
              { label: 'Vencimiento', value: fmtFecha(fechaFin) },
              ...(creadoPor?.nombre ? [{ label: 'Creado por', value: creadoPor.nombre }] : []),
            ],
          },
          ...(seguro ? [{
            titulo: 'Seguro',
            color: '#6366f1',
            icon: (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            ),
            items: [
              { label: 'Cobro de seguro', value: montoSeguro ? formatMoney(montoSeguro) : 'Si', color: '#6366f1' },
            ],
          }] : []),
        ]}
      />

      {/* ── TABLA DE AMORTIZACION (lineal / globo) ──────────────── */}
      {['lineal', 'lineal_dinamico', 'solo_interes'].includes(modoInteres) && cuotasAmortizacion.length > 0 && (
        <Card>
          <TablaAmortizacion
            tabla={cuotasAmortizacion}
            frecuencia={frecuencia}
            modoInteres={modoInteres}
            mostrarPagado
            onPagarCuota={estaActivo && !completado ? (fila) => {
              const faltante = Math.max(0, fila.cuotaTotal - (fila.pagado || 0))
              if (faltante <= 0) return
              setPresetPago({ monto: Math.round(faltante), tipo: 'completo' })
              setModalPago(true)
            } : undefined}
          />
        </Card>
      )}

      {/* ── BOTONES WHATSAPP ─────────────────────────────────────── */}
      {cliente?.telefono && estaActivo && enMora && !completado && (
        <BotonWhatsApp tipo="mora" cliente={cliente} prestamo={prestamo} orgNombre={orgNombre} ocultarSaldo={ocultarSaldoWA} camposRecibo={camposRecibo} organizationId={session?.user?.organizationId} />
      )}
      {cliente?.telefono && estaActivo && !enMora && !ultimoPago && (
        <button
          type="button"
          onClick={() => setModalWA(true)}
          className="flex items-center justify-center gap-2 px-4 h-10 rounded-[12px] text-sm font-medium transition-all duration-150 cursor-pointer w-full bg-[#25d366] hover:bg-[#1da855] text-white"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          Enviar resumen por WhatsApp
        </button>
      )}

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

      {/* ── HISTORIAL DE PAGOS (colapsado por defecto) ──────────── */}
      <Card>
        <button
          type="button"
          onClick={() => setHistorialOpen(v => !v)}
          className="w-full flex items-center justify-between gap-2 focus-visible:outline-none"
        >
          <p className="text-[11px] font-extrabold text-[var(--color-text-muted)] uppercase tracking-[.07em]">
            Historial de pagos ({pagos.length})
          </p>
          <svg
            className="w-4 h-4 shrink-0 transition-transform duration-200"
            style={{ color: 'var(--color-text-muted)', transform: historialOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {historialOpen && <div className="mt-3">
          <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {filtroFecha ? `${pagos.filter(p => {
              const d = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
              return d === filtroFecha
            }).length} de ${pagos.length} en esta fecha` : `${pagos.length} pago${pagos.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-1">
            <label
              className="relative h-8 flex items-center gap-1.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 cursor-pointer hover:border-[var(--color-info)] transition-colors"
              title="Filtrar por fecha"
            >
              <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">
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
                className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1"
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
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
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
                  <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                    {!esAjuste && (
                      <button
                        onClick={() => setComprobante(comprobanteAbierto ? null : pago.id)}
                        className={[
                          'flex items-center gap-1 px-2 h-7 rounded-[8px] text-[10px] font-medium transition-colors',
                          comprobanteAbierto
                            ? 'text-[var(--color-accent)] bg-[rgba(245,197,24,0.1)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.08)]',
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
                      <span className="text-[10px] px-2 py-1 rounded-[6px] font-mono-display" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-purple)' }}>
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
                            ? 'text-[var(--color-info)] bg-[rgba(59,130,246,0.1)]'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-info)] hover:bg-[rgba(59,130,246,0.08)]',
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
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] transition-colors disabled:opacity-50"
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
                        onClick={() => setModalRecibo({ tipo: 'pago', pago: { montoPagado: pago.montoPagado, fechaPago: pago.fechaPago } })}
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
                          className="h-9 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)] transition-colors"
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
                          className="h-9 px-3 rounded-[12px] text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-info)] hover:bg-[#2563eb] transition-colors active:scale-[0.97]"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditandoFecha(null)}
                          className="h-9 px-2 rounded-[12px] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
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

      {/* ── CANCELAR PRÉSTAMO (solo owner, solo activo) ──────────── */}
      {estaActivo && session?.user?.rol === 'owner' && !completado && (
        <div className="pt-2">
          {!confirmCancel ? (
            <button
              onClick={() => {
                setModoReversionCapital(hayCobrosRegistrados ? 'devolver_restante' : 'devolver_todo')
                setConfirmCancel(true)
              }}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.08)] border border-[var(--color-border)] hover:border-[rgba(239,68,68,0.3)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Cancelar préstamo
            </button>
          ) : (
            <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-[20px] cf-card-shadow p-4 space-y-3">
              <p className="text-sm text-[var(--color-danger)] font-semibold">¿Cancelar este préstamo?</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Se marcará como cancelado. El saldo pendiente de {formatMoney(saldoPendiente)} quedará sin cobrar.
              </p>

              {hayCobrosRegistrados && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--color-text-secondary)]">El préstamo ya tiene cobros registrados ({formatMoney(totalPagadoReal)}). Elige cómo reversar en caja:</p>

                  <label className="flex items-start gap-2.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_todo"
                      checked={modoReversionCapital === 'devolver_todo'}
                      onChange={() => setModoReversionCapital('devolver_todo')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">Devolver todo el préstamo a caja (+{formatMoney(montoPrestadoRedondeado)})</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">Conserva los cobros ya registrados y regresa el monto completo prestado.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name="modo-reversion-capital"
                      value="devolver_restante"
                      checked={modoReversionCapital === 'devolver_restante'}
                      onChange={() => setModoReversionCapital('devolver_restante')}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">Devolver solo lo pendiente (+{formatMoney(saldoFinancieroPendiente)})</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">Calculado como prestado menos cobrado real.</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 h-10 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-surface)] transition-colors"
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
                  className="flex-1 h-10 rounded-[12px] text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black)] disabled:opacity-50 transition-colors"
                >
                  {cancelando ? 'Cancelando…' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-danger)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.25)] hover:bg-[rgba(239,68,68,0.15)] transition-all"
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
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-accent)] bg-[rgba(245,197,24,0.08)] border border-[rgba(245,197,24,0.3)] hover:bg-[rgba(245,197,24,0.15)] transition-all"
            >
              Ponerse al día · {formatMoney(montoParaPonerseAlDia)}
            </button>
          )}

          {['lineal', 'lineal_dinamico', 'solo_interes'].includes(prestamo?.modoInteres) && (() => {
            const interesesPend = prestamo?.cuotasAmortizacion
              ?.filter(f => new Date(f.fechaEsperada) <= new Date() && (f.pagado || 0) < f.cuotaTotal)
              ?.reduce((acc, f) => acc + Math.max(0, f.interes - (f.interesPagado || 0)), 0) ?? 0
            return interesesPend > 0 ? (
              <button
                onClick={() => {
                  setModalAtajosCobro(false)
                  setModalIntereses(true)
                }}
                className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-warning)] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] hover:bg-[rgba(245,158,11,0.15)] transition-all"
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
            className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-success)] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] hover:bg-[rgba(34,197,94,0.15)] transition-all"
          >
            Hacer abono extraordinario
          </button>
        </div>
      </Modal>

      {/* Modal: gestión del préstamo (según permisos) */}
      <Modal
        open={modalGestionPrestamo}
        onClose={() => setModalGestionPrestamo(false)}
        title="Gestión del préstamo"
      >
        <div className="space-y-4">
          {(puedeGestionarPrestamos || esOwner) && puedeEditar && (
            <button
              onClick={() => { setModalGestionPrestamo(false); setModalEditar(true) }}
              className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-hover)] border-2 border-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.1)] transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar préstamo
            </button>
          )}

          {puedeGestionarPrestamos && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Plazo y calendario
              </p>
              <div className="grid grid-cols-2 gap-2">
                <GestionBtn
                  label="Renovar"
                  desc="Prestar más al cliente"
                  color="168,85,247"
                  icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  onClick={() => { setModalGestionPrestamo(false); setModalRenovar(true) }}
                />
                <GestionBtn
                  label="Modificar plazo"
                  desc="Cambiar duración o fecha"
                  color="59,130,246"
                  icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  onClick={() => { setModalGestionPrestamo(false); setModalPlazo(true) }}
                />
                {prestamo?.frecuencia && prestamo.frecuencia !== 'diario' && (
                  <GestionBtn
                    label="Día de cobro"
                    desc="Fijar día de la semana"
                    color="245,197,24"
                    icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    onClick={() => { setModalGestionPrestamo(false); setModalDiaCobro(true) }}
                  />
                )}
                <GestionBtn
                  label="Próximo cobro"
                  desc="Cambiar fecha manual"
                  color="139,92,246"
                  icon="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  onClick={() => { setModalGestionPrestamo(false); setModalProximoCobro(true) }}
                />
                <GestionBtn
                  label="Días sin cobro"
                  desc="Excluir días de la semana"
                  color="160,160,160"
                  onClick={() => {
                    try { setDscDias(prestamo?.diasSinCobro ? JSON.parse(prestamo.diasSinCobro) : []) } catch { setDscDias([]) }
                    setModalGestionPrestamo(false)
                    setModalDscPrestamo(true)
                  }}
                  icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </div>
            </div>
          )}

          {puedeGestionarPrestamos && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Ajustes de saldo
              </p>
              <div className="grid grid-cols-2 gap-2">
                <GestionBtn
                  label="Recargo"
                  desc="Agregar castigo o multa"
                  color="249,115,22"
                  icon="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  onClick={() => { setModalGestionPrestamo(false); setModalRecargo(true) }}
                />
                {puedeAplicarDescuentos && (
                  <GestionBtn
                    label="Descuento"
                    desc="Reducir saldo pendiente"
                    color="34,197,94"
                    icon="M9 14.25l3-3m0 0l3 3m-3-3v8.25M3 11.25a4.502 4.502 0 018.206-2.913 4.5 4.5 0 015.588 5.163"
                    onClick={() => { setModalGestionPrestamo(false); setModalDescuento(true) }}
                  />
                )}
              </div>
            </div>
          )}

          {puedeAplicarDescuentos && (
            <button
              onClick={() => { setModalGestionPrestamo(false); abrirLiquidacion() }}
              className="w-full h-11 rounded-[12px] font-medium text-sm transition-all flex items-center justify-center gap-2"
              style={{ color: 'var(--color-accent)', background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.25)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Cerrar préstamo anticipado
            </button>
          )}

          <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {esClavo ? (
              <button
                onClick={() => { setModalGestionPrestamo(false); quitarClavo() }}
                className="w-full h-10 rounded-[12px] font-medium text-sm text-[var(--color-success)] bg-[rgba(34,197,94,0.06)] hover:bg-[rgba(34,197,94,0.12)] transition-all"
              >
                Quitar de préstamos perdidos
              </button>
            ) : (
              <button
                onClick={() => { setModalGestionPrestamo(false); setModalClavo(true) }}
                className="w-full h-10 rounded-[12px] font-medium text-sm text-[var(--color-danger)] bg-[rgba(239,68,68,0.06)] hover:bg-[rgba(239,68,68,0.12)] transition-all"
              >
                Mover a préstamos perdidos
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar mover a préstamos perdidos */}
      <Modal open={modalClavo} onClose={() => setModalClavo(false)} title="Mover a préstamos perdidos">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Este préstamo saldrá de tus números normales (cartera, saldos, dashboard) y pasará a la sección de préstamos perdidos. Podrás seguir registrando pagos si el cliente abona.
          </p>
          <label className="flex items-start gap-2 cursor-pointer rounded-[12px] border border-[var(--color-border)] p-3">
            <input type="checkbox" checked={clavoPerdida} onChange={e => setClavoPerdida(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[var(--color-danger)]" />
            <span className="text-sm text-[var(--color-text-primary)]">
              Registrar el capital prestado como dinero en riesgo
              <span className="block text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Resta de tu capital el dinero que aún no has recuperado de este préstamo. Si no lo marcas, solo se aparta de la cartera sin tocar tu caja.
              </span>
            </span>
          </label>
          {clavoError && <p className="text-sm text-[var(--color-danger)]">{clavoError}</p>}
          <div className="flex gap-3">
            <button onClick={() => setModalClavo(false)} className="flex-1 h-11 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-hover)]">Cancelar</button>
            <button onClick={confirmarClavo} disabled={clavoEnviando} className="flex-1 h-11 rounded-[12px] text-sm font-bold text-[var(--color-danger-text,#fff)] bg-[var(--color-danger)] disabled:opacity-40">
              {clavoEnviando ? 'Moviendo...' : 'Mover a perdidos'}
            </button>
          </div>
        </div>
      </Modal>

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
          <p className="text-xs text-[var(--color-text-secondary)] leading-snug">
            Este préstamo no generará mora en los días seleccionados. Vacío = hereda la configuración del cliente, ruta u organización.
          </p>
          <DiasSinCobroSelector value={dscDias} onChange={setDscDias} />
          {dscDias.length > 0 && (
            <button
              onClick={() => setDscDias([])}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
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
      />

      {/* Modales de ajuste: usan el mismo RegistrarPago con tabInicial.
          Antes habia un AjusteSaldo separado — se unifico para evitar UX divergente. */}
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalRecargo}
        onClose={() => setModalRecargo(false)}
        onSuccess={(prestamoActualizado) => setPrestamo(prestamoActualizado)}
        cliente={cliente}
        prestamo={prestamo}
        tabInicial="recargo"
      />
      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalDescuento}
        onClose={() => setModalDescuento(false)}
        onSuccess={(prestamoActualizado) => {
          setPrestamo(prestamoActualizado)
          if (prestamoActualizado.estado === 'completado') setCompletado(true)
        }}
        cliente={cliente}
        prestamo={prestamo}
        tabInicial="descuento"
      />

      <RegistrarPago
        prestamoId={id}
        cuotaDiaria={cuotaDiaria}
        saldoPendiente={saldoPendiente}
        open={modalIntereses}
        onClose={() => setModalIntereses(false)}
        onSuccess={(prestamoActualizado) => setPrestamo(prestamoActualizado)}
        cliente={cliente}
        prestamo={prestamo}
        tabInicial="intereses"
      />

      {/* Modal: Liquidación anticipada (cierre por pago total antes del plazo) */}
      <Modal open={modalLiquidacion} onClose={() => setModalLiquidacion(false)} title="Liquidación anticipada">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            El cliente paga todo hoy. Solo se cobra capital + interés de los meses transcurridos; se perdona el interés futuro.
          </p>

          {liqCargando && <p className="text-sm text-[var(--color-text-muted)]">Calculando...</p>}

          {liqData && !liqCargando && (
            <>
              {liqData.aproximado && (
                <div className="text-[12px] text-[var(--color-accent)] bg-[rgba(245,197,24,0.08)] rounded-[12px] px-3 py-2">
                  Este préstamo es modo {liqData.modo}; el cálculo es aproximado. Ajusta el monto final según lo pactado.
                </div>
              )}

              {/* Selector de modalidad */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'mesCompleto', label: 'Mes completo' },
                  { id: 'proporcional', label: 'Proporcional (días)' },
                ].map(m => {
                  const d = liqData[m.id]
                  const activo = liqModalidad === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => seleccionarModalidad(m.id)}
                      className={`rounded-[12px] px-3 py-2.5 text-left border transition-all ${activo ? 'border-[var(--color-accent)] bg-[rgba(245,197,24,0.1)]' : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'}`}
                    >
                      <p className="text-[11px] text-[var(--color-text-muted)]">{m.label}</p>
                      <p className="text-base font-bold text-[var(--color-text-primary)] font-mono-display">${(d?.restanteHoy ?? 0).toLocaleString('es-CO')}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{(d?.mesesTranscurridos ?? 0)} mes(es) · perdona ${ (d?.interesPerdonado ?? 0).toLocaleString('es-CO')}</p>
                    </button>
                  )
                })}
              </div>

              {/* Desglose */}
              <div className="rounded-[12px] bg-[var(--color-bg-hover)] px-3 py-2.5 text-[13px] space-y-1">
                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Capital{liqData.capitalRestante != null ? ' restante' : ''}</span><span className="text-[var(--color-text-primary)] font-mono-display">${(liqData.capitalRestante ?? liqData.capital ?? 0).toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Interés devengado</span><span className="text-[var(--color-text-primary)] font-mono-display">${(liqData[liqModalidad]?.interesDevengado ?? 0).toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Ya pagó</span><span className="text-[var(--color-text-primary)] font-mono-display">${(liqData.totalPagadoReal ?? 0).toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between border-t border-[var(--color-border)] pt-1 mt-1"><span className="text-[var(--color-text-muted)]">Saldo actual (pactado)</span><span className="text-[var(--color-text-primary)] font-mono-display">${(liqData.saldoActual ?? 0).toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--color-success)]">Interés que se perdona</span><span className="text-[var(--color-success)] font-semibold font-mono-display">${(liqData[liqModalidad]?.interesPerdonado ?? 0).toLocaleString('es-CO')}</span></div>
              </div>

              {/* Monto final editable */}
              <div>
                <label className="text-[12px] text-[var(--color-text-muted)]">Monto para cerrar hoy (editable)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={liqMonto ? liqMonto.toLocaleString('es-CO') : ''}
                  onChange={e => {
                    const n = Number((e.target.value || '').replace(/\D/g, ''))
                    setLiqMonto(Number.isFinite(n) ? n : 0)
                  }}
                  placeholder="Escribe el monto a cobrar"
                  className="w-full mt-1 px-3 py-2.5 rounded-[12px] bg-[var(--color-bg-base)] text-lg font-bold text-[var(--color-text-primary)] font-mono-display placeholder:text-[var(--color-text-muted)] placeholder:font-normal placeholder:text-sm outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]"
                />
              </div>

              {/* Nota */}
              <div>
                <label className="text-[12px] text-[var(--color-text-muted)]">Motivo / nota (obligatorio)</label>
                <input
                  type="text"
                  value={liqNota}
                  onChange={e => setLiqNota(e.target.value)}
                  placeholder="Ej: pago anticipado pactado con el cliente"
                  className="w-full mt-1 px-3 py-2 rounded-[12px] bg-[var(--color-bg-base)] text-sm text-[var(--color-text-primary)] outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]"
                />
              </div>
            </>
          )}

          {liqError && <p className="text-sm text-[var(--color-danger)]">{liqError}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalLiquidacion(false)} className="flex-1 h-11 rounded-[12px] text-sm font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-hover)]">Cancelar</button>
            <button
              onClick={confirmarLiquidacion}
              disabled={liqEnviando || liqCargando || !liqData}
              className="flex-1 h-11 rounded-[12px] text-sm font-bold text-[var(--color-accent-text)] bg-[var(--color-accent)] disabled:opacity-40"
            >
              {liqEnviando ? 'Cerrando...' : 'Cerrar préstamo'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de renovación */}
      <RenovarPrestamo
        prestamoId={id}
        saldoPendiente={saldoPendiente}
        capitalRestante={capitalRestante}
        prestamoAnterior={{ tasaInteres, diasPlazo, frecuencia, modoInteres, cuotaDiaria, montoPrestado, interesAdelantado }}
        clienteNombre={cliente?.nombre}
        montoMaximoPrestamo={cliente?.montoMaximoPrestamo}
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
        open={modalEditar}
        onClose={() => setModalEditar(false)}
        onSuccess={() => { setModalEditar(false); fetchPrestamo() }}
        socios={sociosLista}
      />

      {/* Modal selector de plantillas WhatsApp (boton circular del header) */}
      <ModalWhatsAppTemplates
        open={modalWA}
        onClose={() => setModalWA(false)}
        cliente={cliente}
        prestamo={prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={session?.user?.organizationId}
        camposRecibo={camposRecibo}
      />

      {/* Modal: aplicar interes moratorio como recargo */}
      <Modal
        open={modalMoratorio}
        onClose={() => setModalMoratorio(false)}
        title="Aplicar interés moratorio"
      >
        <div className="space-y-4">
          <div className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.2)] rounded-[12px] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Calculado: {formatMoney(moratorio?.montoMoratorio ?? 0)} ({moratorio?.diasMoraEfectivos ?? 0} dias sobre {formatMoney(moratorio?.montoBase ?? 0)})
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Monto a aplicar</label>
            <input
              type="number"
              min="0"
              value={moratorioMonto}
              onChange={(e) => setMoratorioMonto(Number(e.target.value) || 0)}
              className="w-full h-11 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-base)] text-lg font-semibold font-mono-display text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
            />
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Puedes editar el monto. El sistema sugiere {formatMoney(moratorio?.montoMoratorio ?? 0)}.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Nota (opcional)</label>
            <input
              type="text"
              value={moratorioNota}
              onChange={(e) => setMoratorioNota(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-base)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
            />
          </div>
          {moratorioError && (
            <p className="text-xs text-[var(--color-danger)]">{moratorioError}</p>
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
            className="w-full h-11 rounded-[12px] font-semibold text-sm text-[var(--color-accent-text)] bg-[var(--color-warning)] hover:opacity-90 disabled:opacity-50 transition-all"
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
        'bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]',
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

        <div className="pt-2 border-t border-[var(--color-border)]">
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
