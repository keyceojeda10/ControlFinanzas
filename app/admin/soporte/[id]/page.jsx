'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADO_BADGE = {
  abierto: { label: 'Abierto', variant: 'yellow' },
  en_progreso: { label: 'En progreso', variant: 'blue' },
  resuelto: { label: 'Resuelto', variant: 'green' },
  cerrado: { label: 'Cerrado', variant: 'gray' },
}

const TIPO_LABEL = {
  bug: 'Error', pregunta: 'Pregunta', solicitud: 'Solicitud',
  problema_pago: 'Pago', otro: 'Otro',
}

export default function AdminTicketDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [updatingEstado, setUpdatingEstado] = useState(false)
  const chatRef = useRef(null)
  const lastTimestampRef = useRef(null)

  useEffect(() => {
    fetch(`/api/soporte/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) return
        setTicket(data)
        setMensajes(data.mensajes || [])
        if (data.mensajes?.length) {
          lastTimestampRef.current = data.mensajes[data.mensajes.length - 1].createdAt
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // Polling
  const pollMensajes = useCallback(async () => {
    if (!lastTimestampRef.current) return
    try {
      const res = await fetch(`/api/soporte/${id}/mensajes?despues=${lastTimestampRef.current}`)
      const nuevos = await res.json()
      if (Array.isArray(nuevos) && nuevos.length > 0) {
        setMensajes(prev => [...prev, ...nuevos])
        lastTimestampRef.current = nuevos[nuevos.length - 1].createdAt
      }
    } catch {}
  }, [id])

  useEffect(() => {
    const interval = setInterval(pollMensajes, 5000)
    return () => clearInterval(interval)
  }, [pollMensajes])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if (!mensaje.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/soporte/${id}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: mensaje.trim() }),
      })
      const nuevo = await res.json()
      if (!nuevo.error) {
        setMensajes(prev => [...prev, nuevo])
        lastTimestampRef.current = nuevo.createdAt
        setMensaje('')
      }
    } catch {}
    setSending(false)
  }

  const cambiarEstado = async (nuevoEstado) => {
    setUpdatingEstado(true)
    try {
      const res = await fetch(`/api/soporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      const data = await res.json()
      if (!data.error) setTicket(prev => ({ ...prev, estado: nuevoEstado }))
    } catch {}
    setUpdatingEstado(false)
  }

  const marcarContactado = async () => {
    try {
      const res = await fetch(`/api/soporte/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactoAtendido: true }),
      })
      const data = await res.json()
      if (!data.error) setTicket(prev => ({ ...prev, contactoAtendido: true }))
    } catch {}
  }

  if (loading) return <div><SkeletonCard /><SkeletonCard /></div>
  if (!ticket) return <p className="text-sm text-[#888888] text-center py-12">Ticket no encontrado</p>

  const estado = ESTADO_BADGE[ticket.estado] || ESTADO_BADGE.abierto

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.push('/admin/soporte')} className="text-xs text-[#888888] hover:text-white transition-colors mb-3 flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Todos los tickets
      </button>

      {/* Info del ticket */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-base font-bold text-white mb-1.5">{ticket.asunto}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="gray">{TIPO_LABEL[ticket.tipo] || ticket.tipo}</Badge>
              <Badge variant={estado.variant}>{estado.label}</Badge>
            </div>
          </div>
          <span className="text-[10px] text-[#555555] shrink-0">
            {new Date(ticket.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <p className="text-xs text-[#888888] leading-relaxed mb-4">{ticket.descripcion}</p>

        {/* Info del usuario */}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-[10px] p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">{ticket.user?.nombre}</p>
              <p className="text-[10px] text-[#888888]">{ticket.user?.email} — {ticket.organization?.nombre} ({ticket.organization?.plan})</p>
            </div>
          </div>
        </div>

        {/* Solicitud de contacto */}
        {ticket.solicitaContacto && (
          <div className={`rounded-[10px] p-3 mb-4 border ${ticket.contactoAtendido ? 'bg-[rgba(34,197,94,0.05)] border-[rgba(34,197,94,0.15)]' : 'bg-[rgba(245,158,11,0.05)] border-[rgba(245,158,11,0.15)]'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-white">Solicita contacto telefónico</p>
                <p className="text-sm font-bold text-[#f5c518] mt-0.5">{ticket.telefonoContacto || 'Sin teléfono'}</p>
              </div>
              {!ticket.contactoAtendido && (
                <Button size="sm" variant="success" onClick={marcarContactado}>
                  Marcar contactado
                </Button>
              )}
              {ticket.contactoAtendido && <Badge variant="green">Contactado</Badge>}
            </div>
          </div>
        )}

        {/* Cambiar estado */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#888888]">Estado:</span>
          {['abierto', 'en_progreso', 'resuelto', 'cerrado'].map(e => (
            <button
              key={e}
              onClick={() => cambiarEstado(e)}
              disabled={updatingEstado || ticket.estado === e}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                ticket.estado === e
                  ? 'bg-[#f5c518] text-[#0a0a0a]'
                  : 'bg-[#1a1a1a] text-[#888888] hover:text-white border border-[#2a2a2a] disabled:opacity-50'
              }`}
            >
              {ESTADO_BADGE[e].label}
            </button>
          ))}
        </div>
      </Card>

      {/* Chat */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-[#2a2a2a]">
          <p className="text-xs font-semibold text-white">Conversación</p>
        </div>

        <div ref={chatRef} className="px-4 py-4 space-y-3 max-h-[400px] overflow-y-auto">
          {mensajes.length === 0 ? (
            <p className="text-xs text-[#555555] text-center py-6">No hay mensajes. Responde al usuario aquí.</p>
          ) : (
            mensajes.map(m => (
              <div key={m.id} className={`flex ${m.esAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-[12px] px-3.5 py-2.5 ${
                  m.esAdmin
                    ? 'bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.15)]'
                    : 'bg-[#111111] border border-[#2a2a2a]'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-[#888888]">
                      {m.esAdmin ? 'Tú (Soporte)' : m.user?.nombre || 'Usuario'}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed whitespace-pre-wrap">{m.contenido}</p>
                  <p className="text-[9px] text-[#555555] mt-1 text-right">
                    {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={enviarMensaje} className="px-4 py-3 border-t border-[#2a2a2a] flex items-center gap-2">
          <input
            type="text"
            value={mensaje}
            onChange={e => setMensaje(e.target.value)}
            placeholder="Responder al usuario..."
            className="flex-1 h-9 rounded-[10px] bg-[#111111] border border-[#2a2a2a] px-3 text-xs text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518]"
          />
          <Button type="submit" size="sm" loading={sending} disabled={!mensaje.trim()}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </form>
      </Card>
    </div>
  )
}
