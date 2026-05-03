'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonTable }       from '@/components/ui/Skeleton'

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green', test: 'yellow' }

export default function OrganizacionesPage() {
  const [orgs,    setOrgs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [q,       setQ]       = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtPlan,   setFiltPlan]   = useState('')
  const [filtEstado, setFiltEstado] = useState('')
  const [filtSub,    setFiltSub]    = useState('') // pagado, trial, vencido
  const [filtAct,    setFiltAct]    = useState('') // hoy, semana, mes, inactivos
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set('q', searchTerm.trim())
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
  }, [filtPlan, filtEstado, fechaDesde, fechaHasta, searchTerm])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchTerm(q)
  }

  const limpiarTodo = () => {
    setQ('')
    setSearchTerm('')
    setFiltPlan('')
    setFiltEstado('')
    setFiltSub('')
    setFiltAct('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const hayFiltros = q || filtPlan || filtEstado || filtSub || filtAct || fechaDesde || fechaHasta

  // Filtrado client-side de suscripcion + actividad
  const ahora = new Date()
  const orgsFiltradas = orgs.filter((o) => {
    if (filtSub) {
      const s = o.suscripcion
      const vigente = s && new Date(s.fechaVencimiento) > ahora
      const esPagado = vigente && (s.montoCOP ?? 0) > 0
      const esTrial  = vigente && (s.montoCOP ?? 0) === 0
      const esVencido = !vigente
      if (filtSub === 'pagado'  && !esPagado)  return false
      if (filtSub === 'trial'   && !esTrial)   return false
      if (filtSub === 'vencido' && !esVencido) return false
    }
    if (filtAct) {
      const last = o.ownerLastActivityAt ? new Date(o.ownerLastActivityAt) : null
      if (!last && filtAct !== 'inactivos') return false
      if (last) {
        const horas = (ahora - last) / (1000 * 60 * 60)
        if (filtAct === 'hoy'    && horas > 24)  return false
        if (filtAct === 'semana' && horas > 168) return false
        if (filtAct === 'mes'    && horas > 720) return false
        if (filtAct === 'inactivos' && horas <= 720) return false
      }
    }
    return true
  })

  const hace = (date) => {
    if (!date) return 'Nunca'
    const ms = ahora - new Date(date)
    const min = Math.floor(ms / 60000)
    if (min < 1) return 'Ahora'
    if (min < 60) return `${min} min`
    const horas = Math.floor(min / 60)
    if (horas < 24) return `${horas}h`
    const dias = Math.floor(horas / 24)
    if (dias < 30) return `${dias}d`
    const meses = Math.floor(dias / 30)
    return `${meses}mes${meses > 1 ? 'es' : ''}`
  }

  const colorActividad = (date) => {
    if (!date) return 'var(--color-text-muted)'
    const horas = (ahora - new Date(date)) / (1000 * 60 * 60)
    if (horas <= 24) return '#22c55e'
    if (horas <= 168) return '#f59e0b'
    return 'var(--color-danger)'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[white]">Organizaciones</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {!loading && `${orgsFiltradas.length} de ${orgs.length} resultado${orgs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {hayFiltros && (
          <button
            onClick={limpiarTodo}
            className="text-[11px] text-[var(--color-text-muted)] hover:text-[white] transition-all"
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
            className="flex-1 h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[white] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]"
          />
          <button type="submit" className="h-9 px-4 rounded-[12px] bg-[#3b82f6] text-[var(--color-text-primary)] text-xs font-medium hover:bg-[#2563eb] transition-all shrink-0">
            Buscar
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtPlan}
            onChange={(e) => setFiltPlan(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todos los planes</option>
            <option value="starter">Inicial</option>
            <option value="basic">Básico</option>
            <option value="growth">Crecimiento</option>
            <option value="standard">Profesional</option>
            <option value="professional">Empresarial</option>
          </select>
          <select
            value={filtEstado}
            onChange={(e) => setFiltEstado(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todos los estados</option>
            <option value="activa">Activas</option>
            <option value="suspendida">Suspendidas</option>
          </select>
          <select
            value={filtSub}
            onChange={(e) => setFiltSub(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Toda suscripcion</option>
            <option value="pagado">Pagados</option>
            <option value="trial">Trials</option>
            <option value="vencido">Vencidos</option>
          </select>
          <select
            value={filtAct}
            onChange={(e) => setFiltAct(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Toda actividad</option>
            <option value="hoy">Activos hoy</option>
            <option value="semana">Activos 7d</option>
            <option value="mes">Activos 30d</option>
            <option value="inactivos">Inactivos +30d</option>
          </select>
          <span className="text-[10px] text-[var(--color-text-muted)]">desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          />
          <span className="text-[10px] text-[var(--color-text-muted)]">hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="h-8 px-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[white] focus:outline-none focus:border-[var(--color-info)]"
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? <SkeletonTable rows={5} /> : orgsFiltradas.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No se encontraron organizaciones</p>
      ) : (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-7 gap-2 px-4 py-2.5 text-[10px] text-[var(--color-text-muted)] font-medium uppercase border-b border-[var(--color-border)]">
            <span className="col-span-2">Organización</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Usuarios</span>
            <span className="text-center">Clientes</span>
            <span className="text-center">Última actividad</span>
            <span className="text-right">Suscripción</span>
          </div>

          {/* Rows */}
          {orgsFiltradas.map((o) => (
            <Link
              key={o.id}
              href={`/admin/organizaciones/${o.id}`}
              className="grid grid-cols-2 sm:grid-cols-7 gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-all items-center"
            >
              <div className="col-span-2">
                <p className="text-sm font-medium text-[white]">{o.nombre}</p>
                {o.ownerEmail && (
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{o.ownerEmail}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={o.activo ? 'green' : 'red'}>
                    {o.activo ? 'Activa' : 'Suspendida'}
                  </Badge>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(o.createdAt).toLocaleDateString('es-CO')}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <Badge variant={planBadge[o.plan]}>{o.plan}</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] text-center">{o.usuarios}</p>
              <p className="text-sm text-[var(--color-text-muted)] text-center">{o.clientes}</p>
              <div className="text-center">
                <span className="text-[11px] font-medium" style={{ color: colorActividad(o.ownerLastActivityAt) }}>
                  {hace(o.ownerLastActivityAt)}
                </span>
                {o.ownerLastLoginAt && (
                  <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                    login: {hace(o.ownerLastLoginAt)}
                  </p>
                )}
              </div>
              <div className="text-right">
                {o.suscripcion ? (
                  <div>
                    <Badge variant={o.suscripcion.diasRestantes > 7 ? 'green' : o.suscripcion.diasRestantes > 0 ? 'yellow' : 'red'}>
                      {o.suscripcion.diasRestantes > 0
                        ? `${o.suscripcion.diasRestantes}d`
                        : `${Math.abs(o.suscripcion.diasRestantes)}d vencida`}
                    </Badge>
                    {(o.suscripcion.montoCOP ?? 0) > 0 && (
                      <p className="text-[9px] text-[var(--color-success)] mt-0.5">pagado</p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-[var(--color-text-muted)]">Sin suscripción</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
