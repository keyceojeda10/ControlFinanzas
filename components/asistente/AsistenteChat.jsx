'use client'
// components/asistente/AsistenteChat.jsx — Chat UI del asistente Fin
import { useState, useRef, useEffect, useCallback } from 'react'

const SUGERENCIAS = [
  '¿Cuánto recaudé esta semana?',
  '¿Quién me debe más?',
  '¿Cuántos clientes están en mora?',
  '¿Cómo va mi cartera este mes?',
  '¿Tengo capital disponible para prestar?',
]

export default function AsistenteChat({ onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planError, setPlanError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setError('')

    const userMsg = { role: 'user', content: msg }
    const assistantMsg = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-6),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'plan_upgrade_required') {
          setPlanError(data.message)
          setMessages(prev => prev.slice(0, -2))
          return
        }
        if (data.error === 'rate_limit') {
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { ...copy[copy.length - 1], content: data.message }
            return copy
          })
          return
        }
        throw new Error(data.error || 'Error del servidor')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value, { stream: true }).split('\n\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break
          try {
            const { token, error: streamErr } = JSON.parse(payload)
            if (streamErr) { setError(streamErr); break }
            if (token) {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + token,
                }
                return copy
              })
            }
          } catch {}
        }
      }
    } catch (e) {
      setError('Error de conexion. Intenta de nuevo.')
      setMessages(prev => prev.slice(0, -2))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              background: 'var(--color-accent-soft)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-accent)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Fin</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Asistente financiero</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Cerrar asistente"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Plan error */}
      {planError && (
        <div
          className="mx-4 mt-4 p-3 rounded-[12px] text-sm"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            color: 'var(--color-text-primary)',
          }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--color-accent)' }}>
            Asistente IA no disponible
          </p>
          <p style={{ color: 'var(--color-text-secondary)' }}>{planError}</p>
          <a
            href="/configuracion/plan"
            className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}
          >
            Ver planes
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !planError && (
          <div className="space-y-4">
            <div className="text-center pt-4">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Hola, soy Fin. Preguntame sobre tu negocio.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm px-3 py-2.5 rounded-[12px] transition-all active:scale-98"
                  style={{
                    background: '#1e1e28',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5"
                style={{ background: 'var(--color-accent-soft)' }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--color-accent)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] px-3.5 py-2.5 rounded-[14px] text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
              }`}
              style={
                msg.role === 'user'
                  ? { background: 'var(--color-accent)', color: '#0a0a0a' }
                  : {
                      background: '#1e1e28',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'var(--color-text-primary)',
                    }
              }
            >
              {msg.content ||
                (msg.role === 'assistant' && loading && i === messages.length - 1 ? (
                  <span className="flex gap-1 items-center py-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--color-text-muted)', animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--color-text-muted)', animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--color-text-muted)', animationDelay: '300ms' }}
                    />
                  </span>
                ) : (
                  ''
                ))}
            </div>
          </div>
        ))}

        {error && (
          <p className="text-center text-xs" style={{ color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!planError && (
        <div
          className="px-4 py-3 border-t shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntame algo sobre tu negocio..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-[12px] px-3.5 py-2.5 text-sm outline-none transition-all"
              style={{
                background: '#1e1e28',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-text-primary)',
                maxHeight: '100px',
                lineHeight: '1.5',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
              style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}
              aria-label="Enviar"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Los datos se actualizan cada 5 minutos
          </p>
        </div>
      )}
    </div>
  )
}
