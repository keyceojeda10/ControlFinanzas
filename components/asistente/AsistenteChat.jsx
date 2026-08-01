'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import AccionCard from './AccionCard'
import VoiceInput from './VoiceInput'

import { Cabecera as CabeceraLucas, Vacio as VacioLucas } from '@/components/pantallas/Lucas'

// ── T43-02/03/04 · LO QUE SE INJERTA Y LO QUE NO ──
//
// De `Lucas` se toman la CABECERA y el VACIO. El compositor NO: el de aqui
// lleva `VoiceInput`, que es dictado de verdad contra la API, y el de la lamina
// solo dibuja el boton. El publico de esta app teclea poco; perder el microfono
// por ganar una pastilla habria sido un mal cambio.
//
// El vacio es el arreglo de fondo que señala la lamina: «la app promete "pideme
// que haga algo" y luego SOLO OFRECE PREGUNTAS», asi que el dueño nunca
// descubre que Lucas actua. Ahora son dos grupos.

const SUGERENCIAS_DEFAULT = [
  '¿Cuánto estoy ganando realmente?',
  '¿Cuánto recaudé esta semana?',
  '¿Quién me debe más y cuánto?',
  '¿Cuántos clientes están en mora?',
  '¿Tengo capital disponible para prestar más?',
]

// Lo que Lucas PUEDE HACER, no lo que puede contestar. Fijas a proposito: son
// las capacidades del asistente, no dependen de la cartera. La cifra real —«los
// 13 en mora»— se le pega abajo cuando existe: sin ella es una promesa, con
// ella es una tarea a medio hacer.
const ACCIONES_BASE = [
  { texto: 'Mándale un recordatorio a los que deben', icono: 'whatsapp' },
  { texto: 'Ármame el reporte del mes', icono: 'reporte' },
  { texto: 'Búscame un cliente por nombre o cédula', icono: 'gente' },
]

