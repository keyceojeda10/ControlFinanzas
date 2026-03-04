'use client'
// app/(dashboard)/caja/page.jsx - Cierre de caja

import { useState, useEffect } from 'react'
import { useAuth }             from '@/hooks/useAuth'
import { Card }                from '@/components/ui/Card'
import { Button }              from '@/components/ui/Button'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonCard }        from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'
import ReportarGasto          from '@/components/gastos/ReportarGasto'
import ListaGastos            from '@/components/gastos/ListaGastos'

const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

export default function CajaPage() {
  const { session, esOwner, esCobrador, loading: authLoading } = useAuth()

  const [cierres,      setCierres]      = useState([])
  const [prestamos,    setPrestamos]    = useState([])  // para cobrador: lista del día
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardando,    setGuardando]    = useState(false)
  const [errorCaja,    setErrorCaja]    = useState('')
  const [exito,        setExito]        = useState(false)
  const [showGasto,    setShowGasto]    = useState(false)
  const [gastosPendientes, setGastosPendientes] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [cierresRes, prestamosRes] = await Promise.all([
        fetch('/api/caja'),
        fetch('/api/prestamos?estado=activo'),
      ])
      const [cierresData, prestamosData] = await Promise.all([
        cierresRes.json(),
        prestamosRes.json(),
      ])
      setCierres(Array.isArray(cierresData) ? cierresData : [])
      setPrestamos(Array.isArray(prestamosData) ? prestamosData : [])
    } catch {
      setError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) fetchData()
  }, [authLoading])

  const cierreHoy = cierres.find((c) => {
    const hoy  = new Date().toISOString().slice(0, 10)
    return new Date(c.fecha).toISOString().slice(0, 10) === hoy
  })

  const esperadoHoy = prestamos.reduce((a, p) => a + (p.cuotaDiaria ?? 0), 0)
  const recaudadoHoy = prestamos.reduce((a, p) => {
    if (p.pagoHoy) return a + (p.cuotaDiaria ?? 0)
    return a
  }, 0)

  const registrarCierre = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrorCaja('')
    try {
      const res  = await fetch('/api/caja', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ totalRecogido: Number(totalRecogido) }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorCaja(data.error ?? 'Error al registrar'); return }
      setExito(true)
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

  // ── VISTA DEL COBRADOR ────────────────────────────────────────
  if (esCobrador) {
    const diferencia = cierreHoy
      ? cierreHoy.totalRecogido - cierreHoy.totalEsperado
      : null

    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="mb-2">
          <h1 className="text-xl font-bold text-[white]">Cierre de caja</h1>
          <p className="text-sm text-[#555555] mt-0.5">{fmtFecha(new Date())}</p>
        </div>

        {error && (
          <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Resumen del día */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-4 py-3">
            <p className="text-[10px] text-[#555555]">Esperado hoy</p>
            <p className="text-xl font-bold text-[white] mt-1">{formatCOP(esperadoHoy)}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-4 py-3">
            <p className="text-[10px] text-[#555555]">Recaudado hoy</p>
            <p className="text-xl font-bold text-[#22c55e] mt-1">{formatCOP(recaudadoHoy)}</p>
          </div>
        </div>

        {/* Lista de préstamos activos del cobrador */}
        <Card>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">
            Clientes del día ({prestamos.length})
          </p>
          {prestamos.length === 0 ? (
            <p className="text-sm text-[#555555] text-center py-4">Sin cobros asignados hoy</p>
          ) : (
            <div className="space-y-2.5">
              {prestamos.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#2a2a2a] last:border-0">
                  <div className="w-7 h-7 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center shrink-0">
                    <span className="text-[#3b82f6] text-[10px] font-bold">{p.cliente?.nombre?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[white] truncate">{p.cliente?.nombre}</p>
                    <p className="text-xs text-[#555555]">{formatCOP(p.cuotaDiaria)}/día</p>
                  </div>
                  {p.pagoHoy
                    ? <Badge variant="green">Pagó</Badge>
                    : <Badge variant="yellow">Pendiente</Badge>
                  }
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cierre */}
        {cierreHoy ? (
          <Card>
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">Cierre registrado</p>
            <div className="space-y-2">
              {[
                { label: 'Esperado',  value: formatCOP(cierreHoy.totalEsperado)  },
                { label: 'Entregado', value: formatCOP(cierreHoy.totalRecogido)  },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#555555]">{label}</span>
                  <span className="font-medium text-[white]">{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
                <span className="text-[#555555]">Diferencia</span>
                <span style={{ color: diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                  {diferencia >= 0 ? '+' : ''}{formatCOP(diferencia)}
                </span>
              </div>
            </div>
            {diferencia < 0 && (
              <div className="mt-3 flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-3 py-2.5">
                <span className="text-[#ef4444] text-sm font-semibold">
                  Faltaron {formatCOP(Math.abs(diferencia))}
                </span>
              </div>
            )}
            {diferencia >= 0 && (
              <div className="mt-3 flex items-center gap-2 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] rounded-[12px] px-3 py-2.5">
                <span className="text-[#22c55e] text-sm font-semibold">
                  ✓ Cierre correcto
                </span>
              </div>
            )}

            {/* Botón Reportar Gasto */}
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
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">
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

            {/* Botón de cierre rápido */}
            <button
              onClick={async () => {
                setTotalRecogido(String(esperadoHoy))
                setErrorCaja('')
              }}
              className="mb-4 w-full flex items-center justify-center gap-2 h-10 rounded-[12px] bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] text-sm font-medium text-[#f5c518] hover:bg-[rgba(245,197,24,0.15)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Cierre rápido (usar esperado)
            </button>

            <form onSubmit={registrarCierre} className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[#555555]">Total esperado hoy</span>
                <span className="font-semibold text-[white]">{formatCOP(esperadoHoy)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#888888]">Dinero que vas a entregar (COP)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej: 250000"
                  value={totalRecogido}
                  onChange={(e) => setTotalRecogido(e.target.value)}
                  className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#555555] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
                />
              </div>
              {totalRecogido && (
                <div className="text-sm">
                  <span className="text-[#555555]">Diferencia: </span>
                  <span style={{ color: Number(totalRecogido) >= esperadoHoy ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {Number(totalRecogido) >= esperadoHoy ? '+' : ''}{formatCOP(Number(totalRecogido) - esperadoHoy)}
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
  const totalEsperadoOrg  = cierres.reduce((a, c) => a + c.totalEsperado, 0)
  const totalRecogidoOrg  = cierres.reduce((a, c) => a + c.totalRecogido, 0)
  const totalDiferenciaOrg = totalRecogidoOrg - totalEsperadoOrg

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-[white]">Cierre de caja</h1>
        <p className="text-sm text-[#555555] mt-0.5">{fmtFecha(new Date())} — resumen de la organización</p>
      </div>

      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
          {error}
        </div>
      )}

      {/* Consolidado */}
      {cierres.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total esperado',  value: formatCOP(totalEsperadoOrg),  color: 'white' },
            { label: 'Total recogido',  value: formatCOP(totalRecogidoOrg),  color: '#22c55e' },
            {
              label: 'Diferencia',
              value: (totalDiferenciaOrg >= 0 ? '+' : '') + formatCOP(totalDiferenciaOrg),
              color: totalDiferenciaOrg >= 0 ? '#22c55e' : '#ef4444',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center">
              <p className="text-[10px] text-[#555555]">{label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabla de cobradores */}
      <Card>
        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-4">
          Cierres del día ({cierres.length})
        </p>
        {cierres.length === 0 ? (
          <p className="text-sm text-[#555555] text-center py-4">
            Ningún cobrador ha registrado cierre de caja hoy
          </p>
        ) : (
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 text-[10px] text-[#555555] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
              <span>Cobrador</span>
              <span className="text-right">Esperado</span>
              <span className="text-right">Recogido</span>
              <span className="text-right">Diferencia</span>
            </div>
            {cierres.map((c) => {
              const diff = c.totalRecogido - c.totalEsperado
              return (
                <div key={c.id} className="grid grid-cols-4 gap-2 py-2.5 border-b border-[#2a2a2a] last:border-0 items-center">
                  <span className="text-sm font-medium text-[white] truncate">{c.cobrador?.nombre}</span>
                  <span className="text-sm text-[#888888] text-right">{formatCOP(c.totalEsperado)}</span>
                  <span className="text-sm text-[white] text-right">{formatCOP(c.totalRecogido)}</span>
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

        {/* Sección de Gastos Menores */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide">
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
          <ListaGastos soloPendientes={false} onCountChange={setGastosPendientes} />
        </Card>
      </Card>

      <ReportarGasto
        open={showGasto}
        onClose={() => setShowGasto(false)}
        onSuccess={() => fetchData()}
      />
    </div>
  )
}
