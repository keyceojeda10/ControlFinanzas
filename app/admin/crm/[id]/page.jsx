'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green', test: 'yellow' }

const estadoConfig = {
  nuevo:        { variant: 'blue',   label: 'Nuevo' },
  contactado:   { variant: 'yellow', label: 'Contactado' },
  interesado:   { variant: 'purple', label: 'Interesado' },
  activo_pagado:{ variant: 'green',  label: 'Activo/Pagado' },
  perdido:      { variant: 'red',    label: 'Perdido' },
}

const fuenteOpts = [
  { value: 'meta_ads',  label: 'Meta Ads' },
  { value: 'google',    label: 'Google' },
  { value: 'referido',  label: 'Referido' },
  { value: 'organico',  label: 'Orgánico' },
  { value: 'otro',      label: 'Otro' },
]

function diasDesde(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'hace 1 día'
  return `hace ${d} días`
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Email Modal
// ---------------------------------------------------------------------------
function EmailModal({ email, orgId, onClose }) {
  const [to,      setTo]      = useState(email ?? '')
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
        body: JSON.stringify({ to, subject, body, organizationId: orgId }),
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
                <input value={to} onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Asunto</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo"
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)]" />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Mensaje</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)}
                  rows={5} placeholder="Escribe tu mensaje..."
                  className="mt-1 w-full px-3 py-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)] resize-none" />
              </div>
            </div>
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose}
                className="h-9 px-4 rounded-[10px] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                Cancelar
              </button>
              <button onClick={send} disabled={sending}
                className="h-9 px-5 rounded-[10px] bg-[#3b82f6] text-[var(--color-text-primary)] text-xs font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50">
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
// Info row helper
// ---------------------------------------------------------------------------
function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide shrink-0 mt-0.5">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-[var(--color-bg-surface)] rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px]" />
          ))}
        </div>
        <div className="lg:col-span-2">
          <div className="h-96 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px]" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function CRMDetailPage({ params }) {
  const { id } = use(params)

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Edit state
  const [estadoContacto, setEstadoContacto] = useState('')
  const [fuenteRegistro, setFuenteRegistro] = useState('')
  const [saving,         setSaving]         = useState(false)
  const [saveMsg,        setSaveMsg]        = useState('')

  // Notes
  const [notaBody,      setNotaBody]      = useState('')
  const [notaEstado,    setNotaEstado]    = useState('')
  const [addingNota,    setAddingNota]    = useState(false)
  const [notaError,     setNotaError]     = useState('')

  // Email modal
  const [showEmail, setShowEmail] = useState(false)

  // Load data
  useEffect(() => {
    setLoading(true); setError('')
    fetch(`/api/admin/crm/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Error cargando organización'); return r.json() })
      .then((d) => {
        setData(d)
        setEstadoContacto(d.estadoContacto ?? 'nuevo')
        setFuenteRegistro(d.fuenteRegistro ?? '')
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  // Save org fields
  const saveOrg = async () => {
    setSaving(true); setSaveMsg('')
    try {
      const res = await fetch(`/api/admin/crm/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoContacto, fuenteRegistro }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setData((prev) => ({ ...prev, estadoContacto, fuenteRegistro }))
      setSaveMsg('Guardado')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch (e) {
      setSaveMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Add nota
  const addNota = async () => {
    if (!notaBody.trim()) { setNotaError('Escribe el contenido de la nota'); return }
    setAddingNota(true); setNotaError('')
    try {
      const res = await fetch(`/api/admin/crm/${id}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenido: notaBody,
          ...(notaEstado ? { estadoCambio: notaEstado } : {}),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      const nuevaNota = await res.json()
      setData((prev) => ({ ...prev, notas: [nuevaNota, ...(prev.notas ?? [])] }))
      setNotaBody(''); setNotaEstado('')
      // If estado changed, update locally
      if (notaEstado) {
        setEstadoContacto(notaEstado)
        setData((prev) => ({ ...prev, estadoContacto: notaEstado }))
      }
    } catch (e) {
      setNotaError(e.message)
    } finally {
      setAddingNota(false)
    }
  }

  if (loading) return <SkeletonDetail />

  if (error) return (
    <div className="max-w-4xl mx-auto">
      <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a CRM
      </Link>
      <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    </div>
  )

  const phone = data.ownerPhone || data.orgTelefono

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Back */}
      <Link href="/admin/crm" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a CRM
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ------------------------------------------------------------------ */}
        {/* Left panel                                                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="lg:col-span-1 space-y-4">

          {/* Org info */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">{data.orgNombre}</h2>
                <p className="text-[10px] text-[var(--color-text-muted)]">ID: {id}</p>
              </div>
              <Badge variant={planBadge[data.plan] ?? 'gray'}>{data.plan}</Badge>
            </div>

            <div className="space-y-0">
              {data.orgTelefono && (
                <InfoRow label="Teléfono">
                  <span className="text-xs text-[var(--color-text-muted)]">{data.orgTelefono}</span>
                </InfoRow>
              )}
              {data.ciudad && (
                <InfoRow label="Ciudad">
                  <span className="text-xs text-[var(--color-text-muted)]">{data.ciudad}</span>
                </InfoRow>
              )}
              <InfoRow label="Registro">
                <div className="text-right">
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(data.createdAt)}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{diasDesde(data.createdAt)}</p>
                </div>
              </InfoRow>
            </div>

            {/* Estado + Fuente editable */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Estado contacto</label>
                <select
                  value={estadoContacto}
                  onChange={(e) => setEstadoContacto(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
                >
                  {Object.entries(estadoConfig).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Fuente de registro</label>
                <select
                  value={fuenteRegistro}
                  onChange={(e) => setFuenteRegistro(e.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
                >
                  <option value="">Sin especificar</option>
                  {fuenteOpts.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={saveOrg}
                  disabled={saving}
                  className="flex-1 h-9 rounded-[10px] bg-[#3b82f6] text-[var(--color-text-primary)] text-xs font-medium hover:bg-[#2563eb] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg === 'Guardado' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Owner info */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium mb-3">Propietario</p>
            <div className="space-y-0">
              <InfoRow label="Nombre">
                <span className="text-xs text-[var(--color-text-muted)]">{data.ownerNombre}</span>
              </InfoRow>
              <InfoRow label="Email">
                <span className="text-xs text-[var(--color-text-muted)] break-all">{data.ownerEmail}</span>
              </InfoRow>
              {data.ownerPhone && (
                <InfoRow label="Celular">
                  <span className="text-xs text-[var(--color-text-muted)]">{data.ownerPhone}</span>
                </InfoRow>
              )}
              <InfoRow label="Email verificado">
                <Badge variant={data.emailVerificado ? 'green' : 'red'}>
                  {data.emailVerificado ? 'Verificado' : 'Sin verificar'}
                </Badge>
              </InfoRow>
              <InfoRow label="Onboarding">
                <Badge variant={data.onboardingCompletado ? 'green' : 'gray'}>
                  {data.onboardingCompletado ? 'Completado' : 'Pendiente'}
                </Badge>
              </InfoRow>
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium mb-3">Suscripción</p>
            {data.suscripcion ? (
              <div className="space-y-0">
                <InfoRow label="Plan">
                  <Badge variant={planBadge[data.suscripcion.plan] ?? 'gray'}>{data.suscripcion.plan}</Badge>
                </InfoRow>
                <InfoRow label="Estado">
                  <Badge variant={data.suscripcion.activa ? 'green' : 'red'}>
                    {data.suscripcion.activa ? 'Activa' : 'Inactiva'}
                  </Badge>
                </InfoRow>
                {data.suscripcion.vencimiento && (
                  <InfoRow label="Vencimiento">
                    <div className="text-right">
                      <p className="text-xs text-[var(--color-text-muted)]">{formatDate(data.suscripcion.vencimiento)}</p>
                      {data.suscripcion.diasRestantes !== undefined && (
                        <p className={`text-[10px] ${data.suscripcion.diasRestantes > 7 ? 'text-[var(--color-success)]' : data.suscripcion.diasRestantes > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'}`}>
                          {data.suscripcion.diasRestantes > 0
                            ? `${data.suscripcion.diasRestantes}d restantes`
                            : `${Math.abs(data.suscripcion.diasRestantes)}d vencida`}
                        </p>
                      )}
                    </div>
                  </InfoRow>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">Sin suscripción activa</p>
            )}
          </div>

          {/* Activity */}
          {data.actividad && (
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4">
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide font-medium mb-3">Actividad</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Clientes',  value: data.actividad.clientes  ?? 0, color: 'white' },
                  { label: 'Préstamos', value: data.actividad.prestamos ?? 0, color: '#3b82f6' },
                  { label: 'Rutas',     value: data.actividad.rutas     ?? 0, color: 'var(--color-purple)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                    <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {phone && (
              <a
                href={`https://wa.me/57${phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[12px] bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[var(--color-success)] text-xs font-medium hover:bg-[rgba(34,197,94,0.2)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            )}
            <button
              onClick={() => setShowEmail(true)}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-[12px] bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] text-[var(--color-info)] text-xs font-medium hover:bg-[rgba(59,130,246,0.2)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Right panel — Notes timeline                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] p-4 h-full flex flex-col gap-4">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Notas · {(data.notas ?? []).length}
            </p>

            {/* Add note form */}
            <div className="space-y-3 pb-4 border-b border-[var(--color-border)]">
              <textarea
                value={notaBody}
                onChange={(e) => setNotaBody(e.target.value)}
                rows={3}
                placeholder="Agrega una nota de seguimiento..."
                className="w-full px-3 py-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-info)] resize-none"
              />
              <div className="flex gap-2 items-center">
                <select
                  value={notaEstado}
                  onChange={(e) => setNotaEstado(e.target.value)}
                  className="h-9 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-info)]"
                >
                  <option value="">Sin cambio de estado</option>
                  {Object.entries(estadoConfig).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button
                  onClick={addNota}
                  disabled={addingNota}
                  className="ml-auto h-9 px-5 rounded-[10px] bg-[var(--color-accent)] text-[#1a1a2e] text-xs font-bold hover:bg-[#e5b516] transition-colors disabled:opacity-50"
                >
                  {addingNota ? 'Agregando...' : 'Agregar nota'}
                </button>
              </div>
              {notaError && <p className="text-xs text-[var(--color-danger)]">{notaError}</p>}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] lg:max-h-[600px]">
              {(data.notas ?? []).length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sin notas aun. Agrega la primera nota de seguimiento.</p>
              ) : (
                (data.notas ?? []).map((n, i) => (
                  <div key={n.id ?? i} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-bg-hover)] border-2 border-[#3b82f6] mt-1 shrink-0" />
                      {i < (data.notas ?? []).length - 1 && (
                        <div className="w-px flex-1 bg-[var(--color-bg-hover)] mt-1" />
                      )}
                    </div>

                    {/* Note card */}
                    <div className="flex-1 pb-3">
                      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-[12px] px-3 py-2.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-[var(--color-text-muted)]">
                            {n.adminNombre ?? 'Admin'}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                            {formatDate(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{n.contenido}</p>
                        {n.estadoCambio && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-[var(--color-text-muted)]">Estado cambiado a</span>
                            <Badge variant={estadoConfig[n.estadoCambio]?.variant ?? 'gray'}>
                              {estadoConfig[n.estadoCambio]?.label ?? n.estadoCambio}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmail && (
        <EmailModal
          email={data.ownerEmail}
          orgId={id}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}
