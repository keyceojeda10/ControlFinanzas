'use client'

/* La hoja del video (Adenda 6, F).
 *
 * Hoja inferior, no otra pantalla: la de atrás se ve arriba y quien la abrió no
 * pierde dónde estaba. El título es la PREGUNTA (si el catálogo la trae).
 * Debajo, los capítulos: saltan a su minuto y se marcan con check al verse —la
 * gente no quiere el tutorial entero, quiere su parte—. La acción dorada
 * DEVUELVE A LA TAREA con su nombre («Volver al préstamo»), no «Cerrar»; si el
 * video tiene tarea («Registrar mi capital inicial»), la dorada es esa.
 *
 * En escritorio, modal de 720px con los capítulos a la derecha.
 *
 * ⚠ LOS VIDEOS SON VERTICALES (720×1280): van en una banda oscura de alto fijo.
 * ⚠ VA POR ENCIMA DE TODO: se monta en `document.body`, porque lo abren
 * también botones que viven dentro de otras hojas (Gestión, el pago).
 *
 * El sonido, igual que la bienvenida: se intenta con sonido (lo abrió un toque)
 * y si el navegador no deja, sigue en silencio con el botón para oír al profe.
 * Mide abierto, 25/50/75/100 y cerrado con el segundo; al 80 % cuenta como
 * visto (`VISTO_DESDE`). */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import HojaInferior, { useEscritorio } from '@/components/cf/HojaInferior'
import { hitosNuevos } from '@/lib/video-bienvenida'
import { partesDe, capituloEn, reloj, tareaDe, preguntaDe, VISTO_DESDE } from '@/lib/tutoriales/profe'

const icono = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

/** «45 segundos» · «2 min 15 s» */
function duracionLarga(segundos) {
  const s = Math.round(Number(segundos) || 0)
  const m = Math.floor(s / 60)
  if (!m) return `${s} segundos`
  return `${m} min${s % 60 ? ` ${s % 60} s` : ''}`
}

export default function ReproductorProfe({ video, desde = 0, volver = 'Volver', onCerrar, onApuntar, onVisto, onTarea }) {
  const ref = useRef(null)
  const hitos = useRef(new Set())
  const cerrado = useRef(false)
  const vistoYa = useRef(false)
  const escritorio = useEscritorio()
  const [t, setT] = useState(desde)
  const [dur, setDur] = useState(Number(video.duracion) || 0)
  const [pausa, setPausa] = useState(false)
  const [silencio, setSilencio] = useState(false)
  const [fallo, setFallo] = useState(false)
  const [montado, setMontado] = useState(false)
  // Los capítulos que ya pasaron enteros: check (no se guardan, son de esta vez).
  const [vistasPartes, setVistasPartes] = useState(() => new Set())
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

  const alAvanzar = (segundo, termino = false) => {
    setT(segundo)
    const v = ref.current
    if (v) {
      for (const h of hitosNuevos(v.currentTime, v.duration, hitos.current, { termino })) {
        hitos.current.add(h)
        onApuntar(String(h), {})
      }
      // Visto al 80 % (los hitos de medición van de 25 en 25).
      if (!vistoYa.current && (termino || (v.duration > 0 && v.currentTime / v.duration >= VISTO_DESDE / 100))) {
        vistoYa.current = true
        onVisto()
      }
    }
    // Un capítulo queda visto cuando el video pasa su final.
    const hechas = partes.filter((p) => termino || segundo >= p.t + p.dura - 0.4).map((p) => p.n)
    if (hechas.some((n) => !vistasPartes.has(n))) setVistasPartes(new Set([...vistasPartes, ...hechas]))
  }

  if (!montado) return null

  const videoBanda = (
    <div style={{
      position: 'relative', flex: 'none', height: escritorio ? 'min(70dvh, 560px)' : 'min(46dvh, 420px)',
      aspectRatio: escritorio ? '9 / 16' : undefined, borderRadius: 16, overflow: 'hidden',
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
        onTimeUpdate={(e) => alAvanzar(e.currentTarget.currentTime)}
        onEnded={(e) => alAvanzar(e.currentTarget.currentTime, true)}
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
        <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(t)}</span>
        <div role="slider" aria-label="Avance" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
          onClick={buscar} style={{ flex: 1, height: 24, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
            <div style={{ width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%`, height: '100%', background: 'var(--cf-gold)' }} />
          </div>
        </div>
        <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(dur)}</span>
      </div>
    </div>
  )

  /* Los capítulos: visto con check verde, el que suena con fondo dorado claro,
     los demás con un círculo vacío. A la derecha, el minuto en que empieza. */
  const capitulos = (
    <div role="list" aria-label="Partes del video" style={{
      display: 'flex', flexDirection: 'column', borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
      border: '1px solid var(--cf-border)', background: 'var(--cf-card)', flex: escritorio ? 1 : 'none', minWidth: 0,
      alignSelf: escritorio ? 'flex-start' : 'stretch',
    }}>
      {partes.map((p, i) => {
        const suena = i === actual
        const vista = vistasPartes.has(p.n) && !suena
        return (
          <button key={p.n} type="button" role="listitem" onClick={() => irA(p.t)} aria-current={suena ? 'true' : undefined} style={{
            minHeight: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', textAlign: 'left',
            border: 0, borderTop: i ? '1px solid var(--cf-border)' : 0, cursor: 'pointer', font: 'inherit',
            background: suena ? 'var(--cf-gold-tint-2)' : 'transparent',
          }}>
            <span aria-hidden style={{
              width: 20, height: 20, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: vista ? 'var(--cf-green)' : suena ? 'var(--cf-ink)' : 'transparent',
              border: vista || suena ? 0 : '1.5px solid var(--cf-border-strong)',
            }}>
              {vista && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
              {suena && <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--cf-gold)"><path d="M7 4.5v15l13-7.5z" /></svg>}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: suena ? 700 : 500, color: 'var(--cf-ink)', lineHeight: 1.3 }}>{p.titulo}</span>
            <span className="cf-fig" style={{ fontSize: 12, color: 'var(--cf-ink-3)', fontVariantNumeric: 'tabular-nums' }}>{reloj(p.t)}</span>
          </button>
        )
      })}
    </div>
  )

  // Sin `flex: 1`: en la columna del pie eso le quita la altura (base 0).
  const dorado = {
    width: '100%', height: 'var(--cf-h-btn)', flex: 'none', borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer', font: 'inherit',
    fontSize: 15, fontWeight: 700, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
  }

  return createPortal(
    <HojaInferior
      abierta
      onCerrar={() => cerrar()}
      titulo={preguntaDe(video)}
      subtitulo={duracionLarga(video.duracion)}
      anchoEscritorio={720}
      accion={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tarea
            ? (
              <>
                <button type="button" onClick={() => { cerrar(); onTarea(tarea) }} style={dorado}>{tarea.texto}</button>
                <button type="button" onClick={() => cerrar()} style={{
                  height: 44, border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
                  fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-2)',
                }}>{volver}</button>
              </>
            )
            : <button type="button" onClick={() => cerrar()} style={dorado}>{volver}</button>}
        </div>
      }
    >
      {escritorio
        ? <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>{videoBanda}{capitulos}</div>
        : <>{videoBanda}{capitulos}</>}
    </HojaInferior>,
    document.body,
  )
}
