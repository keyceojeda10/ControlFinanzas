'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import {
  PREGUNTAS, MAX_IMAGENES, MAX_CARACTERES, TIPOS_IMAGEN, TIPOS_AUDIO,
} from '@/lib/sugerencias'

/* ══ EL BANNER PARA PREGUNTAR QUÉ FALTA ═════════════════════════════════════
 *
 * ── POR QUÉ ESTE Y NO OTRO TICKET ──
 * `TicketSoporte` ya tiene un tipo `solicitud` desde que existe el producto y
 * lleva UN uso. La campaña de fotos de cuadernos tuvo banner cuatro días y no
 * llegó ni una. Y mientras tanto la gente manda notas de voz y capturas por
 * WhatsApp todo el día. Nadie va a buscar un formulario; hay que ponérselo
 * delante y pedirle poco.
 *
 * ── LAS TRES FORMAS SON LAS TRES QUE LA GENTE USA ──
 * Escribir, mandar una foto o hablar. La nota de voz no es un adorno: el cliente
 * que reportó siete cosas la noche del 13 de agosto lo hizo con un video de tres
 * minutos, no escribiendo. Y llega transcrita, así que leerlas después es leer,
 * no oír trescientos audios.
 *
 * ── VA PARA TODOS ──
 * El banner de fotos era `esOwner &&` y los cobradores no lo vieron nunca. Son
 * los que caminan la ruta con la app en la mano ocho horas: tienen las quejas
 * más concretas de todas.
 *
 * ── SE APAGA SOLO ──
 * El 28 de agosto. Un banner que sobra es ruido, y esta es la pantalla que se
 * abre cada mañana.
 */

const TARJETA = {
  borderRadius: 'var(--cf-r-card)',
  background: 'var(--cf-card)',
  border: '1px solid var(--cf-border)',
}

function Megafono({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84a3 3 0 11-4.68 0M3 11.5v-2a2 2 0 012-2h2.5L15 4v15l-7.5-3.5H5a2 2 0 01-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 8.5a5 5 0 010 7" />
    </svg>
  )
}

function Micro({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" />
    </svg>
  )
}

function Imagen({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5-4.5 4 3.5 3-2.5 6 5" />
      <circle cx="8.5" cy="9" r="1.4" />
    </svg>
  )
}

