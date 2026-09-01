'use client'
// app/admin/whatsapp-bot/simulador/page.jsx — escribirle al bot sin gastar un
// mensaje.
//
// ⚠ NO ES UNA MAQUETA. Cada turno llama al mismo código que corre en el
// webhook: `decidirDesdeAnuncio()` para el flujo de botones y `responder()`
// para el texto libre. Un simulador con su propia copia del guion se ajusta
// contra sí mismo y en WhatsApp sale otra cosa.
//
// Lo que se ve debajo de cada burbuja —«flujo de anuncios (sin modelo)» o
// «modelo · haiku»— es la parte que más importa al ajustar: dice si esa
// respuesta salió del guion fijo o si la improvisó el modelo, que es
// exactamente lo que se está tratando de acotar.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

const MODOS = [
  { key: 'anuncio', label: 'Desde un anuncio', pie: 'Click-to-WhatsApp · por botones' },
  { key: 'siempre', label: 'Bot de siempre',   pie: 'Formulario y directos · modelo' },
]

/* Frases que la gente escribe de verdad, sacadas de las conversaciones. Sirven
   para no tener que teclearlas cada vez que se ajusta una respuesta. */
const ATAJOS = ['hola', 'cuánto cuesta', 'no pude', 'es confiable?', 'quiero pagar', 'mándame un video']

