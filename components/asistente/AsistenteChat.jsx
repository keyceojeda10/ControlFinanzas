'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import AccionCard from './AccionCard'
import VoiceInput from './VoiceInput'
import { Icono as IconoDelSistema } from '@/components/armazon/iconos'

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

export default function AsistenteChat({ onClose, comoPagina = false }) {
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
    // ⚠ `block: 'nearest'` — SIN ESTO SE MUEVE LA PÁGINA ENTERA.
    //
    // `scrollIntoView` a secas desplaza TODOS los ancestros que scrolleen, no
    // solo la lista de mensajes. El dueño lo describió exacto: «cuando Lucas
    // contesta, todo el dashboard se desplaza un poco hacia abajo… no afecta la
    // funcionalidad, pero se ve como un error». Con cada respuesta, otro
    // empujón. Con `nearest` solo se mueve el contenedor del chat, que es el
    // único que tiene que moverse.
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
    <div className="flex flex-col h-full" style={{ background: 'var(--cf-surface)' }}>
      {/* ── LA CABECERA ES DEL CHAT, SIEMPRE ──
          En la pantalla dedicada la ponía el armazón y el chat iba `fixed` debajo:
          dos cajas distintas. En iPhone, al salir el teclado, el navegador corre
          la página para enseñar el campo y la cabecera —con su flecha de volver—
          se quedaba FUERA de la pantalla, sin forma de traerla de vuelta (el
          documento tiene el scroll apagado). El dueño, 20 sep 2026: «el icono de
          cerrar Lucas no se ve, o sea no se puede cerrar… la gente va a pasar de
          él porque está bugueado». Ahora cabecera, mensajes y campo son UNA sola
          caja que mide lo que de verdad se ve (`useAltoVisible` en la página),
          así que la salida no se puede perder. */}
      <CabeceraLucas
        onEditar={nuevaConversacion}
        onCerrar={onClose}
        comoPagina={comoPagina}
        extra={contadorPlan}
      />

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
            <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <span className="inline-flex items-center justify-center shrink-0 mb-0.5"
                  style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)' }}>
                  <IconoDelSistema ruta="/asistente" size={15} grosor={2} />
                </span>
              )}
              {/* LA BURBUJA DEL USUARIO YA NO ES DORADA. El dorado se reserva a la
                  cifra principal, la acción primaria y el foco (DESIGN.md · 1): una
                  conversación larga era una columna entera de dorado. Va en tinta,
                  como el chip activo. La de Lucas es una tarjeta blanca con borde,
                  que se despega del fondo; antes era del mismo gris que la pantalla. */}
              <div
                className={`max-w-[84%] px-4 py-3 text-[15px] leading-[1.5] ${msg.role === 'user' ? 'whitespace-pre-wrap' : ''}`}
                style={msg.role === 'user'
                  ? { background: 'var(--cf-ink)', color: 'var(--cf-card)', borderRadius: '20px 20px 6px 20px' }
                  : { background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)', borderRadius: '20px 20px 20px 6px', overflowWrap: 'anywhere' }
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
        <div className="px-3 pt-3 shrink-0" style={{
          background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}>
          <style>{`.cf-lucas-campo:focus { border-color: var(--cf-gold) !important; background: var(--cf-card) !important; }`}</style>
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
              {/* EL CAMPO SE DESPEGA DEL FONDO. «El cuadro de texto de mensaje de
                  Lucas es del mismo color del fondo» — el dueño. La barra entera es
                  una tarjeta blanca y el campo una pastilla con borde fuerte que se
                  pone dorada al enfocar (el dorado SÍ es para el foco). */}
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
                  placeholder="Pregúntale o pídele algo…"
                  rows={1}
                  disabled={loading}
                  className="cf-lucas-campo flex-1 resize-none outline-none"
                  style={{
                    minHeight: 46, maxHeight: 120, padding: '11px 16px', lineHeight: 1.45,
                    borderRadius: 23, background: 'var(--cf-surface)', color: 'var(--cf-ink)',
                    border: '1.5px solid var(--cf-border-strong)',
                    display: voiceRecording ? 'none' : undefined,
                  }}
                />
                <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
                  className="shrink-0 inline-flex items-center justify-center transition-[background-color,color,opacity]"
                  style={{
                    width: 46, height: 46, borderRadius: 999, border: 0, cursor: input.trim() ? 'pointer' : 'default',
                    background: input.trim() ? 'var(--cf-gold)' : 'var(--cf-fill-2)',
                    color: input.trim() ? 'var(--cf-gold-ink)' : 'var(--cf-ink-4)',
                    display: voiceRecording ? 'none' : undefined,
                  }}
                  aria-label="Enviar">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                  </svg>
                </button>
              </div>
              <p className="text-[11px] text-center mt-2" style={{ color: 'var(--cf-ink-3)' }}>
                Lucas se puede equivocar. Los números salen de tu app.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
