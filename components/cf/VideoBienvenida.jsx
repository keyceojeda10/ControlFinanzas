'use client'

/* La clase de 2 minutos, en nuestro propio reproductor (sin YouTube).
 *
 * ⚠ EL SONIDO. Carlos preguntó si arrancar con sonido o sin él (14 oct 2026).
 * Se INTENTA con sonido: es un profesor hablando. Pero el navegador decide —
 * Android suele dejar porque la persona acaba de tocar «Entrar»; el iPhone no
 * deja nunca, y si se insiste el video ni arranca—. Así que si `play()` con
 * sonido se rechaza, sigue en silencio (los subtítulos van dentro del video) y
 * sale el botón grande para oír al profe, que vuelve al principio.
 *
 * ⚠ NUNCA ATRAPA. «Cerrar» está siempre a la vista, y si el video no carga
 * cuando se abrió solo, se cierra sin decir nada y sigue el asistente.
 *
 * Mide lo que pidió Carlos (abierto, sonido, 25/50/75/100, cerrado con el
 * segundo) en `Evento`, para cruzarlo con quién registra capital y quién cobra. */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { VIDEO_BIENVENIDA, EVENTOS_VIDEO, hitosNuevos } from '@/lib/video-bienvenida'

const marcar = (evento, metadata) => {
  fetch('/api/analytics/track', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evento, pagina: typeof window !== 'undefined' ? window.location.pathname : null, metadata }),
  }).catch(() => {})
}

const ESPERA_MAX_MS = 12000

