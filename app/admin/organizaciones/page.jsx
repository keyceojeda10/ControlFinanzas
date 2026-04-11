'use client'

import { useState, useEffect, useRef } from 'react'
import Link                    from 'next/link'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonTable }       from '@/components/ui/Skeleton'

const planBadge = { basic: 'gray', growth: 'blue', standard: 'yellow', professional: 'purple', test: 'yellow' }

export default function OrganizacionesPage() {
  const [orgs,    setOrgs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')
  const [filtPlan,   setFiltPlan]   = useState('')
  const [filtEstado, setFiltEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [trigger, setTrigger] = useState(0) // force re-fetch
  const isFirst = useRef(true)

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (q.trim())   params.set('q', q.trim())
      if (filtPlan)   params.set('plan', filtPlan)
      if (filtEstado) params.set('estado', filtEstado)
      if (fechaDesde) params.set('desde', fechaDesde)
      if (fechaHasta) params.set('hasta', fechaHasta)
      try {
        const res = await fetch(`/api/admin/organizaciones?${params}`)
        const data = await res.json()
        setOrgs(Array.isArray(data) ? data : [])
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }
    doFetch()
  }, [filtPlan, filtEstado, fechaDesde, fechaHasta, trigger])

  const handleSearch = (e) => {
    e.preventDefault()
    setTrigger(t => t + 1)
  }

  const limpiarTodo = () => {
    setQ('')
    setFiltPlan('')
    setFiltEstado('')
    setFechaDesde('')
    setFechaHasta('')
    // The state changes above will trigger the useEffect
  }

  const hayFiltros = q || filtPlan || filtEstado || fechaDesde || fechaHasta

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[white]">Organizaciones</h1>
          <p className="text-sm text-[#555555] mt-0.5">
            {!loading && `${orgs.length} resultado${orgs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {hayFiltros && (
          <button
            onClick={limpiarTodo}
            className="text-[11px] text-[#555555] hover:text-[white] transition-all"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Buscador + filtros */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo electrónico o teléfono…"
            className="flex-1 h-9 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#555555] focus:outline-none focus:border-[#3b82f6]"
          />
          <button type="submit" className="h-9 px-4 rounded-[12px] bg-[#3b82f6] text-white text-xs font-medium hover:bg-[#2563eb] transition-all shrink-0">
            Buscar
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtPlan}
            onChange={(e) => setFiltPlan(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#3b82f6]"
          >
            <option value="">Todos los planes</option>
            <option value="basic">Básico</option>
            <option value="growth">Crecimiento</option>
            <option value="standard">Profesional</option>
            <option value="professional">Empresarial</option>
          </select>
          <select
            value={filtEstado}
            onChange={(e) => setFiltEstado(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#3b82f6]"
          >
            <option value="">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="suspendida">Suspendidas</option>
          </select>
          <span className="text-[10px] text-[#555555]">desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#3b82f6]"
          />
          <span className="text-[10px] text-[#555555]">hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-xs text-[white] focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? <SkeletonTable rows={5} /> : orgs.length === 0 ? (
        <p className="text-sm text-[#555555] text-center py-8">No se encontraron organizaciones</p>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-6 gap-2 px-4 py-2.5 text-[10px] text-[#555555] font-medium uppercase border-b border-[#2a2a2a]">
            <span className="col-span-2">Organización</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Usuarios</span>
            <span className="text-center">Clientes</span>
            <span className="text-right">Suscripción</span>
          </div>

          {/* Rows */}
          {orgs.map((o) => (
            <Link
              key={o.id}
              href={`/admin/organizaciones/${o.id}`}
              className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-4 py-3 border-b border-[#2a2a2a] last:border-0 hover:bg-[#222222] transition-all items-center"
            >
              <div className="col-span-2">
                <p className="text-sm font-medium text-[white]">{o.nombre}</p>
                {o.ownerEmail && (
                  <p className="text-[11px] text-[#888888] truncate">{o.ownerEmail}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={o.activo ? 'green' : 'red'}>
                    {o.activo ? 'Activa' : 'Suspendida'}
                  </Badge>
                  <span className="text-[10px] text-[#555555]">
                    {new Date(o.createdAt).toLocaleDateString('es-CO')}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <Badge variant={planBadge[o.plan]}>{o.plan}</Badge>
              </div>
              <p className="text-sm text-[#888888] text-center">{o.usuarios}</p>
              <p className="text-sm text-[#888888] text-center">{o.clientes}</p>
              <div className="text-right">
                {o.suscripcion ? (
                  <div>
                    <Badge variant={o.suscripcion.diasRestantes > 7 ? 'green' : o.suscripcion.diasRestantes > 0 ? 'yellow' : 'red'}>
                      {o.suscripcion.diasRestantes > 0
                        ? `${o.suscripcion.diasRestantes}d`
                        : `${Math.abs(o.suscripcion.diasRestantes)}d vencida`}
                    </Badge>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#555555]">Sin suscripción</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
