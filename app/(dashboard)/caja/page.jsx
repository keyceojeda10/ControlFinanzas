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
  const { esCobrador, puedeReportarGastos, loading: authLoading } = useAuth()
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
  const [exitoAjuste, setExitoAjuste] = useState(false)
  const [gastosPendientes, setGastosPendientes] = useState(0)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    typeof fechaParam === 'string' && FECHA_REGEX.test(fechaParam)
      ? fechaParam
      : getColombiaDateStr()
  )
  const [modoAjusteCierre, setModoAjusteCierre] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
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
  const cierres = cajaData?.cierres || []
  const cobradores = cajaData?.cobradores || []
  const disponibleOperativo = stats.disponibleOperativo ?? ((stats.recogida || 0) - (stats.gastos || 0))
  const desembolsadoDia = stats.desembolsadoDia || 0
  const saldoRealCaja = stats.saldoRealCajaConAjustes ?? stats.saldoRealCaja ?? (disponibleOperativo - desembolsadoDia)
  const cobradoHoy = Math.round(stats.cobradoHoy ?? stats.recogida ?? 0)
  const prestadoHoy = Math.round(stats.prestadoHoy ?? desembolsadoDia)
  const gastosHoy = Math.round(stats.gastos || 0)
  const disponibleHoy = Math.round(stats.disponibleHoy ?? saldoRealCaja)
  const diferenciaRecaudo = cobradoHoy - Math.round(stats.esperado || 0)
  const ajustesDelDia = Math.round(stats.ajustesManualDia || 0)
  const saldoGeneralActual = cajaGeneral.saldoActual ?? 0
  const tasaRecaudo = stats.tasaRecaudo || 0
  const colorRecaudo = tasaRecaudo >= 80 ? '#22c55e' : tasaRecaudo >= 50 ? '#f5c518' : '#ef4444'
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

  const pagosDiaCard = (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Pagos del día</p>
          <p className="text-[11px] text-[#666666]">{cantidadPagosDia} registro{cantidadPagosDia === 1 ? '' : 's'}</p>
        </div>
        <p className="text-sm font-bold font-mono-display text-[#22c55e]">{formatCOP(totalPagosDia)}</p>
      </div>

      {pagosDelDia.length === 0 ? (
        <p className="text-sm text-[#888888] text-center py-2">No hay pagos registrados en esta fecha.</p>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {pagosDelDia.map((pago) => (
            <div key={pago.id} className="rounded-[10px] border border-[#2a2a2a] bg-[#111111] px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{pago.clienteNombre || 'Cliente'}</p>
                  <p className="text-[11px] text-[#888888] mt-0.5">
                    {fmtHora(pago.fechaPago)}
                    {!esCobrador && pago.cobradorNombre ? ` · ${pago.cobradorNombre}` : ''}
                    {` · ${getMetodoPagoLabel(pago)}`}
                  </p>
                </div>
                <p className="text-sm font-bold font-mono-display text-[#22c55e]">{formatCOP(pago.montoPagado || 0)}</p>
              </div>
              {pago.prestamoId && (
                <Link href={`/prestamos/${pago.prestamoId}`} className="inline-block mt-1 text-[11px] text-[#06b6d4] hover:underline">
                  Ver préstamo
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
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
            <h1 className="text-xl font-bold text-white">Caja del día</h1>
            <p className="text-sm text-[#888888] mt-0.5">{cajaData?.fechaDisplay || '—'}</p>
          </div>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={handleFechaChange}
            className="px-3 py-2 rounded-[8px] bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white"
          />
        </div>

        {isOffline && (
          <div className="bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse shrink-0" />
            Datos guardados — sin conexión
          </div>
        )}
        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Resumen operativo del día */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Caja operativa de hoy</p>
              <p className="text-[11px] text-[#666666]">Disponible hoy</p>
            </div>
            {tasaRecaudo > 0 && (
              <span className="text-sm font-bold" style={{ color: colorRecaudo }}>
                {tasaRecaudo}% cobrado
              </span>
            )}
          </div>
          <p className="text-3xl font-bold font-mono-display" style={{ color: disponibleHoy >= 0 ? '#22c55e' : '#ef4444' }}>
            {formatCOP(disponibleHoy)}
          </p>
          <p className="text-[11px] text-[#888888] mt-1">Cobrado - Prestado hoy - Gastos</p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Cobrado</p>
              <p className="text-base font-bold font-mono-display text-[#22c55e]">{formatCOP(cobradoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Prestado hoy</p>
              <p className="text-base font-bold font-mono-display text-[#f59e0b]">{prestadoHoy > 0 ? '-' : ''}{formatCOP(prestadoHoy)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Gastos</p>
              <p className="text-base font-bold font-mono-display text-[#ef4444]">{gastosHoy > 0 ? '-' : ''}{formatCOP(gastosHoy)}</p>
            </div>
          </div>

          <details className="mt-3 pt-3 border-t border-[#2a2a2a]">
            <summary className="cursor-pointer text-[11px] text-[#888888]">Ver detalle del cálculo</summary>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#888888]">Saldo del día</span>
                <span className="font-semibold" style={{ color: saldoRealCaja >= 0 ? '#06b6d4' : '#ef4444' }}>{formatCOP(saldoRealCaja)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">Esperado</span>
                <span className="font-semibold text-white">{formatCOP(stats.esperado || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">Diferencia vs esperado</span>
                <span className="font-semibold" style={{ color: diferenciaRecaudo >= 0 ? '#22c55e' : '#ef4444' }}>
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
              <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Cierre registrado</p>
              <Badge variant="green">Cerrado</Badge>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Esperado', value: formatCOP(cierreHoy.totalEsperado), color: 'text-white' },
                { label: 'Entregado', value: formatCOP(cierreHoy.totalRecogido), color: 'text-white' },
                { label: 'Gastos', value: formatCOP(cierreHoy.totalGastos || 0), color: 'text-[#ef4444]' },
                { label: 'Prestado hoy', value: `${cierreDesembolsado > 0 ? '-' : ''}${formatCOP(cierreDesembolsado)}`, color: 'text-[#f59e0b]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#888888]">{label}</span>
                  <span className={`font-medium ${color}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
                <span className="text-[#888888]">Diferencia</span>
                <span style={{ color: diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                  {diferencia >= 0 ? '+' : ''}{formatCOP(diferencia)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-[#888888]">Saldo del día</span>
                <span style={{ color: cierreSaldoReal >= 0 ? '#06b6d4' : '#ef4444' }}>
                  {formatCOP(cierreSaldoReal)}
                </span>
              </div>
            </div>

            {esAyer && !modoAjusteCierre && (
              <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-2">
                <p className="text-[11px] text-[#f5c518] leading-snug">
                  Si olvidaste confirmar o corregir el monto ayer, puedes ajustarlo hoy.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModoAjusteCierre(true)
                    setTotalRecogido(String(Math.round(cierreHoy.totalRecogido || recaudadoRegistrado)))
                  }}
                  className="text-xs font-semibold text-[#f5c518] hover:text-[#ffe07a] transition-colors"
                >
                  Ajustar cierre de este día
                </button>
              </div>
            )}
          </Card>
        ) : mostrarFormularioCierre ? (
          <Card>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
              {modoAjusteCierre
                ? 'Ajustar cierre'
                : (esAyer ? 'Registrar cierre pendiente (ayer)' : 'Registrar cierre del día')}
            </p>
            {exito && (
              <div className="mb-4 flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[#22c55e] text-sm rounded-[12px] px-4 py-3">
                Cierre guardado exitosamente
              </div>
            )}
            {errorCaja && (
              <div className="mb-4 flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
                {errorCaja}
              </div>
            )}
            {esAyer && (
              <p className="mb-3 text-[11px] text-[#f5c518] leading-snug">
                Estás cerrando el día anterior. Este ajuste evita que se pierda la gestión del cobrador.
              </p>
            )}
            <form onSubmit={registrarCierre} className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#888888]">{esAyer ? 'Total esperado (ayer)' : 'Total esperado hoy'}</span>
                <span className="font-semibold text-white">{formatCOP(stats.esperado || 0)}</span>
              </div>
              <div className="rounded-[12px] border border-[rgba(245,197,24,0.25)] bg-[rgba(245,197,24,0.08)] px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-[#f5c518] leading-snug">
                  Importante: el cierre de caja no registra pagos ni descuenta saldo de préstamos.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#b8b8b8]">Cobrado ya registrado en sistema</span>
                  <button
                    type="button"
                    onClick={() => setTotalRecogido(String(recaudadoRegistrado))}
                    className="text-[11px] font-semibold text-[#f5c518] hover:text-[#ffe07a] transition-colors"
                  >
                    Usar {formatCOP(recaudadoRegistrado)}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#888888]">Dinero que vas a entregar (COP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Ej: 250000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
                />
              </div>
              {totalRecogido !== '' && Number(totalRecogido) !== recaudadoRegistrado && (
                <p className="text-[11px] text-[#f5c518]">
                  Este valor no coincide con el cobrado registrado en pagos ({formatCOP(recaudadoRegistrado)}).
                </p>
              )}
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[#888888]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= (stats.esperado || 0) ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
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
              <p className="text-sm text-[#888888]">
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
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-sm font-medium text-[#888888] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#222222]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reportar gasto menor
          </button>
          {!puedeReportarGastoCobrador && (
            <p className="text-[11px] text-[#888888] leading-snug">
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
          <h1 className="text-xl font-bold text-white">Caja</h1>
          <p className="text-sm text-[#888888] mt-0.5">{cajaData?.fechaDisplay || '—'}</p>
        </div>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={handleFechaChange}
          className="px-3 py-2 rounded-[8px] bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white"
        />
      </div>

      {isOffline && (
        <div className="bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-[#f5c518] text-xs rounded-[12px] px-4 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f5c518] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}
      {exitoAjuste && (
        <div className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[#22c55e] text-sm rounded-[12px] px-4 py-3">
          Ajuste de saldo general registrado correctamente.
        </div>
      )}

      {/* Resumen operativo del día */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Caja operativa de hoy</p>
            <p className="text-[11px] text-[#666666]">Disponible hoy</p>
          </div>
          {tasaRecaudo > 0 && (
            <span className="text-sm font-bold" style={{ color: colorRecaudo }}>
              {tasaRecaudo}% cobrado
            </span>
          )}
        </div>
        <p className="text-3xl font-bold font-mono-display" style={{ color: disponibleHoy >= 0 ? '#22c55e' : '#ef4444' }}>
          {formatCOP(disponibleHoy)}
        </p>
        <p className="text-[11px] text-[#888888] mt-1">Cobrado - Prestado hoy - Gastos</p>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Cobrado</p>
            <p className="text-base font-bold font-mono-display text-[#22c55e]">{formatCOP(cobradoHoy)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Prestado hoy</p>
            <p className="text-base font-bold font-mono-display text-[#f59e0b]">{prestadoHoy > 0 ? '-' : ''}{formatCOP(prestadoHoy)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Gastos</p>
            <p className="text-base font-bold font-mono-display text-[#ef4444]">{gastosHoy > 0 ? '-' : ''}{formatCOP(gastosHoy)}</p>
          </div>
        </div>

        <details className="mt-3 pt-3 border-t border-[#2a2a2a]">
          <summary className="cursor-pointer text-[11px] text-[#888888]">Ver detalle del cálculo</summary>
          <div className="mt-2 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#888888]">Saldo del día</span>
              <span className="font-semibold" style={{ color: saldoRealCaja >= 0 ? '#06b6d4' : '#ef4444' }}>{formatCOP(saldoRealCaja)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888888]">Esperado</span>
              <span className="font-semibold text-white">{formatCOP(stats.esperado || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#888888]">Diferencia vs esperado</span>
              <span className="font-semibold" style={{ color: diferenciaRecaudo >= 0 ? '#22c55e' : '#ef4444' }}>
                {diferenciaRecaudo >= 0 ? '+' : ''}{formatCOP(diferenciaRecaudo)}
              </span>
            </div>
            {ajustesDelDia !== 0 && (
              <div className="flex justify-between">
                <span className="text-[#888888]">Ajustes manuales del día</span>
                <span className="font-semibold" style={{ color: ajustesDelDia >= 0 ? '#22c55e' : '#ef4444' }}>
                  {ajustesDelDia >= 0 ? '+' : ''}{formatCOP(ajustesDelDia)}
                </span>
              </div>
            )}
          </div>
        </details>
      </Card>

      {pagosDiaCard}

      <Card>
        <div className="mb-2">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Saldo general</p>
          <p className="text-[11px] text-[#666666]">Saldo histórico acumulado del negocio</p>
        </div>
        <p className="text-2xl font-bold font-mono-display" style={{ color: saldoGeneralActual >= 0 ? '#22c55e' : '#ef4444' }}>
          {formatCOP(saldoGeneralActual)}
        </p>
        <p className="text-[11px] text-[#888888] mt-1">Para detalle completo de movimientos, revisa Capital.</p>

        <div className="mt-4 pt-3 border-t border-[#2a2a2a] space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowAjusteCaja(true)
              setErrorAjuste('')
              setAjusteDireccion('ingreso')
            }}
            className="w-full h-10 rounded-[10px] text-sm font-semibold text-[#0a0a0a] bg-[#f5c518] hover:bg-[#f0b800] transition-colors"
          >
            Ajustar saldo general
          </button>
          <Link href="/capital?view=manual-movements" className="block text-center text-xs font-medium text-[#06b6d4] hover:underline">
            Ver más movimientos en Capital
          </Link>
        </div>
      </Card>

      {/* Cobradores */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
            Cobradores
          </p>
          {cobradoresTotal > 0 && (
            <span className="text-xs text-[#888888]">
              <span className="font-bold" style={{ color: cobradoresCerrados === cobradoresTotal ? '#22c55e' : '#f5c518' }}>
                {cobradoresCerrados}/{cobradoresTotal}
              </span> cerraron
            </span>
          )}
        </div>

        {cobradoresTotal > 0 && (
          <div className="mb-3 text-[11px] space-y-1">
            {pendientesConRecaudo > 0 && (
              <p className="text-[#f5c518]">
                {pendientesConRecaudo} cobrador{pendientesConRecaudo === 1 ? '' : 'es'} con cobrado registrado pendiente de cierre.
              </p>
            )}
            {pendientesSinMovimiento > 0 && (
              <p className="text-[#666666]">
                {pendientesSinMovimiento} cobrador{pendientesSinMovimiento === 1 ? '' : 'es'} sin pagos ni cierre hoy.
              </p>
            )}
          </div>
        )}

        {cobradoresTotal === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">
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

              return (
                <div key={c.id} className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-white">{c.nombre}</span>
                    {c.cerrado ? (
                      <Badge variant="green">Cerrado</Badge>
                    ) : (
                      <Badge variant="yellow">Pendiente cierre</Badge>
                    )}
                  </div>
                  {cierre ? (
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Esperado</p>
                          <p className="text-sm font-semibold font-mono-display text-white">{formatCOP(cierre.totalEsperado)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Entregado</p>
                          <p className="text-sm font-semibold font-mono-display text-white">{formatCOP(cierre.totalRecogido)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Gastos</p>
                          <p className="text-sm font-semibold font-mono-display text-[#ef4444]">{formatCOP(cierre.totalGastos || 0)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Prestado hoy</p>
                          <p className="text-sm font-semibold font-mono-display text-[#f59e0b]">{cierreDesembolsado > 0 ? '-' : ''}{formatCOP(cierreDesembolsado)}</p>
                        </div>
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Saldo real</p>
                          <p className="text-sm font-semibold font-mono-display" style={{ color: cierreSaldoReal >= 0 ? '#06b6d4' : '#ef4444' }}>
                            {formatCOP(cierreSaldoReal)}
                          </p>
                        </div>
                        <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                          <p className="text-[10px] text-[#888888] uppercase tracking-wide">Diferencia</p>
                          <p className="text-sm font-bold font-mono-display" style={{ color: diff >= 0 ? '#22c55e' : '#ef4444' }}>
                            {diff >= 0 ? '+' : ''}{formatCOP(diff)}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-[#777777] border-t border-[#222222] pt-2">
                        Cobrado registrado en pagos: <span className="text-[#22c55e] font-semibold">{formatCOP(recaudadoDiaCobrador)}</span>
                        {deltaSistemaVsCierre !== 0 && (
                          <span className="ml-2 text-[#f5c518]">
                            (diferencia vs cierre: {deltaSistemaVsCierre > 0 ? '+' : ''}{formatCOP(deltaSistemaVsCierre)})
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {recaudadoDiaCobrador > 0 ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                              <p className="text-[10px] text-[#888888] uppercase tracking-wide">Esperado ruta</p>
                              <p className="text-sm font-semibold font-mono-display text-white">{formatCOP(esperadoDiaCobrador)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                              <p className="text-[10px] text-[#888888] uppercase tracking-wide">Cobrado en pagos</p>
                              <p className="text-sm font-semibold font-mono-display text-[#22c55e]">{formatCOP(recaudadoDiaCobrador)}</p>
                            </div>
                            <div className="rounded-[10px] bg-[#171717] border border-[#262626] p-2">
                              <p className="text-[10px] text-[#888888] uppercase tracking-wide">Sugerido cierre</p>
                              <p className="text-sm font-semibold font-mono-display text-[#f5c518]">{formatCOP(sugeridoCierre)}</p>
                            </div>
                          </div>
                          <p className="text-[11px] text-[#f5c518]">Falta confirmación manual del cobrador para cerrar caja.</p>
                        </>
                      ) : (
                        <p className="text-sm text-[#555555]">Sin pagos registrados y sin cierre reportado hoy.</p>
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
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
            Gastos menores
          </p>
          <div className="flex items-center gap-2">
            {gastosPendientes > 0 && (
              <Badge variant="yellow">{gastosPendientes} pendientes</Badge>
            )}
            <button
              onClick={() => setShowGasto(true)}
              className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#f5c518] hover:bg-[rgba(245,197,24,0.1)] transition-all"
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
          <p className="text-xs text-[#888888] leading-snug">
            Registra un ajuste de saldo como ingreso o egreso para cuadrar el saldo general.
          </p>

          <p className="text-[11px] text-[#b8b8b8] leading-snug">
            Este movimiento se registrará con fecha: <span className="text-white font-medium">{fmtFecha(fechaSeleccionada)}</span>
          </p>

          {fechaSeleccionada !== hoyColombia && (
            <p className="text-[11px] text-[#f5c518] leading-snug">
              Este movimiento impacta el saldo general acumulado desde el momento en que se registra.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
              Tipo de ajuste
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAjusteDireccion('ingreso')}
                className={[
                  'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                  ajusteDireccion === 'ingreso'
                    ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.35)] text-[#22c55e]'
                    : 'bg-[#111111] border-[#2a2a2a] text-[#888888]',
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
                    ? 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.35)] text-[#ef4444]'
                    : 'bg-[#111111] border-[#2a2a2a] text-[#888888]',
                ].join(' ')}
              >
                Egreso
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
              Monto (COP)
            </label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              placeholder="Ej: 85000"
              value={ajusteMonto}
              onChange={(e) => setAjusteMonto(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em] mb-1.5">
              Descripción
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Ajuste por sobrante de cierre anterior"
              value={ajusteDescripcion}
              onChange={(e) => setAjusteDescripcion(e.target.value)}
              className="w-full rounded-[12px] border border-[#2a2a2a] bg-[#111111] px-3 py-2.5 text-sm text-white placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all resize-none"
            />
          </div>

          {errorAjuste && (
            <p className="text-sm text-[#ef4444]">{errorAjuste}</p>
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
