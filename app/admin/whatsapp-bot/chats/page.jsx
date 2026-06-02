'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

const ESTADO_COLORS = {
  pendiente: '#f5c518', contactado: '#3b82f6', interesado: '#10b981',
  no_interesado: '#888888', cerrado: '#8b5cf6', bloqueado: '#ef4444',
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'calientes', label: 'Calientes' },
  { id: 'sin_contestar', label: 'Sin contestar' },
  { id: 'bot_off', label: 'Bot apagado' },
]

function horaCorta(d) {
  if (!d) return ''
  const date = new Date(d)
  const hoy = new Date()
  const mismaFecha = date.toDateString() === hoy.toDateString()
  if (mismaFecha) return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })
}

function previewTexto(um) {
  if (!um) return 'Sin mensajes'
  const pref = um.rol === 'lead' ? '' : (um.rol === 'admin' ? 'Tú: ' : 'Bot: ')
  if (um.tipoMensaje === 'image') return pref + 'Imagen'
  if (um.tipoMensaje === 'audio') return pref + 'Audio'
  if (um.tipoMensaje === 'call') return 'Llamada'
  return pref + (um.texto || '')
}

export default function ChatsPage() {
  const [chats, setChats] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [activo, setActivo] = useState(null) // lead seleccionado

  const cargarChats = useCallback(() => {
    const params = new URLSearchParams({ filtro })
    if (q) params.set('q', q)
    fetch(`/api/admin/whatsapp-bot/chats?${params}`)
      .then(r => r.json())
      .then(d => setChats(d.chats || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filtro, q])

  useEffect(() => {
    cargarChats()
    const t = setInterval(cargarChats, 8000)
    return () => clearInterval(t)
  }, [cargarChats])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Chats</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Conversaciones del bot comercial</p>
        </div>
        <Link href="/admin/whatsapp-bot" className="text-xs text-[#3b82f6] hover:underline">Ver panel</Link>
      </div>

      <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[500px]">
        {/* LISTA DE CHATS */}
        <div className={`${activo ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] shrink-0 border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)] overflow-hidden`}>
          {/* Buscador */}
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar nombre o telefono"
              className="w-full px-3 py-2 rounded-[8px] bg-[rgba(255,255,255,0.04)] text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none"
            />
          </div>
          {/* Filtros */}
          <div className="flex gap-1 p-2 border-b border-[var(--color-border)] overflow-x-auto">
            {FILTROS.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all ${
                  filtro === f.id ? 'bg-[#f5c518] text-black font-medium' : 'bg-[rgba(255,255,255,0.06)] text-[var(--color-text-muted)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Lista */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
            {loading && <p className="p-4 text-sm text-[var(--color-text-muted)]">Cargando...</p>}
            {!loading && chats.length === 0 && <p className="p-4 text-sm text-[var(--color-text-muted)] text-center">Sin chats</p>}
            {chats.map(c => (
              <button
                key={c.id}
                onClick={() => setActivo(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.03)] transition-all ${activo?.id === c.id ? 'bg-[rgba(245,197,24,0.08)]' : ''}`}
              >
                <div className="relative shrink-0">
                  <Avatar nombre={c.nombre} size={42} />
                  {c.botActivo && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] border-2 border-[var(--color-bg-card)]" title="Bot activo" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white font-medium truncate">{c.nombre}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{horaCorta(c.ultimaActividad)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-[var(--color-text-muted)] truncate">{previewTexto(c.ultimoMensaje)}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {c.registrado && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[#10b981] font-medium">Cliente</span>}
                      {c.temperatura >= 60 && <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" title={`Temp ${c.temperatura}`} />}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PANEL DE CHAT */}
        <div className={`${activo ? 'flex' : 'hidden md:flex'} flex-col flex-1 border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)] overflow-hidden`}>
          {activo
            ? <ChatPanel lead={activo} onBack={() => setActivo(null)} onUpdate={cargarChats} />
            : <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">Selecciona un chat</div>}
        </div>
      </div>
    </div>
  )
}

function ChatPanel({ lead, onBack, onUpdate }) {
  const [mensajes, setMensajes] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [botActivo, setBotActivo] = useState(lead.botActivo)
  const [aviso, setAviso] = useState('')
  const [grabando, setGrabando] = useState(false)
  const chatRef = useRef(null)
  const fileRef = useRef(null)
  const mediaRecRef = useRef(null)

  const cargar = useCallback(() => {
    fetch(`/api/admin/whatsapp-bot/leads/${lead.id}/conversacion`)
      .then(r => r.json())
      .then(setMensajes)
      .catch(() => {})
  }, [lead.id])

  useEffect(() => {
    setBotActivo(lead.botActivo)
    setAviso('')
    cargar()
    const t = setInterval(cargar, 6000)
    return () => clearInterval(t)
  }, [lead.id, lead.botActivo, cargar])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [mensajes])

  async function toggleBot() {
    const nuevo = !botActivo
    setBotActivo(nuevo)
    await fetch(`/api/admin/whatsapp-bot/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botActivo: nuevo }),
    }).catch(() => {})
    onUpdate?.()
  }

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true); setAviso('')
    try {
      const res = await fetch(`/api/admin/whatsapp-bot/leads/${lead.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t }),
      })
      const r = await res.json()
      if (!res.ok) {
        setAviso(r.mensaje || r.error || 'No se pudo enviar')
      } else {
        setTexto('')
        cargar()
      }
    } catch {
      setAviso('Error de red')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarBlob(blob, filename) {
    setEnviando(true); setAviso('')
    try {
      const fd = new FormData()
      fd.append('file', blob, filename)
      const res = await fetch(`/api/admin/whatsapp-bot/leads/${lead.id}/send`, { method: 'POST', body: fd })
      const r = await res.json()
      if (!res.ok) setAviso(r.mensaje || r.error || 'No se pudo enviar')
      else cargar()
    } catch {
      setAviso('Error de red')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    await enviarBlob(file, file.name)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function toggleGrabacion() {
    // Si esta grabando -> detener y enviar
    if (grabando) {
      mediaRecRef.current?.stop()
      return
    }
    // Iniciar grabacion
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // WhatsApp/Meta acepta audio/ogg (opus) y audio/mp4; usamos lo que soporte el navegador
      const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : 'audio/mp4'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      const chunks = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setGrabando(false)
        // Mandar el audio con su tipo NATIVO (webm/ogg/mp4). El servidor lo
        // convierte a ogg/opus con ffmpeg antes de enviarlo a Meta.
        const tipoNativo = mime.split(';')[0]
        const ext = tipoNativo.includes('ogg') ? 'ogg' : tipoNativo.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(chunks, { type: tipoNativo })
        await enviarBlob(blob, `nota-voz.${ext}`)
      }
      mediaRecRef.current = rec
      rec.start()
      setGrabando(true)
      setAviso('')
    } catch {
      setAviso('No se pudo acceder al microfono. Revisa los permisos del navegador.')
    }
  }

  return (
    <>
      {/* Cabecera */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--color-border)]">
        <button onClick={onBack} className="md:hidden text-[var(--color-text-muted)]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <Avatar nombre={lead.nombre} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">{lead.nombre}</span>
            {lead.registrado && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[#10b981] font-medium">Cliente registrado</span>}
          </div>
          <span className="text-[11px] text-[var(--color-text-muted)]">{lead.telefono} · temp {lead.temperatura}</span>
        </div>
        {/* Toggle bot */}
        <button
          onClick={toggleBot}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
            botActivo ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981]' : 'bg-[rgba(136,136,136,0.15)] text-[#888]'
          }`}
          title="Prender/apagar el bot para este chat"
        >
          <span className={`w-2 h-2 rounded-full ${botActivo ? 'bg-[#10b981]' : 'bg-[#888]'}`} />
          Bot {botActivo ? 'ON' : 'OFF'}
        </button>
        <a href={`https://wa.me/${(lead.telefono || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-white" title="Abrir en WhatsApp">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 00-8.6 15l-1.4 5 5.1-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20z"/></svg>
        </a>
      </div>

      {/* Mensajes */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[rgba(0,0,0,0.15)]">
        {mensajes.map(m => <Burbuja key={m.id} m={m} leadId={lead.id} />)}
        {mensajes.length === 0 && <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">Sin mensajes aun</p>}
      </div>

      {/* Aviso ventana cerrada */}
      {aviso && <div className="px-3 py-2 text-[11px] text-[#f5c518] bg-[rgba(245,197,24,0.08)] border-t border-[var(--color-border)]">{aviso}</div>}

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-[var(--color-border)]">
        <input ref={fileRef} type="file" accept="image/*,audio/*,application/pdf" onChange={enviarArchivo} className="hidden" />
        {grabando ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[20px] bg-[rgba(239,68,68,0.12)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="text-sm text-[#ef4444] flex-1">Grabando nota de voz...</span>
            <span className="text-[11px] text-[var(--color-text-muted)]">Toca el micro para enviar</span>
          </div>
        ) : (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={enviando} className="text-[var(--color-text-muted)] hover:text-white p-1.5" title="Adjuntar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-3 py-2 rounded-[20px] bg-[rgba(255,255,255,0.05)] text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none"
            />
          </>
        )}
        {/* Boton: si hay texto -> enviar; si no -> grabar/parar nota de voz */}
        {texto.trim() && !grabando ? (
          <button onClick={enviar} disabled={enviando} className="bg-[#10b981] disabled:opacity-40 text-white rounded-full p-2" title="Enviar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        ) : (
          <button onClick={toggleGrabacion} disabled={enviando} className={`rounded-full p-2 text-white disabled:opacity-40 ${grabando ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} title={grabando ? 'Detener y enviar' : 'Grabar nota de voz'}>
            {grabando ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-14 0m7 7v3m0-3a4 4 0 01-4-4V7a4 4 0 018 0v4a4 4 0 01-4 4z" /></svg>
            )}
          </button>
        )}
      </div>
    </>
  )
}