function HojaOpinar({ open, onClose, onListo }) {
  const [texto, setTexto] = useState('')
  const [imagenes, setImagenes] = useState([])
  const [audio, setAudio] = useState(null)
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const inputFotos = useRef(null)
  const grabadora = useRef(null)
  const trozos = useRef([])
  const reloj = useRef(null)

  useEffect(() => () => { clearInterval(reloj.current) }, [])

  const empezarAGrabar = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      /* Los mismos formatos y el mismo orden que `VoiceInput`: Safari no admite
         webm y sin la lista cae al formato por defecto, que en iOS no reproduce
         nadie. */
      const posibles = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      const mime = posibles.find((m) => MediaRecorder.isTypeSupported(m)) || ''
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      trozos.current = []
      mr.ondataavailable = (e) => { if (e.data.size) trozos.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(trozos.current, { type: mime || 'audio/webm' })
        setAudio(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      grabadora.current = mr
      setGrabando(true)
      setSegundos(0)
      reloj.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    } catch {
      setError('No se pudo usar el micrófono. Revisa el permiso del navegador.')
    }
  }

  const pararDeGrabar = () => {
    clearInterval(reloj.current)
    setGrabando(false)
    try { grabadora.current?.stop() } catch {}
  }

  const elegirFotos = (e) => {
    const nuevas = Array.from(e.target.files ?? []).filter((f) => TIPOS_IMAGEN.includes(f.type))
    setImagenes((prev) => [...prev, ...nuevas].slice(0, MAX_IMAGENES))
    if (inputFotos.current) inputFotos.current.value = ''
  }

  const enviar = async () => {
    if (!texto.trim() && !imagenes.length && !audio) {
      setError('Escribe algo, graba una nota o adjunta una imagen')
      return
    }
    setEnviando(true); setError('')
    try {
      const fd = new FormData()
      fd.append('texto', texto)
      for (const img of imagenes) fd.append('imagenes', img)
      if (audio) fd.append('audio', audio, 'nota.webm')
      const r = await fetch('/api/sugerencias', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'No se pudo enviar'); return }
      setListo(true)
      onListo?.()
    } catch {
      setError('No se pudo enviar. Revisa tu conexión.')
    } finally { setEnviando(false) }
  }

  const cerrar = () => {
    setTexto(''); setImagenes([]); setAudio(null); setError(''); setListo(false)
    onClose()
  }

  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={listo ? 'Gracias' : '¿Qué le falta a la app?'}
      subtitle={listo ? null : 'Lo leemos todo. No todo se podrá hacer, pero todo se tiene en cuenta.'}
    >
      {listo ? (
        <div className="text-center py-4">
          <p className="text-[14px]" style={{ color: 'var(--cf-ink-2)' }}>
            Nos llegó. Si algo de lo que pediste sale, te avisamos.
          </p>
          <button type="button" onClick={cerrar} className="mt-5 w-full" style={{
            height: 48, borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)',
            color: 'var(--cf-gold-ink)', border: 0, font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            Cerrar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1.5">
            {PREGUNTAS.map((p) => (
              <li key={p} className="text-[13px] flex gap-2" style={{ color: 'var(--cf-ink-3)' }}>
                <span aria-hidden style={{ color: 'var(--cf-gold)' }}>·</span>{p}
              </li>
            ))}
          </ul>

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_CARACTERES))}
            rows={5}
            placeholder="Escribe aquí… o grábalo, si te queda más cómodo hablar"
            className="w-full px-3 py-2.5 text-sm outline-none"
            style={{
              borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)',
              border: '1px solid var(--cf-border)', color: 'var(--cf-ink)', resize: 'vertical',
            }}
          />

          {/* La nota de voz. Para mucha gente de esta app hablar es más rápido
              que teclear, y es como se comunican todo el día. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={grabando ? pararDeGrabar : empezarAGrabar}
              className="flex items-center gap-2 px-3.5"
              style={{
                height: 44, flex: 1, borderRadius: 'var(--cf-r-control)',
                background: grabando ? 'color-mix(in srgb, var(--cf-red) 12%, transparent)' : 'var(--cf-fill)',
                border: `1px solid ${grabando ? 'var(--cf-red)' : 'var(--cf-border)'}`,
                color: grabando ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
                font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Micro className="w-[17px] h-[17px]" />
              {grabando ? `Grabando ${mmss} · toca para parar` : audio ? 'Grabar otra nota' : 'Grabar una nota de voz'}
            </button>

            <button
              type="button"
              onClick={() => inputFotos.current?.click()}
              aria-label="Adjuntar imágenes"
              className="flex items-center justify-center"
              style={{
                width: 44, height: 44, borderRadius: 'var(--cf-r-control)',
                background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                color: 'var(--cf-ink-2)', cursor: 'pointer',
              }}
            >
              <Imagen className="w-[18px] h-[18px]" />
            </button>
            <input ref={inputFotos} type="file" accept={TIPOS_IMAGEN.join(',')} multiple hidden onChange={elegirFotos} />
          </div>

          {audio && !grabando && (
            <div className="flex items-center justify-between gap-3 px-3 py-2" style={{
              borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)',
            }}>
              <span className="text-[13px]" style={{ color: 'var(--cf-ink-2)' }}>Nota de voz lista</span>
              <button type="button" onClick={() => setAudio(null)} style={{
                background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
                fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
              }}>Quitar</button>
            </div>
          )}

          {imagenes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imagenes.map((f, i) => (
                <span key={i} className="flex items-center gap-2 px-2.5 py-1.5" style={{
                  borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)',
                  fontSize: 13, color: 'var(--cf-ink-2)',
                }}>
                  {f.name.length > 18 ? f.name.slice(0, 16) + '…' : f.name}
                  <button type="button" aria-label={`Quitar ${f.name}`}
                    onClick={() => setImagenes((p) => p.filter((_, k) => k !== i))}
                    style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--cf-ink-3)', font: 'inherit' }}>×</button>
                </span>
              ))}
            </div>
          )}

          {error && (
            <p className="text-[12.5px]" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>
          )}

          <button type="button" onClick={enviar} disabled={enviando} className="w-full" style={{
            height: 48, borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)',
            color: 'var(--cf-gold-ink)', border: 0, font: 'inherit', fontSize: 15, fontWeight: 700,
            cursor: enviando ? 'default' : 'pointer', opacity: enviando ? 0.6 : 1,
          }}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}
    </Modal>
  )
}

export default function BannerSugerencias() {
  const [estado, setEstado] = useState(null)
  const [abierto, setAbierto] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/sugerencias')
      if (r.ok) setEstado(await r.json())
    } catch { /* sin campaña, sin banner: nunca es un error que se enseñe */ }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (!estado) return null

  const contestadas = estado.contestadas ?? []

  /* ⚠ LA RESPUESTA SE ENSEÑA AUNQUE LA CAMPAÑA HAYA CERRADO, y por eso va
     ANTES del `return null` de `viva`. El banner se apaga solo el 28 de agosto;
     quien escribió el 27 tiene que poder leer lo que se le contestó el 29. */
  if (!estado.viva && contestadas.length === 0) return null

  const yaOpino = estado.mias > 0

  return (
    <>
      {/* ══ TE CONTESTARON ══════════════════════════════════════════════════
          «No se les puede contestar desde el banner, no por WhatsApp.»
           — el dueño, 18 ago 2026.

          Escribieron desde aquí; la respuesta vuelve aquí. Antes dependía de
          tener el WhatsApp de la persona: de los cinco que escribieron hubo que
          buscarle el número a uno, y un cobrador que manda una queja desde la
          ruta no tiene por qué dar su teléfono para que le contesten. */}
      {contestadas.map((c) => (
        <div key={c.id} style={{
          ...TARJETA,
          borderColor: 'color-mix(in srgb, var(--cf-green-dark) 30%, transparent)',
          background: 'color-mix(in srgb, var(--cf-green-dark) 5%, var(--cf-card))',
          marginBottom: 12,
        }} className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{
              borderRadius: 'var(--cf-r-icon)',
              background: 'var(--cf-green-pill-bg)', color: 'var(--cf-green-dark)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>
                Te contestamos
              </p>
              {/* Lo que él escribió, recortado: sin esto, a los diez días no se
                  acuerda de a cuál de sus mensajes le están respondiendo. */}
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                Sobre: «{String(c.texto).replace(/\s+/g, ' ').slice(0, 70)}
                {String(c.texto).length > 70 ? '…' : ''}»
              </p>
              <p className="text-[13px] mt-2 whitespace-pre-wrap" style={{ color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
                {c.respuesta}
              </p>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/sugerencias', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: c.id }),
                  }).catch(() => {})
                  cargar()
                }}
                className="mt-3 h-9 px-4 text-[13px] font-semibold"
                style={{
                  borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border)',
                  background: 'var(--cf-card)', color: 'var(--cf-ink-2)', cursor: 'pointer',
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ))}

      {!estado.viva ? null : (
      <>
      <div style={TARJETA} className="px-4 py-3.5 flex items-start gap-3">
        <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{
          borderRadius: 'var(--cf-r-icon)',
          background: yaOpino ? 'var(--cf-green-pill-bg)' : 'var(--cf-gold-tint)',
          color: yaOpino ? 'var(--cf-green-dark)' : 'var(--cf-gold-text)',
        }}>
          <Megafono className="w-[18px] h-[18px]" />
        </div>

        <div className="flex-1 min-w-0">
          {yaOpino ? (
            <>
              <p className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>
                Gracias — nos llegó lo que nos escribiste
              </p>
              <p className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                Si algo de lo que pediste sale, te avisamos. Puedes mandarnos más cuando quieras.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-bold leading-snug" style={{ color: 'var(--cf-ink)' }}>
                ¿Qué le cambiarías a la app?
              </p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                Queremos mejorarla con lo que ustedes necesitan, no con lo que nos imaginamos.
                Cuéntanos qué te falta, qué te molesta o qué es lo que más usas — escrito, con
                una foto o con una nota de voz. No todo se podrá hacer, pero todo se lee.
              </p>
            </>
          )}

          <button type="button" onClick={() => setAbierto(true)} className="mt-2.5 inline-flex items-center gap-1.5 px-3.5" style={{
            height: 38, borderRadius: 'var(--cf-r-control)',
            background: yaOpino ? 'var(--cf-card)' : 'var(--cf-gold)',
            border: yaOpino ? '1px solid var(--cf-border-strong)' : '1px solid transparent',
            color: yaOpino ? 'var(--cf-ink-2)' : 'var(--cf-gold-ink)',
            font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {yaOpino ? 'Contar algo más' : 'Contarles'}
          </button>
        </div>
      </div>
      </>
      )}

      <HojaOpinar open={abierto} onClose={() => setAbierto(false)} onListo={cargar} />
    </>
  )
}
