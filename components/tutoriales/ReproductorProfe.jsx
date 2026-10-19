'use client'

/* El reproductor de los videos del profe (TUTORIALES-CATALOGO.md, paso 2).
 *
 * Una hoja desde abajo, como la eligió Carlos el 17 oct 2026: arriba el video,
 * debajo las partes cortas con la que está sonando marcada, y al pie el botón
 * que hace la tarea («Registrar mi capital inicial») y «Ya entendí, cerrar».
 *
 * ⚠ LOS VIDEOS SON VERTICALES (720×1280). El boceto pintaba una franja
 * horizontal de 200px; un video de pie ahí se veía del tamaño de un sello. Va
 * en una banda oscura de alto fijo, centrado, y las partes debajo se desplazan.
 *
 * ⚠ VA POR ENCIMA DE TODO. El ícono E2 vive dentro de otras hojas («Gestión»,
 * la hoja de pago): se monta en `document.body` para no quedar debajo de la
 * hoja que lo abrió.
 *
 * El sonido, igual que la bienvenida: se intenta con sonido (lo abrió un toque)
 * y si el navegador no deja, sigue en silencio con el botón para oír al profe.
 * Mide abierto, 25/50/75/100 y cerrado con el segundo; al 75 % cuenta como
 * visto (`VISTO_DESDE`). */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import HojaInferior from '@/components/cf/HojaInferior'
import { hitosNuevos } from '@/lib/video-bienvenida'
import { partesDe, capituloEn, reloj, tareaDe, VISTO_DESDE } from '@/lib/tutoriales/profe'

const icono = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

/** «7 partes · 2 min 15 s» */
function resumen(partes, duracion) {
  const s = Math.round(Number(duracion) || 0)
  const m = Math.floor(s / 60)
  const largo = m ? `${m} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`
  return `${partes.length} ${partes.length === 1 ? 'parte' : 'partes'} · ${largo}`
}

