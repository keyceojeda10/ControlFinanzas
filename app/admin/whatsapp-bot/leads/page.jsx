'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADOS = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes', color: '#f5c518' },
  { key: 'contactado', label: 'Contactados', color: '#3b82f6' },
  { key: 'interesado', label: 'Interesados', color: '#10b981' },
  { key: 'no_interesado', label: 'No interesado', color: '#888888' },
  { key: 'cerrado', label: 'Cerrados', color: '#8b5cf6' },
  { key: 'bloqueado', label: 'Bloqueados', color: '#ef4444' },
]

const ESTADO_COLORS = {
  pendiente: '#f5c518',
  contactado: '#3b82f6',
  interesado: '#10b981',
  no_interesado: '#888888',
  cerrado: '#8b5cf6',
  bloqueado: '#ef4444',
}

function tiempoRelativo(fecha) {
  const ms = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const dias = Math.floor(hrs / 24)
  return `${dias}d`
}

export default function WhatsAppBotLeads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estado) params.set('estado', estado)
      if (busqueda) params.set('q', busqueda)
      params.set('pagina', pagina)
      const res = await fetch(`/api/admin/whatsapp-bot/leads?${params}`)
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.total || 0)
    } catch {} finally {
      setLoading(false)
    }
  }, [estado, busqueda, pagina])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[white]">Leads del Bot</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{total} leads en total</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-2 rounded-[10px] text-sm font-medium bg-[rgba(245,197,24,0.12)] text-[#f5c518] hover:bg-[rgba(245,197,24,0.2)] transition-all"
        >
          + Lead manual
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {ESTADOS.map(e => (
          <button
            key={e.key}
            onClick={() => { setEstado(e.key); setPagina(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              estado === e.key
                ? 'bg-[rgba(245,197,24,0.15)] text-[#f5c518]'
                : 'bg-[rgba(136,136,136,0.08)] text-[#888888] hover:text-white'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Busqueda */}
      <input
        type="text"
        placeholder="Buscar por nombre o telefono..."
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[white] placeholder-[#555] focus:outline-none focus:border-[#f5c518]"
      />

      {/* Lista */}
      {loading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)] divide-y divide-[var(--color-border)]">
          {leads.map(lead => (
            <Link
              key={lead.id}
              href={`/admin/whatsapp-bot/leads/${lead.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[white] font-medium truncate">{lead.nombre}</p>
                  {lead.botActivo && <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">{lead.telefono}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {/* Temperatura */}
                <div className="hidden sm:flex items-center gap-1">
                  <div className="w-12 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${lead.temperatura}%`,
                        background: lead.temperatura > 70 ? '#ef4444' : lead.temperatura > 40 ? '#f5c518' : '#3b82f6',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] w-6 text-right">{lead.temperatura}</span>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    color: ESTADO_COLORS[lead.estado] || '#888',
                    background: `${ESTADO_COLORS[lead.estado] || '#888'}1a`,
                  }}
                >
                  {lead.estado?.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{tiempoRelativo(lead.createdAt)}</span>
              </div>
            </Link>
          ))}
          {leads.length === 0 && (
            <p className="px-4 py-8 text-sm text-[var(--color-text-muted)] text-center">Sin leads</p>
          )}
        </div>
      )}

      {/* Paginacion */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            disabled={pagina === 1}
            className="px-3 py-1 rounded-[8px] text-xs bg-[rgba(136,136,136,0.08)] text-[#888] disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-[var(--color-text-muted)] self-center">
            {pagina} / {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPagina(p => p + 1)}
            disabled={pagina >= Math.ceil(total / 50)}
            className="px-3 py-1 rounded-[8px] text-xs bg-[rgba(136,136,136,0.08)] text-[#888] disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal crear lead */}
      {modalOpen && (
        <ModalCrearLead
          onClose={() => setModalOpen(false)}
          onCreado={() => { setModalOpen(false); cargar() }}
        />
      )}
    </div>
  )
}

function ModalCrearLead({ onClose, onCreado }) {
  const [form, setForm] = useState({ nombre: '', telefono: '', cantClientes: '', esPrestamista: '', metodoActual: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function guardar(e) {
    e.preventDefault()
    if (!form.telefono) { setError('Telefono requerido'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/whatsapp-bot/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        onCreado()
      } else {
        const data = await res.json()
        setError(data.error || 'Error creando lead')
      }
    } catch {
      setError('Error de red')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-[#111] border border-[var(--color-border)] rounded-[16px] p-5 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-white mb-4">Crear lead manual</h2>
        <form onSubmit={guardar} className="space-y-3">
          {[
            { key: 'nombre', label: 'Nombre', placeholder: 'Juan Perez' },
            { key: 'telefono', label: 'Telefono', placeholder: '573001234567' },
            { key: 'cantClientes', label: 'Cant. clientes', placeholder: '50' },
            { key: 'metodoActual', label: 'Metodo actual', placeholder: 'Libreta / Excel / Sistema' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[11px] text-[var(--color-text-muted)] mb-1 block">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 rounded-[8px] bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#f5c518]"
              />
            </div>
          ))}
          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 rounded-[8px] text-sm bg-[rgba(136,136,136,0.08)] text-[#888]">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-3 py-2 rounded-[8px] text-sm font-medium bg-[rgba(245,197,24,0.15)] text-[#f5c518]">
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
