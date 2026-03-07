'use client'
// app/(dashboard)/rutas/[id]/page.jsx - Detalle de ruta

import { useState, useEffect, use } from 'react'
import { useRouter }                 from 'next/navigation'
import { useAuth }                   from '@/hooks/useAuth'
import { Badge }                     from '@/components/ui/Badge'
import { Button }                    from '@/components/ui/Button'
import { Card }                      from '@/components/ui/Card'
import { Modal }                     from '@/components/ui/Modal'
import { SkeletonCard }              from '@/components/ui/Skeleton'
import { formatCOP }                 from '@/lib/calculos'

export default function RutaDetallePage({ params }) {
  const { id }    = use(params)
  const router    = useRouter()
  const { esOwner } = useAuth()

  const [ruta,          setRuta]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [cobradores,    setCobradores]    = useState([])
  const [modalClientes, setModalClientes] = useState(false)
  const [clientesSinRuta, setClientesSinRuta] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [asignando,     setAsignando]     = useState(false)
  const [quitando,      setQuitando]      = useState(null)
  const [modalCaja,     setModalCaja]     = useState(false)
  const [totalRecogido, setTotalRecogido] = useState('')
  const [guardandoCaja, setGuardandoCaja] = useState(false)
  const [errorCaja,     setErrorCaja]     = useState('')

  const fetchRuta = async () => {
    try {
      const res  = await fetch(`/api/rutas/${id}`)
      if (!res.ok) throw new Error()
      setRuta(await res.json())
    } catch {
      setError('No se pudo cargar la ruta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuta()
    if (esOwner) {
      fetch('/api/cobradores').then((r) => r.json()).then(setCobradores).catch(() => {})
    }
  }, [id, esOwner])

  const cambiarCobrador = async (cobradorId) => {
    await fetch(`/api/rutas/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cobradorId: cobradorId || null }),
    })
    fetchRuta()
  }

  const abrirModalClientes = async () => {
    const res  = await fetch('/api/clientes')
    const data = await res.json()
    const idsEnRuta = new Set(ruta?.clientes?.map((c) => c.id) ?? [])
    setClientesSinRuta(data.filter((c) => !c.rutaId || idsEnRuta.has(c.id) === false))
    setSeleccionados([])
    setModalClientes(true)
  }

  const toggleSeleccion = (id) =>
    setSeleccionados((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const asignarClientes = async () => {
    if (!seleccionados.length) return
    setAsignando(true)
    await fetch(`/api/rutas/${id}/clientes`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clienteIds: seleccionados }),
    })
    setModalClientes(false)
    fetchRuta()
    setAsignando(false)
  }

  const quitarCliente = async (clienteId) => {
    setQuitando(clienteId)
    await fetch(`/api/rutas/${id}/clientes`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clienteId }),
    })
    setQuitando(null)
    fetchRuta()
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
      setModalCaja(false)
      fetchRuta()
    } finally {
      setGuardandoCaja(false)
    }
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <SkeletonCard /><SkeletonCard /><SkeletonCard />
    </div>
  )

  if (error || !ruta) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] rounded-[16px] p-6 text-center">
        <p className="font-semibold">Ruta no encontrada</p>
        <button onClick={() => router.back()} className="text-sm underline mt-2">Volver</button>
      </div>
    </div>
  )

  const progreso = ruta.esperadoHoy > 0
    ? Math.min(100, Math.round((ruta.recaudadoHoy / ruta.esperadoHoy) * 100)) : 0

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Rutas
      </button>

      {/* Header */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-[white]">{ruta.nombre}</h1>
          </div>
        </div>

        {/* Selector de cobrador (solo owner) */}
        {esOwner && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-[#888888]">Cobrador asignado</p>
            <select
              value={ruta.cobrador?.id ?? ''}
              onChange={(e) => cambiarCobrador(e.target.value)}
              className="w-full h-9 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] px-3 focus:outline-none focus:border-[#3b82f6] transition-all cursor-pointer"
            >
              <option value="">Sin cobrador asignado</option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
        {!esOwner && ruta.cobrador && (
          <p className="text-sm text-[#888888]">Cobrador: <span className="text-[white] font-medium">{ruta.cobrador.nombre}</span></p>
        )}
      </Card>

      {/* Métricas del día */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Esperado hoy',      value: formatCOP(ruta.esperadoHoy),   color: 'white' },
          { label: 'Recaudado hoy',     value: formatCOP(ruta.recaudadoHoy),  color: '#22c55e' },
          { label: 'Pendientes de pago', value: `${ruta.pendientesHoy} cliente${ruta.pendientesHoy !== 1 ? 's' : ''}`, color: ruta.pendientesHoy > 0 ? '#f59e0b' : '#22c55e' },
          { label: 'En mora',           value: `${ruta.enMora} cliente${ruta.enMora !== 1 ? 's' : ''}`, color: ruta.enMora > 0 ? '#ef4444' : '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
            <p className="text-[10px] text-[#888888]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progreso del día */}
      <Card padding={false}>
        <div className="px-4 py-3">
          <div className="flex justify-between text-xs text-[#888888] mb-1.5">
            <span>Progreso del día</span>
            <span>{progreso}%</span>
          </div>
          <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progreso}%`,
                background: progreso >= 100 ? '#22c55e' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Clientes de la ruta */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
            Clientes ({ruta.clientes?.length ?? 0})
          </p>
          {esOwner && (
            <Button size="sm" variant="secondary" onClick={abrirModalClientes}>
              + Agregar clientes
            </Button>
          )}
        </div>

        {(!ruta.clientes || ruta.clientes.length === 0) ? (
          <p className="text-sm text-[#888888] text-center py-4">Sin clientes asignados</p>
        ) : (
          <div className="space-y-2.5">
            {ruta.clientes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[#2a2a2a] last:border-0">
                <div className="w-7 h-7 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center shrink-0">
                  <span className="text-[#3b82f6] text-[10px] font-bold">{c.nombre?.[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[white] truncate">{c.nombre}</p>
                  <p className="text-[10px] text-[#888888]">
                    {c.diasMora > 0 ? `${c.diasMora} días en mora` : c.pagoHoy ? 'Pagó hoy' : 'Pendiente'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.pagoHoy && <span className="w-2 h-2 rounded-full bg-[#22c55e]" />}
                  {c.diasMora > 0 && <Badge variant="red">{c.diasMora}d</Badge>}
                  {esOwner && (
                    <button
                      onClick={() => quitarCliente(c.id)}
                      disabled={quitando === c.id}
                      className="text-[#888888] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                      title="Quitar de la ruta"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Cierre de caja */}
      <Card>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-4">
          Cierre de caja del día
        </p>
        {ruta.cierre ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Esperado</span>
              <span className="text-[white] font-medium">{formatCOP(ruta.cierre.totalEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#888888]">Entregado</span>
              <span className="text-[white] font-medium">{formatCOP(ruta.cierre.totalRecogido)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-[#2a2a2a] pt-2 mt-2">
              <span className="text-[#888888]">Diferencia</span>
              <span style={{ color: ruta.cierre.diferencia >= 0 ? '#22c55e' : '#ef4444' }}>
                {ruta.cierre.diferencia >= 0 ? '+' : ''}{formatCOP(ruta.cierre.diferencia)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-[#888888] mb-3">No se ha registrado el cierre de hoy</p>
            <Button onClick={() => { setTotalRecogido(''); setModalCaja(true) }}>
              Registrar cierre de caja
            </Button>
          </div>
        )}
      </Card>

      {/* Modal: agregar clientes */}
      <Modal
        open={modalClientes}
        onClose={() => setModalClientes(false)}
        title="Agregar clientes a la ruta"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalClientes(false)}>Cancelar</Button>
            <Button onClick={asignarClientes} loading={asignando} disabled={!seleccionados.length}>
              Agregar {seleccionados.length > 0 ? `(${seleccionados.length})` : ''}
            </Button>
          </>
        }
      >
        {clientesSinRuta.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-4">Todos los clientes ya tienen ruta asignada</p>
        ) : (
          <div className="space-y-2">
            {clientesSinRuta.map((c) => (
              <label
                key={c.id}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-[12px] cursor-pointer transition-colors',
                  seleccionados.includes(c.id) ? 'bg-[rgba(59,130,246,0.1)]' : 'hover:bg-[#222222]',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(c.id)}
                  onChange={() => toggleSeleccion(c.id)}
                  className="accent-[#3b82f6]"
                />
                <div>
                  <p className="text-sm font-medium text-[white]">{c.nombre}</p>
                  <p className="text-xs text-[#888888]">CC {c.cedula}</p>
                </div>
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
            <div className="text-[#ef4444] text-sm bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
              {errorCaja}
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#888888]">Total esperado hoy</span>
            <span className="font-semibold text-[white]">{formatCOP(ruta.esperadoHoy)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#888888]">Dinero recogido (COP)</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Ej: 250000"
              value={totalRecogido}
              onChange={(e) => setTotalRecogido(e.target.value)}
              className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
              autoFocus
            />
          </div>
          {totalRecogido && (
            <div className="text-sm">
              <span className="text-[#888888]">Diferencia: </span>
              <span style={{ color: Number(totalRecogido) >= ruta.esperadoHoy ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {Number(totalRecogido) >= ruta.esperadoHoy ? '+' : ''}{formatCOP(Number(totalRecogido) - ruta.esperadoHoy)}
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
