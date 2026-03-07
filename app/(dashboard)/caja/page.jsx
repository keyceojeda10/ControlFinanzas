'use client'
// app/(dashboard)/caja/page.jsx - Caja del día

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }              from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import ReportarGasto          from '@/components/gastos/ReportarGasto'
import ListaGastos            from '@/components/gastos/ListaGastos'

const fmtFecha = (d) => {
  if (!d) return '—'
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

const getColombiaDateStr = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// Barra de progreso visual
function ProgressBar({ value, max, color = '#22c55e' }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

export default function CajaPage() {
  const { session, esOwner, esCobrador, loading: authLoading } = useAuth()

  const [cajaData, setCajaData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorCaja, setErrorCaja] = useState('')
  const [exito, setExito] = useState(false)
  const [showGasto, setShowGasto] = useState(false)
  const [gastosPendientes, setGastosPendientes] = useState(0)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(getColombiaDateStr())

  const esHoy = fechaSeleccionada === getColombiaDateStr()

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/caja?fecha=${fechaSeleccionada}`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setCajaData(data)
      }
    } catch {
      setError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) fetchData()
  }, [authLoading, fechaSeleccionada])

  const handleFechaChange = (e) => {
    setFechaSeleccionada(e.target.value)
    setExito(false)
  }

  const registrarCierre = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrorCaja('')
    try {
      const res = await fetch('/api/caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalRecogido: Number(totalRecogido) }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al registrar'); return }
      setExito(true)
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
  const cierres = cajaData?.cierres || []
  const cobradores = cajaData?.cobradores || []
  const disponible = (stats.recogida || 0) - (stats.gastos || 0)
  const tasaRecaudo = stats.tasaRecaudo || 0
  const colorRecaudo = tasaRecaudo >= 80 ? '#22c55e' : tasaRecaudo >= 50 ? '#f5c518' : '#ef4444'

  // ── VISTA DEL COBRADOR ────────────────────────────────────────
  if (esCobrador) {
    const cierreHoy = cierres[0]
    const diferencia = cierreHoy ? cierreHoy.totalRecogido - cierreHoy.totalEsperado : null

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

        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Resumen de recaudo */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Recaudo del día</p>
            {tasaRecaudo > 0 && (
              <span className="text-sm font-bold" style={{ color: colorRecaudo }}>
                {tasaRecaudo}%
              </span>
            )}
          </div>
          <ProgressBar value={stats.recogida || 0} max={stats.esperado || 1} color={colorRecaudo} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Esperado</p>
              <p className="text-lg font-bold text-white">{formatCOP(stats.esperado || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Recaudado</p>
              <p className="text-lg font-bold text-[#22c55e]">{formatCOP(stats.recogida || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888] uppercase">Gastos</p>
              <p className="text-lg font-bold text-[#ef4444]">{stats.gastos > 0 ? '-' : ''}{formatCOP(stats.gastos || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#f5c518] uppercase font-semibold">Disponible</p>
              <p className="text-lg font-bold text-[#f5c518]">{formatCOP(disponible)}</p>
            </div>
          </div>
        </Card>

        {/* Cierre */}
        {cierreHoy ? (
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
            </div>
          </Card>
        ) : esHoy ? (
          <Card>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
              Registrar cierre del día
            </p>
            {exito && (
              <div className="mb-4 flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[#22c55e] text-sm rounded-[12px] px-4 py-3">
                Cierre registrado exitosamente
              </div>
            )}
            {errorCaja && (
              <div className="mb-4 flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
                {errorCaja}
              </div>
            )}
            <form onSubmit={registrarCierre} className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#888888]">Total esperado hoy</span>
                <span className="font-semibold text-white">{formatCOP(stats.esperado || 0)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#888888]">Dinero que vas a entregar (COP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej: 250000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#777777] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
                />
              </div>
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[#888888]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= (stats.esperado || 0) ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {Number(totalRecogido) >= (stats.esperado || 0) ? '+' : ''}{formatCOP(Number(totalRecogido) - (stats.esperado || 0))}
                  </span>
                </div>
              )}
              <Button type="submit" loading={guardando} className="w-full">
                Registrar cierre de caja
              </Button>
            </form>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-4">
              <p className="text-sm text-[#888888]">No se registró cierre este día</p>
            </div>
          </Card>
        )}

        {/* Gastos */}
        {esHoy && (
          <button
            onClick={() => setShowGasto(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] border border-[#2a2a2a] bg-[#1a1a1a] text-sm font-medium text-[#888888] hover:bg-[#222222] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reportar gasto menor
          </button>
        )}

        <ReportarGasto
          open={showGasto}
          onClose={() => setShowGasto(false)}
          onSuccess={fetchData}
        />
      </div>
    )
  }

  // ── VISTA DEL OWNER ───────────────────────────────────────────
  const cobradoresCerrados = cobradores.filter(c => c.cerrado).length
  const cobradoresTotal = cobradores.length

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

      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      {/* Resumen del día */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Resumen del día</p>
          {tasaRecaudo > 0 && (
            <span className="text-sm font-bold" style={{ color: colorRecaudo }}>
              {tasaRecaudo}% recaudo
            </span>
          )}
        </div>
        <ProgressBar value={stats.recogida || 0} max={stats.esperado || 1} color={colorRecaudo} />
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Esperado</p>
            <p className="text-lg font-bold text-white">{formatCOP(stats.esperado || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Recaudado</p>
            <p className="text-lg font-bold text-[#22c55e]">{formatCOP(stats.recogida || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888] uppercase">Gastos</p>
            <p className="text-lg font-bold text-[#ef4444]">{stats.gastos > 0 ? '-' : ''}{formatCOP(stats.gastos || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#f5c518] uppercase font-semibold">Disponible</p>
            <p className="text-lg font-bold text-[#f5c518]">{formatCOP(disponible)}</p>
          </div>
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

        {cobradoresTotal === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">
            No hay cobradores activos
          </p>
        ) : (
          <div className="space-y-2">
            {cobradores.map((c) => {
              const cierre = c.cierre
              const diff = cierre ? cierre.totalRecogido - cierre.totalEsperado : null
              return (
                <div key={c.id} className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{c.nombre}</span>
                    {c.cerrado ? (
                      <Badge variant="green">Cerrado</Badge>
                    ) : (
                      <Badge variant="yellow">Pendiente</Badge>
                    )}
                  </div>
                  {cierre ? (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div>
                        <p className="text-[9px] text-[#888888] uppercase">Esperado</p>
                        <p className="text-xs font-semibold text-white">{formatCOP(cierre.totalEsperado)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#888888] uppercase">Entregado</p>
                        <p className="text-xs font-semibold text-white">{formatCOP(cierre.totalRecogido)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#888888] uppercase">Gastos</p>
                        <p className="text-xs font-semibold text-[#ef4444]">{formatCOP(cierre.totalGastos || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#888888] uppercase">Dif.</p>
                        <p className="text-xs font-bold" style={{ color: diff >= 0 ? '#22c55e' : '#ef4444' }}>
                          {diff >= 0 ? '+' : ''}{formatCOP(diff)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#555555] mt-1">Aún no ha registrado cierre</p>
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
              className="p-1.5 rounded-[8px] text-[#888888] hover:text-[#3b82f6] hover:bg-[rgba(59,130,246,0.1)] transition-all"
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
      />
    </div>
  )
}