const icono = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export function VideoBienvenida({ desde = 0, origen, solo = false, onCerrar }) {
  const ref = useRef(null)
  const vistos = useRef(new Set())
  const arranco = useRef(false)
  const cerrado = useRef(false)
  const [silencio, setSilencio] = useState(false)
  const [parado, setParado] = useState(false)   // ni en silencio quiso arrancar
  const [pausa, setPausa] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [t, setT] = useState(desde)
  const [dur, setDur] = useState(0)
  const [visible, setVisible] = useState(false)

  const cerrar = (termino = false) => {
    if (cerrado.current) return
    cerrado.current = true
    const v = ref.current
    marcar(EVENTOS_VIDEO.cerrado, { origen, segundo: Math.round(v?.currentTime ?? 0), termino })
    v?.pause()
    onCerrar?.()
  }

  useEffect(() => {
    marcar(EVENTOS_VIDEO.abierto, { origen, desde })
    const id = requestAnimationFrame(() => setVisible(true))
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', onKey)

    const v = ref.current
    if (v) {
      v.muted = false
      v.play()
        .then(() => marcar(EVENTOS_VIDEO.sonido, { origen, como: 'solo' }))
        .catch(() => {
          v.muted = true
          setSilencio(true)
          return v.play().catch(() => setParado(true))
        })
    }
    // Abierto solo y sin arrancar: no se deja a nadie mirando una pantalla quieta.
    const espera = solo ? setTimeout(() => { if (!arranco.current) cerrar() }, ESPERA_MAX_MS) : null

    return () => {
      cancelAnimationFrame(id)
      clearTimeout(espera)
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const oirAlProfe = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    v.currentTime = desde
    setSilencio(false)
    setParado(false)
    v.play().catch(() => {})
    marcar(EVENTOS_VIDEO.sonido, { origen, como: 'toque' })
  }

  const alternar = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {}); else v.pause()
  }

  const buscar = (e) => {
    const v = ref.current
    if (!v || !dur) return
    const caja = e.currentTarget.getBoundingClientRect()
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width)) * dur
  }

  const apuntarHitos = (termino) => {
    const v = ref.current
    if (!v) return
    for (const h of hitosNuevos(v.currentTime, v.duration, vistos.current, { termino })) {
      vistos.current.add(h)
      marcar(EVENTOS_VIDEO.hito(h), { origen })
    }
  }

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return createPortal(
    /* El foco va a la capa y no a «Cerrar»: en el teléfono el foco puesto por
       código pinta un aro alrededor del botón, como si ya lo hubieran tocado. */
    <div role="dialog" aria-modal="true" aria-label="La clase de 2 minutos" tabIndex={-1}
      ref={(el) => { if (el && !el.dataset.enfocada) { el.dataset.enfocada = '1'; el.focus({ preventScroll: true }) } }} style={{
      outline: 'none',
      position: 'fixed', inset: 0, zIndex: 10004, background: 'rgba(8,9,12,.94)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity .35s cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{ position: 'relative', height: '100%', maxHeight: '100dvh', aspectRatio: '9 / 16', maxWidth: '100%' }}>
        <video
          ref={ref}
          src={`${VIDEO_BIENVENIDA.src}${desde ? `#t=${desde}` : ''}`}
          poster={VIDEO_BIENVENIDA.poster}
          playsInline
          preload="auto"
          onClick={alternar}
          onPlaying={() => { arranco.current = true; setPausa(false); setParado(false) }}
          onPause={() => setPausa(true)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); apuntarHitos(false) }}
          onEnded={() => { apuntarHitos(true); cerrar(true) }}
          onError={() => { if (solo) cerrar(); else setFallo(true) }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
        />

        <button type="button" onClick={() => cerrar()} style={{
          position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', right: 12,
          height: 40, padding: '0 14px 0 10px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600,
          background: 'rgba(0,0,0,.55)', color: '#fff',
        }}>
          <svg {...icono}><path d="M6 6l12 12M18 6L6 18" /></svg>
          Cerrar
        </button>

        {(silencio || parado) && !fallo && (
          <button type="button" onClick={oirAlProfe} style={{
            position: 'absolute', left: '50%', bottom: 88, transform: 'translateX(-50%)',
            height: 56, padding: '0 22px', borderRadius: 16, border: 0, cursor: 'pointer', font: 'inherit',
            display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
            fontSize: 16, fontWeight: 700, background: 'var(--cf-green-dark)', color: '#fff',
            boxShadow: '0 6px 8px rgba(0,0,0,.35)',
          }}>
            <svg {...icono} width={22} height={22}>
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
            </svg>
            {parado ? 'Ver la clase con sonido' : 'Toca para oír al profe'}
          </button>
        )}

        {fallo && (
          <p style={{
            position: 'absolute', left: 16, right: 16, top: '45%', margin: 0, textAlign: 'center',
            fontSize: 15, lineHeight: 1.5, color: '#fff',
          }}>
            No se pudo cargar el video. Revisa la conexión y vuelve a abrirlo desde Tutoriales.
          </p>
        )}

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '12px 14px max(14px, env(safe-area-inset-bottom))',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent)',
        }}>
          <button type="button" onClick={alternar} aria-label={pausa ? 'Seguir' : 'Pausa'} style={{
            width: 40, height: 40, flex: 'none', borderRadius: 999, border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.16)', color: '#fff',
          }}>
            {pausa
              ? <svg {...icono}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              : <svg {...icono}><path d="M9 5v14M15 5v14" /></svg>}
          </button>
          <div role="slider" aria-label="Avance" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
            onClick={buscar} style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
              <div style={{ width: `${dur ? (t / dur) * 100 : 0}%`, height: '100%', background: '#fff' }} />
            </div>
          </div>
          <span className="cf-fig" style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', minWidth: 72, textAlign: 'right' }}>
            {mmss(t)} / {mmss(dur)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Un enlace que abre la clase. `desde` en segundos (los avisos de caja la abren
 *  en la lección del capital). */
export function EnlaceVideoBienvenida({ desde = 0, origen, children, style, className }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, textAlign: 'left',
        cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'var(--cf-green-dark)', ...style,
      }}>
        <svg {...icono} width={16} height={16}><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5z" fill="currentColor" /></svg>
        {children}
      </button>
      {abierto && <VideoBienvenida desde={desde} origen={origen} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export default VideoBienvenida
