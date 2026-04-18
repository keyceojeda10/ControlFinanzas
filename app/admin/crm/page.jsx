'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green', test: 'yellow' }

const estadoConfig = {
  nuevo:        { variant: 'blue',   label: 'Nuevo' },
  contactado:   { variant: 'yellow', label: 'Contactado' },
  interesado:   { variant: 'purple', label: 'Interesado' },
  activo_pagado:{ variant: 'green',  label: 'Activo/Pagado' },
  perdido:      { variant: 'red',    label: 'Perdido' },
}

function diasDesde(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'hace 1 día'
  return `hace ${d} días`
}

// ---------------------------------------------------------------------------
// Email Modal
// ---------------------------------------------------------------------------
function EmailModal({ org, onClose }) {
  const [to,      setTo]      = useState(org?.ownerEmail ?? '')
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState('')
  const [sent,    setSent]    = useState(false)

  const send = async () => {
    if (!to || !subject || !body) { setError('Completa todos los campos'); return }
    setSending(true); setError('')
    try {
      const res = await fetch('/api/admin/crm/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body, organizationId: org?.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSent(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70">
      <div className="w-full max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Enviar email</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sent ? (
          <p className="text-sm text-[var(--color-success)] text-center py-4">Email enviado correctamente</p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Para</label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Asunto</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo"
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Mensaje</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Escribe tu mensaje..."
                  className="mt-1 w-full px-3 py-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)] resize-none"
                />
              </div>
            </div>
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-[10px] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="h-9 px-5 rounded-[10px] bg-[#3b82f6] text-[var(--color-text-primary)] text-xs font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estado inline select
// ---------------------------------------------------------------------------
function EstadoSelect({ id, value, onChange }) {
  const [saving, setSaving] = useState(false)

  const handle = async (nuevoEstado) => {
    if (nuevoEstado === value) return
    setSaving(true)
    try {
      await fetch(`/api/admin/crm/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoContacto: nuevoEstado }),
      })
      onChange(id, nuevoEstado)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={value}
      onChange={(e) => handle(e.target.value)}
      disabled={saving}
      className="h-7 px-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[10px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)] disabled:opacity-50"
      onClick={(e) => e.stopPropagation()}
    >
      {Object.entries(estadoConfig).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CRMPage() {
  const [periodo,    setPeriodo]    = useState('30d')
  const [metricas,   setMetricas]   = useState(null)
  const [loadingMet, setLoadingMet] = useState(true)

  const [registros,  setRegistros]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  // Filters
  const [q,          setQ]          = useState('')
  const [filtPlan,   setFiltPlan]   = useState('')
  const [filtEstado, setFiltEstado] = useState('')
  const [filtSusc,   setFiltSusc]   = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Email modal
  const [emailOrg, setEmailOrg] = useState(null)

  // Fetch metricas
  useEffect(() => {
    setLoadingMet(true)
    fetch(`/api/admin/crm/metricas?dias=${periodo.replace('d', '')}`)
      .then((r) => r.json())
      .then((d) => setMetricas(d))
      .catch(() => setMetricas(null))
      .finally(() => setLoadingMet(false))
  }, [periodo])

  // Fetch registros
  const fetchRegistros = useCallback(async () => {
    setLoading(true); setError('')
    const p = new URLSearchParams()
    if (q)          p.set('q', q)
    if (filtPlan)   p.set('plan', filtPlan)
    if (filtEstado) p.set('estado', filtEstado)
    if (filtSusc)   p.set('suscripcion', filtSusc)
    if (fechaDesde) p.set('fechaDesde', fechaDesde)
    if (fechaHasta) p.set('fechaHasta', fechaHasta)
    try {
      const res = await fetch(`/api/admin/crm?${p}`)
      if (!res.ok) throw new Error('Error cargando registros')
      const data = await res.json()
      setRegistros(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [q, filtPlan, filtEstado, filtSusc, fechaDesde, fechaHasta])

  useEffect(() => { fetchRegistros() }, [fetchRegistros])

  const handleEstadoChange = (id, nuevoEstado) => {
    setRegistros((prev) => prev.map((r) => r.id === id ? { ...r, estadoContacto: nuevoEstado } : r))
  }

  const tasaColor = (t) => {
    if (!t) return 'white'
    const n = parseFloat(t)
    if (n >= 20) return 'var(--color-success)'
    if (n >= 10) return 'var(--color-warning)'
    return 'var(--color-danger)'
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">CRM</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gestión de leads y seguimiento comercial</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[10px] p-1">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={[
                'px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all',
                periodo === p
                  ? 'bg-[rgba(245,197,24,0.15)] text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loadingMet ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3 animate-pulse">
              <div className="h-3 w-16 bg-[var(--color-bg-hover)] rounded mb-2" />
              <div className="h-6 w-10 bg-[var(--color-bg-hover)] rounded" />
            </div>
          ))
        ) : metricas ? (
          [
            { label: 'Registros',        value: metricas.totalRegistros ?? 0,                                                                          color: 'white' },
            { label: 'Contactados',      value: (metricas.porEstado?.contactado ?? 0) + (metricas.porEstado?.interesado ?? 0),               color: 'var(--color-accent)' },
            { label: 'Convertidos',      value: metricas.conSuscripcionActiva ?? 0,                                                           color: 'var(--color-success)' },
            { label: 'Tasa conversión',  value: `${metricas.tasaConversion ?? 0}%`,                                                           color: tasaColor(metricas.tasaConversion) },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
            </div>
          ))
        ) : (
          <div className="col-span-4">
            <p className="text-xs text-[var(--color-danger)]">Error cargando métricas</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); fetchRegistros() }}
            className="flex-1 flex gap-2"
          >
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="flex-1 h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-[12px] bg-[#3b82f6] text-[var(--color-text-primary)] text-xs font-medium hover:bg-[#2563eb] transition-colors"
            >
              Buscar
            </button>
          </form>
          <select
            value={filtPlan}
            onChange={(e) => setFiltPlan(e.target.value)}
            className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todos los planes</option>
            <option value="starter">Inicial</option>
            <option value="basic">Basico</option>
            <option value="growth">Crecimiento</option>
            <option value="standard">Profesional</option>
            <option value="professional">Empresarial</option>
          </select>
          <select
            value={filtEstado}
            onChange={(e) => setFiltEstado(e.target.value)}
            className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todos los estados</option>
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="interesado">Interesado</option>
            <option value="activo_pagado">Activo/Pagado</option>
            <option value="perdido">Perdido</option>
          </select>
          <select
            value={filtSusc}
            onChange={(e) => setFiltSusc(e.target.value)}
            className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
          >
            <option value="">Todas las suscripciones</option>
            <option value="activa">Con suscripción activa</option>
            <option value="sin">Sin suscripción</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
          {(fechaDesde || fechaHasta || filtEstado || filtPlan || filtSusc || q) && (
            <button
              onClick={() => {
                setQ(''); setFiltPlan(''); setFiltEstado(''); setFiltSusc('')
                setFechaDesde(''); setFechaHasta('')
              }}
              className="h-9 px-3 rounded-[12px] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : registros.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-10">No se encontraron registros</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {registros.map((r) => (
              <div key={r.id} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{r.orgNombre}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{r.ownerNombre}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={planBadge[r.plan] ?? 'gray'}>{r.plan}</Badge>
                    <Badge variant={estadoConfig[r.estadoContacto]?.variant ?? 'gray'}>
                      {estadoConfig[r.estadoContacto]?.label ?? r.estadoContacto}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
                  <p>{r.ownerEmail}</p>
                  {(r.ownerPhone || r.orgTelefono) && (
                    <p>{r.ownerPhone || r.orgTelefono}</p>
                  )}
                  <p>{new Date(r.createdAt).toLocaleDateString('es-CO')} · {diasDesde(r.createdAt)}</p>
                  {r.notasCount > 0 && (
                    <p className="text-[var(--color-accent)]">{r.notasCount} nota{r.notasCount !== 1 ? 's' : ''}</p>
                  )}
                </div>

                <div className="pt-1">
                  <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Estado contacto</label>
                  <div className="mt-1">
                    <EstadoSelect id={r.id} value={r.estadoContacto} onChange={handleEstadoChange} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {(r.ownerPhone || r.orgTelefono) && (
                    <a
                      href={`https://wa.me/57${(r.ownerPhone || r.orgTelefono).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[var(--color-success)] text-xs font-medium hover:bg-[rgba(34,197,94,0.2)] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => setEmailOrg({ id: r.id, ownerEmail: r.ownerEmail })}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] text-[var(--color-info)] text-xs font-medium hover:bg-[rgba(59,130,246,0.2)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </button>
                  <Link
                    href={`/admin/crm/${r.id}`}
                    className="ml-auto flex items-center gap-1 h-8 px-3 rounded-[8px] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors"
                  >
                    Ver detalle
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] text-[var(--color-text-muted)] font-medium uppercase border-b border-[var(--color-border)]">
              <span className="col-span-3">Organización / Owner</span>
              <span className="col-span-2">Contacto</span>
              <span className="col-span-1 text-center">Plan</span>
              <span className="col-span-2">Estado</span>
              <span className="col-span-2">Registro</span>
              <span className="col-span-2 text-right">Acciones</span>
            </div>

            {registros.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors items-center"
              >
                {/* Org / Owner */}
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{r.orgNombre}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{r.ownerNombre}</p>
                  {r.notasCount > 0 && (
                    <span className="text-[10px] text-[var(--color-accent)]">{r.notasCount} nota{r.notasCount !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Contacto */}
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{r.ownerEmail}</p>
                  {(r.ownerPhone || r.orgTelefono) && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{r.ownerPhone || r.orgTelefono}</p>
                  )}
                </div>

                {/* Plan */}
                <div className="col-span-1 text-center">
                  <Badge variant={planBadge[r.plan] ?? 'gray'}>{r.plan}</Badge>
                </div>

                {/* Estado */}
                <div className="col-span-2">
                  <EstadoSelect id={r.id} value={r.estadoContacto} onChange={handleEstadoChange} />
                </div>

                {/* Registro */}
                <div className="col-span-2">
                  <p className="text-xs text-[var(--color-text-muted)]">{new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{diasDesde(r.createdAt)}</p>
                </div>

                {/* Acciones */}
                <div className="col-span-2 flex items-center gap-1.5 justify-end">
                  {(r.ownerPhone || r.orgTelefono) && (
                    <a
                      href={`https://wa.me/57${(r.ownerPhone || r.orgTelefono).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      className="w-7 h-7 flex items-center justify-center rounded-[8px] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[var(--color-success)] hover:bg-[rgba(34,197,94,0.2)] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => setEmailOrg({ id: r.id, ownerEmail: r.ownerEmail })}
                    title="Enviar email"
                    className="w-7 h-7 flex items-center justify-center rounded-[8px] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] text-[var(--color-info)] hover:bg-[rgba(59,130,246,0.2)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <Link
                    href={`/admin/crm/${r.id}`}
                    title="Ver detalle"
                    className="w-7 h-7 flex items-center justify-center rounded-[8px] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Email Modal */}
      {emailOrg && <EmailModal org={emailOrg} onClose={() => setEmailOrg(null)} />}
    </div>
  )
}