function generarAcciones(alertas) {
  const n = alertas?.clientesMora ?? 0
  return ACCIONES_BASE.map((a, i) => (i === 0 && n > 0
    ? { ...a, texto: `Mándale un recordatorio a los ${n} en mora` }
    : a))
}

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
  const [voiceRecording, setVoiceRecording] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef([])
  const voiceRef = useRef(null) // ref al VoiceInput para llamar cancel/confirm

  useEffect(() => {
    messagesRef.current = messages
    // SOLO SI HAY CONVERSACION. Sin mensajes, bajar al final arrastraba la
    // pagina entera y metia el titulo del vacio —«Pregúntame lo que sea de tu
    // negocio»— DEBAJO de la cabecera pegajosa. Se entraba a Lucas y lo primero
    // que se leia era la segunda linea.
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

            if (parsed.error) {
              setError(parsed.error)
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                // Si el placeholder del asistente quedo vacio (ej. atascado en
                // "Buscando..."), quitarlo para no dejarlo colgado visualmente
                // — el error se muestra aparte.
                if (last?.role === 'assistant' && !last.content) return copy.slice(0, -1)
                return copy
              })
              break
            }

            if (parsed.type === 'status') {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                copy[copy.length - 1] = { ...last, statusText: parsed.text, content: '' }
                return copy
              })
            }

            if (parsed.token) {
              setMessages(prev => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                // Primer token real — limpiar statusText
                copy[copy.length - 1] = { ...last, statusText: undefined, content: last.content + parsed.token }
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
              // No mostrar en el chat — Lucas lo procesa internamente y responde con texto limpio
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
  const acciones   = generarAcciones(usageInfo?.alertas)

  // Determinar color del contador
  const restantes = usageInfo?.restantes ?? null
  const limite = usageInfo?.limite ?? null
  const sinMensajes = restantes !== null && restantes <= 0
  const pocasCuotas = restantes !== null && restantes > 0 && restantes <= 3

  // OJO CON EL ORDEN: esto lee `restantes`, `limite`, `sinMensajes` y
  // `pocasCuotas`. Estaba ARRIBA, junto a las sugerencias, y reventaba con
  // «Cannot access 'restantes' before initialization» — la pantalla entera
  // caia a la frontera de error. Un `const` no se puede leer antes de su linea.
  const nuevaConversacion = () => {
    setMessages([]); messagesRef.current = []; setError(''); setInput('')
  }
  const contadorPlan = restantes !== null && limite !== null && limite > 0 ? (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{
        flex: 'none', whiteSpace: 'nowrap',
        background: pocasCuotas || sinMensajes
          ? 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)'
          : 'var(--cf-fill)',
        color: pocasCuotas || sinMensajes ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
        border: `1px solid ${pocasCuotas || sinMensajes ? 'color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)' : 'var(--cf-border)'}`,
      }}
    >
      {sinMensajes ? '0 restantes' : `${restantes} de ${limite}`}
    </span>
  ) : null

  return (
    <div className="flex flex-col h-full">
      {/* ── LA CABECERA VA EN EL ARMAZON, NO AQUI ──
          Se monto la de `Lucas` y quedaron DOS: la del armazon fija arriba con
          la flecha de volver, y la de Lucas debajo con el mismo nombre. Es el
          patron del titulo duplicado que ya tiene su propia prueba.
          Manda el armazon —es quien sabe volver— y las dos cosas que la
          cabecera de Lucas aportaba, el contador del plan y «empezar de nuevo»,
          se le pasan por `acciones`. En panel flotante (`onClose`) no hay
          armazon, y ahi si se pinta la de Lucas. */}
      {onClose && (
        <CabeceraLucas
          onEditar={nuevaConversacion}
          onCerrar={onClose}
          extra={contadorPlan}
        />
      )}

      {/* Plan error */}
      {planError && (
        <div className="mx-4 mt-4 p-3 rounded-[12px] text-sm"
          style={{
            background: 'var(--cf-gold-tint)',
            border: '1px solid color-mix(in srgb, var(--cf-gold) 30%, transparent)',
          }}>
          <p className="font-semibold mb-1" style={{ color: 'var(--cf-gold)' }}>Asistente IA no disponible</p>
          <p style={{ color: 'var(--cf-ink-2)' }}>{planError}</p>
          <a href="/configuracion/plan" className="inline-block mt-2 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--cf-gold)', color: 'var(--cf-ink)' }}>
            Ver planes
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !planError && (
          <VacioLucas
            preguntas={sugerencias.map((t) => ({ texto: t, icono: 'pregunta' }))}
            acciones={acciones}
            onElegir={(t) => sendMessage(t)}
          />
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
                  style={{ background: 'var(--cf-gold-tint)' }}>
                  <svg style={{ width: '12px', height: '12px', display: 'block', color: 'var(--cf-gold)' }}
                    viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-[12px] text-sm ${msg.role === 'user' ? 'rounded-br-[4px] whitespace-pre-wrap' : 'rounded-bl-[4px]'}`}
                style={msg.role === 'user'
                  ? { background: 'var(--cf-gold)', color: 'var(--cf-ink)' }
                  : { background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }
                }>
                {msg.content
                  ? (msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content)
                  : msg.statusText
                  ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce shrink-0" style={{ background: 'var(--cf-ink-3)', animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce shrink-0" style={{ background: 'var(--cf-ink-3)', animationDelay: '150ms' }} />
                      <span className="text-xs italic" style={{ color: 'var(--cf-ink-3)' }}>{msg.statusText}</span>
                    </span>
                  )
                  : (msg.role === 'assistant' && loading && i === messages.length - 1
                    ? (
                      <span className="flex gap-1 items-center py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--cf-ink-3)', animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--cf-ink-3)', animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--cf-ink-3)', animationDelay: '300ms' }} />
                      </span>
                    ) : null
                  )
                }
              </div>
            </div>
          )
        })}

        {error && (
          <p className="text-center text-xs" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!planError && (
        <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--cf-border)' }}>
          {sinMensajes ? (
            /* Banner de upgrade cuando se agotan los mensajes */
            <div className="rounded-[12px] px-4 py-3 text-center"
              style={{
                background: 'color-mix(in srgb, var(--cf-gold-dark) 10%, var(--cf-fill))',
                border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)',
              }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--cf-gold-dark)' }}>
                Límite de mensajes alcanzado
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--cf-ink-2)' }}>
                Actualiza tu plan para tener más consultas con Lucas.
              </p>
              <a href="/configuracion/plan"
                className="inline-block text-xs font-bold px-4 py-1.5 rounded-lg"
                style={{ background: 'var(--cf-gold)', color: 'var(--cf-ink)' }}>
                Ver planes
              </a>
            </div>
          ) : (
            <>
              {/* Contenedor flex: mic siempre primero, textarea+send ocultos al grabar */}
              <div className="flex gap-2 items-end">
                <VoiceInput
                  ref={voiceRef}
                  disabled={loading}
                  onRecordingStart={() => setVoiceRecording(true)}
                  onRecordingEnd={() => setVoiceRecording(false)}
                  onConfirm={(text) => {
                    setVoiceRecording(false)
                    setInput(text)
                    setTimeout(() => inputRef.current?.focus(), 50)
                  }}
                  onCancel={() => setVoiceRecording(false)}
                  onSend={(text) => { setVoiceRecording(false); sendMessage(text) }}
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
                    background: 'var(--cf-fill)',
                    border: '1px solid var(--cf-border-strong)',
                    color: 'var(--cf-ink)',
                    maxHeight: '100px',
                    lineHeight: '1.5',
                    display: voiceRecording ? 'none' : undefined,
                  }}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                  style={{
                    background: 'var(--cf-gold)',
                    color: 'var(--cf-ink)',
                    display: voiceRecording ? 'none' : undefined,
                  }}
                  aria-label="Enviar">
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--cf-ink-3)' }}>
                Lucas puede cometer errores — verifica datos importantes
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