function Burbuja({ m, leadId }) {
  const esLead = m.rol === 'lead'
  const align = esLead ? 'items-start' : 'items-end'
  const color = esLead
    ? 'bg-[rgba(255,255,255,0.07)] text-white'
    : (m.rol === 'admin' ? 'bg-[#f5c518] text-black' : 'bg-[#10b981] text-white')
  const mediaUrl = m.mediaPath ? `/api/admin/whatsapp-bot/media/${m.mediaPath}` : null

  return (
    <div className={`flex flex-col ${align}`}>
      <div className={`max-w-[78%] rounded-[12px] px-3 py-2 ${color}`}>
        {m.rol === 'admin' && <p className="text-[9px] opacity-70 mb-0.5">Tú (manual)</p>}
        {m.tipoMensaje === 'image' && mediaUrl && (
          <a href={mediaUrl} target="_blank" rel="noreferrer">
            <img src={mediaUrl} alt="imagen" className="rounded-[8px] max-w-full max-h-[240px] mb-1" />
          </a>
        )}
        {m.tipoMensaje === 'audio' && mediaUrl && (
          <audio controls src={mediaUrl} className="max-w-full mb-1" />
        )}
        {m.tipoMensaje === 'call' && (
          <span className="flex items-center gap-1.5 text-[13px]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/></svg>
            Llamada entrante
          </span>
        )}
        {m.texto && !['[nota de voz]', '[imagen no legible]'].includes(m.texto) && (
          <p className="text-[13px] whitespace-pre-wrap break-words">{m.texto}</p>
        )}
      </div>
      <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5 px-1">
        {new Date(m.createdAt).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