export default function SimuladorBot() {
  const [modo, setModo] = useState('anuncio')
  const [turnos, setTurnos] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [registrado, setRegistrado] = useState(false)
  const finRef = useRef(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turnos, cargando])

  const reiniciar = () => { setTurnos([]); setError(null); setRegistrado(false) }

  const mandar = async ({ texto: t, botonId, modoForzado }) => {
    if (cargando) return
    setError(null)
    const historial = turnos.map((x) => ({ rol: x.rol, texto: x.texto }))
    /* Lo que pulsa el usuario se ve en el chat como lo que dijo, igual que en
       WhatsApp: el título del botón ES su mensaje. */
    const mio = { rol: 'lead', texto: t }
    if (!modoForzado) setTurnos((v) => [...v, mio])
    setTexto('')
    setCargando(true)
    try {
      const res = await fetch('/api/admin/whatsapp-bot/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: modoForzado || modo, texto: t, botonId, historial, registrado }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Falló el simulador')
      const nuevos = (d.respuestas ?? []).map((r) => ({
        rol: 'bot', texto: r.texto, botones: r.botones ?? [],
        via: d.via, aviso: d.aviso, temperatura: d.temperatura, costoUsd: d.costoUsd,
      }))
      if (!nuevos.length) {
        nuevos.push({ rol: 'bot', texto: '(el bot no contestó)', botones: [], via: d.via })
      }
      setTurnos((v) => [...v, ...nuevos])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  const simularRegistro = async () => {
    setRegistrado(true)
    setTurnos((v) => [...v, { rol: 'nota', texto: 'Se registró — la cuenta acaba de crearse' }])
    await mandar({ texto: '', modoForzado: 'registro' })
  }

  return (
    <div className="max-w-[720px] mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin/whatsapp-bot" className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
            ← WA Bot
          </Link>
          <h1 className="text-[20px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Simulador del bot</h1>
          <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
            No manda nada por WhatsApp ni toca ningún lead. Corre el mismo código que el webhook.
          </p>
        </div>
        <button
          onClick={reiniciar}
          className="shrink-0 h-9 px-3 rounded-[12px] text-[12px] font-semibold"
          style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}
        >
          Reiniciar
        </button>
      </div>

      {/* Qué bot se está probando */}
      <div className="grid grid-cols-2 gap-2">
        {MODOS.map((m) => {
          const activo = modo === m.key
          return (
            <button
              key={m.key}
              onClick={() => { setModo(m.key); reiniciar() }}
              className="rounded-[12px] px-3 py-2.5 text-left transition-[background-color,color,border-color] duration-150"
              style={activo
                ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: '1px solid var(--cf-gold)' }
                : { background: 'var(--cf-surface)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
            >
              <span className="block text-[13px] font-semibold">{m.label}</span>
              <span className="block text-[11px]" style={{ opacity: 0.75 }}>{m.pie}</span>
            </button>
          )
        })}
      </div>

      {/* El chat */}
      <div className="rounded-[16px] p-3 space-y-3 min-h-[320px] max-h-[62vh] overflow-y-auto"
        style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
        {!turnos.length && (
          <p className="text-[12px] text-center py-8" style={{ color: 'var(--cf-ink-3)' }}>
            {modo === 'anuncio'
              ? 'Escriba lo primero que escribiría alguien que acaba de pulsar el anuncio.'
              : 'Escriba como escribiría un lead del formulario.'}
          </p>
        )}

        {turnos.map((t, i) => {
          if (t.rol === 'nota') {
            return (
              <p key={i} className="text-[11px] text-center py-1" style={{ color: 'var(--cf-ink-3)' }}>
                — {t.texto} —
              </p>
            )
          }
          const mio = t.rol === 'lead'
          return (
            <div key={i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[86%] space-y-1.5">
                <div className="rounded-[12px] px-3 py-2 text-[13px] whitespace-pre-wrap" style={mio
                  ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
                  : { background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border)' }}>
                  {t.texto}
                </div>

                {/* Los botones se pulsan de verdad: es como se recorre el árbol. */}
                {!!t.botones?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.botones.map((b) => (
                      <button
                        key={b.id}
                        disabled={cargando}
                        onClick={() => mandar({ texto: b.titulo, botonId: b.id })}
                        className="rounded-[10px] px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-gold)', color: 'var(--cf-ink)' }}
                      >
                        {b.titulo}
                      </button>
                    ))}
                  </div>
                )}

                {/* ⚠ De dónde salió la respuesta. Es el dato que se mira al
                    ajustar: si dice «modelo» donde debería decir «sin modelo»,
                    falta una respuesta preparada. */}
                {!mio && (t.via || t.aviso) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {t.via && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono-display"
                        style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                        {t.via}
                      </span>
                    )}
                    {typeof t.temperatura === 'number' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono-display"
                        style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                        temp {t.temperatura}
                      </span>
                    )}
                    {t.costoUsd > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono-display"
                        style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-3)' }}>
                        ${t.costoUsd.toFixed(4)}
                      </span>
                    )}
                    {t.aviso && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{
                        background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
                        color: 'var(--cf-red-dark)',
                      }}>
                        {t.aviso}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {cargando && (
          <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>escribiendo…</p>
        )}
        <div ref={finRef} />
      </div>

      {error && (
        <p className="text-[12px] rounded-[12px] px-3 py-2" style={{
          background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)', color: 'var(--cf-red-dark)',
        }}>
          {error}
        </p>
      )}

      {/* Atajos: las frases que la gente escribe de verdad */}
      <div className="flex flex-wrap gap-1.5">
        {ATAJOS.map((f) => (
          <button
            key={f}
            disabled={cargando}
            onClick={() => mandar({ texto: f })}
            className="rounded-full px-2.5 py-1 text-[11px] disabled:opacity-50"
            style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}
          >
            {f}
          </button>
        ))}
        <button
          disabled={cargando || registrado}
          onClick={simularRegistro}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--cf-green-pill-bg, var(--cf-fill))', border: '1px solid var(--cf-green-dark)', color: 'var(--cf-green-dark)' }}
        >
          Simular que se registró
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (texto.trim()) mandar({ texto: texto.trim() }) }}
        className="flex gap-2"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escriba como escribiría un prestamista…"
          className="flex-1 h-11 rounded-[12px] px-3 text-[14px]"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
        />
        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="h-11 px-4 rounded-[12px] text-[13px] font-bold disabled:opacity-50"
          style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
        >
          Enviar
        </button>
      </form>

      <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
        El modo «Bot de siempre» y el texto libre llaman al modelo de verdad, así que cuestan unos céntimos por turno.
        El flujo de botones no cuesta nada.
      </p>
    </div>
  )
}
