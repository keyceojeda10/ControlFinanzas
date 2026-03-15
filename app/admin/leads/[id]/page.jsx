'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { MENSAJES, CATEGORIAS, whatsappLink } from '@/lib/leadMessages'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ESTADO_CONFIG = {
  nuevo:      { label: 'Nuevo',      variant: 'blue'   },
  contactado: { label: 'Contactado', variant: 'yellow' },
  registrado: { label: 'Registrado', variant: 'green'  },
  descartado: { label: 'Descartado', variant: 'red'    },
}

const CATEGORIA_BADGE_VARIANT = {
  inicial:     'blue',
  respuesta:   'yellow',
  seguimiento: 'red',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haceTiempo(fecha) {
  const ms = Date.now() - new Date(fecha).getTime()
  const dias = Math.floor(ms / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

function formatFechaLarga(fecha) {
  return new Date(fecha).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function parseMensajesEnviados(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Skeleton de carga
// ---------------------------------------------------------------------------

function LeadDetailSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-28 bg-[#1a1a1a] rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Panel izquierdo */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-4">
            <div className="h-6 w-40 bg-[#2a2a2a] rounded" />
            <div className="space-y-2">
              <div className="h-3 w-32 bg-[#2a2a2a] rounded" />
              <div className="h-3 w-24 bg-[#2a2a2a] rounded" />
              <div className="h-3 w-36 bg-[#2a2a2a] rounded" />
            </div>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-3">
            <div className="h-9 w-full bg-[#2a2a2a] rounded-[10px]" />
            <div className="h-20 w-full bg-[#2a2a2a] rounded-[10px]" />
            <div className="h-10 w-full bg-[#2a2a2a] rounded-[12px]" />
          </div>
        </div>

        {/* Panel derecho */}
        <div className="lg:col-span-2 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 bg-[#2a2a2a] rounded-full" />
                <div className="h-5 w-16 bg-[#2a2a2a] rounded-full" />
              </div>
              <div className="h-3 w-full bg-[#2a2a2a] rounded" />
              <div className="h-3 w-4/5 bg-[#2a2a2a] rounded" />
              <div className="h-3 w-3/5 bg-[#2a2a2a] rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-12 flex-1 bg-[#2a2a2a] rounded-[12px]" />
                <div className="h-12 w-24 bg-[#2a2a2a] rounded-[12px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Icono WhatsApp SVG
// ---------------------------------------------------------------------------

function WhatsAppIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Card de mensaje individual
// ---------------------------------------------------------------------------

function MensajeCard({ msg, lead, enviados, onToggleEnviado, onWhatsAppClick }) {
  const [copiado, setCopiado] = useState(false)
  const enviado = enviados.includes(msg.id)

  const textoGenerado = msg.generate({
    nombre: lead.nombre ?? 'cliente',
    cantClientes: lead.cantClientes ?? 0,
  })

  const catConfig = CATEGORIAS[msg.category] ?? { label: msg.category, color: '#888888' }
  const badgeVariant = CATEGORIA_BADGE_VARIANT[msg.category] ?? 'gray'

  const waLink = lead.telefono
    ? whatsappLink(lead.telefono, textoGenerado)
    : null

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(textoGenerado)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Fallback para navegadores sin permisos
      const el = document.createElement('textarea')
      el.value = textoGenerado
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  return (
    <div
      className={[
        'rounded-[16px] border transition-all duration-200',
        enviado
          ? 'border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.04)]'
          : 'border-[#2a2a2a] bg-[#1a1a1a]',
      ].join(' ')}
    >
      <div className="p-4 space-y-3">

        {/* Header: categoría + label + checkbox */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <Badge variant={badgeVariant}>
              {catConfig.label}
            </Badge>
            <p className="text-sm font-semibold text-white leading-tight">
              {msg.label}
            </p>
          </div>

          {/* Checkbox enviado */}
          <button
            onClick={() => onToggleEnviado(msg.id)}
            className={[
              'flex items-center gap-1.5 shrink-0 h-8 px-3 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer',
              enviado
                ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.4)] text-[#22c55e]'
                : 'bg-transparent border-[#2a2a2a] text-[#555555] hover:border-[#3a3a3a] hover:text-[#888888]',
            ].join(' ')}
            aria-label={enviado ? 'Marcar como no enviado' : 'Marcar como enviado'}
          >
            {enviado ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Enviado
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                </svg>
                Pendiente
              </>
            )}
          </button>
        </div>

        {/* Condición */}
        <p className="text-[11px] text-[#555555] leading-relaxed">
          {msg.condition}
        </p>

        {/* Preview del mensaje */}
        <div
          className={[
            'rounded-[10px] px-3.5 py-3 border transition-all duration-200',
            enviado
              ? 'bg-[#0d0d0d] border-[rgba(34,197,94,0.2)] opacity-60'
              : 'bg-[#111111] border-[#222222]',
          ].join(' ')}
        >
          <p className="text-xs text-[#aaaaaa] leading-relaxed whitespace-pre-wrap">
            {textoGenerado}
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 pt-1">
          {/* Botón WhatsApp — prominente y grande */}
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onWhatsAppClick(msg.id)}
              className="
                flex-1 flex items-center justify-center gap-2
                min-h-[52px] rounded-[12px]
                bg-[rgba(34,197,94,0.15)] border border-[rgba(34,197,94,0.35)]
                text-[#22c55e] text-sm font-bold
                active:scale-[0.98] transition-all duration-150
                hover:bg-[rgba(34,197,94,0.22)] hover:border-[rgba(34,197,94,0.5)]
              "
            >
              <WhatsAppIcon className="w-5 h-5 shrink-0" />
              Enviar por WhatsApp
            </a>
          ) : (
            <div
              className="
                flex-1 flex items-center justify-center gap-2
                min-h-[52px] rounded-[12px]
                bg-[#111111] border border-[#2a2a2a]
                text-[#444444] text-sm font-semibold
                cursor-not-allowed select-none
              "
            >
              <WhatsAppIcon className="w-5 h-5 shrink-0" />
              Sin teléfono
            </div>
          )}

          {/* Botón Copiar */}
          <button
            onClick={handleCopiar}
            className={[
              'flex items-center justify-center gap-1.5',
              'min-h-[52px] px-4 rounded-[12px]',
              'border text-sm font-medium',
              'active:scale-[0.97] transition-all duration-150',
              copiado
                ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.3)] text-[#22c55e]'
                : 'bg-[#111111] border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#3a3a3a]',
            ].join(' ')}
          >
            {copiado ? (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copiado
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel de información del lead
// ---------------------------------------------------------------------------

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-2 py-2.5 border-b border-[#222222] last:border-0">
      <span className="text-[10px] text-[#555555] uppercase tracking-wide shrink-0 mt-0.5 font-medium">
        {label}
      </span>
      <div className="text-right min-w-0">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function LeadDetallePage({ params }) {
  const { id } = use(params)
  const router = useRouter()

  const [lead,    setLead]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Estado editable
  const [estado,    setEstado]    = useState('')
  const [notas,     setNotas]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState('')

  // Mensajes enviados (array de IDs)
  const [enviados, setEnviados] = useState([])

  // ---------------------------------------------------------------------------
  // Carga inicial
  // ---------------------------------------------------------------------------

  const fetchLead = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/leads/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      const data = await res.json()
      setLead(data)
      setEstado(data.estado ?? 'nuevo')
      setNotas(data.notas ?? '')
      setEnviados(parseMensajesEnviados(data.mensajesEnviados))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  // ---------------------------------------------------------------------------
  // Guardar estado + notas
  // ---------------------------------------------------------------------------

  const handleGuardar = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, notas }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al guardar')
      }
      const data = await res.json()
      setLead((prev) => ({ ...prev, ...data }))
      setSaveMsg('Guardado')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (e) {
      setSaveMsg(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle mensaje enviado
  // ---------------------------------------------------------------------------

  const patchMensajesEnviados = useCallback(async (nuevosEnviados) => {
    try {
      await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensajesEnviados: JSON.stringify(nuevosEnviados) }),
      })
    } catch {
      // silencioso — el estado local ya se actualizó
    }
  }, [id])

  const handleToggleEnviado = useCallback((msgId) => {
    setEnviados((prev) => {
      const nuevo = prev.includes(msgId)
        ? prev.filter((x) => x !== msgId)
        : [...prev, msgId]
      patchMensajesEnviados(nuevo)
      return nuevo
    })
  }, [patchMensajesEnviados])

  // ---------------------------------------------------------------------------
  // Click en botón WhatsApp: marcar enviado + auto-contactado si estaba en nuevo
  // ---------------------------------------------------------------------------

  const handleWhatsAppClick = useCallback(async (msgId) => {
    // Marcar mensaje como enviado si no lo estaba
    setEnviados((prev) => {
      if (prev.includes(msgId)) return prev
      const nuevo = [...prev, msgId]
      patchMensajesEnviados(nuevo)
      return nuevo
    })

    // Auto-cambiar estado a "contactado" si estaba en "nuevo"
    if (estado === 'nuevo') {
      setEstado('contactado')
      setLead((prev) => prev ? { ...prev, estado: 'contactado' } : prev)
      try {
        await fetch(`/api/admin/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'contactado' }),
        })
      } catch {
        // silencioso
      }
    }
  }, [estado, id, patchMensajesEnviados])

  // ---------------------------------------------------------------------------
  // Estados de carga y error
  // ---------------------------------------------------------------------------

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-8">
      <LeadDetailSkeleton />
    </div>
  )

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-24 sm:pb-8">
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-white mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Leads
      </Link>
      <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-4 space-y-2">
        <p className="text-sm text-[#ef4444] font-medium">No se pudo cargar el lead</p>
        <p className="text-xs text-[#ef4444]/70">{error}</p>
        <button
          onClick={fetchLead}
          className="text-xs text-[#ef4444]/70 underline underline-offset-2 hover:text-[#ef4444] transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  )

  const estadoCfg = ESTADO_CONFIG[lead.estado] ?? { label: lead.estado, variant: 'gray' }
  const mensajesEnviadosCount = enviados.length

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-24 sm:pb-8">

      {/* Botón volver */}
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-white mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a Leads
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ================================================================ */}
        {/* PANEL IZQUIERDO / ARRIBA — Info del lead                         */}
        {/* ================================================================ */}
        <div className="lg:col-span-1 space-y-4">

          {/* Card de información */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5">

            {/* Nombre + estado */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-white leading-tight break-words">
                  {lead.nombre}
                </h1>
              </div>
              <Badge variant={estadoCfg.variant} className="shrink-0 mt-0.5">
                {estadoCfg.label}
              </Badge>
            </div>

            {/* Filas de datos */}
            <div className="space-y-0">

              {/* Teléfono */}
              {lead.telefono && (
                <InfoRow label="Teléfono">
                  <a
                    href={`tel:${lead.telefono}`}
                    className="text-sm text-[#f5c518] font-semibold hover:text-[#f0b800] transition-colors"
                  >
                    {lead.telefono}
                  </a>
                </InfoRow>
              )}

              {/* Clientes */}
              {lead.cantClientes != null && (
                <InfoRow label="Clientes">
                  <Badge variant="gray">
                    {lead.cantClientes} clientes
                  </Badge>
                </InfoRow>
              )}

              {/* Anuncio ID */}
              {lead.adId && (
                <InfoRow label="Anuncio ID">
                  <span className="text-[11px] text-[#555555] font-mono break-all">{lead.adId}</span>
                </InfoRow>
              )}

              {/* Registrado */}
              <InfoRow label="Registrado">
                <div className="text-right">
                  <p className="text-xs text-[#888888]">{haceTiempo(lead.createdAt)}</p>
                  <p className="text-[10px] text-[#555555] mt-0.5">{formatFechaLarga(lead.createdAt)}</p>
                </div>
              </InfoRow>

              {/* Org vinculada */}
              <InfoRow label="Org vinculada">
                {lead.organization?.nombre ? (
                  <span className="text-xs text-[#22c55e] font-medium">{lead.organization.nombre}</span>
                ) : (
                  <span className="text-xs text-[#555555]">Sin registrar</span>
                )}
              </InfoRow>

            </div>
          </div>

          {/* Card de estado + notas */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-4">
            <p className="text-[10px] text-[#555555] uppercase tracking-wide font-semibold">
              Estado y notas
            </p>

            {/* Select de estado */}
            <div>
              <label className="text-[10px] text-[#555555] uppercase tracking-wide block mb-1.5">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-sm text-white focus:outline-none focus:border-[rgba(245,197,24,0.4)] transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%23666' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px', paddingRight: '32px' }}
              >
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="registrado">Registrado</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>

            {/* Textarea de notas */}
            <div>
              <label className="text-[10px] text-[#555555] uppercase tracking-wide block mb-1.5">
                Notas internas
              </label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={4}
                placeholder="Agrega notas sobre este lead..."
                className="w-full px-3 py-2.5 rounded-[10px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[rgba(245,197,24,0.4)] resize-none transition-colors"
              />
            </div>

            {/* Botón guardar + feedback */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                loading={saving}
                onClick={handleGuardar}
                className="flex-1"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
              {saveMsg && (
                <span
                  className={[
                    'text-xs font-medium transition-all',
                    saveMsg === 'Guardado' ? 'text-[#22c55e]' : 'text-[#ef4444]',
                  ].join(' ')}
                >
                  {saveMsg === 'Guardado' ? '✓ Guardado' : saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* Resumen mensajes enviados */}
          {mensajesEnviadosCount > 0 && (
            <div className="bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.2)] rounded-[14px] px-4 py-3">
              <p className="text-xs text-[#22c55e] font-medium">
                {mensajesEnviadosCount} de {MENSAJES.length} mensajes enviados
              </p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {MENSAJES.map((msg) => (
                  <div
                    key={msg.id}
                    className={[
                      'w-2 h-2 rounded-full transition-colors',
                      enviados.includes(msg.id) ? 'bg-[#22c55e]' : 'bg-[#2a2a2a]',
                    ].join(' ')}
                    title={msg.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* PANEL DERECHO / ABAJO — Guía de mensajes WhatsApp               */}
        {/* ================================================================ */}
        <div className="lg:col-span-2">

          {/* Header de la sección */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">
                Mensajes WhatsApp
              </h2>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Flujo guiado · toca para abrir en WhatsApp
              </p>
            </div>
            <div className="flex items-center gap-2">
              <WhatsAppIcon className="w-5 h-5 text-[#22c55e]" />
              <span className="text-xs text-[#555555]">
                {mensajesEnviadosCount}/{MENSAJES.length}
              </span>
            </div>
          </div>

          {/* Agrupado por categoría */}
          {['inicial', 'respuesta', 'seguimiento'].map((cat) => {
            const msgsDeCategoria = MENSAJES.filter((m) => m.category === cat)
            const catCfg = CATEGORIAS[cat]
            const badgeVariant = CATEGORIA_BADGE_VARIANT[cat] ?? 'gray'
            const enviadosEnCat = msgsDeCategoria.filter((m) => enviados.includes(m.id)).length

            return (
              <div key={cat} className="mb-6">
                {/* Separador de categoría */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: catCfg.color }}
                  />
                  <span className="text-xs font-semibold text-[#888888] uppercase tracking-wide">
                    {catCfg.label}
                  </span>
                  <div className="flex-1 h-px bg-[#1e1e1e]" />
                  {enviadosEnCat > 0 && (
                    <span className="text-[10px] text-[#22c55e] font-medium">
                      {enviadosEnCat}/{msgsDeCategoria.length} enviados
                    </span>
                  )}
                </div>

                {/* Cards de mensajes */}
                <div className="space-y-3">
                  {msgsDeCategoria.map((msg) => (
                    <MensajeCard
                      key={msg.id}
                      msg={msg}
                      lead={lead}
                      enviados={enviados}
                      onToggleEnviado={handleToggleEnviado}
                      onWhatsAppClick={handleWhatsAppClick}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
