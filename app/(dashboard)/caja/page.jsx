'use client'
// app/(dashboard)/caja/page.jsx - Caja del día

import { formatMoney } from '@/lib/i18n'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth }             from '@/hooks/useAuth'
import { useOffline }          from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache } from '@/lib/offline'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }              from '@/components/ui/Badge'
import { Modal }               from '@/components/ui/Modal'
import MoneyInput              from '@/components/ui/MoneyInput'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import EmptyState              from '@/components/ui/EmptyState'
import ReportarGasto          from '@/components/gastos/ReportarGasto'
import ListaGastos            from '@/components/gastos/ListaGastos'
import ListadoPagos           from '@/components/pagos/ListadoPagos'
import CajaCobradorDetalle    from '@/components/caja/CajaCobradorDetalle'
import FiltroPeriodo          from '@/components/caja/FiltroPeriodo'
import CajaResumen            from '@/components/caja/CajaResumen'
import CuadreDia              from '@/components/caja/CuadreDia'
import ReporteDia             from '@/components/reportes/ReporteDia'
import { nivelReportes }      from '@/lib/planes'

const DAY_MS = 24 * 60 * 60 * 1000
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const fmtFecha = (d) => {
  if (!d) return '—'
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

const fmtHora = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Bogota',
  })
}

const getMetodoPagoLabel = (pago) => {
  if (pago?.metodoPago === 'transferencia') {
    return pago?.plataforma ? `Transferencia (${pago.plataforma})` : 'Transferencia'
  }
  if (pago?.metodoPago === 'efectivo') return 'Efectivo'
  return 'Método no definido'
}

const getColombiaDateStr = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

const diasDesdeFechaColombia = (fechaBase, fechaObjetivo) => {
  const base = new Date(fechaBase + 'T00:00:00-05:00')
  const objetivo = new Date(fechaObjetivo + 'T00:00:00-05:00')
  return Math.round((base - objetivo) / DAY_MS)
}

