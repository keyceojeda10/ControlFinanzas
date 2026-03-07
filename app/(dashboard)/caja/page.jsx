'use client'
// app/(dashboard)/caja/page.jsx - Cierre de caja

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
  // Si recibimos YYYY-MM-DD, agregar timezone Colombia para evitar desfase UTC
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

// Obtener fecha actual en formato YYYY-MM-DD (Colombia)
const getColombiaDateStr = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
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

  const stats = cajaData?.stats || { dia: {}, cartera: {} }
  const cierres = cajaData?.cierres || []
  const gastos = cajaData?.gastos || []
  const disponible = stats.dia.recogida - stats.dia.gastos

  // ── VISTA DEL COBRADOR ────────────────────────────────────────
  if (esCobrador) {
    const cierreHoy = cierres[0]
    const diferencia = cierreHoy ? cierreHoy.totalRecogido - cierreHoy.totalEsperado : null

    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[white]">Cierre de caja</h1>
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
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
            💰 Resumen del día
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] text-[#888888]">Total Esperado</p>
              <p className="text-lg font-bold text-white">{formatCOP(stats.dia.esperado || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888]">Total Recaudado</p>
              <p className="text-lg font-bold text-[#22c55e]">{formatCOP(stats.dia.recogida || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888]">Gastos</p>
              <p className="text-lg font-bold text-[#ef4444]">-{formatCOP(stats.dia.gastos || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#888888]">💵 DISPONIBLE</p>
              <p className="text-lg font-bold text-[#f5c518]">{formatCOP(disponible || 0)}</p>
            </div>
          </div>
        </Card>

        {/* Cierre */}
        {cierreHoy ? (
          <Card>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">Cierre registrado</p>
            <div className="space-y-2">
              {[
                { label: 'Esperado', value: formatCOP(cierreHoy.totalEsperado) },
                { label: 'Recogido', value: formatCOP(cierreHoy.totalRecogido) },
                { label: 'Gastos', value: formatCOP(cierreHoy.totalGastos || 0) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#888888]">{label}</span>
                  <span className="font-medium text-[white]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
                <span className="text-[#888888]">Diferencia</span>
                <span style={{ color: diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                  {diferencia >= 0 ? '+' : ''}{formatCOP(diferencia)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowGasto(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 h-11 rounded-[12px] border border-[#2a2a2a] text-sm font-medium text-[#888888] hover:bg-[#1a1a1a] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Reportar gasto menor
            </button>
          </Card>
        ) : (
          <Card>
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
              Registrar cierre del día
            </p>
            {exito && (
              <div className="mb-4 flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] text-[#22c55e] text-sm rounded-[12px] px-4 py-3">
                ✓ Cierre registrado exitosamente
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
                <span className="font-semibold text-[white]">{formatCOP(stats.dia.esperado || 0)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#888888]">Dinero que vas a entregar (COP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej: 250000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
                />
              </div>
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[#888888]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= (stats.dia.esperado || 0) ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {Number(totalRecogido) >= (stats.dia.esperado || 0) ? '+' : ''}{formatCOP(Number(totalRecogido) - (stats.dia.esperado || 0))}
                  </span>
                </div>
              )}
              <Button type="submit" loading={guardando} className="w-full">
                Registrar cierre de caja
              </Button>
            </form>
          </Card>
        )}
      </div>
    )
  }

  // ── VISTA DEL OWNER ───────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[white]">Cierre de caja</h1>
          <p className="text-sm text-[#888888] mt-0.5">{cajaData?.fechaDisplay || '—'} — resumen de la organización</p>
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
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          💰 Resumen del día
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] text-[#888888]">Total Esperado</p>
            <p className="text-lg font-bold text-white">{formatCOP(stats.dia.esperado || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888]">Total Recaudado</p>
            <p className="text-lg font-bold text-[#22c55e]">{formatCOP(stats.dia.recogida || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888]">Gastos</p>
            <p className="text-lg font-bold text-[#ef4444]">-{formatCOP(stats.dia.gastos || 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#888888]">💵 DISPONIBLE</p>
            <p className="text-lg font-bold text-[#f5c518]">{formatCOP(disponible || 0)}</p>
          </div>
        </div>
        {stats.dia.tasaRecaudo > 0 && (
          <div className="text-center">
            <span className="text-xs text-[#888888]">Tasa de recaudo: </span>
            <span className="text-sm font-bold" style={{ color: stats.dia.tasaRecaudo >= 80 ? '#22c55e' : stats.dia.tasaRecaudo >= 50 ? '#f5c518' : '#ef4444' }}>
              {stats.dia.tasaRecaudo}%
            </span>
          </div>
        )}
      </Card>

      {/* Estadísticas de cartera */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          📊 Estadísticas de Cartera
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#888888]">Capital prestado actualmente</span>
            <span className="text-sm font-bold text-white">{formatCOP(stats.cartera.capitalPrestado || 0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#888888]">Recuperado (histórico)</span>
            <span className="text-sm font-bold text-[#22c55e]">{formatCOP(stats.cartera.capitalRecuperado || 0)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-[#2a2a2a] pt-3">
            <span className="text-sm text-[#888888]">Recuperación</span>
            <span className="text-sm font-bold text-[#f5c518]">{stats.cartera.porcentajeRecuperacion || 0}%</span>
          </div>
        </div>
      </Card>

      {/* Tabla de cobradores */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Cierres del día ({cierres.length})
        </p>
        {cierres.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">
            Ningún cobrador ha registrado cierre de caja para esta fecha
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-5 gap-2 text-[10px] text-[#888888] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
              <span>Cobrador</span>
              <span className="text-right">Esperado</span>
              <span className="text-right">Recogido</span>
              <span className="text-right">Gastos</span>
              <span className="text-right">Diferencia</span>
            </div>
            {cierres.map((c) => {
              const diff = c.totalRecogido - c.totalEsperado
              return (
                <div key={c.id} className="grid grid-cols-5 gap-2 py-2.5 border-b border-[#2a2a2a] last:border-0 items-center">
                  <span className="text-sm font-medium text-[white] truncate">{c.cobrador?.nombre}</span>
                  <span className="text-sm text-[#888888] text-right">{formatCOP(c.totalEsperado)}</span>
                  <span className="text-sm text-[white] text-right">{formatCOP(c.totalRecogido)}</span>
                  <span className="text-sm text-[#ef4444] text-right">-{formatCOP(c.totalGastos || 0)}</span>
                  <span
                    className="text-sm font-bold text-right"
                    style={{ color: diff >= 0 ? '#22c55e' : '#ef4444' }}
                  >
                    {diff >= 0 ? '+' : ''}{formatCOP(diff)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Sección de Gastos Menores */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
            Gastos Menores
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
