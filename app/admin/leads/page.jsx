'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { MENSAJES, whatsappLink } from '@/lib/leadMessages'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const estadoConfig = {
  nuevo:      { label: 'Nuevo',      variant: 'blue'   },
  contactado: { label: 'Contactado', variant: 'yellow' },
  registrado: { label: 'Registrado', variant: 'green'  },
  descartado: { label: 'Descartado', variant: 'red'    },
}

const FILTROS = [
  { key: '',           label: 'Todos'       },
  { key: 'nuevo',      label: 'Nuevos'      },
  { key: 'contactado', label: 'Contactados' },
  { key: 'registrado', label: 'Registrados' },
  { key: 'descartado', label: 'Descartados' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haceTiempo(fecha) {
  const ms = Date.now() - new Date(fecha).getTime()
  const dias = Math.floor(ms / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias}d`
}

function buildWhatsappLink(lead) {
  if (!lead.telefono) return null
  const idx = (lead.cantClientes ?? 0) >= 50 ? 1 : 0
  const mensaje = MENSAJES[idx].generate({
    nombre: lead.nombre,
    cantClientes: lead.cantClientes,
  })
  return whatsappLink(lead.telefono, mensaje)
}

// ---------------------------------------------------------------------------
// Skeleton de lead card (mobile)
// ---------------------------------------------------------------------------

function LeadCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-36 bg-[#2a2a2a] rounded" />
          <div className="h-3 w-24 bg-[#2a2a2a] rounded" />
        </div>
        <div className="h-5 w-16 bg-[#2a2a2a] rounded-full" />
      </div>
      <div className="h-3 w-full bg-[#2a2a2a] rounded" />
      <div className="flex gap-2 pt-1">
        <div className="h-11 flex-1 bg-[#2a2a2a] rounded-[12px]" />
        <div className="h-11 w-24 bg-[#2a2a2a] rounded-[12px]" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lead Card
// ---------------------------------------------------------------------------

function LeadCard({ lead }) {
  const cfg = estadoConfig[lead.estado] ?? { label: lead.estado, variant: 'gray' }
  const waLink = buildWhatsappLink(lead)

  return (
    <Card className="space-y-3">
      {/* Row 1: nombre + tiempo + estado */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-white leading-tight truncate">
            {lead.nombre}
          </p>
          {lead.telefono && (
            <p className="text-xs text-[#666666] mt-0.5">{lead.telefono}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[11px] text-[#555555]">{haceTiempo(lead.createdAt)}</span>
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        </div>
      </div>

      {/* Row 2: badges secundarios */}
      {(lead.cantClientes != null || lead.orgVinculada) && (
        <div className="flex flex-wrap items-center gap-2">
          {lead.cantClientes != null && (
            <Badge variant="gray">{lead.cantClientes} clientes</Badge>
          )}
          {lead.orgVinculada && (
            <span className="text-[11px] text-[#22c55e] font-medium">
              Org: {lead.orgVinculada}
            </span>
          )}
        </div>
      )}

      {/* Row 3: botones de acción — grandes y tocables */}
      <div className="flex gap-2 pt-1">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex-1 flex items-center justify-center gap-2
              min-h-[48px] rounded-[12px]
              bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)]
              text-[#22c55e] text-sm font-semibold
              active:scale-[0.98] transition-all
            "
          >
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </a>
        ) : (
          <div
            className="
              flex-1 flex items-center justify-center gap-2
              min-h-[48px] rounded-[12px]
              bg-[#1f1f1f] border border-[#2a2a2a]
              text-[#444444] text-sm font-semibold cursor-not-allowed select-none
            "
          >
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Sin tel.
          </div>
        )}

        <Link
          href={`/admin/leads/${lead.id}`}
          className="
            flex items-center justify-center gap-1.5
            min-h-[48px] px-5 rounded-[12px]
            bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.25)]
            text-[#f5c518] text-sm font-semibold
            active:scale-[0.98] transition-all whitespace-nowrap
          "
        >
          Ver
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stats cards
// ---------------------------------------------------------------------------

function StatsGrid({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[14px] px-4 py-3 animate-pulse"
          >
            <div className="h-2.5 w-14 bg-[#2a2a2a] rounded mb-2" />
            <div className="h-7 w-10 bg-[#2a2a2a] rounded" />
          </div>
        ))}
      </div>
    )
  }

  const items = [
    {
      label: 'Hoy',
      value: stats?.totalHoy ?? 0,
      color: '#f5c518',
    },
    {
      label: 'Total',
      value: stats?.total ?? 0,
      color: 'white',
    },
    {
      label: 'Contactados',
      value: stats?.porEstado?.contactado ?? 0,
      color: '#3b82f6',
    },
    {
      label: 'Conversión',
      value: stats?.tasaConversion != null ? `${stats.tasaConversion}%` : '0%',
      color: '#22c55e',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[14px] px-4 py-3 text-center"
        >
          <p className="text-[11px] text-[#555555] uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1 leading-none" style={{ color }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function LeadsPage() {
  const [leads,   setLeads]   = useState([])
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [filtroEstado, setFiltroEstado] = useState('')
  const [q,            setQ]            = useState('')
  const [inputQ,       setInputQ]       = useState('')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    if (q)            params.set('q', q)
    try {
      const res = await fetch(`/api/admin/leads?${params}`)
      if (!res.ok) throw new Error('Error al cargar leads')
      const data = await res.json()
      setLeads(Array.isArray(data.leads) ? data.leads : [])
      setStats(data.stats ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, q])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleSearch = (e) => {
    e.preventDefault()
    setQ(inputQ.trim())
  }

  const countPorEstado = (key) => {
    if (!stats?.porEstado) return null
    return stats.porEstado[key] ?? 0
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 sm:pb-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <p className="text-sm text-[#555555] mt-0.5">Facebook Ads</p>
      </div>

      {/* Stats */}
      <StatsGrid stats={stats} loading={loading && !stats} />

      {/* Búsqueda */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="
            flex-1 h-11 px-4 rounded-[12px]
            border border-[#2a2a2a] bg-[#111111]
            text-sm text-white placeholder-[#444444]
            focus:outline-none focus:border-[#f5c518]/40
          "
        />
        <button
          type="submit"
          className="
            h-11 px-4 rounded-[12px]
            bg-[rgba(245,197,24,0.12)] border border-[rgba(245,197,24,0.25)]
            text-[#f5c518] text-sm font-medium
            active:scale-[0.97] transition-all
          "
        >
          Buscar
        </button>
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); setInputQ('') }}
            className="
              h-11 px-4 rounded-[12px]
              border border-[#2a2a2a]
              text-[#555555] text-sm
              hover:text-white transition-colors
            "
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Filtros pill — scroll horizontal en mobile */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
          {FILTROS.map(({ key, label }) => {
            const count = key ? countPorEstado(key) : null
            const active = filtroEstado === key
            return (
              <button
                key={key}
                onClick={() => setFiltroEstado(key)}
                className={[
                  'flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-[rgba(245,197,24,0.15)] border border-[rgba(245,197,24,0.3)] text-[#f5c518]'
                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#888888] hover:text-white hover:border-[#3a3a3a]',
                ].join(' ')}
              >
                {label}
                {count != null && (
                  <span
                    className={[
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
                      active
                        ? 'bg-[rgba(245,197,24,0.25)] text-[#f5c518]'
                        : 'bg-[#2a2a2a] text-[#666666]',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[12px] px-4 py-3">
          <p className="text-sm text-[#ef4444]">{error}</p>
          <button
            onClick={fetchLeads}
            className="mt-2 text-xs text-[#ef4444]/70 underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#444444] text-sm">
            {filtroEstado || q
              ? 'No hay leads con ese filtro'
              : 'No hay leads todavía'}
          </p>
          {(filtroEstado || q) && (
            <button
              onClick={() => { setFiltroEstado(''); setQ(''); setInputQ('') }}
              className="mt-3 text-xs text-[#f5c518]/70 underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  )
}