export default function CajaPage() {
  const searchParams = useSearchParams()
  const fechaParam = searchParams.get('fecha')
  const tabParam = searchParams.get('tab')
  const { esCobrador, esOwner, session, plan, puedeReportarGastos, puedeVerSaldoCaja, puedeVerCapital, puedeVerCapitalRuta, puedeReabrirCajaSinAprobacion, loading: authLoading } = useAuth()
  const ownerId = session?.user?.id ?? null

  const { lastSyncedAt } = useOffline()

  const [cajaData, setCajaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorCaja, setErrorCaja] = useState('')
  const [exito, setExito] = useState(false)
  const [showGasto, setShowGasto] = useState(false)
  const [showAjusteCaja, setShowAjusteCaja] = useState(false)
  const [ajusteDireccion, setAjusteDireccion] = useState('ingreso')
  const [ajusteMonto, setAjusteMonto] = useState('')
  const [ajusteDescripcion, setAjusteDescripcion] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [errorAjuste, setErrorAjuste] = useState('')
  const [cobradorExpandido, setCobradorExpandido] = useState({})
  const [exitoAjuste, setExitoAjuste] = useState(false)
  const [gastosPendientes, setGastosPendientes] = useState(0)
  const [cajaTab, setCajaTab] = useState(tabParam === 'gastos' ? 'gastos' : 'cobros')
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    typeof fechaParam === 'string' && FECHA_REGEX.test(fechaParam)
      ? fechaParam
      : getColombiaDateStr()
  )
  const [modoAjusteCierre, setModoAjusteCierre] = useState(false)
  const [reabriendoCierre, setReabriendoCierre] = useState(false)
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
  const [filtroCobrador, setFiltroCobrador] = useState('')
  // Filtro de periodo de la caja: { modo:'hoy'|'7d'|'30d'|'rango', fecha, desde, hasta }
  const [periodo, setPeriodo] = useState({ modo: 'hoy', fecha: null, desde: null, hasta: null })
  // Datos del rango histórico acumulado (cuando modo != 'hoy')
  const [rangoData, setRangoData] = useState(null)
  // Pestaña "Caja por ruta": cobrador seleccionado + su detalle (caja completa)
  const [cajaRutaCobradorId, setCajaRutaCobradorId] = useState('')
  const [cajaRutaData, setCajaRutaData] = useState(null)
  const [cajaRutaLoading, setCajaRutaLoading] = useState(false)
  const [cajaRutaError, setCajaRutaError] = useState('')
  // Historial de cierres del owner (carga perezosa al expandir)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [historial, setHistorial] = useState(null)
  const [historialCargando, setHistorialCargando] = useState(false)
  const hasLoadedOnceRef = useRef(false)
  const [showReporte, setShowReporte] = useState(false)
  const [showUpgradeReporte, setShowUpgradeReporte] = useState(false)
  const [rutasDisponibles, setRutasDisponibles] = useState([])
  const [bannerCajaVisible, setBannerCajaVisible] = useState(() => {
    try { return localStorage.getItem('cf-banner-caja') !== 'hidden' } catch { return true }
  })

  const cerrarBannerCaja = () => {
    setBannerCajaVisible(false)
    try { localStorage.setItem('cf-banner-caja', 'hidden') } catch {}
  }

  const abrirReporte = async () => {
    if (nivelReportes(plan) < 1) {
      setShowUpgradeReporte(true)
      return
    }
    setShowReporte(true)
    if (rutasDisponibles.length === 0) {
      try {
        const res = await fetch('/api/rutas')
        if (res.ok) {
          const rutas = await res.json()
          setRutasDisponibles((rutas || []).map(r => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre })))
        }
      } catch {}
    }
  }

  // Solo al montar: si llega ?fecha= en la URL (deep-link), úsala como fecha inicial.
  // No reaccionar a fechaParam después: el usuario cambia la fecha con el input y NO
  // debemos revertirla a la de la URL (ese era el bug: se devolvía a hoy).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (typeof fechaParam !== 'string' || !FECHA_REGEX.test(fechaParam)) return
    if (fechaParam === fechaSeleccionada) return
    setFechaSeleccionada(fechaParam)
    setExito(false)
    setModoAjusteCierre(false)
  }, [])

  const fetchData = useCallback(async ({ soft = false } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    if (!shouldUseSoftRefresh) setLoading(true)
    setError('')
    setIsOffline(false)
    const cacheKey = `caja:${fechaSeleccionada}`

    // Offline: go straight to IndexedDB
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) cached = await leerDeCache('sync:caja')
        if (cached) { setCajaData(cached); if (!navigator.onLine) setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
      } catch {}
    }

    try {
      const res = await fetch(`/api/caja?fecha=${fechaSeleccionada}`)
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      if (data.error) {
        setError(data.error)
      } else {
        setCajaData(data)
        guardarEnCache(cacheKey, data).catch(() => {})
      }
    } catch {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) cached = await leerDeCache('sync:caja')
        if (cached) { setCajaData(cached); if (!navigator.onLine) setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
      } catch {}
      setError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [fechaSeleccionada])

  // Pestaña "Caja por ruta": carga el detalle del cobrador seleccionado.
  useEffect(() => {
    if (cajaTab !== 'porruta' || !cajaRutaCobradorId) {
      setCajaRutaData(null)
      return
    }
    let cancelado = false
    ;(async () => {
      setCajaRutaLoading(true)
      setCajaRutaError('')
      try {
        const qs = periodo.modo === 'hoy'
          ? `fecha=${periodo.fecha || fechaSeleccionada}`
          : `desde=${periodo.desde}&hasta=${periodo.hasta}`
        const res = await fetch(`/api/caja/cobrador/${cajaRutaCobradorId}?${qs}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'No se pudo cargar la caja del cobrador')
        }
        const data = await res.json()
        if (!cancelado) setCajaRutaData(data)
      } catch (e) {
        if (!cancelado) { setCajaRutaError(e.message); setCajaRutaData(null) }
      } finally {
        if (!cancelado) setCajaRutaLoading(false)
      }
    })()
    return () => { cancelado = true }
  }, [cajaTab, cajaRutaCobradorId, fechaSeleccionada, periodo.modo, periodo.fecha, periodo.desde, periodo.hasta])

  useEffect(() => {
    if (!authLoading) fetchData()
  }, [authLoading, fetchData])

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (authLoading || !lastSyncedAt) return
    fetchData({ soft: true })
  }, [authLoading, lastSyncedAt, fetchData])

  const handleFechaChange = (e) => {
    setFechaSeleccionada(e.target.value)
    setExito(false)
    setExitoAjuste(false)
    setModoAjusteCierre(false)
  }

  // Cambio del filtro de periodo (Hoy / 7d / 30d / Personalizado).
  const handlePeriodoChange = (nuevo) => {
    setPeriodo(nuevo)
    if (nuevo.modo === 'hoy' && nuevo.fecha) {
      setFechaSeleccionada(nuevo.fecha)
      setRangoData(null)
    }
  }

  // Carga del histórico acumulado cuando el periodo es un rango (7d/30d/personalizado).
  useEffect(() => {
    if (periodo.modo === 'hoy' || !periodo.desde || !periodo.hasta) { setRangoData(null); return }
    let cancelado = false
    ;(async () => {
      try {
        const qs = new URLSearchParams({ desde: periodo.desde, hasta: periodo.hasta })
        if (!esCobrador && filtroCobrador) qs.set('cobradorId', filtroCobrador)
        const res = await fetch(`/api/caja?${qs.toString()}`)
        const data = await res.json()
        if (!cancelado) setRangoData(data?.rango || null)
      } catch {
        if (!cancelado) setRangoData(null)
      }
    })()
    return () => { cancelado = true }
  }, [periodo.modo, periodo.desde, periodo.hasta, filtroCobrador, esCobrador])

  const registrarAjusteCaja = async (e) => {
    e.preventDefault()
    setErrorAjuste('')

    const montoNum = Number(ajusteMonto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setErrorAjuste('Ingresa un monto válido mayor a 0')
      return
    }

    setGuardandoAjuste(true)
    try {
      const res = await fetch('/api/caja/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movimiento: 'ajuste',
          direccion: ajusteDireccion,
          monto: montoNum,
          descripcion: ajusteDescripcion,
          fecha: fechaSeleccionada,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorAjuste(data.error || 'No se pudo registrar el ajuste')
        return
      }

      setShowAjusteCaja(false)
      setAjusteMonto('')
      setAjusteDescripcion('')
      setAjusteDireccion('ingreso')
      setExitoAjuste(true)
      await fetchData()
    } finally {
      setGuardandoAjuste(false)
    }
  }

  const registrarCierre = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrorCaja('')
    try {
      const totalRecogidoFinal = totalRecogido === ''
        ? Number(cajaData?.stats?.dia?.recogida || 0)
        : Number(totalRecogido)

      if (!Number.isFinite(totalRecogidoFinal) || totalRecogidoFinal < 0) {
        setErrorCaja('Ingresa un valor válido para el cierre')
        return
      }

      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalRecogido: totalRecogidoFinal,
          fecha: fechaSeleccionada,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al registrar'); return }
      setExito(true)
      setModoAjusteCierre(false)
      setTotalRecogido('')
      setHistorial(null) // invalida cache historial para que recargue con el nuevo cierre
      await fetchData()
    } finally {
      setGuardando(false)
    }
  }

  const reabrirCierre = async (cobradorId) => {
    setReabriendoCierre(true)
    setErrorCaja('')
    try {
      const res = await fetch('/api/caja/reabrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fechaSeleccionada, ...(cobradorId ? { cobradorId } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al reabrir la caja'); return }
      await fetchData()
    } finally {
      setReabriendoCierre(false)
    }
  }

  const aprobarReapertura = async (cierreId) => {
    setProcesandoSolicitud(cierreId)
    setErrorCaja('')
    try {
      const res = await fetch('/api/caja/reabrir/aprobar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cierreId }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al aprobar la reapertura'); return }
      await fetchData()
    } finally {
      setProcesandoSolicitud(null)
    }
  }

  const rechazarReapertura = async (cierreId) => {
    setProcesandoSolicitud(cierreId)
    setErrorCaja('')
    try {
      const res = await fetch('/api/caja/reabrir/rechazar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cierreId }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al rechazar la reapertura'); return }
      await fetchData()
    } finally {
      setProcesandoSolicitud(null)
    }
  }

  const toggleHistorial = async () => {
    const next = !historialAbierto
    setHistorialAbierto(next)
    if (next && historial === null && !historialCargando) {
      setHistorialCargando(true)
      try {
        const res = await fetch('/api/caja/historial-owner?limit=30')
        const data = await res.json()
        if (res.ok) setHistorial(data.cierres || [])
        else setHistorial([])
      } catch {
        setHistorial([])
      } finally {
        setHistorialCargando(false)
      }
    }
  }

  const reabrirCierreOwner = () => {
    setModoAjusteCierre(true)
    setExito(false)
  }

  // Owner corrige el cierre de un cobrador (modal aparte)
  const [editCobrador, setEditCobrador] = useState(null) // { id, nombre, totalRecogido }
  const [editMonto, setEditMonto] = useState('')
  const [editError, setEditError] = useState('')
  const [editGuardando, setEditGuardando] = useState(false)

  const abrirEditCierreCobrador = (cobrador, cierre) => {
    setEditCobrador({ id: cobrador.id, nombre: cobrador.nombre })
    setEditMonto(String(Math.round(cierre?.totalRecogido || 0)))
    setEditError('')
  }

  const guardarEditCierreCobrador = async (e) => {
    e.preventDefault()
    if (!editCobrador) return
    const monto = Number(editMonto)
    if (!Number.isFinite(monto) || monto < 0) { setEditError('Ingresa un valor válido'); return }
    setEditGuardando(true)
    setEditError('')
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalRecogido: monto,
          fecha: fechaSeleccionada,
          cobradorId: editCobrador.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error ?? 'Error al corregir'); return }
      setEditCobrador(null)
      setHistorial(null)
      await fetchData()
    } finally {
      setEditGuardando(false)
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SkeletonCard /><SkeletonCard />
    </div>
  )

  const stats = cajaData?.stats?.dia || {}
  const cajaGeneral = cajaData?.stats?.cajaGeneral || {}
  const capitalOrganizacion = cajaData?.stats?.capitalOrganizacion || null
  const capitalRutas = cajaData?.stats?.capitalRutas || null
  const cierres = cajaData?.cierres || []
  const cobradores = cajaData?.cobradores || []
  const disponibleOperativo = stats.disponibleOperativo ?? ((stats.recogida || 0) - (stats.gastos || 0))
  const desembolsadoDia = stats.desembolsadoDia || 0
  const saldoRealCaja = stats.saldoRealCajaConAjustes ?? stats.saldoRealCaja ?? (disponibleOperativo - desembolsadoDia)
  const cobradoHoy = Math.round(stats.cobradoHoy ?? stats.recogida ?? 0)
  const prestadoHoy = Math.round(stats.prestadoHoy ?? desembolsadoDia)
  const gastosHoy = Math.round(stats.gastos || 0)
  const baseInicialDia = Math.round(stats.baseInicialDia || 0)
  const disponibleHoy = Math.round(stats.disponibleHoy ?? saldoRealCaja)
  const diferenciaRecaudo = cobradoHoy - Math.round(stats.esperado || 0)
  const ajustesDelDia = Math.round(stats.ajustesOperativosDia ?? stats.ajustesManualDia ?? 0)
  const segurosDia = stats.segurosCobradosDia || { monto: 0, cantidad: 0 }
  const saldoGeneralActual = cajaGeneral.saldoActual ?? 0
  const tasaRecaudo = stats.tasaRecaudo || 0
  const colorRecaudo = tasaRecaudo >= 80 ? 'var(--color-success)' : tasaRecaudo >= 50 ? 'var(--color-accent)' : 'var(--color-danger)'
  const recaudadoRegistrado = cobradoHoy
  const pagosDelDia = cajaData?.pagosDia || []
  const resumenPagosDia = cajaData?.resumenPagosDia || {}
  const cantidadPagosDia = resumenPagosDia.cantidad ?? pagosDelDia.length
  const totalPagosDia = Math.round(resumenPagosDia.total ?? pagosDelDia.reduce((acc, pago) => acc + Number(pago.montoPagado || 0), 0))
  const hoyColombia = getColombiaDateStr()
  const diasAtrasSeleccion = diasDesdeFechaColombia(hoyColombia, fechaSeleccionada)
  const esAyer = diasAtrasSeleccion === 1
  const fechaEditableCobrador = diasAtrasSeleccion === 0 || diasAtrasSeleccion === 1
  const fechaFueraRango = diasAtrasSeleccion < 0 || diasAtrasSeleccion > 1
  const puedeReportarGastoCobrador = fechaEditableCobrador && puedeReportarGastos

  const pagosDelDiaFiltrados = filtroCobrador
    ? pagosDelDia.filter((p) => (p.cobrador?.id ?? p.cobradorId) === filtroCobrador)
    : pagosDelDia
  const totalPagosFiltrados = filtroCobrador
    ? Math.round(pagosDelDiaFiltrados.reduce((acc, p) => acc + Number(p.montoPagado || 0), 0))
    : totalPagosDia
  const cantidadPagosFiltrados = filtroCobrador ? pagosDelDiaFiltrados.length : cantidadPagosDia

  const cobradoresParaFiltro = cajaData?.cobradores || []
  const descargarCSV = () => {
    const qs = new URLSearchParams({
      desde: fechaSeleccionada,
      hasta: fechaSeleccionada,
    })
    if (filtroCobrador) qs.set('cobrador', filtroCobrador)
    window.location.href = `/api/pagos/export?${qs.toString()}`
  }

  const pagosDiaCard = (
    <Card>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Pagos del día</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{cantidadPagosFiltrados} registro{cantidadPagosFiltrados === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-sm font-bold font-mono-display text-[var(--color-success)]">{formatMoney(totalPagosFiltrados)}</p>
          {!esCobrador && pagosDelDia.length > 0 && (
            <button
              type="button"
              onClick={descargarCSV}
              title="Descargar CSV"
              aria-label="Descargar CSV"
              className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!esCobrador && cobradoresParaFiltro.length > 1 && (
        <div className="mb-3">
          <select
            value={filtroCobrador}
            onChange={(e) => setFiltroCobrador(e.target.value)}
            className="w-full h-9 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todos los cobradores</option>
            {cobradoresParaFiltro.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <ListadoPagos
        pagos={pagosDelDiaFiltrados}
        mostrarCliente
        mostrarCobrador={!esCobrador}
        mostrarLinkPrestamo
        emptyLabel="No hay pagos registrados en esta fecha."
        maxHeight="320px"
      />

    </Card>
  )

  // ── VISTA DEL COBRADOR ────────────────────────────────────────
  if (esCobrador) {
    const cierreHoy = cierres[0]
    const diferencia = cierreHoy ? cierreHoy.totalRecogido - cierreHoy.totalEsperado : null
    const cierreDesembolsado = cierreHoy?.totalDesembolsado ?? desembolsadoDia
    const cierreSaldoReal = cierreHoy?.saldoRealCaja ?? saldoRealCaja
    const mostrarFormularioCierre = fechaEditableCobrador && (!cierreHoy || modoAjusteCierre)

    return (
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Caja del dia</h1>
            <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{cajaData?.fechaDisplay || '—'}</p>
          </div>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={handleFechaChange}
            className="px-3 py-2 rounded-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
          />
        </div>

        {isOffline && (
          <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
            Datos guardados — sin conexión
          </div>
        )}
        {error && (
          <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Capital total de la organización (solo cobradores con permiso verCapital) */}
        {puedeVerCapital && capitalOrganizacion && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Capital total de la organización</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">Saldo en caja + cartera activa</p>
              </div>
            </div>
            <p className="text-2xl font-bold font-mono-display text-[var(--color-info)]">
              {formatMoney(capitalOrganizacion.total || 0)}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">En caja</p>
                <p className="text-sm font-bold font-mono-display text-[var(--color-success)]">{formatMoney(capitalOrganizacion.saldoCaja || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">En calle (cartera)</p>
                <p className="text-sm font-bold font-mono-display text-[var(--color-warning)]">{formatMoney(capitalOrganizacion.carteraActiva || 0)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Capital de SU(S) ruta(s) (cobrador con permiso verCapitalRuta) */}
        {puedeVerCapitalRuta && capitalRutas && (
          <Card>
            <div className="mb-2">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                {capitalRutas.rutas.length > 1 ? 'Capital de mis rutas' : 'Capital de mi ruta'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Dinero asignado a tu ruta para prestar</p>
            </div>
            <p className="text-2xl font-bold font-mono-display text-[var(--color-info)]">
              {formatMoney(capitalRutas.total || 0)}
            </p>
            {capitalRutas.rutas.length > 1 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1.5">
                {capitalRutas.rutas.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--color-text-muted)] truncate">{r.nombre}</span>
                    <span className="text-sm font-bold font-mono-display text-[var(--color-text-primary)]">{formatMoney(r.saldoCapital)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Hero dorado de marca: saldo en caja */}
        <Card
          className="relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #f9d64a 0%, #f5c518 55%, #eab308 100%)',
            border: '1px solid rgba(180, 140, 10, 0.35)',
            boxShadow: '0 14px 34px rgba(200, 160, 20, 0.30)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 58%)' }}
          />
          <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(35,26,4,0.62)' }}>
                {puedeVerSaldoCaja ? 'Saldo en caja' : 'Flujo del día'}
              </p>
              <p className="text-[11px]" style={{ color: 'rgba(35,26,4,0.55)' }}>
                {puedeVerSaldoCaja ? 'Disponible para prestar ahora' : 'Neto operativo de hoy'}
              </p>
            </div>
            {tasaRecaudo > 0 && (
              <span className="text-sm font-bold" style={{ color: '#231a04' }}>
                {tasaRecaudo}% cobrado
              </span>
            )}
          </div>
          <p className="text-3xl font-bold font-mono-display" style={{ color: disponibleHoy >= 0 ? '#231a04' : '#b91c1c' }}>
            {formatMoney(disponibleHoy)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'rgba(35,26,4,0.55)' }}>
            {puedeVerSaldoCaja ? 'Saldo compartido con el administrador' : 'Cobrado - Prestado hoy - Gastos'}
          </p>

          {!esCobrador && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <p className="text-[10px] uppercase" style={{ color: 'rgba(35,26,4,0.55)' }}>Base inicial</p>
                <p className="text-base font-bold font-mono-display" style={{ color: '#231a04' }}>{formatMoney(baseInicialDia)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase" style={{ color: 'rgba(35,26,4,0.55)' }}>Ajustes manuales</p>
                <p className="text-base font-bold font-mono-display" style={{ color: ajustesDelDia >= 0 ? '#15803d' : '#b91c1c' }}>
                  {ajustesDelDia > 0 ? '+' : ''}{formatMoney(ajustesDelDia)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div>
              <p className="text-[10px] uppercase" style={{ color: 'rgba(35,26,4,0.55)' }}>Cobrado</p>
              <p className="text-base font-bold font-mono-display" style={{ color: '#15803d' }}>{formatMoney(cobradoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase" style={{ color: 'rgba(35,26,4,0.55)' }}>Prestado hoy</p>
              <p className="text-base font-bold font-mono-display" style={{ color: '#92400e' }}>{prestadoHoy > 0 ? '-' : ''}{formatMoney(prestadoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase" style={{ color: 'rgba(35,26,4,0.55)' }}>Gastos</p>
              <p className="text-base font-bold font-mono-display" style={{ color: '#b91c1c' }}>{gastosHoy > 0 ? '-' : ''}{formatMoney(gastosHoy)}</p>
            </div>
          </div>

          {/* Seguros cobrados hoy */}
          {segurosDia.monto > 0 && (
            <div className="mt-3 rounded-[10px] px-3 py-2.5 flex items-center justify-between"
              style={{ background: 'color-mix(in srgb, #231a04 8%, transparent)', border: '1px solid color-mix(in srgb, #231a04 16%, transparent)' }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(35,26,4,0.55)' }}>Seguros cobrados hoy</p>
                <p className="text-[10px]" style={{ color: 'rgba(35,26,4,0.55)' }}>{segurosDia.cantidad} {segurosDia.cantidad === 1 ? 'préstamo' : 'préstamos'}</p>
              </div>
              <p className="text-base font-bold font-mono-display" style={{ color: '#231a04' }}>{formatMoney(segurosDia.monto)}</p>
            </div>
          )}

          <details className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(35,26,4,0.16)' }}>
            <summary className="cursor-pointer text-[11px]" style={{ color: 'rgba(35,26,4,0.62)' }}>Ver detalle del cálculo</summary>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span style={{ color: 'rgba(35,26,4,0.55)' }}>Efectivo del día</span>
                <span className="font-semibold" style={{ color: saldoRealCaja >= 0 ? '#231a04' : '#b91c1c' }}>{formatMoney(saldoRealCaja)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgba(35,26,4,0.55)' }}>Esperado</span>
                <span className="font-semibold" style={{ color: '#231a04' }}>{formatMoney(stats.esperado || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgba(35,26,4,0.55)' }}>Diferencia vs esperado</span>
                <span className="font-semibold" style={{ color: diferenciaRecaudo >= 0 ? '#15803d' : '#b91c1c' }}>
                  {diferenciaRecaudo >= 0 ? '+' : ''}{formatMoney(diferenciaRecaudo)}
                </span>
              </div>
            </div>
          </details>
          </div>
        </Card>

        {pagosDiaCard}

        {/* Cierre */}
        {cierreHoy && !modoAjusteCierre ? (
          <Card>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Cierre registrado</p>
              <div className="flex items-center gap-1.5">
                {cierreHoy.editadoEn && <Badge variant="gray">Editado</Badge>}
                {cierreHoy.reabiertoEn
                  ? <Badge variant="yellow">Reabierta</Badge>
                  : cierreHoy.solicitudReaperturaEn
                    ? <Badge variant="yellow">Solicitud pendiente</Badge>
                    : <Badge variant="green">Cerrado</Badge>}
              </div>
            </div>
            {cierreHoy.reabiertoEn && (
              <div
                className="rounded-[10px] px-3 py-2.5 mb-2 flex items-start gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 20%, transparent)',
                }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--color-success)' }}>
                    Caja reabierta — puedes seguir cobrando
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Reabierta por {cierreHoy.reabiertoPor?.nombre || '—'}
                  </p>
                </div>
              </div>
            )}
            {!cierreHoy.reabiertoEn && cierreHoy.solicitudReaperturaEn && (
              <div
                className="rounded-[10px] px-3 py-2.5 mb-2 flex items-start gap-2"
                style={{
                  background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
                }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                    Solicitud de reapertura enviada
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Esperando aprobacion del administrador
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {[
                { label: 'Deberias tener', value: formatMoney(cierreHoy.totalEsperado), color: 'text-[var(--color-text-primary)]' },
                { label: 'Entregaste', value: formatMoney(cierreHoy.totalRecogido), color: 'text-[var(--color-text-primary)]' },
                { label: 'Gastos', value: formatMoney(cierreHoy.totalGastos || 0), color: 'text-[var(--color-danger)]' },
                { label: 'Prestado hoy', value: `${cierreDesembolsado > 0 ? '-' : ''}${formatMoney(cierreDesembolsado)}`, color: 'text-[var(--color-warning)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className={`font-medium ${color}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-2 mt-2">
                <span className="text-[var(--color-text-muted)]">Diferencia</span>
                <span style={{ color: diferencia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {diferencia >= 0 ? '+' : ''}{formatMoney(diferencia)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-[var(--color-text-muted)]">Saldo del día</span>
                <span style={{ color: cierreSaldoReal >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
                  {formatMoney(cierreSaldoReal)}
                </span>
              </div>
            </div>

            {!esAyer && !cierreHoy.reabiertoEn && !cierreHoy.solicitudReaperturaEn && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                <p className="text-[11px] leading-snug" style={{ color: 'var(--color-warning)' }}>
                  Ya entregaste la caja de hoy. Si necesitas seguir cobrando, reabre la caja.
                </p>
                <button
                  type="button"
                  onClick={() => reabrirCierre()}
                  disabled={reabriendoCierre}
                  className="text-xs font-semibold transition-colors disabled:opacity-50"
                  style={{ color: 'var(--color-warning)' }}
                >
                  {reabriendoCierre
                    ? 'Enviando...'
                    : (puedeReabrirCajaSinAprobacion ? 'Reabrir caja' : 'Solicitar reapertura de caja')}
                </button>
              </div>
            )}

            {fechaEditableCobrador && !modoAjusteCierre && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                <p className="text-[11px] text-[var(--color-accent)] leading-snug">
                  {esAyer
                    ? 'Puedes corregir el monto que entregaste ayer.'
                    : 'Puedes corregir el monto si te equivocaste.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModoAjusteCierre(true)
                    setTotalRecogido(String(Math.round(cierreHoy.totalRecogido || recaudadoRegistrado)))
                  }}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                >
                  Corregir cierre de este día
                </button>
              </div>
            )}
          </Card>
        ) : mostrarFormularioCierre ? (
          <Card>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
              {modoAjusteCierre
                ? 'Corregir monto entregado'
                : (esAyer ? 'Cierre pendiente de ayer' : 'Entregar caja del dia')}
            </p>
            {exito && (
              <div className="mb-4 flex items-center gap-2 bg-[var(--color-success-dim)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] text-[var(--color-success)] text-sm rounded-[12px] px-4 py-3">
                Cierre guardado exitosamente
              </div>
            )}
            {errorCaja && (
              <div className="mb-4 flex items-center gap-2 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
                {errorCaja}
              </div>
            )}
            {esAyer && (
              <p className="mb-3 text-[11px] text-[var(--color-accent)] leading-snug">
                Estas reportando lo de ayer. Anota cuanto efectivo recogiste para que quede registrado.
              </p>
            )}
            <form onSubmit={registrarCierre} className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">{esAyer ? 'Deberias tener (ayer)' : 'Deberias tener en caja'}</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{formatMoney(stats.esperado || 0)}</span>
              </div>
              <div className="rounded-[12px] px-3 py-2.5 space-y-2" style={{ background: 'var(--color-warning-dim)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
                <p className="text-[11px] text-[var(--color-accent)] leading-snug">
                  Esto no cobra ni descuenta nada. Solo reportas cuanto dinero fisico tienes para entregar.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">Segun los pagos registrados hoy</span>
                  <button
                    type="button"
                    onClick={() => setTotalRecogido(String(recaudadoRegistrado))}
                    className="text-[11px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                  >
                    Usar {formatMoney(recaudadoRegistrado)}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <MoneyInput
                  label="Dinero en caja que vas a entregar al dueño"
                  placeholder="Ej: 250.000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                />
              </div>
              {totalRecogido !== '' && Number(totalRecogido) !== recaudadoRegistrado && (
                <p className="text-[11px] text-[var(--color-accent)]">
                  No coincide con lo cobrado en sistema ({formatMoney(recaudadoRegistrado)}). Si la diferencia es correcta, continua.
                </p>
              )}
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[var(--color-text-muted)]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= (stats.esperado || 0) ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                    {Number(totalRecogido) >= (stats.esperado || 0) ? '+' : ''}{formatMoney(Number(totalRecogido) - (stats.esperado || 0))}
                  </span>
                </div>
              )}
              <Button type="submit" loading={guardando} className="w-full">
                {modoAjusteCierre ? 'Guardar correccion' : 'Confirmar y entregar caja'}
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-4">
              <p className="text-sm text-[var(--color-text-muted)]">
                {fechaFueraRango
                  ? 'Esta fecha ya no está disponible para cierre desde perfil cobrador.'
                  : 'No se registró cierre este día'}
              </p>
            </div>
          </Card>
        )}

        {/* Gastos */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              if (puedeReportarGastoCobrador) setShowGasto(true)
            }}
            disabled={!puedeReportarGastoCobrador}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm font-medium text-[var(--color-text-muted)] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-hover)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reportar gasto menor
          </button>
          {!puedeReportarGastoCobrador && (
            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
              {puedeReportarGastos
                ? 'Puedes reportar gastos solo para hoy o ayer desde este perfil.'
                : 'Este cobrador no tiene habilitado el permiso de gastos menores.'}
            </p>
          )}
        </div>

        <ReportarGasto
          open={showGasto}
          onClose={() => setShowGasto(false)}
          onSuccess={fetchData}
          fecha={fechaSeleccionada}
        />
      </div>
    )
  }

  // ── VISTA DEL OWNER ───────────────────────────────────────────
  const cobradoresCerrados = cobradores.filter(c => c.cerrado).length
  const cobradoresTotal = cobradores.length
  const pendientesConRecaudo = cobradores.filter(c => !c.cerrado && (c.recaudadoDia || 0) > 0).length
  const pendientesSinMovimiento = cobradores.filter(c => !c.cerrado && (c.recaudadoDia || 0) <= 0).length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Caja</h1>
          <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">
            {periodo.modo === 'hoy' ? (cajaData?.fechaDisplay || '—') : `${periodo.desde} a ${periodo.hasta}`}
          </p>
        </div>
        <button
          type="button"
          onClick={abrirReporte}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors"
          style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Reporte
        </button>
      </div>

      {/* Banner explicativo (colapsable) */}
      {bannerCajaVisible && (
        <div className="rounded-[12px] px-3.5 py-2.5 flex items-start gap-2.5" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card))', border: '1px solid color-mix(in srgb, var(--color-success) 20%, var(--color-border))' }}>
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--color-success)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
          </svg>
          <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--color-text-secondary)' }}>
            Aquí ves el efectivo que entró y salió hoy. Cada cobrador cierra su caja al terminar la ruta — tú ves el consolidado y puedes corregir cualquier diferencia.
          </p>
          <button onClick={cerrarBannerCaja} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,0.1)]" style={{ color: 'var(--color-text-muted)' }} title="Cerrar">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filtro de periodo */}
      <FiltroPeriodo value={{ ...periodo, fecha: periodo.fecha || fechaSeleccionada }} onChange={handlePeriodoChange} />

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {[
          { key: 'cobros', label: 'Caja del dia' },
          { key: 'porruta', label: 'Por ruta' },
          ...(esOwner && cobradoresParaFiltro.length > 0 ? [{ key: 'cuadre', label: 'Cuadre' }] : []),
        ].map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setCajaTab(t.key)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
            style={cajaTab === t.key ? {
              background: 'var(--color-bg-card)',
              color: 'var(--color-accent)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            } : { color: 'var(--color-text-muted)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isOffline && (
        <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}
      {exitoAjuste && (
        <div className="bg-[var(--color-success-dim)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] text-[var(--color-success)] text-sm rounded-[12px] px-4 py-3">
          Ajuste de saldo general registrado correctamente.
        </div>
      )}

      {cajaTab === 'porruta' && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Caja por cobrador / ruta</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
              Selecciona un cobrador para ver su caja del día: lo que prestó, cobró, los seguros, el efectivo y el capital de cada ruta, con todos sus movimientos.
            </p>
            <select
              value={cajaRutaCobradorId}
              onChange={(e) => setCajaRutaCobradorId(e.target.value)}
              className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
            >
              <option value="">— Elige un cobrador —</option>
              {cobradoresParaFiltro.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Card>

          {cajaRutaLoading && <SkeletonCard />}
          {cajaRutaError && (
            <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3">
              {cajaRutaError}
            </div>
          )}
          {!cajaRutaLoading && !cajaRutaError && cajaRutaData && (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-sm font-bold text-[var(--color-text-primary)]">Caja de {cajaRutaData.cobrador?.nombre}</p>
                {cajaRutaData.esRango ? null : (cajaRutaData.cerrado ? <Badge variant="green">Cerrado</Badge> : <Badge variant="yellow">Pendiente cierre</Badge>)}
              </div>
              <CajaCobradorDetalle data={cajaRutaData} />
              <Link
                href={`/caja/cobrador/${cajaRutaCobradorId}?${periodo.modo === 'hoy' ? `fecha=${periodo.fecha || fechaSeleccionada}` : `desde=${periodo.desde}&hasta=${periodo.hasta}`}`}
                className="block text-center text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] py-2 rounded-[10px] border border-[var(--color-border)]"
              >
                Abrir en pantalla completa
              </Link>
            </>
          )}
          {!cajaRutaLoading && !cajaRutaError && !cajaRutaData && cajaRutaCobradorId === '' && (
            <EmptyState
              pose="guia"
              titulo="Selecciona un cobrador"
              hint="Elige un cobrador de la lista para ver su caja detallada."
              size={64}
            />
          )}
        </div>
      )}

      {/* Cuadre del día: verificación del efectivo de cada cobrador (solo owner) */}
      {cajaTab === 'cuadre' && (
        <CuadreDia fecha={periodo.modo === 'hoy' ? (periodo.fecha || fechaSeleccionada) : (periodo.hasta || fechaSeleccionada)} />
      )}

      {/* Histórico acumulado del rango (7d / 30d / personalizado) — MISMA hero card */}
      {cajaTab === 'cobros' && periodo.modo !== 'hoy' && (
        <div className="space-y-4">
          {!rangoData ? (
            <Card><p className="text-sm text-[var(--color-text-muted)]">Cargando…</p></Card>
          ) : (
            <>
              <CajaResumen
                hero={{
                  label: 'Efectivo del período',
                  valor: rangoData.efectivoNeto,
                  subtitulo: 'Cobrado − Prestado − Gastos',
                  color: rangoData.efectivoNeto >= 0 ? '#22c55e' : '#ef4444',
                }}
                cards={[
                  { label: 'Cobrado', valor: rangoData.cobrado, color: 'var(--color-success)' },
                  { label: 'Prestado', valor: rangoData.prestado, color: 'var(--color-warning)', signo: '-' },
                  { label: 'Gastos', valor: rangoData.gastos, color: 'var(--color-danger)', signo: '-' },
                  ...(rangoData.seguros?.monto > 0 ? [{ label: 'Seguros', valor: rangoData.seguros.monto, color: 'var(--color-info)', sub: `·${rangoData.seguros.cantidad}` }] : []),
                ]}
              />

              {/* Lista inteligente: resumen por día */}
              {rangoData.porDia?.length > 0 && (
                <Card>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Cobrado por día</p>
                  <div className="space-y-1.5">
                    {rangoData.porDia.map((d) => (
                      <div key={d.fecha} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
                        <p className="text-xs text-[var(--color-text-primary)]">{d.fecha}</p>
                        <span className="text-sm font-semibold font-mono-display text-[var(--color-success)] shrink-0">+{formatMoney(d.cobrado)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-2">{rangoData.cantidadPagos} pago{rangoData.cantidadPagos === 1 ? '' : 's'} en el período.</p>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {cajaTab === 'cobros' && periodo.modo === 'hoy' && <>
      {/* HERO CARD unificada: Saldo/Efectivo en caja del día */}
      <CajaResumen
        hero={{
          label: 'Saldo en caja',
          valor: disponibleHoy,
          subtitulo: 'Base inicial + Cobrado − Prestado − Gastos + Ajustes',
          tasa: tasaRecaudo,
        }}
        cards={[
          { label: 'Cobrado', valor: cobradoHoy, color: 'var(--color-success)' },
          { label: 'Prestado', valor: prestadoHoy, color: 'var(--color-warning)', signo: '-' },
          { label: 'Gastos', valor: gastosHoy, color: 'var(--color-danger)', signo: '-' },
          ...(!esCobrador ? [
            { label: 'Base inicial', valor: baseInicialDia, color: 'var(--color-info)' },
            { label: 'Ajustes', valor: ajustesDelDia, color: ajustesDelDia >= 0 ? 'var(--color-success)' : 'var(--color-danger)', signo: '+' },
          ] : []),
          ...(segurosDia.monto > 0 ? [{ label: 'Seguros', valor: segurosDia.monto, color: '#6366f1', sub: `·${segurosDia.cantidad}` }] : []),
        ]}
        detalle={[
          { label: 'Efectivo del día', valor: saldoRealCaja, color: saldoRealCaja >= 0 ? 'var(--color-info)' : 'var(--color-danger)' },
          { label: 'Esperado', valor: stats.esperado || 0 },
          { label: 'Diferencia vs esperado', valor: diferenciaRecaudo, color: diferenciaRecaudo >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
        ]}
      />

      {pagosDiaCard}

      <div
        className="relative rounded-[20px] overflow-hidden px-5 py-5"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 60%)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border))',
        }}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.06] pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)' }} />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tu patrimonio</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Todo el dinero del negocio acumulado</p>
          <p className="text-3xl font-extrabold font-mono-display mt-2" style={{ color: saldoGeneralActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatMoney(saldoGeneralActual)}
          </p>

          <div className="mt-4 pt-3 space-y-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
            <button
              type="button"
              onClick={() => {
                setShowAjusteCaja(true)
                setErrorAjuste('')
                setAjusteDireccion('ingreso')
              }}
              className="w-full h-11 rounded-[12px] text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: 'var(--color-accent)', color: 'var(--color-bg-base)' }}
            >
              Ajustar saldo general
            </button>
            <Link href="/capital?view=manual-movements" className="block text-center text-xs font-semibold py-1" style={{ color: 'var(--color-info)' }}>
              Ver movimientos en Capital
            </Link>
          </div>
        </div>
      </div>

      {/* Mi cierre del dia (owner): aparece si el owner no tiene cobradores
          o si el mismo registro pagos hoy (caso owner mixto). */}
      {esOwner && ownerId && (() => {
        const cierreOwner = cierres.find(c => c.cobradorId === ownerId) || null
        const ownerHaceCobros = pagosDelDia.some(p => p.cobradorId === ownerId)
        const ownerSinCobradores = cobradores.length === 0
        const debeMostrar = ownerSinCobradores || ownerHaceCobros || !!cierreOwner
        if (!debeMostrar) return null

        const recaudadoOwner = pagosDelDia
          .filter(p => p.cobradorId === ownerId)
          .reduce((acc, p) => acc + (p.montoPagado || 0), 0)
        const mostrarFormulario = !cierreOwner || modoAjusteCierre

        return (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Mi cierre del día
              </p>
              {cierreOwner && !modoAjusteCierre && (
                <Badge variant="green">Cerrado</Badge>
              )}
            </div>

            {cierreOwner && !modoAjusteCierre ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Recaudado</p>
                    <p className="text-lg font-bold font-mono-display text-[var(--color-text-primary)] mt-0.5">
                      {formatMoney(cierreOwner.totalRecogido)}
                    </p>
                  </div>
                  <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Saldo final</p>
                    <p className="text-lg font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-success)' }}>
                      {formatMoney(cierreOwner.saldoRealCaja)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                    <p className="text-[var(--color-text-muted)] uppercase tracking-wide text-[9px]">Esperado</p>
                    <p className="font-semibold font-mono-display text-[var(--color-text-primary)]">{formatMoney(cierreOwner.totalEsperado)}</p>
                  </div>
                  <div className="rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                    <p className="text-[var(--color-text-muted)] uppercase tracking-wide text-[9px]">Gastos</p>
                    <p className="font-semibold font-mono-display text-[var(--color-danger)]">{formatMoney(cierreOwner.totalGastos || 0)}</p>
                  </div>
                  <div className="rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                    <p className="text-[var(--color-text-muted)] uppercase tracking-wide text-[9px]">Prestado</p>
                    <p className="font-semibold font-mono-display text-[var(--color-warning)]">{formatMoney(cierreOwner.totalDesembolsado || 0)}</p>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                  Cerrado {fmtHora(cierreOwner.createdAt)}
                </p>
                <button
                  type="button"
                  onClick={reabrirCierreOwner}
                  className="w-full py-2 rounded-[10px] text-xs font-semibold border transition-colors"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Reabrir y ajustar
                </button>
              </div>
            ) : (
              <form onSubmit={registrarCierre} className="space-y-3">
                {!cierreOwner && (
                  <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Recaudo del día</p>
                    <p className="text-2xl font-bold font-mono-display text-[var(--color-text-primary)] mt-0.5">
                      {formatMoney(Math.round(recaudadoOwner))}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      Total de cobros registrados hoy. Ajusta si el efectivo entregado es distinto.
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
                    Total entregado (efectivo en caja)
                  </label>
                  <MoneyInput
                    value={totalRecogido}
                    onChange={(e) => setTotalRecogido(e.target.value)}
                    placeholder={String(Math.round(recaudadoOwner))}
                  />
                </div>
                {errorCaja && (
                  <p className="text-xs text-[var(--color-danger)]">{errorCaja}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={guardando}
                    className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'var(--color-accent)', color: 'var(--color-bg-base)' }}
                  >
                    {guardando ? 'Cerrando...' : (cierreOwner ? 'Guardar ajuste' : 'Cerrar día')}
                  </button>
                  {modoAjusteCierre && (
                    <button
                      type="button"
                      onClick={() => { setModoAjusteCierre(false); setTotalRecogido(''); setErrorCaja('') }}
                      className="px-4 py-2.5 rounded-[10px] text-sm font-semibold border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                {exito && (
                  <p className="text-xs text-[var(--color-success)] text-center">Cierre registrado.</p>
                )}
              </form>
            )}
          </Card>
        )
      })()}

      {/* Historial de cierres del owner (colapsable) */}
      {esOwner && ownerId && (
        <Card>
          <button
            type="button"
            onClick={toggleHistorial}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={historialAbierto}
          >
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Historial de cierres
            </span>
            <svg
              width="14" height="14" viewBox="0 0 20 20" fill="currentColor"
              aria-hidden="true"
              style={{
                color: 'var(--color-text-muted)',
                transform: historialAbierto ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
          {historialAbierto && (
            <div className="mt-3 space-y-1.5">
              {historialCargando && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Cargando...</p>
              )}
              {!historialCargando && historial && historial.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Aun no hay cierres registrados.</p>
              )}
              {!historialCargando && historial && historial.length > 0 && historial.map((c) => {
                const esActual = c.fecha?.slice(0, 10) === fechaSeleccionada
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFechaSeleccionada(c.fecha.slice(0, 10))}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] border text-left transition-colors"
                    style={{
                      background: esActual ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                      borderColor: esActual ? 'color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">
                        {fmtFecha(c.fecha)}
                      </span>
                      {c.diferencia !== 0 && (
                        <span
                          className="text-[10px] tabular-nums"
                          style={{ color: c.diferencia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                        >
                          {c.diferencia >= 0 ? '+' : ''}{formatMoney(c.diferencia)}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold font-mono-display tabular-nums" style={{ color: 'var(--color-success)' }}>
                      {formatMoney(c.saldoRealCaja)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Cobradores: solo visible si hay al menos uno (cuando no hay, el owner ya
          ve "Mi cierre del dia" arriba y esta seccion no aporta nada). */}
      {cobradoresTotal > 0 && (
      <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #8b5cf6 15%, transparent)', color: '#8b5cf6' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h2 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Cobradores</h2>
          </div>
          <span className="text-[11px] font-mono-display px-2 py-0.5 rounded-md" style={{
            background: cobradoresCerrados === cobradoresTotal
              ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
              : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            color: cobradoresCerrados === cobradoresTotal ? 'var(--color-success)' : 'var(--color-accent)',
          }}>
            {cobradoresCerrados}/{cobradoresTotal} cerraron
          </span>
        </div>

        <div className="px-4 py-3">
        {cobradoresTotal > 0 && (pendientesConRecaudo > 0 || pendientesSinMovimiento > 0) && (
          <div className="mb-3 text-[11px] space-y-1">
            {pendientesConRecaudo > 0 && (
              <p className="text-[var(--color-accent)]">
                {pendientesConRecaudo} cobrador{pendientesConRecaudo === 1 ? '' : 'es'} con cobrado registrado pendiente de cierre.
              </p>
            )}
            {pendientesSinMovimiento > 0 && (
              <p className="text-[var(--color-text-muted)]">
                {pendientesSinMovimiento} cobrador{pendientesSinMovimiento === 1 ? '' : 'es'} sin pagos ni cierre hoy.
              </p>
            )}
          </div>
        )}

        {cobradoresTotal === 0 ? (
          <EmptyState
            pose="busca"
            titulo="No hay cobradores activos"
            hint="Agrega cobradores a tu equipo para ver su actividad."
            size={64}
          />
        ) : (
          <div className="space-y-2">
            {cobradores.map((c) => {
              const cierre = c.cierre
              const diff = cierre ? cierre.totalRecogido - cierre.totalEsperado : null
              const recaudadoDiaCobrador = Math.round(c.recaudadoDia || 0)
              const esperadoDiaCobrador = Math.round(c.esperadoDia || 0)
              const sugeridoCierre = Math.round(c.sugeridoCierre || 0)
              const deltaSistemaVsCierre = cierre ? recaudadoDiaCobrador - Math.round(cierre.totalRecogido || 0) : null
              const cierreDesembolsado = Math.round(cierre?.totalDesembolsado || 0)
              const cierreSaldoReal = cierre
                ? (cierre.saldoRealCaja ?? (cierre.totalRecogido - (cierre.totalGastos || 0) - cierreDesembolsado))
                : 0

              const expandido = !!cobradorExpandido[c.id]
              const toggleExpand = () => setCobradorExpandido((prev) => ({ ...prev, [c.id]: !prev[c.id] }))

              // El detalle completo (prestado/cobrado/seguros/efectivo/capital + movimientos)
              // vive ahora en la pestaña "Caja por ruta". Aquí solo dejamos un acceso directo.
              const detalleCobrador = (
                <div className="border-t border-[var(--color-border)] pt-3 mt-1">
                  <button
                    type="button"
                    onClick={() => { setCajaRutaCobradorId(c.id); setCajaTab('porruta') }}
                    className="w-full text-[12px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] flex items-center justify-center gap-1 py-2 rounded-[10px] border border-[var(--color-border)]"
                  >
                    Ver caja por ruta de {c.nombre}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )

              return (
                <div key={c.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{c.nombre}</span>
                    {c.cerrado ? (
                      cierre?.reabiertoEn
                        ? <Badge variant="yellow">Reabierta</Badge>
                        : cierre?.solicitudReaperturaEn
                          ? <Badge variant="yellow">Solicitud pendiente</Badge>
                          : <Badge variant="green">Cerrado</Badge>
                    ) : (
                      <Badge variant="yellow">Pendiente cierre</Badge>
                    )}
                  </div>
                  {cierre?.reabiertoEn && (
                    <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                      Reabierta por {cierre.reabiertoPor?.nombre || '—'}
                    </p>
                  )}
                  {!cierre?.reabiertoEn && cierre?.solicitudReaperturaEn && (
                    <div className="mb-2 p-2 rounded-[10px]" style={{ background: 'var(--color-warning-dim)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}>
                      <p className="text-[11px] mb-2" style={{ color: 'var(--color-warning)' }}>
                        {cierre.solicitudReaperturaPor?.nombre || c.nombre} solicita reabrir su caja para seguir cobrando
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => aprobarReapertura(cierre.id)}
                          disabled={procesandoSolicitud === cierre.id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                          style={{ color: '#1a1a2e', background: 'var(--color-success)' }}
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => rechazarReapertura(cierre.id)}
                          disabled={procesandoSolicitud === cierre.id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
                          style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  )}

                  {cierre ? (
                    <>
                      {/* Resumen siempre visible: 2 números grandes */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Entregado</p>
                          <p className="text-lg font-bold font-mono-display text-[var(--color-text-primary)] mt-0.5">{formatMoney(cierre.totalRecogido)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Diferencia</p>
                          <p className="text-lg font-bold font-mono-display mt-0.5" style={{ color: diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {diff >= 0 ? '+' : ''}{formatMoney(diff)}
                          </p>
                        </div>
                      </div>

                      {expandido && (
                        <div className="space-y-3 mt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Esperado</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-text-primary)]">{formatMoney(cierre.totalEsperado)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Gastos</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-danger)]">{formatMoney(cierre.totalGastos || 0)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Prestado hoy</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-warning)]">{cierreDesembolsado > 0 ? '-' : ''}{formatMoney(cierreDesembolsado)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Saldo real</p>
                              <p className="text-sm font-semibold font-mono-display" style={{ color: cierreSaldoReal >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
                                {formatMoney(cierreSaldoReal)}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-2">
                            Cobrado registrado en pagos: <span className="text-[var(--color-success)] font-semibold">{formatMoney(recaudadoDiaCobrador)}</span>
                            {deltaSistemaVsCierre !== 0 && (
                              <span className="ml-2 text-[var(--color-accent)]">
                                (diferencia vs cierre: {deltaSistemaVsCierre > 0 ? '+' : ''}{formatMoney(deltaSistemaVsCierre)})
                              </span>
                            )}
                          </div>

                          {detalleCobrador}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={toggleExpand}
                          className="flex-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center gap-1 py-1"
                        >
                          {expandido ? 'Ocultar detalle' : 'Ver detalle'}
                          <svg className={`w-3 h-3 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => abrirEditCierreCobrador(c, cierre)}
                          className="text-[11px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] py-1 px-2"
                        >
                          Corregir cierre
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {recaudadoDiaCobrador > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Cobrado</p>
                              <p className="text-lg font-bold font-mono-display text-[var(--color-success)] mt-0.5">{formatMoney(recaudadoDiaCobrador)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Sugerido cierre</p>
                              <p className="text-lg font-bold font-mono-display text-[var(--color-accent)] mt-0.5">{formatMoney(sugeridoCierre)}</p>
                            </div>
                          </div>

                          {expandido && (
                            <>
                              <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2 mt-2">
                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Esperado ruta</p>
                                <p className="text-sm font-semibold font-mono-display text-[var(--color-text-primary)]">{formatMoney(esperadoDiaCobrador)}</p>
                              </div>
                              {detalleCobrador}
                            </>
                          )}

                          <p className="text-[11px] text-[var(--color-accent)]">Falta confirmación manual del cobrador para cerrar caja.</p>

                          <button
                            onClick={toggleExpand}
                            className="w-full text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center gap-1 py-1"
                          >
                            {expandido ? 'Ocultar detalle' : 'Ver detalle'}
                            <svg className={`w-3 h-3 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <EmptyState
                          pose="vacia"
                          titulo="Sin pagos registrados"
                          hint="Los pagos aparecerán aquí cuando tus cobradores cobren."
                          size={64}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>
      )}

      </>}

      <ReportarGasto
        open={showGasto}
        onClose={() => setShowGasto(false)}
        onSuccess={fetchData}
        fecha={fechaSeleccionada}
      />

      <Modal
        open={showAjusteCaja}
        onClose={() => {
          setShowAjusteCaja(false)
          setErrorAjuste('')
          setAjusteDireccion('ingreso')
        }}
        title="Ajustar saldo general"
      >
        <form onSubmit={registrarAjusteCaja} className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)] leading-snug">
            Registra un ajuste de saldo como ingreso o egreso para cuadrar el saldo general.
          </p>

          <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
            Este movimiento se registrará con fecha: <span className="text-[var(--color-text-primary)] font-medium">{fmtFecha(fechaSeleccionada)}</span>
          </p>

          {fechaSeleccionada !== hoyColombia && (
            <p className="text-[11px] text-[var(--color-accent)] leading-snug">
              Este movimiento impacta el saldo general acumulado desde el momento en que se registra.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-1.5">
              Tipo de ajuste
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAjusteDireccion('ingreso')}
                className={[
                  'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                  ajusteDireccion === 'ingreso'
                    ? 'bg-[var(--color-success-dim)] border-[color-mix(in_srgb,var(--color-success)_35%,transparent)] text-[var(--color-success)]'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                ].join(' ')}
              >
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setAjusteDireccion('egreso')}
                className={[
                  'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                  ajusteDireccion === 'egreso'
                    ? 'bg-[var(--color-danger-dim)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)]'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                ].join(' ')}
              >
                Egreso
              </button>
            </div>
          </div>

          <MoneyInput
            label="Monto (COP)"
            placeholder="Ej: 85.000"
            value={ajusteMonto}
            onChange={(e) => setAjusteMonto(e.target.value)}
          />

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-1.5">
              Descripción
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Ajuste por sobrante de cierre anterior"
              value={ajusteDescripcion}
              onChange={(e) => setAjusteDescripcion(e.target.value)}
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all resize-none"
            />
          </div>

          {errorAjuste && (
            <p className="text-sm text-[var(--color-danger)]">{errorAjuste}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAjusteCaja(false)
                setErrorAjuste('')
                setAjusteDireccion('ingreso')
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" loading={guardandoAjuste} className="flex-1">
              Guardar movimiento
            </Button>
          </div>
        </form>
      </Modal>

      {/* Owner: corregir cierre de un cobrador */}
      <Modal
        open={!!editCobrador}
        onClose={() => { setEditCobrador(null); setEditError('') }}
        title={`Corregir cierre — ${editCobrador?.nombre ?? ''}`}
      >
        <form onSubmit={guardarEditCierreCobrador} className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)] leading-snug">
            Corrige el total entregado por el cobrador para el día {fmtFecha(fechaSeleccionada)}. Queda registrado quién hizo la corrección.
          </p>
          <MoneyInput
            label="Total entregado"
            value={editMonto}
            onChange={(e) => setEditMonto(e.target.value)}
          />
          {editError && <p className="text-sm text-[var(--color-danger)]">{editError}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setEditCobrador(null); setEditError('') }} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={editGuardando} className="flex-1">
              Guardar corrección
            </Button>
          </div>
        </form>
      </Modal>

      <ReporteDia
        open={showReporte}
        onClose={() => setShowReporte(false)}
        rutasDisponibles={rutasDisponibles}
        fechaInicial={fechaSeleccionada}
      />

      <Modal open={showUpgradeReporte} onClose={() => setShowUpgradeReporte(false)} title="Reporte del dia">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-[12px] mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
            <svg className="w-6 h-6" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
            Esta funcion esta disponible desde el plan <strong>Crecimiento</strong>
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Genera reportes diarios con pagos, pendientes y gastos para imprimir o compartir por WhatsApp.
          </p>
          <a href="/configuracion/plan"
            className="inline-block px-4 py-2 rounded-[10px] text-sm font-semibold transition-colors"
            style={{ background: 'var(--color-accent)', color: '#fff' }}>
            Ver planes
          </a>
        </div>
      </Modal>
    </div>
  )
}
