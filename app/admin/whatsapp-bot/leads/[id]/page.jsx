'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADO_COLORS = {
  pendiente: '#f5c518',
  contactado: '#3b82f6',
  interesado: '#10b981',
  no_interesado: '#888888',
  cerrado: '#8b5cf6',
  bloqueado: '#ef4444',
}

const ESTADOS = ['pendiente', 'contactado', 'interesado', 'no_interesado', 'cerrado', 'bloqueado']

function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function BotLeadDetalle() {
  const { id } = useParams()
  const router = useRouter()
  const [lead, setLead] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [loading, setLoading] = useState(true)
  const chatRef = useRef(null)
  const cargaInicial = useRef(true)
  const scrollBloqueado = useRef(false)

  const cargar = useCallback(async () => {
    try {
      const [lRes, cRes] = await Promise.all([
        fetch(`/api/admin/whatsapp-bot/leads/${id}`),
        fetch(`/api/admin/whatsapp-bot/leads/${id}/conversacion`),
      ])
      if (!lRes.ok) { router.push('/admin/whatsapp-bot/leads'); return }
      const [l, c] = await Promise.all([lRes.json(), cRes.json()])
      setLead(l)
      setMensajes(c)
    } catch {} finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { cargar() }, [cargar])

  // Polling cada 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/whatsapp-bot/leads/${id}/conversacion`)
        if (res.ok) {
          const c = await res.json()
          setMensajes(c)
        }
      } catch {}
    }, 10000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    const el = chatRef.current
    if (!el || mensajes.length === 0) return
    if (cargaInicial.current) {
      // Primera carga: ir al fondo sin condicion
      el.scrollTop = el.scrollHeight
      cargaInicial.current = false
      return
    }
    // Polling: solo scrollear si el usuario NO esta leyendo hacia arriba
    if (!scrollBloqueado.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [mensajes])

  function handleScroll() {
    const el = chatRef.current
    if (!el) return
    // Si el usuario subio mas de 80px del fondo -> bloquear auto-scroll
    const distanciaAlFondo = el.scrollHeight - el.scrollTop - el.clientHeight
    scrollBloqueado.current = distanciaAlFondo > 80
  }

  async function cambiarEstado(nuevoEstado) {
    try {
      const res = await fetch(`/api/admin/whatsapp-bot/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLead(updated)
      }
    } catch {}
  }

  async function toggleBot() {
    if (!lead) return
    try {
      const res = await fetch(`/api/admin/whatsapp-bot/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botActivo: !lead.botActivo }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLead(updated)
      }
    } catch {}
  }

  async function eliminar() {
    if (!confirm('Eliminar este lead y toda su conversacion?')) return
    try {
      await fetch(`/api/admin/whatsapp-bot/leads/${id}`, { method: 'DELETE' })
      router.push('/admin/whatsapp-bot/leads')
    } catch {}
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /></div>
  }

  if (!lead) return <p className="text-[var(--color-danger)] text-sm">Lead no encontrado</p>

  const tel = (lead.telefono || '').replace(/\D/g, '')

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/admin/whatsapp-bot/leads" className="text-[var(--color-text-muted)] hover:text-white transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-[white] flex-1 truncate">{lead.nombre}</h1>
        <a
          href={`https://wa.me/${tel}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[rgba(16,185,129,0.12)] text-[#10b981] hover:bg-[rgba(16,185,129,0.2)] transition-all"
        >
          WhatsApp
        </a>
      </div>

      {/* Info card */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Telefono</p>
            <p className="text-white font-mono-display text-xs">{lead.telefono}</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Estado</p>
            <span
              className="text-xs font-medium capitalize"
              style={{ color: ESTADO_COLORS[lead.estado] || '#888' }}
            >
              {lead.estado?.replace('_', ' ')}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Temperatura</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${lead.temperatura}%`,
                    background: lead.temperatura > 70 ? '#ef4444' : lead.temperatura > 40 ? '#f5c518' : '#3b82f6',
                  }}
                />
              </div>
              <span className="text-xs text-white">{lead.temperatura}/100</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Bot</p>
            <span className={`text-xs font-medium ${lead.botActivo ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              {lead.botActivo ? 'Activo' : 'Apagado'}
            </span>
          </div>
          {lead.cantClientes && (
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Clientes</p>
              <p className="text-xs text-white">{lead.cantClientes}</p>
            </div>
          )}
          {lead.metodoActual && (
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Metodo</p>
              <p className="text-xs text-white">{lead.metodoActual}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Creado</p>
            <p className="text-xs text-white">{formatFecha(lead.createdAt)}</p>
          </div>
          {lead.fechaContacto && (
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Contactado</p>
              <p className="text-xs text-white">{formatFecha(lead.fechaContacto)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        <select
          value={lead.estado}
          onChange={e => cambiarEstado(e.target.value)}
          className="px-3 py-1.5 rounded-[8px] text-xs bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white focus:outline-none"
        >
          {ESTADOS.map(e => (
            <option key={e} value={e}>{e.replace('_', ' ')}</option>
          ))}
        </select>
        <button
          onClick={toggleBot}
          className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all ${
            lead.botActivo
              ? 'bg-[rgba(239,68,68,0.12)] text-[#ef4444]'
              : 'bg-[rgba(16,185,129,0.12)] text-[#10b981]'
          }`}
        >
          {lead.botActivo ? 'Apagar bot' : 'Encender bot'}
        </button>
        <button
          onClick={eliminar}
          className="px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[rgba(239,68,68,0.06)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.15)] transition-all ml-auto"
        >
          Eliminar
        </button>
      </div>

      {/* Chat */}
      <div className="border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[white]">Conversacion ({mensajes.length})</h2>
        </div>
        <div ref={chatRef} onScroll={handleScroll} className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          {mensajes.map(msg => {
            const esBot = msg.rol === 'bot'
            return (
              <div key={msg.id} className={`flex ${esBot ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-[12px] text-sm ${
                    esBot
                      ? 'bg-[rgba(59,130,246,0.12)] text-[#93c5fd]'
                      : 'bg-[rgba(255,255,255,0.06)] text-[#e0e0e0]'
                  }`}
                >
                  {msg.tipoMensaje !== 'chat' && (
                    <span className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">
                      [{msg.tipoMensaje}]
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] mt-1 text-right">
                    {formatFecha(msg.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
          {mensajes.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Sin mensajes aun</p>
          )}
        </div>
      </div>
    </div>
  )
}
