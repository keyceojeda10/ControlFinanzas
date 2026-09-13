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
 * Reglas:
 * - Solo el ASA se arrastra. Tocar la pista no confirma: enseña la pista
 *   «Desliza la flecha hasta el final» y empuja el asa un poco, que es cómo se
 *   aprende el gesto sin leer nada.
 * - Confirma al pasar el 88 % del recorrido. Menos, vuelve con muelle.
 * - Con teclado (Enter/Espacio sobre el asa) confirma directo: quien usa
 *   teclado o lector de pantalla ya eligió a propósito, y un gesto que no puede
 *   hacer lo dejaría sin forma de cobrar.
 * - Mientras `confirmando`, el asa se queda al final y dice «Guardando…».
 *   Cuando termina (error o no), vuelve al principio.
 *
 * Medidas del sistema: pista 52 de alto y radio 14 (botón primario), asa 44 con
 * radio 12 (botón de icono), icono 20 con trazo 2.2. El dorado va en el asa,
 * que es la acción primaria.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const ALTO = 52
const RELLENO = 4
const ASA = ALTO - RELLENO * 2
const UMBRAL = 0.88

export default function DeslizarParaConfirmar({
  texto = 'Confirmar',
  onConfirmar,
  confirmando = false,
  deshabilitado = false,
}) {
  const refPista = useRef(null)
  const refAsa = useRef(null)
  const refRelleno = useRef(null)
  const refTexto = useRef(null)
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

  const recorrido = useCallback(() => {
    const ancho = refPista.current?.getBoundingClientRect().width ?? 0
    return Math.max(0, ancho - ASA - RELLENO * 2)
  }, [])

  /* Se pinta por estilo y no por estado: un render por cada píxel del dedo
     traba la hoja entera en los Android de gama baja que usan los cobradores. */
  const pintar = useCallback((x, animar) => {
    const max = recorrido() || 1
    const t = animar && !menosMovimiento ? 'transform .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1), opacity .2s' : 'none'
    if (refAsa.current) {
      refAsa.current.style.transition = t
      refAsa.current.style.transform = `translateX(${x}px)`
    }
    if (refRelleno.current) {
      refRelleno.current.style.transition = t
      refRelleno.current.style.width = `${x + ASA + RELLENO * 2}px`
    }
    if (refTexto.current) {
      refTexto.current.style.transition = t
      refTexto.current.style.opacity = String(Math.max(0, 1 - (x / max) * 1.6))
    }
  }, [menosMovimiento, recorrido])

  // Al terminar de guardar —bien o mal— el asa vuelve al principio.
  useEffect(() => {
    pintar(confirmando ? recorrido() : 0, true)
  }, [confirmando, pintar, recorrido])

  useEffect(() => () => clearTimeout(refPista2.current), [])

  const muerto = confirmando || deshabilitado

  const confirmar = () => {
    if (muerto) return
    pintar(recorrido(), true)
    try { navigator.vibrate?.(18) } catch { /* sin vibración */ }
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
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* sin captura */ }
    refGesto.current = { x0: e.clientX, max: recorrido(), x: 0 }
  }

  const alMover = (e) => {
    const g = refGesto.current
    if (!g) return
    g.x = Math.min(g.max, Math.max(0, e.clientX - g.x0))
    pintar(g.x, false)
  }

  const alSoltar = () => {
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
      style={{
        position: 'relative', height: ALTO, width: '100%', borderRadius: 14,
        background: 'var(--cf-fill)', overflow: 'hidden',
        opacity: deshabilitado && !confirmando ? 0.55 : 1,
        touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Lo recorrido se tiñe: dice cuánto falta sin tener que leerlo. */}
      <span ref={refRelleno} aria-hidden style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: ASA + RELLENO * 2,
        borderRadius: 14, background: 'var(--cf-gold-tint)',
      }} />

      <span ref={refTexto} aria-hidden style={{
        position: 'absolute', inset: 0, paddingLeft: ASA + RELLENO * 2 + 8, paddingRight: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)', whiteSpace: 'nowrap',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pista ? 'Desliza la flecha hasta el final' : texto}
        </span>
        {!pista && (
          <svg className="cf-deslizar-flechas" width="18" height="16" viewBox="0 0 18 16" fill="none"
               stroke="var(--cf-ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
               style={{ flex: 'none' }}>
            <path d="M3 3l5 5-5 5" /><path d="M10 3l5 5-5 5" />
          </svg>
        )}
      </span>

      {confirmando && (
        <span role="status" style={{
          position: 'absolute', inset: 0, paddingRight: ASA + RELLENO * 2 + 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'var(--cf-gold-text)',
        }}>Guardando…</span>
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
        style={{
          position: 'absolute', left: RELLENO, top: RELLENO,
          width: ASA, height: ASA, minWidth: ASA, minHeight: ASA, flex: 'none',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: 12, padding: 0,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
          cursor: muerto ? 'not-allowed' : 'grab', touchAction: 'none',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {confirmando
            ? <path d="M5 12.5l4.5 4.5L19 7.5" />
            : <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>}
        </svg>
      </button>

      <style>{`
        @keyframes cf-deslizar-flechas { 0%,100% { transform: translateX(0); opacity: .55 } 50% { transform: translateX(4px); opacity: 1 } }
        .cf-deslizar-flechas { animation: cf-deslizar-flechas 1.6s cubic-bezier(.22,1,.36,1) infinite }
        @media (prefers-reduced-motion: reduce) { .cf-deslizar-flechas { animation: none } }
      `}</style>
    </div>
  )
}
