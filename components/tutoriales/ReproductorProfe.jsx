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
 * ══ PANTALLA COMPLETA (Carlos, 19 oct 2026) ════════════════════════════════
 * «Se ve muy pequeño si lo dejamos así en ese solo recuadro… y que también
 * vaya pudiendo hacer la seguidilla del video, en qué sesión está, pero dentro
 * de la pantalla completa.» Los videos son verticales: de pie llenan el
 * teléfono entero. Encima van la parte que suena («Parte 3 de 6 · El total»),
 * anterior y siguiente, la barra con una marca por capítulo y la lista de
 * partes, sin salir.
 *
 * ⚠ NO ES `video.requestFullscreen()`. En el iPhone eso saca el reproductor de
 * Apple y se pierden los capítulos. Es una capa propia a pantalla completa (y
 * en Android, además, se le pide al navegador que esconda sus barras).
 *
 * ⚠ UN SOLO <video>, QUE SE MUEVE. La hoja tiene `transform` (su animación), y
 * un `position: fixed` dentro de ella no llega a la pantalla. Así que el video
 * se crea a mano y se cambia de sitio con `appendChild` entre la banda de la
 * hoja y la capa completa: moverlo en el mismo turno no lo pausa (la pausa por
 * salir del documento espera a un estado estable), y sigue sonando donde iba.
 * Volver a montar uno nuevo lo reiniciaría, y el iPhone no lo dejaría sonar
 * sin otro toque.
 *
 * ⚠ VA POR ENCIMA DE TODO: se monta en `document.body`, porque lo abren
 * también botones que viven dentro de otras hojas (Gestión, el pago) y del
 * menú del +.
 *
 * El sonido, igual que la bienvenida: se intenta con sonido (lo abrió un toque)
 * y si el navegador no deja, sigue en silencio con el botón para oír al profe.
 * Mide abierto, 25/50/75/100 y cerrado con el segundo; al 80 % cuenta como
 * visto (`VISTO_DESDE`). */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const Agrandar = () => (
  <svg {...icono} width={18} height={18}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
)
const Achicar = () => (
  <svg {...icono} width={20} height={20}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
)
const PlayPausa = ({ pausa, tam = 18 }) => (pausa
  ? <svg {...icono} width={tam} height={tam}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
  : <svg {...icono} width={tam} height={tam}><path d="M9 5v14M15 5v14" /></svg>)

/** La barra de avance con una marca donde empieza cada parte. */
function Barra({ t, dur, partes, onBuscar, alto = 4 }) {
  const pct = (s) => (dur ? Math.min(100, (s / dur) * 100) : 0)
  return (
    <div role="slider" aria-label="Avance" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)}
      onClick={onBuscar} style={{ flex: 1, height: 28, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%', height: alto, borderRadius: 999, background: 'rgba(255,255,255,.25)', overflow: 'hidden' }}>
        <div style={{ width: `${pct(t)}%`, height: '100%', background: 'var(--cf-gold)' }} />
      </div>
      {partes.slice(1).map((p) => (
        <span key={p.n} aria-hidden style={{
          position: 'absolute', left: `${pct(p.t)}%`, top: '50%', width: 2, height: alto + 6, marginTop: -(alto + 6) / 2,
          background: 'rgba(0,0,0,.55)', borderRadius: 1,
        }} />
      ))}
    </div>
  )
}