export default function ReproductorProfe({ video, desde = 0, onCerrar, onApuntar, onVisto, onTarea }) {
  const ref = useRef(null)
  const hitos = useRef(new Set())
  const cerrado = useRef(false)
  const [t, setT] = useState(desde)
  const [dur, setDur] = useState(Number(video.duracion) || 0)
  const [pausa, setPausa] = useState(false)
  const [silencio, setSilencio] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [montado, setMontado] = useState(false)
  const partes = partesDe(video)
  const actual = capituloEn(video, t)
  const tarea = tareaDe(video)

  useEffect(() => {
    setMontado(true)
    onApuntar('abierto', { segundo: desde })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cerrar = (termino = false) => {
    if (cerrado.current) return
    cerrado.current = true
    const v = ref.current
    onApuntar('cerrado', { segundo: v?.currentTime ?? 0, termino })
    v?.pause()
    onCerrar()
  }

  const arrancar = () => {
    const v = ref.current
    if (!v) return
    if (desde > 0) v.currentTime = desde
    v.muted = false
    v.play().catch(() => {
      v.muted = true
      setSilencio(true)
      return v.play().catch(() => setPausa(true))
    })
  }

  const oirAlProfe = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    setSilencio(false)
    v.play().catch(() => {})
  }

  const alternar = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {}); else v.pause()
  }

  const irA = (segundo) => {
    const v = ref.current
    if (!v) return
    v.currentTime = segundo
    setT(segundo)
    v.play().catch(() => {})
  }

  const buscar = (e) => {
    const caja = e.currentTarget.getBoundingClientRect()
    if (!dur) return
    irA(Math.max(0, Math.min(1, (e.clientX - caja.left) / caja.width)) * dur)
  }

  const apuntarHitos = (termino) => {
    const v = ref.current
    if (!v) return
    for (const h of hitosNuevos(v.currentTime, v.duration, hitos.current, { termino })) {
      hitos.current.add(h)
      onApuntar(String(h), {})
      if (h >= VISTO_DESDE) onVisto()
    }
  }

  if (!montado) return null

  return createPortal(
    <HojaInferior
      abierta
      onCerrar={() => cerrar()}
      titulo={video.titulo}
      subtitulo={`El profe · ${resumen(partes, video.duracion)}`}
      accion={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tarea && (
            <button type="button" onClick={() => { cerrar(); onTarea(tarea) }} style={{
              height: 'var(--cf-h-btn)', borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 15, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            }}>{tarea.texto}</button>
          )}
          <button type="button" onClick={() => cerrar()} style={{
            height: 44, border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
            fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>Ya entendí, cerrar</button>
        </div>
      }
    >
      {/* El video, de pie, en su banda. El negro es el del propio video. */}
      <div style={{
        position: 'relative', flex: 'none', height: 'min(48dvh, 440px)', borderRadius: 16, overflow: 'hidden',
        background: '#000', display: 'flex', justifyContent: 'center',
      }}>
        <video
          ref={ref}
          src={video.src}
          poster={video.poster}
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => { setDur(e.currentTarget.duration || dur); arrancar() }}
          onClick={alternar}
          onPlaying={() => setPausa(false)}
          onPause={() => setPausa(true)}
          onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); apuntarHitos(false) }}
          onEnded={() => { apuntarHitos(true); onVisto() }}
          onError={() => setFallo(true)}
          style={{ height: '100%', aspectRatio: '9 / 16', maxWidth: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
        />

        {silencio && !fallo && (
          <button type="button" onClick={oirAlProfe} style={{
            position: 'absolute', left: '50%', bottom: 60, transform: 'translateX(-50%)',
            height: 44, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
            fontSize: 14, fontWeight: 700, background: 'var(--cf-green-dark)', color: '#fff',
          }}>
            <svg {...icono}><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
            Toca para oír al profe
          </button>
        )}

        {fallo && (
          <p style={{ position: 'absolute', left: 16, right: 16, top: '42%', margin: 0, textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: '#fff' }}>
            No se pudo cargar el video. Revisa la conexión y vuelve a abrirlo.
          </p>
        )}

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)', color: '#fff',
        }}>
          <button type="button" onClick={alternar} aria-label={pausa ? 'Seguir' : 'Pausa'} style={{
            width: 36, height: 36, flex: 'none', borderRadius: 999, border: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.18)', color: '#fff',
          }}>
            {pausa
              ? <svg {...icono} width={18} height={18}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              : <svg {...icono} width={18} height={18}><path d="M9 5v14M15 5v14" /></svg>}
          </button>
          <div role="slider" aria-label="Avance" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
            onClick={buscar} style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
              <div style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%`, height: '100%', background: '#fff' }} />
            </div>
          </div>
          <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, minWidth: 64, textAlign: 'right' }}>{reloj(t)} / {reloj(dur)}</span>
        </div>
      </div>

      {/* Las partes. La que suena va en carbón: el dorado es de la tarea. */}
      <div role="list" aria-label="Partes del video" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {partes.map((p, i) => {
          const suena = i === actual
          return (
            <button key={p.n} type="button" role="listitem" onClick={() => irA(p.t)} aria-current={suena ? 'true' : undefined} style={{
              minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', textAlign: 'left',
              borderRadius: 12, cursor: 'pointer', font: 'inherit',
              border: `1px solid ${suena ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
              background: suena ? 'var(--cf-fill)' : 'var(--cf-card)',
            }}>
              <span aria-hidden style={{
                width: 28, height: 28, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: suena ? 'var(--cf-ink)' : 'var(--cf-fill)', color: suena ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
              }}>
                {suena ? <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> : p.n}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.3 }}>{p.titulo}</span>
                {suena && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Viendo ahora</span>}
              </span>
              <span className="cf-fig" style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>{reloj(p.dura)}</span>
            </button>
          )
        })}
      </div>
    </HojaInferior>,
    document.body,
  )
}
