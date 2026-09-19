'use client'

/**
 * DESLIZAR PARA CONFIRMAR — el pie que guarda un pago en un teléfono.
 *
 * Idea tomada del competidor (sep 2026), y el dueño la vio en su vídeo: «los
 * pagos se aprueban deslizando el botón de lado a lado, como aceptar una
 * llamada». Lo que resuelve en la calle: el cobrador cobra con una mano, con el
 * billete en la otra, y un toque de más —al guardar el teléfono en el bolsillo,
 * al pasar la hoja— guardaba un pago. Un deslizamiento hasta el final no ocurre
 * sin querer.
 *
 * El 19 sep el dueño lo encontró «aburrido» y pidió que cobrar diera ganas:
 * «un poquito de dopamina… fluida, nada de trabada en ningún dispositivo».
 * Diez versiones de prototipo después aprobó ésta («mucho más limpio»):
 *   · una pastilla SÓLIDA del color de la tinta (se invierte en oscuro), sin
 *     cristal ni brillos — lo probamos y «parecía el iPhone 6»;
 *   · el asa dorada lisa, que crece al tocarla y se estira un poco al correr;
 *   · con `cifra`, el monto SE ARMA detrás del asa: cada dígito gira como un
 *     rodillo y se fija al pasar su marca, con un toque de vibración y un clic
 *     que sube de tono. El último se fija justo en el umbral;
 *   · al pasar el umbral todo se pone verde; guardando, la pista entera es
 *     verde con el monto al centro.
 *
 * Reglas:
 * - Solo el ASA se arrastra. Tocar la pista no confirma: enseña la pista
 *   «Desliza la flecha hasta el final» y empuja el asa un poco, que es cómo se
 *   aprende el gesto sin leer nada.
 * - Confirma al pasar el 88 % del recorrido. Menos, vuelve con muelle.
 * - Con teclado (Enter/Espacio sobre el asa) confirma directo: quien usa
 *   teclado o lector de pantalla ya eligió a propósito, y un gesto que no puede
 *   hacer lo dejaría sin forma de cobrar.
 * - Mientras `confirmando`, el asa se queda al final y dice «Guardando».
 *   Cuando termina (error o no), vuelve al principio.
 * - Todo se pinta por estilo, nunca por estado: un render por píxel del dedo
 *   traba la hoja en los Android de gama baja. Y solo `transform`/`opacity`.
 *
 * Medidas del sistema: pista 56 de alto (remate de flujo), asa 48 de alto.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clicDigito, construirRodillos, CSS_RODILLOS, despertarAudio, haciaDelante, moverRodillo, vibrar,
} from '@/lib/celebrar'

const ALTO = 56
const RELLENO = 4
const ASA_ALTO = ALTO - RELLENO * 2
const ASA = 56
const UMBRAL = 0.88
const EXPO = 'cubic-bezier(.16,1,.3,1)'

export default function DeslizarParaConfirmar({
  texto = 'Confirmar',
  // El monto ya formateado («$30.000»). Con él, el número se arma mientras se
  // desliza; sin él, la pista funciona igual, sin número.
  cifra = null,
  onConfirmar,
  confirmando = false,
  deshabilitado = false,
}) {
  const refPista = useRef(null)
  const refAsa = useRef(null)
  const refCara = useRef(null)
  const refRelleno = useRef(null)
  const refTexto = useRef(null)
  const refCifra = useRef(null)
  const refOdo = useRef(null)
  const refRodillos = useRef([])
  const refAnchoCifra = useRef(0)
  const refUmbral = useRef(false)
  const refGesto = useRef(null)
  const refPista2 = useRef(0)
  const [pista, setPista] = useState(false)
  const [menosMovimiento, setMenosMovimiento] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const leer = () => setMenosMovimiento(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  // El último valor, para los temporizadores: su cierre ve el de cuando nacieron.
  const refConfirmando = useRef(confirmando)
  useEffect(() => { refConfirmando.current = confirmando }, [confirmando])

  const ancho = useCallback(() => refPista.current?.getBoundingClientRect().width ?? 0, [])
  const recorrido = useCallback(() => Math.max(0, ancho() - ASA - RELLENO * 2), [ancho])

  const pintar = useCallback((x, animar) => {
    const max = recorrido() || 1
    const W = ancho() || 1
    const suave = animar && !menosMovimiento
    const t = suave ? `transform .32s ${EXPO}, opacity .2s` : 'none'
    if (refAsa.current) {
      refAsa.current.style.transition = t
      refAsa.current.style.transform = `translateX(${x}px)`
    }
    // El relleno es una pastilla del ancho de la pista que se corre: su punta
    // redonda queda siempre detrás del asa, sin deformarse (y sin animar
    // `width`, que recalcula la página en cada cuadro).
    if (refRelleno.current) {
      refRelleno.current.style.transition = t
      refRelleno.current.style.transform = `translateX(${x + ASA + RELLENO * 2 - W}px)`
      refRelleno.current.style.opacity = String(Math.min(1, x / 24))
    }
    if (refTexto.current) {
      refTexto.current.style.transition = t
      refTexto.current.style.opacity = String(Math.max(0, 1 - (x / max) * 3))
    }
    const anchoCifra = refAnchoCifra.current
    if (refCifra.current) {
      refCifra.current.style.transition = t
      refCifra.current.style.transform = `translateX(${RELLENO + x - anchoCifra - 12}px)`
      refCifra.current.style.opacity = String(Math.min(1, x / 20))
    }

    // Cada dígito se fija al pasar su marca; el último, justo en el umbral.
    const fin = max * UMBRAL
    const desde = anchoCifra + 16 < fin ? anchoCifra + 16 : 0
    const rodillos = refRodillos.current
    rodillos.forEach((r, k) => {
      const marca = desde + (fin - desde) * (k + 1) / rodillos.length
      if (x >= marca - 0.5) {
        if (r.fija) return
        r.fija = true
        r.el.style.opacity = '1'
        moverRodillo(r, haciaDelante(r, r.d), menosMovimiento ? 'none' : `transform .24s ${EXPO}`)
        if (!animar) { vibrar(7); clicDigito(k) }
      } else {
        r.fija = false
        r.el.style.opacity = '.38'
        moverRodillo(r, 10 + ((x / 8 + k * 3.3) % 10), suave ? `transform .32s ${EXPO}` : 'none')
      }
    })

    const listo = x >= fin && x > 0
    if (listo !== refUmbral.current) {
      refUmbral.current = listo
      refPista.current?.setAttribute('data-listo', listo ? '1' : '0')
      if (listo && !animar) vibrar(16)
    }
  }, [ancho, menosMovimiento, recorrido])

  // El número se arma sobre los rodillos de ESTE monto.
  useEffect(() => {
    if (!refOdo.current) { refRodillos.current = []; return }
    refRodillos.current = cifra ? construirRodillos(refOdo.current, cifra) : []
    refRodillos.current.forEach((r) => { r.fija = false })
    refAnchoCifra.current = refOdo.current.getBoundingClientRect().width
    if (!refGesto.current && !refConfirmando.current) pintar(0, false)
  }, [cifra, pintar])

  // Al terminar de guardar —bien o mal— el asa vuelve al principio.
  useEffect(() => {
    pintar(confirmando ? recorrido() : 0, true)
    refPista.current?.setAttribute('data-guardando', confirmando ? '1' : '0')
    if (confirmando && refCifra.current) {
      // Guardando: el monto queda al centro de lo verde, sobre «Guardando».
      refCifra.current.style.transform =
        `translate(${(ancho() - ASA - RELLENO * 2 - refAnchoCifra.current) / 2}px, -7px)`
    }
  }, [confirmando, pintar, recorrido, ancho])

  useEffect(() => () => clearTimeout(refPista2.current), [])

  /* ── EL ASA SE PORTA COMO ALGO VIVO ──
     Crece al tocarla y se estira un poco con la velocidad del dedo; al frenar
     se recoge. Un solo bucle de cuadros, solo mientras se mueve. */
  const refVivo = useRef({ escala: 1, estiro: 1, vel: 0, ultimo: null, bucle: 0, agarrada: false, despertar: null })
  const refMenos = useRef(false)
  useEffect(() => { refMenos.current = menosMovimiento }, [menosMovimiento])
  useEffect(() => {
    const v = refVivo.current
    const paso = () => {
      const objetivo = v.agarrada ? 1.08 : 1
      v.escala += (objetivo - v.escala) * 0.22
      const s = refMenos.current ? 0 : Math.min(0.08, Math.abs(v.vel) * 0.06)
      v.estiro += (1 + s - v.estiro) * 0.3
      v.vel *= 0.8
      const cara = refCara.current
      if (cara) cara.style.transform = `scale(${v.escala * v.estiro}, ${v.escala * (2 - v.estiro)})`
      if (Math.abs(objetivo - v.escala) > 0.002 || Math.abs(v.estiro - 1) > 0.002 || Math.abs(v.vel) > 0.01) {
        v.bucle = requestAnimationFrame(paso)
      } else {
        v.bucle = 0; v.escala = objetivo; v.estiro = 1
        if (cara) cara.style.transform = objetivo === 1 ? '' : `scale(${objetivo})`
      }
    }
    v.despertar = () => { if (!v.bucle) v.bucle = requestAnimationFrame(paso) }
    return () => cancelAnimationFrame(v.bucle)
  }, [])
  const despertarAsa = () => refVivo.current.despertar?.()

  const muerto = confirmando || deshabilitado

  const confirmar = () => {
    if (muerto) return
    pintar(recorrido(), true)
    vibrar(18)
    onConfirmar?.()
    // Si no llegó a guardar —«Ingresa un monto válido» sale sin encender
    // `confirmando`— el asa no puede quedarse al final: parecería guardado.
    setTimeout(() => { if (!refConfirmando.current) pintar(0, true) }, 350)
  }

  const ensenar = () => {
    if (muerto) return
    setPista(true)
    clearTimeout(refPista2.current)
    refPista2.current = setTimeout(() => setPista(false), 2200)
    if (menosMovimiento) return
    pintar(Math.min(36, recorrido()), true)
    setTimeout(() => { if (!refGesto.current && !refConfirmando.current) pintar(0, true) }, 280)
  }

  const alAgarrar = (e) => {
    if (muerto || e.button > 0) return
    e.stopPropagation()
    despertarAudio()
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* sin captura */ }
    if (refOdo.current && !refAnchoCifra.current) refAnchoCifra.current = refOdo.current.getBoundingClientRect().width
    refGesto.current = { x0: e.clientX, max: recorrido(), x: 0 }
    Object.assign(refVivo.current, { agarrada: true, vel: 0, ultimo: null })
    despertarAsa()
  }

  const alMover = (e) => {
    const g = refGesto.current
    if (!g) return
    g.x = Math.min(g.max, Math.max(0, e.clientX - g.x0))
    const v = refVivo.current
    if (v.ultimo) v.vel = v.vel * 0.5 + ((g.x - v.ultimo.x) / Math.max(4, e.timeStamp - v.ultimo.t)) * 0.5
    v.ultimo = { x: g.x, t: e.timeStamp }
    despertarAsa()
    pintar(g.x, false)
  }

  const alSoltar = () => {
    refVivo.current.agarrada = false
    despertarAsa()
    const g = refGesto.current
    if (!g) return
    refGesto.current = null
    if (g.max > 0 && g.x >= g.max * UMBRAL) return confirmar()
    // Un toque sin arrastre no es un intento fallido: es alguien que no sabe
    // que hay que deslizar.
    if (g.x < 6) return ensenar()
    pintar(0, true)
  }

  return (
    <div
      ref={refPista}
      onClick={(e) => { if (e.target === refAsa.current || refAsa.current?.contains(e.target)) return; ensenar() }}
      data-deslizar-confirmar=""
      data-listo="0"
      data-guardando="0"
      className="cf-deslizar"
      style={{
        position: 'relative', height: ALTO, width: '100%', borderRadius: 999,
        background: 'var(--cf-pista-fondo)', overflow: 'hidden',
        opacity: deshabilitado && !confirmando ? 0.55 : 1,
        touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Lo recorrido se tiñe: dice cuánto falta sin tener que leerlo. */}
      <span ref={refRelleno} aria-hidden className="cf-deslizar-relleno" style={{
        position: 'absolute', inset: 0, borderRadius: 999, opacity: 0,
        transform: 'translateX(-100%)', willChange: 'transform',
      }} />

      {/* El monto que se arma, pegado detrás del asa. */}
      {cifra && (
        <span ref={refCifra} aria-hidden className="cf-deslizar-cifra" style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, opacity: 0,
          display: 'flex', alignItems: 'center', pointerEvents: 'none', willChange: 'transform',
        }}>
          <span ref={refOdo} className="cf-rodillos" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 700,
            letterSpacing: '-.01em',
          }} />
        </span>
      )}

      <span ref={refTexto} aria-hidden style={{
        position: 'absolute', inset: 0, paddingLeft: ASA + RELLENO * 2 + 4, paddingRight: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontSize: 16, fontWeight: 700, color: 'var(--cf-pista-texto)', whiteSpace: 'nowrap',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pista ? 'Desliza la flecha hasta el final' : texto}
        </span>
        {/* Tres flechas que se encienden en fila: dicen hacia dónde sin moverse. */}
        {!pista && (
          <span className="cf-deslizar-flechas" style={{ display: 'inline-flex', flex: 'none' }}>
            {[0, 1, 2].map((k) => (
              <svg key={k} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -3 }}>
                <path d="M4 2l4 4-4 4" />
              </svg>
            ))}
          </span>
        )}
      </span>

      {confirmando && (
        <span role="status" style={{
          position: 'absolute', left: 0, right: ASA + RELLENO * 2, pointerEvents: 'none',
          ...(cifra
            ? { bottom: 7, textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }
            : { top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }),
          color: '#FFF',
        }}>{cifra ? 'Guardando' : 'Guardando…'}</span>
      )}

      <button
        ref={refAsa}
        type="button"
        aria-label={texto}
        disabled={muerto}
        onPointerDown={alAgarrar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        // `detail === 0` es un clic de teclado: el ratón y el dedo van por el
        // arrastre. Sin esto, soltar el dedo sobre el asa sería un clic y
        // confirmaría sin deslizar.
        onClick={(e) => { if (e.detail === 0) confirmar() }}
        className="cf-deslizar-asa"
        style={{
          position: 'absolute', left: RELLENO, top: RELLENO,
          width: ASA, height: ASA_ALTO, minWidth: ASA, minHeight: ASA_ALTO, flex: 'none',
          border: 'none', borderRadius: 999, padding: 0, background: 'none',
          cursor: muerto ? 'not-allowed' : 'grab', touchAction: 'none', willChange: 'transform', zIndex: 1,
        }}
      >
        <span ref={refCara} className="cf-deslizar-cara" style={{
          position: 'absolute', inset: 0, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', willChange: 'transform',
        }}>
          {/* Flecha mientras falta; visto al pasar el umbral y guardando. Los dos
              están siempre y se cruzan por CSS: cambiar de icono no re-pinta. */}
          <svg className="cf-deslizar-flecha" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M13 6l6 6-6 6" />
          </svg>
          <svg className="cf-deslizar-visto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </button>

      <style>{`
        ${CSS_RODILLOS}
        .cf-deslizar-relleno { background: color-mix(in oklab, var(--cf-gold) 26%, var(--cf-pista-fondo)); transition: background-color .15s; }
        .cf-deslizar-cifra .cf-rodillos { color: var(--cf-pista-cifra); transition: color .15s; }
        .cf-deslizar-cifra .cf-rodillo { transition: opacity .12s; }
        .cf-deslizar-cara { background: var(--cf-gold); color: var(--cf-gold-ink); transition: background-color .15s, color .15s; }
        .cf-deslizar-flecha, .cf-deslizar-visto { transition: transform .18s cubic-bezier(.16,1,.3,1), opacity .12s; }
        .cf-deslizar-visto { position: absolute; opacity: 0; transform: scale(.6); }
        .cf-deslizar[data-listo="1"] .cf-deslizar-flecha, .cf-deslizar[data-guardando="1"] .cf-deslizar-flecha { opacity: 0; transform: scale(.6); }
        .cf-deslizar[data-listo="1"] .cf-deslizar-visto, .cf-deslizar[data-guardando="1"] .cf-deslizar-visto { opacity: 1; transform: none; }
        .cf-deslizar[data-listo="1"] .cf-deslizar-relleno { background: color-mix(in oklab, var(--cf-green) 30%, var(--cf-pista-fondo)); }
        .cf-deslizar[data-listo="1"] .cf-rodillos { color: var(--cf-pista-listo); }
        .cf-deslizar[data-listo="1"] .cf-deslizar-cara { background: var(--cf-green); color: #FFF; }
        .cf-deslizar[data-guardando="1"] .cf-deslizar-relleno { background: var(--cf-green); opacity: 1 !important; }
        .cf-deslizar[data-guardando="1"] .cf-rodillos { color: #FFF; }
        .cf-deslizar[data-guardando="1"] .cf-deslizar-cara { background: rgba(255,255,255,.2); color: #FFF; }
        .cf-deslizar::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0;
          background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,.26) 50%, transparent 70%); transform: translateX(-100%); }
        .cf-deslizar[data-guardando="1"]::after { opacity: 1; animation: cf-deslizar-barrido 1s cubic-bezier(.65,0,.35,1) infinite; }
        @keyframes cf-deslizar-barrido { to { transform: translateX(100%) } }
        .cf-deslizar-flechas svg { opacity: .3; animation: cf-deslizar-flecha 1.6s ease-in-out infinite; }
        .cf-deslizar-flechas svg:nth-child(2) { animation-delay: .16s; }
        .cf-deslizar-flechas svg:nth-child(3) { animation-delay: .32s; }
        @keyframes cf-deslizar-flecha { 0%, 60%, 100% { opacity: .3 } 25% { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          .cf-deslizar-flechas svg { animation: none; opacity: .7; }
          .cf-deslizar[data-guardando="1"]::after { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
