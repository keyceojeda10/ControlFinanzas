'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { useOnline } from '@/hooks/useOnline'
import OfflineFallback from '@/components/offline/OfflineFallback'

const ESTADO_BADGE = {
  abierto: { label: 'Abierto', variant: 'yellow' },
  en_progreso: { label: 'En progreso', variant: 'blue' },
  resuelto: { label: 'Resuelto', variant: 'green' },
  cerrado: { label: 'Cerrado', variant: 'gray' },
}

const TIPO_LABEL = {
  bug: 'Error',
  pregunta: 'Pregunta',
  solicitud: 'Solicitud',
  problema_pago: 'Pago',
  otro: 'Otro',
}

export default function TicketDetallePage() {
  const online = useOnline()
  if (!online) return <OfflineFallback titulo="El ticket no esta disponible sin conexion" volverHref="/soporte" volverLabel="Volver a Soporte" />
  return <TicketDetallePageInner />
}

function TicketDetallePageInner() {
  const { id } = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState(null)
  const [mensajes, setMensajes] = useState([])
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [imagenFile, setImagenFile] = useState(null)
  const chatRef = useRef(null)
  const lastTimestampRef = useRef(null)
  const fileInputRef = useRef(null)

  // Cargar ticket inicial
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

  // Polling cada 5 segundos para nuevos mensajes
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

  // Auto-scroll al final del chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensajes])

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Formato no permitido. Usa JPG, PNG, WebP o GIF')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB')
      return
    }
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const cancelarImagen = () => {
    setImagenFile(null)
    setImagenPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const enviarMensaje = async (e) => {
    e.preventDefault()
    if ((!mensaje.trim() && !imagenFile) || sending) return
    setSending(true)
    try {
      let nuevo
      if (imagenFile) {
        const formData = new FormData()
        formData.append('imagen', imagenFile)
        formData.append('contenido', mensaje.trim())
        const res = await fetch(`/api/soporte/${id}/upload`, { method: 'POST', body: formData })
        nuevo = await res.json()
      } else {
        const res = await fetch(`/api/soporte/${id}/mensajes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contenido: mensaje.trim() }),
        })
        nuevo = await res.json()
      }
      if (!nuevo.error) {
        setMensajes(prev => [...prev, nuevo])
        lastTimestampRef.current = nuevo.createdAt
        setMensaje('')
        cancelarImagen()
      }
    } catch {}
    setSending(false)
  }

  if (loading) return <div className="max-w-2xl mx-auto"><SkeletonCard /><SkeletonCard /></div>

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-sm text-[var(--color-text-muted)]">Ticket no encontrado</p>
      </div>
    )
  }

  const estado = ESTADO_BADGE[ticket.estado] || ESTADO_BADGE.abierto
  const cerrado = ticket.estado === 'cerrado' || ticket.estado === 'resuelto'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <button onClick={() => router.push('/soporte')} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-3 flex items-center gap-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Mis tickets
      </button>

      {/* Ticket info */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-base font-bold text-[var(--color-text-primary)]">{ticket.asunto}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="gray">{TIPO_LABEL[ticket.tipo] || ticket.tipo}</Badge>
              <Badge variant={estado.variant}>{estado.label}</Badge>
              {ticket.solicitaContacto && (
                <Badge variant={ticket.contactoAtendido ? 'green' : 'yellow'}>
                  {ticket.contactoAtendido ? 'Contactado' : 'Contacto solicitado'}
                </Badge>
              )}
            </div>
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
            {new Date(ticket.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{ticket.descripcion}</p>
      </Card>

      {/* Chat */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-primary)]">Conversación</p>
        </div>

        <div ref={chatRef} className="px-4 py-4 space-y-3 max-h-[400px] overflow-y-auto">
          {mensajes.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
              {cerrado ? 'No hay mensajes en este ticket' : 'Escribe un mensaje para comenzar la conversación'}
            </p>
          ) : (
            mensajes.map(m => {
              const esSistema = m.contenido?.startsWith('✅') || m.contenido?.startsWith('🔒')
              if (esSistema) {
                return (
                  <div key={m.id} className="flex justify-center">
                    <div className="max-w-[90%] rounded-[12px] px-4 py-3 bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.2)]">
                      <p className="text-xs text-[var(--color-purple)] leading-relaxed whitespace-pre-wrap font-medium">{m.contenido}</p>
                      <p className="text-[9px] text-[var(--color-text-muted)] mt-1 text-right">
                        {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} className={`flex ${m.esAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-[12px] px-3.5 py-2.5 ${
                    m.esAdmin
                      ? 'bg-[var(--color-bg-card)] border border-[var(--color-border)]'
                      : 'bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.15)]'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                        {m.esAdmin ? 'Soporte' : m.user?.nombre || 'Tú'}
                      </span>
                    </div>
                    {m.imagenUrl && (
                      <a href={m.imagenUrl} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                        <Image
                          src={m.imagenUrl}
                          alt="Imagen adjunta"
                          width={800}
                          height={600}
                          unoptimized
                          className="max-w-full max-h-[200px] rounded-[8px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                    {m.contenido && <p className="text-xs text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">{m.contenido}</p>}
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-1 text-right">
                      {new Date(m.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Preview imagen */}
        {!cerrado && imagenPreview && (
          <div className="px-4 py-2 border-t border-[var(--color-border)] flex items-center gap-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagenPreview} alt="Preview" className="h-16 rounded-[8px] object-contain" />
              <button
                onClick={cancelarImagen}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-danger)] flex items-center justify-center text-[var(--color-text-primary)] text-[10px]"
              >
                ✕
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)]">{imagenFile?.name}</p>
          </div>
        )}

        {/* Input */}
        {!cerrado && (
          <form onSubmit={enviarMensaje} className="px-4 py-3 border-t border-[var(--color-border)] flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all shrink-0"
              title="Adjuntar imagen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <input
              type="text"
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 h-9 rounded-[10px] bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 text-xs text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <Button type="submit" size="sm" loading={sending} disabled={!mensaje.trim() && !imagenFile}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </form>
        )}

        {cerrado && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Este ticket está {ticket.estado}. Si necesitas más ayuda, crea un nuevo ticket.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
