'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import AccionCard from './AccionCard'
import VoiceInput from './VoiceInput'

// ---------------------------------------------------------------------------
// WaveformBar — se renderiza en lugar del row de input mientras se graba
// ---------------------------------------------------------------------------
const BAR_COUNT = 38

function WaveformBar({ text, onCancel, onConfirm }) {
  const [bars, setBars] = useState(() =>
    Array(BAR_COUNT).fill(0).map(() => 0.15 + Math.random() * 0.35)
  )
  const timerRef = useRef(null)

  useEffect(() => {
    const tick = () => {
      setBars(
        Array(BAR_COUNT).fill(0).map(() =>
          text
            ? 0.08 + Math.random() * 0.25   // quietas cuando hay texto pausado
            : 0.15 + Math.random() * 0.85   // activas mientras habla
        )
      )
      timerRef.current = setTimeout(tick, 80)
    }
    tick()
    return () => clearTimeout(timerRef.current)
  }, [text])

  const displayText = text || 'Habla...'
  const hasText = !!text

  return (
    <div
      className="flex items-center gap-2 w-full rounded-[16px] px-3"
      style={{
        height: '44px',
        background: 'var(--color-bg-hover)',
        border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
        boxSizing: 'border-box',
      }}
    >
      {/* Texto transcript / indicador */}
      <span
        className="text-xs shrink-0 max-w-[90px] truncate"
        style={{
          color: hasText ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          fontStyle: hasText ? 'normal' : 'italic',
          minWidth: '52px',
        }}
        title={text}
      >
        {displayText}
      </span>

      {/* Barras waveform */}
      <div
        className="flex items-center gap-[2px] flex-1 overflow-hidden"
        style={{ height: '28px' }}
        aria-hidden="true"
      >
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              width: '2px',
              height: `${Math.max(2, Math.round(h * 26))}px`,
              borderRadius: '2px',
              background: 'var(--color-accent)',
              opacity: 0.45 + h * 0.55,
              transition: 'height 0.08s ease, opacity 0.08s ease',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Botones accion */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Cancelar */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar grabacion"
          className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all"
          style={{
            background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
            color: 'var(--color-text-muted)',
            border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
          }}
        >
          <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Confirmar */}
        <button
          type="button"
          onClick={() => onConfirm(text)}
          disabled={!hasText}
          aria-label="Confirmar transcripcion"
          className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-30"
          style={{
            background: hasText
              ? 'color-mix(in srgb, var(--color-accent) 20%, transparent)'
              : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
            color: 'var(--color-accent)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
          }}
        >
          <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const SUGERENCIAS_DEFAULT = [
  '¿Cuánto estoy ganando realmente?',
  '¿Cuánto recaudé esta semana?',
  '¿Quién me debe más y cuánto?',
  '¿Cuántos clientes están en mora?',
  '¿Tengo capital disponible para prestar más?',
]

function generarSugerencias(alertas) {
  if (!alertas) return SUGERENCIAS_DEFAULT
  const s = []
  if (alertas.clientesMora > 0)
    s.push(`¿Quiénes son mis ${alertas.clientesMora} clientes en mora?`)
  if (alertas.clientesSinRuta > 0)
    s.push(`${alertas.clientesSinRuta} clientes sin ruta — ¿qué hacemos?`)
  if (alertas.prestamosSinPagos > 0)
    s.push(`${alertas.prestamosSinPagos} préstamos sin cobro en +7 días`)
  if (alertas.diaSemana === 1)
    s.push('¿Cuánto recaudé el fin de semana?')
  if (typeof alertas.pctCobroHoy === 'number' && alertas.pctCobroHoy < 80)
    s.push(`Solo llevo ${alertas.pctCobroHoy}% de mi meta de hoy — ¿qué hago?`)
  s.push('¿Cuánto estoy ganando realmente?')
  return s.slice(0, 5)
}

// Convierte markdown básico (**negrita**, *cursiva*, saltos de línea) a JSX
function renderMarkdown(text) {
  if (!text) return null
  return text.split('\n').map((line, li, arr) => {
    const parts = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let last = 0
    let m
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      if (m[0].startsWith('**')) parts.push(<strong key={m.index}>{m[2]}</strong>)
      else parts.push(<em key={m.index}>{m[3]}</em>)
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return (
      <span key={li}>
        {parts}
        {li < arr.length - 1 && <br />}
      </span>
    )
  })
}

export default function AsistenteChat({ onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planError, setPlanError] = useState(null)
  const [usageInfo, setUsageInfo] = useState(null) // { limite, usado, restantes, alertas }
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceText, setVoiceText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef([])
  const voiceRef = useRef(null) // ref al VoiceInput para llamar cancel/confirm

  useEffect(() => {
    messagesRef.current = messages
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch uso + alertas al montar
  useEffect(() => {
    fetch('/api/asistente/uso')
      .then(r => r.json())
      .then(json => {
        const d = json.data ?? json
        setUsageInfo(d)
      })
      .catch(() => {})
  }, [])

  const refreshUsage = useCallback(() => {
    fetch('/api/asistente/uso')
      .then(r => r.json())
      .then(json => { const d = json.data ?? json; setUsageInfo(d) })
      .catch(() => {})
  }, [])

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setError('')

    const currentHistory = messagesRef.current
      .filter(m => m.type !== 'action')
      .slice(-6)
      .map(m => ({ role: m.role, content: m.content }))

    const userMsg = { role: 'user', content: msg }
    const assistantMsg = { role: 'assistant', content: '', type: 'text' }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: currentHistory }),
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
          refreshUsage()
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
            const parsed = JSON.parse(payload)

            if (parsed.error) { setError(parsed.error); break }

            if (parsed.token) {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                copy[copy.length - 1] = { ...last, content: last.content + parsed.token }
                return copy
              })
            }

            if (parsed.type === 'action_proposal') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  role: 'assistant',
                  type: 'action',
                  content: '',
                  actionData: {
                    tool: parsed.tool,
                    input: parsed.input,
                    displayData: parsed.displayData,
                  },
                }
                return copy
              })
            }

            if (parsed.type === 'lookup_result') {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                copy[copy.length - 1] = { ...last, content: last.content + `\n\nBúsqueda: ${parsed.result}` }
                return copy
              })
            }
          } catch {}
        }
      }
      refreshUsage()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setMessages(prev => prev.slice(0, -2))
    } finally {
      setLoading(false)
    }
  }, [input, loading, refreshUsage])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const sugerencias = generarSugerencias(usageInfo?.alertas)

  // Determinar color del contador
  const restantes = usageInfo?.restantes ?? null
  const limite = usageInfo?.limite ?? null
  const sinMensajes = restantes !== null && restantes <= 0
  const pocasCuotas = restantes !== null && restantes > 0 && restantes <= 3

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{
              background: 'var(--color-accent-soft)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            }}>
            <svg style={{ width: '16px', height: '16px', display: 'block', color: 'var(--color-accent)' }}
              viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Lucas</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Asistente financiero</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Contador de mensajes */}
          {restantes !== null && limite !== null && limite > 0 && (
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: pocasCuotas || sinMensajes
                  ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)'
                  : 'var(--color-bg-hover)',
                color: pocasCuotas || sinMensajes ? 'var(--color-warning)' : 'var(--color-text-muted)',
                border: `1px solid ${pocasCuotas || sinMensajes ? 'color-mix(in srgb, var(--color-warning) 30%, transparent)' : 'var(--color-border)'}`,
              }}
            >
              {sinMensajes ? '0 restantes' : `${restantes} de ${limite}`}
            </span>
          )}
          <button
            onClick={() => { setMessages([]); messagesRef.current = []; setError(''); setInput('') }}
            title="Nueva conversación"
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Nueva conversación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)' }} aria-label="Cerrar asistente">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Plan error */}
      {planError && (
        <div className="mx-4 mt-4 p-3 rounded-[12px] text-sm"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
          }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-accent)' }}>Asistente IA no disponible</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>{planError}</p>
          <a href="/configuracion/plan" className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}>
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
                Hola, soy Lucas. Pregúntame sobre tu negocio o pídeme que haga algo.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {sugerencias.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-left text-sm px-3 py-2.5 rounded-[12px] transition-all active:scale-[0.98]"
                  style={{
                    background: 'var(--color-bg-hover)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.type === 'action' && msg.actionData) {
            return (
              <AccionCard
                key={i}
                tool={msg.actionData.tool}
                input={msg.actionData.input}
                displayData={msg.actionData.displayData}
                onConfirm={(data) => {
                  if (data?.message) {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.message, type: 'text' }])
                  }
                  refreshUsage()
                }}
                onCancel={() => {
                  setMessages(prev => {
                    const copy = [...prev]
                    copy[i] = { ...copy[i], type: 'cancelled' }
                    return copy
                  })
                }}
              />
            )
          }

          if (msg.type === 'cancelled') return null

          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mr-2 mt-0.5"
                  style={{ background: 'var(--color-accent-soft)' }}>
                  <svg style={{ width: '12px', height: '12px', display: 'block', color: 'var(--color-accent)' }}
                    viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-[14px] text-sm ${msg.role === 'user' ? 'rounded-br-[4px] whitespace-pre-wrap' : 'rounded-bl-[4px]'}`}
                style={msg.role === 'user'
                  ? { background: 'var(--color-accent)', color: '#0a0a0a' }
                  : { background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }
                }>
                {msg.content
                  ? (msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content)
                  : (msg.role === 'assistant' && loading && i === messages.length - 1
                    ? (
                      <span className="flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--color-text-muted)', animationDelay: '300ms' }} />
                      </span>
                    ) : null
                  )
                }
              </div>
            </div>
          )
        })}

        {error && (
          <p className="text-center text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!planError && (
        <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          {sinMensajes ? (
            /* Banner de upgrade cuando se agotan los mensajes */
            <div className="rounded-[12px] px-4 py-3 text-center"
              style={{
                background: 'color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-hover))',
                border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
              }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-warning)' }}>
                Límite de mensajes alcanzado
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Actualiza tu plan para tener más consultas con Lucas.
              </p>
              <a href="/configuracion/plan"
                className="inline-block text-xs font-bold px-4 py-1.5 rounded-lg"
                style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}>
                Ver planes
              </a>
            </div>
          ) : (
            <>
              {/* Waveform overlay — reemplaza visualmente toda la fila cuando graba */}
              {voiceActive ? (
                <WaveformBar
                  text={voiceText}
                  onCancel={() => {
                    voiceRef.current?.cancel()
                  }}
                  onConfirm={(text) => {
                    voiceRef.current?.confirm(text)
                  }}
                />
              ) : (
                <div className="flex gap-2 items-end">
                  <VoiceInput
                    ref={voiceRef}
                    disabled={loading}
                    onRecordingStart={() => {
                      setVoiceActive(true)
                      setVoiceText('')
                    }}
                    onInterimUpdate={(t) => setVoiceText(t)}
                    onRecordingEnd={() => {
                      setVoiceActive(false)
                      setVoiceText('')
                    }}
                    onConfirm={(text) => {
                      setInput(text)
                      setTimeout(() => inputRef.current?.focus(), 50)
                    }}
                    onCancel={() => {
                      // ya limpiado en onRecordingEnd
                    }}
                  />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pregunta o pide algo..."
                    rows={1}
                    disabled={loading}
                    className="flex-1 resize-none rounded-[12px] px-3.5 py-2.5 text-sm outline-none transition-all"
                    style={{
                      background: 'var(--color-bg-hover)',
                      border: '1px solid var(--color-border-hover)',
                      color: 'var(--color-text-primary)',
                      maxHeight: '100px',
                      lineHeight: '1.5',
                    }}
                  />
                  <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                    className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                    style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}
                    aria-label="Enviar">
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Lucas puede cometer errores — verifica datos importantes
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