export default function ReproductorProfe({ video, desde = 0, volver = 'Volver', onCerrar, onApuntar, onVisto, onTarea }) {
  const ref = useRef(null)            // el <video>, creado a mano (ver arriba)
  const huecoHoja = useRef(null)
  const huecoCompleta = useRef(null)
  const capa = useRef(null)
  const nativa = useRef(false)        // si el navegador también está en pantalla completa
  const hitos = useRef(new Set())
  const cerrado = useRef(false)
  const vistoYa = useRef(false)
  const escritorio = useEscritorio()
  const [t, setT] = useState(desde)
  const [dur, setDur] = useState(Number(video.duracion) || 0)
  const [pausa, setPausa] = useState(false)
  const [silencio, setSilencio] = useState(false)
  const [fallo, setFallo] = useState(false)
  // Solo para el render que coloca en su hueco el <video> recién creado.
  const [, setMontado] = useState(false)
  const [completa, setCompleta] = useState(false)
  const [lista, setLista] = useState(false)
  // Los capítulos que ya pasaron enteros: check (no se guardan, son de esta vez).
  const [vistasPartes, setVistasPartes] = useState(() => new Set())
  const partes = partesDe(video)
  const actual = capituloEn(video, t)
  const tarea = tareaDe(video)

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

  const alternar = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) v.play().catch(() => {}); else v.pause()
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
    setVistasPartes((antes) => {
      const hechas = partes.filter((p) => termino || segundo >= p.t + p.dura - 0.4).map((p) => p.n)
      return hechas.some((n) => !antes.has(n)) ? new Set([...antes, ...hechas]) : antes
    })
  }

  // Los manejadores del <video> leen siempre los de este render.
  const manejar = useRef({})
  manejar.current = { arrancar, alternar, alAvanzar }

  useEffect(() => {
    const v = document.createElement('video')
    v.src = video.src
    if (video.poster) v.poster = video.poster
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    v.preload = 'auto'
    Object.assign(v.style, { width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' })
    const oir = [
      ['loadedmetadata', () => { setDur(v.duration || Number(video.duracion) || 0); manejar.current.arrancar() }],
      ['click', () => manejar.current.alternar()],
      ['playing', () => setPausa(false)],
      ['pause', () => setPausa(true)],
      ['timeupdate', () => manejar.current.alAvanzar(v.currentTime)],
      ['ended', () => manejar.current.alAvanzar(v.currentTime, true)],
      ['error', () => setFallo(true)],
    ]
    for (const [ev, fn] of oir) v.addEventListener(ev, fn)
    ref.current = v
    setMontado(true)
    onApuntar('abierto', { segundo: desde })
    return () => {
      for (const [ev, fn] of oir) v.removeEventListener(ev, fn)
      v.pause()
      v.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El video vive donde toque: en la banda de la hoja o en la capa completa.
  useLayoutEffect(() => {
    const v = ref.current
    const destino = completa ? huecoCompleta.current : huecoHoja.current
    if (v && destino && v.parentNode !== destino) destino.appendChild(v)
  })

  // Si el navegador sale de su pantalla completa (atrás en Android), se sale
  // también de la nuestra.
  useEffect(() => {
    const alCambiar = () => {
      if (nativa.current && !document.fullscreenElement) { nativa.current = false; setCompleta(false); setLista(false) }
    }
    document.addEventListener('fullscreenchange', alCambiar)
    return () => document.removeEventListener('fullscreenchange', alCambiar)
  }, [])

  const entrarCompleta = () => {
    setCompleta(true)
    onApuntar('completa', {})
    // Tras pintar la capa: que el navegador esconda sus barras donde se pueda.
    requestAnimationFrame(() => {
      const el = capa.current
      if (el?.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { nativa.current = true }).catch(() => {})
    })
  }
  const salirCompleta = () => {
    setLista(false)
    setCompleta(false)
    if (nativa.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    nativa.current = false
  }

  const cerrar = (termino = false) => {
    if (cerrado.current) return
    cerrado.current = true
    const v = ref.current
    onApuntar('cerrado', { segundo: v?.currentTime ?? 0, termino })
    v?.pause()
    if (nativa.current && document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    onCerrar()
  }

  const oirAlProfe = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    setSilencio(false)
    v.play().catch(() => {})
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

  // «Anterior»: si ya van unos segundos de esta parte, la repite; si no, la de antes.
  const parteAnterior = () => {
    const p = partes[Math.max(0, actual)]
    if (p && t - p.t > 3) irA(p.t)
    else irA(partes[Math.max(0, actual - 1)]?.t ?? 0)
  }
  const parteSiguiente = () => {
    const sig = partes[actual + 1]
    if (sig) irA(sig.t)
  }

  /* ⚠ LA HOJA NACE EN EL PRIMER CUADRO, sin esperar a `montado`. Se esperaba,
     y eso abría un hueco: la hoja de ayuda (o la novedad) se cierra en el mismo
     toque que abre el video, y al cerrarse retira su entrada del historial con
     un `back()` diferido. Si el video registraba la suya un cuadro después, el
     `popstate` de ese `back()` le llegaba a él y lo cerraba: «toco el video y
     solo se sale del modal» (Carlos, 19 oct 2026, en un teléfono de verdad).
     Registrándose en el mismo cuadro, la hoja nueva cancela ese `back()`. */

  const botonOscuro = {
    width: 44, height: 44, flex: 'none', borderRadius: 999, border: 0, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.16)', color: '#fff',
  }
  const avisoSilencio = silencio && !fallo && (
    <button type="button" onClick={oirAlProfe} style={{
      position: 'absolute', left: '50%', bottom: completa ? 200 : 60, transform: 'translateX(-50%)', zIndex: 2,
      height: 44, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer', font: 'inherit',
      display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
      fontSize: 14, fontWeight: 700, background: 'var(--cf-green-dark)', color: '#fff',
    }}>
      <svg {...icono}><path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
      Toca para oír al profe
    </button>
  )
  const avisoFallo = fallo && (
    <p style={{ position: 'absolute', left: 16, right: 16, top: '42%', margin: 0, textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: '#fff', zIndex: 2 }}>
      No se pudo cargar el video. Revisa la conexión y vuelve a abrirlo.
    </p>
  )

  const videoBanda = (
    <div style={{
      position: 'relative', flex: 'none', height: escritorio ? 'min(70dvh, 560px)' : 'min(46dvh, 420px)',
      aspectRatio: escritorio ? '9 / 16' : undefined, borderRadius: 16, overflow: 'hidden',
      background: '#000', display: 'flex', justifyContent: 'center',
    }}>
      <div ref={huecoHoja} style={{ height: '100%', aspectRatio: '9 / 16', maxWidth: '100%' }} />
      {completa && (
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)', fontSize: 13 }}>
          Viendo en pantalla completa
        </span>
      )}

      {!completa && avisoSilencio}
      {!completa && avisoFallo}

      {!completa && (
        <button type="button" onClick={entrarCompleta} aria-label="Ver en pantalla completa" title="Pantalla completa" style={{
          ...botonOscuro, position: 'absolute', top: 10, right: 10, width: 40, height: 40, borderRadius: 12, background: 'rgba(0,0,0,.5)',
        }}><Agrandar /></button>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(to top, rgba(0,0,0,.72), transparent)', color: '#fff',
      }}>
        <button type="button" onClick={alternar} aria-label={pausa ? 'Seguir' : 'Pausa'} style={{ ...botonOscuro, width: 36, height: 36 }}>
          <PlayPausa pausa={pausa} />
        </button>
        <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(t)}</span>
        <Barra t={t} dur={dur} partes={partes} onBuscar={buscar} />
        <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(dur)}</span>
      </div>
    </div>
  )

  /* Los capítulos: visto con check verde, el que suena con fondo dorado claro,
     los demás con un círculo vacío. A la derecha, el minuto en que empieza.
     `oscura`: la misma lista sobre la capa completa. */
  const listaDePartes = (oscura = false) => (
    <div role="list" aria-label="Partes del video" style={{
      display: 'flex', flexDirection: 'column', borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
      border: oscura ? '1px solid rgba(255,255,255,.12)' : '1px solid var(--cf-border)',
      background: oscura ? '#1E1F24' : 'var(--cf-card)', flex: escritorio && !oscura ? 1 : 'none', minWidth: 0,
      alignSelf: escritorio && !oscura ? 'flex-start' : 'stretch',
    }}>
      {partes.map((p, i) => {
        const suena = i === actual
        const vista = vistasPartes.has(p.n) && !suena
        return (
          <button key={p.n} type="button" role="listitem" onClick={() => { irA(p.t); setLista(false) }} aria-current={suena ? 'true' : undefined} style={{
            minHeight: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', textAlign: 'left',
            border: 0, borderTop: i ? (oscura ? '1px solid rgba(255,255,255,.09)' : '1px solid var(--cf-border)') : 0,
            cursor: 'pointer', font: 'inherit',
            background: suena ? (oscura ? 'rgba(245,184,36,.14)' : 'var(--cf-gold-tint-2)') : 'transparent',
          }}>
            <span aria-hidden style={{
              width: 20, height: 20, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: vista ? 'var(--cf-green)' : suena ? (oscura ? '#F5B824' : 'var(--cf-ink)') : 'transparent',
              border: vista || suena ? 0 : (oscura ? '1.5px solid rgba(255,255,255,.35)' : '1.5px solid var(--cf-border-strong)'),
            }}>
              {vista && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
              {suena && <svg width="8" height="8" viewBox="0 0 24 24" fill={oscura ? '#15161A' : 'var(--cf-gold)'}><path d="M7 4.5v15l13-7.5z" /></svg>}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: suena ? 700 : 500, color: oscura ? '#F3F3F6' : 'var(--cf-ink)', lineHeight: 1.3 }}>{p.titulo}</span>
            <span className="cf-fig" style={{ fontSize: 12, color: oscura ? '#A3A8B2' : 'var(--cf-ink-3)', fontVariantNumeric: 'tabular-nums' }}>{reloj(p.t)}</span>
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

  const parte = partes[Math.max(0, actual)]
  const capaCompleta = completa && (
    <div ref={capa} role="dialog" aria-modal="true" aria-label={`${preguntaDe(video)} en pantalla completa`} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: '#000', color: '#fff', overflow: 'hidden',
    }}>
      <div ref={huecoCompleta} style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }} />
      {avisoSilencio}
      {avisoFallo}

      {/* Arriba: salir de la pantalla completa y qué se está viendo. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1,
        padding: 'max(10px, env(safe-area-inset-top)) 12px 28px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,0,.7), transparent)',
      }}>
        <button type="button" onClick={salirCompleta} aria-label="Salir de pantalla completa" style={botonOscuro}><Achicar /></button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{preguntaDe(video)}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{duracionLarga(video.duracion)}</span>
        </span>
      </div>

      {/* Abajo: la parte que suena, anterior / siguiente, la barra y la lista. */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1,
        padding: '40px 14px max(14px, env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 10,
        // Con la lista abierta, fondo entero: los botones no quedan sobre el video claro.
        background: lista ? 'rgba(0,0,0,.88)' : 'linear-gradient(to top, rgba(0,0,0,.85) 55%, transparent)',
        paddingTop: lista ? 14 : 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={parteAnterior} aria-label="Parte anterior" style={botonOscuro}>
            <svg {...icono}><path d="M6 5v14M19 5l-9 7 9 7z" fill="currentColor" /></svg>
          </button>
          <button type="button" onClick={() => setLista((v) => !v)} aria-expanded={lista} style={{
            flex: 1, minWidth: 0, minHeight: 44, padding: '6px 12px', borderRadius: 12, cursor: 'pointer', font: 'inherit', textAlign: 'left',
            background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.16)', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#F5B824' }}>
                Parte {Math.max(1, actual + 1)} de {partes.length}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{parte?.titulo}</span>
            </span>
            <svg {...icono} width={16} height={16} style={{ transform: lista ? 'rotate(180deg)' : undefined }}><path d="M6 15l6-6 6 6" /></svg>
          </button>
          <button type="button" onClick={parteSiguiente} disabled={actual >= partes.length - 1} aria-label="Parte siguiente" style={{ ...botonOscuro, opacity: actual >= partes.length - 1 ? 0.4 : 1 }}>
            <svg {...icono}><path d="M18 5v14M5 5l9 7-9 7z" fill="currentColor" /></svg>
          </button>
        </div>

        {lista && <div style={{ maxHeight: '42dvh', overflowY: 'auto', borderRadius: 'var(--cf-r-card)' }}>{listaDePartes(true)}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={alternar} aria-label={pausa ? 'Seguir' : 'Pausa'} style={botonOscuro}>
            <PlayPausa pausa={pausa} tam={20} />
          </button>
          <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(t)}</span>
          <Barra t={t} dur={dur} partes={partes} onBuscar={buscar} alto={5} />
          <span className="cf-fig" style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{reloj(dur)}</span>
        </div>
      </div>
    </div>
  )

  /* ⚠ ENCIMA DE TODO, TAMBIÉN DEL MENÚ DEL +. Ese menú vive a z 90 y el
     minuto de sus filas abre el video: a z 60 (el de las hojas) nacía debajo. */
  return createPortal(
    <div style={{ position: 'relative', zIndex: 95 }}>
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
          ? <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flex: 'none' }}>{videoBanda}{listaDePartes()}</div>
          : <>{videoBanda}{listaDePartes()}</>}
      </HojaInferior>
      {capaCompleta}
    </div>,
    document.body,
  )
}
