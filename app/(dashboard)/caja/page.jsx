'use client'
// app/(dashboard)/caja/page.jsx - Caja del día

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
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import ReportarGasto          from '@/components/gastos/ReportarGasto'
import ListaGastos            from '@/components/gastos/ListaGastos'
import ListadoPagos           from '@/components/pagos/ListadoPagos'

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
  const { esCobrador, puedeReportarGastos, puedeVerSaldoCaja, puedeVerCapital, loading: authLoading } = useAuth()
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
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    typeof fechaParam === 'string' && FECHA_REGEX.test(fechaParam)
      ? fechaParam
      : getColombiaDateStr()
  )
  const [modoAjusteCierre, setModoAjusteCierre] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [filtroCobrador, setFiltroCobrador] = useState('')
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    if (typeof fechaParam !== 'string' || !FECHA_REGEX.test(fechaParam)) return
    if (fechaParam === fechaSeleccionada) return
    setFechaSeleccionada(fechaParam)
    setExito(false)
    setModoAjusteCierre(false)
  }, [fechaParam, fechaSeleccionada])

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
        if (cached) { setCajaData(cached); setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
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
        if (cached) { setCajaData(cached); setIsOffline(true); setLoading(false); hasLoadedOnceRef.current = true; return }
      } catch {}
      setError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [fechaSeleccionada])

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
      await fetchData()
    } finally {
      setGuardando(false)
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
          <p className="text-sm font-bold font-mono-display text-[var(--color-success)]">{formatCOP(totalPagosFiltrados)}</p>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Caja del día</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{cajaData?.fechaDisplay || '—'}</p>
          </div>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={handleFechaChange}
            className="px-3 py-2 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
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
              {formatCOP(capitalOrganizacion.total || 0)}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">En caja</p>
                <p className="text-sm font-bold font-mono-display text-[var(--color-success)]">{formatCOP(capitalOrganizacion.saldoCaja || 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">En calle (cartera)</p>
                <p className="text-sm font-bold font-mono-display text-[var(--color-warning)]">{formatCOP(capitalOrganizacion.carteraActiva || 0)}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Saldo principal del cobrador: si tiene verSaldoCaja ve el mismo que el owner,
            si no ve su flujo operativo del día */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                {puedeVerSaldoCaja ? 'Saldo en caja' : 'Flujo del día'}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {puedeVerSaldoCaja ? 'Disponible para prestar ahora' : 'Neto operativo de hoy'}
              </p>
            </div>
            {tasaRecaudo > 0 && (
              <span className="text-sm font-bold" style={{ color: colorRecaudo }}>
                {tasaRecaudo}% cobrado
              </span>
            )}
          </div>
          <p className="text-3xl font-bold font-mono-display" style={{ color: disponibleHoy >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatCOP(disponibleHoy)}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {puedeVerSaldoCaja ? 'Saldo compartido con el administrador' : 'Cobrado - Prestado hoy - Gastos'}
          </p>

          {!esCobrador && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Base inicial</p>
                <p className="text-base font-bold font-mono-display text-[var(--color-info)]">{formatCOP(baseInicialDia)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Ajustes manuales</p>
                <p className="text-base font-bold font-mono-display" style={{ color: ajustesDelDia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {ajustesDelDia > 0 ? '+' : ''}{formatCOP(ajustesDelDia)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Cobrado</p>
              <p className="text-base font-bold font-mono-display text-[var(--color-success)]">{formatCOP(cobradoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Prestado hoy</p>
              <p className="text-base font-bold font-mono-display text-[var(--color-warning)]">{prestadoHoy > 0 ? '-' : ''}{formatCOP(prestadoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Gastos</p>
              <p className="text-base font-bold font-mono-display text-[var(--color-danger)]">{gastosHoy > 0 ? '-' : ''}{formatCOP(gastosHoy)}</p>
            </div>
          </div>

          <details className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <summary className="cursor-pointer text-[11px] text-[var(--color-text-muted)]">Ver detalle del cálculo</summary>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Saldo operativo del día</span>
                <span className="font-semibold" style={{ color: saldoRealCaja >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>{formatCOP(saldoRealCaja)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Esperado</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{formatCOP(stats.esperado || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Diferencia vs esperado</span>
                <span className="font-semibold" style={{ color: diferenciaRecaudo >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {diferenciaRecaudo >= 0 ? '+' : ''}{formatCOP(diferenciaRecaudo)}
                </span>
              </div>
            </div>
          </details>
        </Card>

        {pagosDiaCard}

        {/* Cierre */}
        {cierreHoy && !modoAjusteCierre ? (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Cierre registrado</p>
              <Badge variant="green">Cerrado</Badge>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Esperado', value: formatCOP(cierreHoy.totalEsperado), color: 'text-[var(--color-text-primary)]' },
                { label: 'Entregado', value: formatCOP(cierreHoy.totalRecogido), color: 'text-[var(--color-text-primary)]' },
                { label: 'Gastos', value: formatCOP(cierreHoy.totalGastos || 0), color: 'text-[var(--color-danger)]' },
                { label: 'Prestado hoy', value: `${cierreDesembolsado > 0 ? '-' : ''}${formatCOP(cierreDesembolsado)}`, color: 'text-[var(--color-warning)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className={`font-medium ${color}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[var(--color-border)] pt-2 mt-2">
                <span className="text-[var(--color-text-muted)]">Diferencia</span>
                <span style={{ color: diferencia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {diferencia >= 0 ? '+' : ''}{formatCOP(diferencia)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-[var(--color-text-muted)]">Saldo del día</span>
                <span style={{ color: cierreSaldoReal >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
                  {formatCOP(cierreSaldoReal)}
                </span>
              </div>
            </div>

            {esAyer && !modoAjusteCierre && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
                <p className="text-[11px] text-[var(--color-accent)] leading-snug">
                  Si olvidaste confirmar o corregir el monto ayer, puedes ajustarlo hoy.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModoAjusteCierre(true)
                    setTotalRecogido(String(Math.round(cierreHoy.totalRecogido || recaudadoRegistrado)))
                  }}
                  className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                >
                  Ajustar cierre de este día
                </button>
              </div>
            )}
          </Card>
        ) : mostrarFormularioCierre ? (
          <Card>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-4">
              {modoAjusteCierre
                ? 'Ajustar cierre'
                : (esAyer ? 'Registrar cierre pendiente (ayer)' : 'Registrar cierre del día')}
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
                Estás cerrando el día anterior. Este ajuste evita que se pierda la gestión del cobrador.
              </p>
            )}
            <form onSubmit={registrarCierre} className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">{esAyer ? 'Total esperado (ayer)' : 'Total esperado hoy'}</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{formatCOP(stats.esperado || 0)}</span>
              </div>
              <div className="rounded-[12px] px-3 py-2.5 space-y-2" style={{ background: 'var(--color-warning-dim)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
                <p className="text-[11px] text-[var(--color-accent)] leading-snug">
                  Importante: el cierre de caja no registra pagos ni descuenta saldo de préstamos.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--color-text-secondary)]">Cobrado ya registrado en sistema</span>
                  <button
                    type="button"
                    onClick={() => setTotalRecogido(String(recaudadoRegistrado))}
                    className="text-[11px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
                  >
                    Usar {formatCOP(recaudadoRegistrado)}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--color-text-muted)]">Dinero que vas a entregar (COP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Ej: 250000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all"
                />
              </div>
              {totalRecogido !== '' && Number(totalRecogido) !== recaudadoRegistrado && (
                <p className="text-[11px] text-[var(--color-accent)]">
                  Este valor no coincide con el cobrado registrado en pagos ({formatCOP(recaudadoRegistrado)}).
                </p>
              )}
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[var(--color-text-muted)]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= (stats.esperado || 0) ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                    {Number(totalRecogido) >= (stats.esperado || 0) ? '+' : ''}{formatCOP(Number(totalRecogido) - (stats.esperado || 0))}
                  </span>
                </div>
              )}
              <Button type="submit" loading={guardando} className="w-full">
                {modoAjusteCierre ? 'Guardar ajuste de cierre' : 'Registrar cierre de caja'}
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
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{cajaData?.fechaDisplay || '—'}</p>
        </div>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={handleFechaChange}
          className="px-3 py-2 rounded-[8px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
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
      {exitoAjuste && (
        <div className="bg-[var(--color-success-dim)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] text-[var(--color-success)] text-sm rounded-[12px] px-4 py-3">
          Ajuste de saldo general registrado correctamente.
        </div>
      )}

      {/* HERO CARD: Saldo en caja del dia */}
      {(() => {
        const heroColor = disponibleHoy >= 0 ? '#22c55e' : '#ef4444'
        return (
          <div
            className="relative rounded-[20px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--color-bg-card)) 100%)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
              boxShadow: `0 8px 32px color-mix(in srgb, ${heroColor} 18%, transparent)`,
            }}
          >
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor, boxShadow: `0 0 12px ${heroColor}` }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>
                  Saldo en caja
                </p>
                {tasaRecaudo > 0 && (
                  <span className="ml-auto text-[11px] font-bold" style={{ color: colorRecaudo }}>{tasaRecaudo}% cobrado</span>
                )}
              </div>

              <p
                className="font-mono-display font-bold leading-none tracking-tight"
                style={{
                  color: heroColor,
                  fontSize: 'clamp(32px, 9vw, 44px)',
                  textShadow: `0 0 30px color-mix(in srgb, ${heroColor} 25%, transparent)`,
                }}
              >
                {formatCOP(disponibleHoy)}
              </p>
              <p className="text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Base inicial + Cobrado − Prestado − Gastos + Ajustes
              </p>

              {/* Mini-stats: cobrado / prestado / gastos */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4" style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 15%, transparent)` }}>
                <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'color-mix(in srgb, var(--color-success) 10%, transparent)' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Cobrado</p>
                  <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-success)' }}>{formatCOP(cobradoHoy)}</p>
                </div>
                <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Prestado</p>
                  <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-warning)' }}>{prestadoHoy > 0 ? '-' : ''}{formatCOP(prestadoHoy)}</p>
                </div>
                <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Gastos</p>
                  <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-danger)' }}>{gastosHoy > 0 ? '-' : ''}{formatCOP(gastosHoy)}</p>
                </div>
              </div>

              {!esCobrador && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'color-mix(in srgb, var(--color-info) 10%, transparent)' }}>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Base inicial</p>
                    <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: 'var(--color-info)' }}>{formatCOP(baseInicialDia)}</p>
                  </div>
                  <div className="rounded-[10px] px-2.5 py-2" style={{ background: 'var(--color-bg-hover)' }}>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Ajustes</p>
                    <p className="text-[14px] font-bold font-mono-display mt-0.5" style={{ color: ajustesDelDia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {ajustesDelDia > 0 ? '+' : ''}{formatCOP(ajustesDelDia)}
                    </p>
                  </div>
                </div>
              )}

              <details className="mt-3 pt-3" style={{ borderTop: `1px solid color-mix(in srgb, ${heroColor} 15%, transparent)` }}>
                <summary className="cursor-pointer text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Ver detalle del cálculo</summary>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Saldo operativo del día</span>
                    <span className="font-semibold font-mono-display" style={{ color: saldoRealCaja >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>{formatCOP(saldoRealCaja)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Esperado</span>
                    <span className="font-semibold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatCOP(stats.esperado || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Diferencia vs esperado</span>
                    <span className="font-semibold font-mono-display" style={{ color: diferenciaRecaudo >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {diferenciaRecaudo >= 0 ? '+' : ''}{formatCOP(diferenciaRecaudo)}
                    </span>
                  </div>
                  {ajustesDelDia !== 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-muted)' }}>Ajustes manuales del día</span>
                      <span className="font-semibold font-mono-display" style={{ color: ajustesDelDia >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {ajustesDelDia >= 0 ? '+' : ''}{formatCOP(ajustesDelDia)}
                      </span>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        )
      })()}

      {pagosDiaCard}

      <Card>
        <div className="mb-2">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Saldo general</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">Saldo histórico acumulado del negocio</p>
        </div>
        <p className="text-2xl font-bold font-mono-display" style={{ color: saldoGeneralActual >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {formatCOP(saldoGeneralActual)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Para detalle completo de movimientos, revisa Capital.</p>

        <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowAjusteCaja(true)
              setErrorAjuste('')
              setAjusteDireccion('ingreso')
            }}
            className="w-full h-10 rounded-[10px] text-sm font-semibold text-[#1a1a2e] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Ajustar saldo general
          </button>
          <Link href="/capital?view=manual-movements" className="block text-center text-xs font-medium text-[var(--color-info)] hover:underline">
            Ver más movimientos en Capital
          </Link>
        </div>
      </Card>

      {/* Cobradores */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Cobradores
          </p>
          {cobradoresTotal > 0 && (
            <span className="text-xs text-[var(--color-text-muted)]">
              <span className="font-bold" style={{ color: cobradoresCerrados === cobradoresTotal ? 'var(--color-success)' : 'var(--color-accent)' }}>
                {cobradoresCerrados}/{cobradoresTotal}
              </span> cerraron
            </span>
          )}
        </div>

        {cobradoresTotal > 0 && (
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
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
            No hay cobradores activos
          </p>
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

              return (
                <div key={c.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] p-3">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{c.nombre}</span>
                    {c.cerrado ? (
                      <Badge variant="green">Cerrado</Badge>
                    ) : (
                      <Badge variant="yellow">Pendiente cierre</Badge>
                    )}
                  </div>

                  {cierre ? (
                    <>
                      {/* Resumen siempre visible: 2 números grandes */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Entregado</p>
                          <p className="text-lg font-bold font-mono-display text-[var(--color-text-primary)] mt-0.5">{formatCOP(cierre.totalRecogido)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Diferencia</p>
                          <p className="text-lg font-bold font-mono-display mt-0.5" style={{ color: diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {diff >= 0 ? '+' : ''}{formatCOP(diff)}
                          </p>
                        </div>
                      </div>

                      {expandido && (
                        <div className="space-y-3 mt-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Esperado</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-text-primary)]">{formatCOP(cierre.totalEsperado)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Gastos</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-danger)]">{formatCOP(cierre.totalGastos || 0)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Prestado hoy</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-warning)]">{cierreDesembolsado > 0 ? '-' : ''}{formatCOP(cierreDesembolsado)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Saldo real</p>
                              <p className="text-sm font-semibold font-mono-display" style={{ color: cierreSaldoReal >= 0 ? 'var(--color-info)' : 'var(--color-danger)' }}>
                                {formatCOP(cierreSaldoReal)}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-2">
                            Cobrado registrado en pagos: <span className="text-[var(--color-success)] font-semibold">{formatCOP(recaudadoDiaCobrador)}</span>
                            {deltaSistemaVsCierre !== 0 && (
                              <span className="ml-2 text-[var(--color-accent)]">
                                (diferencia vs cierre: {deltaSistemaVsCierre > 0 ? '+' : ''}{formatCOP(deltaSistemaVsCierre)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={toggleExpand}
                        className="w-full mt-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center gap-1 py-1"
                      >
                        {expandido ? 'Ocultar detalle' : 'Ver detalle'}
                        <svg className={`w-3 h-3 transition-transform ${expandido ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {recaudadoDiaCobrador > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Cobrado</p>
                              <p className="text-lg font-bold font-mono-display text-[var(--color-success)] mt-0.5">{formatCOP(recaudadoDiaCobrador)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2.5">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Sugerido cierre</p>
                              <p className="text-lg font-bold font-mono-display text-[var(--color-accent)] mt-0.5">{formatCOP(sugeridoCierre)}</p>
                            </div>
                          </div>

                          {expandido && (
                            <div className="rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-2 mt-2">
                              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Esperado ruta</p>
                              <p className="text-sm font-semibold font-mono-display text-[var(--color-text-primary)]">{formatCOP(esperadoDiaCobrador)}</p>
                            </div>
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
                        <p className="text-sm text-[var(--color-text-muted)]">Sin pagos registrados y sin cierre reportado hoy.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Gastos Menores */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Gastos menores
          </p>
          <div className="flex items-center gap-2">
            {gastosPendientes > 0 && (
              <Badge variant="yellow">{gastosPendientes} pendientes</Badge>
            )}
            <button
              onClick={() => setShowGasto(true)}
              className="p-1.5 rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all"
              title="Reportar gasto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
        <ListaGastos soloPendientes={false} fecha={fechaSeleccionada} onCountChange={setGastosPendientes} />
      </Card>

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

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em] mb-1.5">
              Monto (COP)
            </label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="Ej: 85000"
              value={ajusteMonto}
              onChange={(e) => setAjusteMonto(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] transition-all"
            />
          </div>

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
    </div>
  )
}
