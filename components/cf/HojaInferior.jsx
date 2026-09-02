'use client'

// components/cf/HojaInferior.jsx — El patrón de modal en móvil.
// docs/design_handoff/03-COMPONENTES.md § 10 y § 11.
//
// SIEMPRE desde abajo, nunca centrado. La página de atrás queda visible con su
// velo: el contexto ya está dado, así que la cabecera de la hoja NO repite el
// dato que ya está detrás — lo completa.
//
// En escritorio el mismo contenido se presenta como modal centrado de 520px.
// Es la única diferencia entre las dos presentaciones.

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react'
import { paso, asentado, proyectar, resistencia, velocidadDe } from '@/lib/muelle'

/* ── LA HOJA SE AGARRA Y SE TIRA ────────────────────────────────────────────
 *
 * El asa llevaba aquí desde el rediseño y NO HACÍA NADA: 38×4px que invitan a
 * arrastrar sobre algo que no se podía arrastrar. Un control que promete un
 * gesto y no lo cumple es peor que no ponerlo.
 *
 * ⚠ SOLO SE AGARRA POR ARRIBA —el asa y la cabecera—, nunca por el cuerpo. El
 * contenido de estas hojas se desplaza (la lista de cuentas, la de plantillas,
 * los filtros), y si el cuerpo también arrastrara, bajar por la lista cerraría
 * la hoja. Es el fallo clásico de las hojas mal hechas.
 *
 * ⚠ Y SOLO EN TELÉFONO. En escritorio esto es un modal centrado cuyo `transform`
 * ya está ocupado por su propio centrado: tocarlo lo manda fuera de la pantalla.
 *
 * Cómo se decide al soltar: NO por dónde quedó el dedo, sino por dónde IBA. Un
 * empujón corto y rápido cierra; bajarla despacio a medio camino la devuelve a
 * su sitio. Ver `lib/muelle.js`.
 */
const AMORTIGUACION = 0.8   // un guiño de rebote: el gesto traía impulso
const RESPUESTA = 0.3       // segundos, los de una hoja
const PARTE_PARA_CERRAR = 0.42

/* Dónde está la hoja AHORA mismo, en píxeles.
   ⚠ `new DOMMatrixReadOnly('none')` LANZA. Cuando el navegador no tiene
   transform devuelve la cadena `'none'`, y sin esta guarda un solo caso raro
   —un estilo pisado, una hoja montada sin su estilo en línea— tira la pantalla
   entera en vez de quedarse sin animación. */
function dondeEsta(el) {
  if (!el) return 0
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return 0
  try { return new DOMMatrixReadOnly(t).m42 } catch { return 0 }
}

/* ══ ¿PC O TELÉFONO? — Y HAY QUE SABERLO EN EL PRIMER CUADRO ═══════════════
 *
 * ⚠ ESTO ERA UN `useState(false)` + `useEffect`, Y ASÍ SE VEÍA EL FALLO. Con la
 * detección en un efecto, TODA hoja nace creyendo que está en un teléfono:
 * `position:absolute; bottom:0; transform:translateY(100%)`, o sea pegada abajo
 * y fuera de la pantalla. El efecto la convertía en modal centrado un cuadro
 * después.
 *
 * A las hojas que viven montadas no les pasa: para cuando se abren, el efecto
 * corrió hace rato. Pero las que se montan AL ABRIRSE —las que van dentro de un
 * `{estado && (…)}`, como «Quiere pagar todo hoy» y «Mover a perdidos»— pintan
 * ese primer cuadro de verdad. Medido en el espejo, a 1440px:
 *
 *     Recargo por mora   (siempre montada)  → left:50% translate(-50%,-50%)  ok
 *     Cerrar anticipado  (montada al abrir) → bottom:0 translateY(100%)      ⚠
 *
 * El dueño, con la captura: «se despliega hacia abajo del todo y no se alcanza
 * a ver nada. No sale normal como los otros modales. Ya probé los otros modales
 * y están bien». Los otros están bien por dónde están escritos, no por otra
 * cosa — y eso no se sostiene solo.
 *
 * `useSyncExternalStore` es exactamente para esto: durante el render del
 * servidor y la hidratación devuelve el valor de `anchoServidor` (falso, igual
 * que antes, así que el desajuste que tiró el árbol tres veces sigue siendo
 * imposible), y en cualquier montaje POSTERIOR —que es cuando se abre una
 * hoja— lee el ancho de verdad ya en el primer render. */
const mqAncha = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
const suscribirAncho = (alCambiar) => {
  mqAncha?.addEventListener('change', alCambiar)
  return () => mqAncha?.removeEventListener('change', alCambiar)
}
const anchoAhora     = () => !!mqAncha?.matches
const anchoServidor  = () => false

/* ══ UNA SOLA ENTRADA DE HISTORIA PARA TODAS LAS HOJAS ══════════════════════
 *
 * Cada hoja metía SU entrada al abrirse y no la retiraba al cerrar. Retirarla
 * con `history.back()` en el cierre se había probado y rompía el menú de
 * gestión: cierra y abre otra hoja en el mismo toque, y como `back()` es
 * asíncrono llegaba cuando la nueva ya estaba abierta y se la llevaba. Así
 * que cada hoja abierta dejaba una entrada muerta. Tras pasearse por el menú
 * —menú, recargo, volver al menú, descuento…— el historial tenía media docena
 * de entradas `cfHoja` sin hoja detrás, y el «Volver» de la cabecera hace
 * `router.back()`: consumía una entrada muerta por toque y no se movía.
 *
 * El dueño: «le tengo que dar un montón de veces, como si quedaran pantallas
 * fantasmas... prácticamente se puede ver como si no sirviera el botón».
 *
 * Ahora la entrada es UNA, compartida a nivel de módulo:
 *   · abre la primera hoja → `pushState`; abre otra encima → nada.
 *   · «atrás» del teléfono → `popstate` cierra la hoja de arriba; si quedan
 *     más, se vuelve a meter la entrada para que el siguiente «atrás» cierre
 *     la siguiente.
 *   · cierra la última hoja por la X o por un botón → se retira la entrada con
 *     `history.back()`, pero DIFERIDO un tick y solo si sigue sin haber hojas:
 *     cuando el menú cierra y abre otra en el mismo toque, la nueva ya está
 *     contada para cuando corre el tick, y la entrada se reutiliza. Es justo
 *     lo que hacía imposible retirarla antes.
 *   · y solo si la entrada de arriba es la nuestra (`history.state.cfHoja`):
 *     si desde la hoja se navegó a otra página, ahí arriba está la página
 *     nueva y un `back()` la echaría.
 */
const pila = []            // { cerrar } de cada hoja abierta, en orden
let entradaViva = false
let retiradaPendiente = 0

function meterEntrada() {
  window.history.pushState({ cfHoja: true }, '')
  entradaViva = true
}

function alPopstate() {
  if (!entradaViva) return
  entradaViva = false
  pila[pila.length - 1]?.cerrar()
  // La hoja que cierra sale de la pila en su cleanup, en el próximo render:
  // se cuenta cuántas QUEDARÁN, no cuántas hay.
  if (pila.length > 1) meterEntrada()
}

export function registrarHoja(hoja) {
  if (pila.length === 0) window.addEventListener('popstate', alPopstate)
  pila.push(hoja)
  clearTimeout(retiradaPendiente)
  if (!entradaViva) meterEntrada()
  return () => {
    const i = pila.indexOf(hoja)
    if (i >= 0) pila.splice(i, 1)
    if (pila.length > 0) return
    window.removeEventListener('popstate', alPopstate)
    clearTimeout(retiradaPendiente)
    retiradaPendiente = setTimeout(() => {
      if (pila.length > 0 || !entradaViva) return
      entradaViva = false
      if (window.history.state?.cfHoja) window.history.back()
    }, 0)
  }
}

export default function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  subtitulo,
  /* Si viene, la cabecera pinta una flecha a la izquierda del título. */
  onVolver,
  children,
  accion,                  // la barra de acción inferior
  // `undefined` = que lo decida sola por el ancho. Se puede forzar pasando
  // true/false. Antes el valor por defecto era `false`, así que cualquier hoja
  // que no lo pasara —todas— salía en PC como una franja pegada al borde
  // inferior de una pantalla de 1440: el patrón es de teléfono y en escritorio
  // no se lee como un modal, se lee como algo roto.
  escritorio: escritorioProp,
  /* ⚠ EN `dvh`, NO EN `vh`. Mismo fallo que tenía `Modal`: en Safari de iPhone
     `100vh` es más alto que lo que se ve, así que una hoja larga se sale por
     arriba justo por donde está el título. El token trae el `@supports`. */
  alturaMaxima = 'var(--cf-alto-hoja)',
}) {
  const anchaPantalla = useSyncExternalStore(suscribirAncho, anchoAhora, anchoServidor)
  const escritorio = escritorioProp ?? anchaPantalla

  // Escape cierra, y el fondo no scrollea mientras la hoja está abierta.
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar?.() }
    document.addEventListener('keydown', alTeclear)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = previo
    }
  }, [abierta, onCerrar])

  /* ── EL «ATRÁS» DEL TELÉFONO CIERRA LA HOJA ─────────────────────────────
     Reportado por un cobrador: «registro a un cliente y se me queda ahí, no me
     da arriba la flechita para salir atrás; si le doy con el celular se vuelve
     a salir afuera». Aquí solo se escuchaba `Escape`, así que en Android el
     «atrás» se llevaba la aplicación entera. Ver `registrarHoja` arriba: la
     entrada de historia es UNA para todas las hojas, y se retira sola.

     ⚠ `onCerrar` va por ref y las deps son SOLO `[abierta]`. Antes el efecto
     dependía de `onCerrar`, que las páginas pasan como flecha en línea —una
     función nueva en cada render—, así que CADA RE-RENDER DEL PADRE CON LA
     HOJA ABIERTA METÍA OTRA ENTRADA: una por tecla escrita en un campo de la
     hoja. De ahí salía «un montón de veces». */
  const refCerrar = useRef(onCerrar)
  useEffect(() => { refCerrar.current = onCerrar })
  useEffect(() => {
    if (!abierta || typeof window === 'undefined') return
    return registrarHoja({ cerrar: () => refCerrar.current?.() })
  }, [abierta])

  /* ⚠ TODOS LOS HOOKS ANTES DEL `return null`. Un `useState` colado detrás de
     un return condicional ya tiró la pantalla del comprobante entero, y ninguna
     prueba de cifras lo caza. */
  const refCaja = useRef(null)
  const refVelo = useRef(null)
  const refAnim = useRef(0)
  const refGesto = useRef(null)
  const [menosMovimiento, setMenosMovimiento] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const leer = () => setMenosMovimiento(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  const pintar = useCallback((y, alto) => {
    const caja = refCaja.current
    if (!caja) return
    /* ⚠ SIN RECORTAR A CERO. Lo tenía con `Math.max(0, y)` y eso se comía la
       resistencia entera: tiraba 160px hacia arriba y la hoja subía 0 —el tope
       seco que precisamente se quería evitar—. Quien limita cuánto sube es
       `resistencia()` en el propio gesto, no este recorte. */
    caja.style.transform = `translateY(${y}px)`
    /* El velo se aclara conforme la hoja baja: el movimiento de en medio dice
       hacia dónde va la cosa, en vez de interpolar a ciegas. Aquí sí se acota,
       porque una opacidad mayor que 1 no significa nada. */
    if (refVelo.current && alto > 0) {
      refVelo.current.style.opacity = String(Math.min(1, Math.max(0, 1 - (Math.max(0, y) / alto) * 0.9)))
    }
  }, [])

  /** Lleva la hoja hasta `destino` con el muelle. Arranca SIEMPRE del sitio en
   *  el que está ahora y con la velocidad que lleva, que es lo que permite
   *  agarrarla a medio camino sin que pegue un salto. */
  const muelleHasta = useCallback((destino, velocidad, alto, alLlegar) => {
    cancelAnimationFrame(refAnim.current)
    if (menosMovimiento) {   // menos movimiento: se va sin recorrido
      pintar(destino, alto)
      alLlegar?.()
      return
    }
    const caja = refCaja.current
    let estado = { valor: dondeEsta(caja), velocidad }
    let previo = performance.now()
    const cuadro = (ahora) => {
      const dt = (ahora - previo) / 1000
      previo = ahora
      estado = paso(estado, destino, dt, { amortiguacion: AMORTIGUACION, respuesta: RESPUESTA })
      pintar(estado.valor, alto)
      if (asentado(estado, destino)) { pintar(destino, alto); alLlegar?.(); return }
      refAnim.current = requestAnimationFrame(cuadro)
    }
    refAnim.current = requestAnimationFrame(cuadro)
  }, [menosMovimiento, pintar])

  // Entrar: sube desde abajo. Sale por el mismo camino por el que entró.
  useEffect(() => {
    if (!abierta || escritorio) return
    const caja = refCaja.current
    if (!caja) return
    const alto = caja.getBoundingClientRect().height || 1
    muelleHasta(0, 0, alto)
    return () => cancelAnimationFrame(refAnim.current)
  }, [abierta, escritorio, muelleHasta])

  const alAgarrar = useCallback((e) => {
    if (escritorio || e.button > 0) return
    /* ⚠ LA X DE CERRAR VIVE DENTRO DE LA ZONA DE AGARRE. Sin esto, tocarla
       empezaba un arrastre y con `touchAction: none` el toque se quedaba
       enredado: el botón de cerrar dejaba de cerrar. Cualquier control de la
       cabecera manda sobre el gesto. */
    if (e.target?.closest?.('button, a, input, select, textarea, [role="button"]')) return
    const caja = refCaja.current
    if (!caja) return
    cancelAnimationFrame(refAnim.current)
    /* ⚠ EN UN `try`: `setPointerCapture` LANZA si el puntero ya no existe —un
       toque que se cancela, un evento sintético—, y esa excepción se llevaba el
       gesto entero por delante. Sin la captura el arrastre sigue funcionando
       mientras el dedo no se salga del elemento, que es el caso normal. */
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* sin captura, igual se arrastra */ }
    const alto = caja.getBoundingClientRect().height || 1
    const desde = dondeEsta(caja)
    refGesto.current = { y0: e.clientY, desde, alto, historia: [[performance.now(), e.clientY]] }
  }, [escritorio])

  const alMover = useCallback((e) => {
    const g = refGesto.current
    if (!g) return
    const bruto = g.desde + (e.clientY - g.y0)
    /* Hacia arriba no hay más hoja: en vez de un tope seco, resistencia que
       aumenta cuanto más tiras. Un tope duro se lee como «se congeló». */
    const y = bruto < 0 ? -resistencia(-bruto, g.alto) : bruto
    g.historia.push([performance.now(), e.clientY])
    if (g.historia.length > 6) g.historia.shift()
    pintar(y, g.alto)
  }, [pintar])

  const alSoltar = useCallback(() => {
    const g = refGesto.current
    if (!g) return
    refGesto.current = null
    const caja = refCaja.current
    const y = dondeEsta(caja)
    /* LA VELOCIDAD CADUCA. Sale del recorrido reciente y no del último punto
       —un solo par da saltos enormes—, pero además solo cuentan los puntos de
       los últimos 120 ms.

       ⚠ SIN LA CADUCIDAD LA HOJA SE CERRABA SOLA. El caso: bajas la hoja, te
       lo piensas un segundo con el dedo quieto y sueltas. No llegan más eventos
       mientras estás parado, así que la historia sigue guardando el tirón de
       antes y se soltaba con una velocidad que ya no existía. Lo encontré
       porque una prueba mía «falló» y el fallo era del código, no de la prueba.

       Quieto = velocidad 0 = decide la posición, que es lo que la persona ve. */
    const velocidad = velocidadDe(g.historia, performance.now())
    // Dónde IBA, no dónde quedó.
    const proyectado = y + proyectar(velocidad)
    if (proyectado > g.alto * PARTE_PARA_CERRAR) {
      muelleHasta(g.alto, velocidad, g.alto, () => onCerrar?.())
    } else {
      muelleHasta(0, velocidad, g.alto)
    }
  }, [muelleHasta, onCerrar])

  if (!abierta) return null

  const asas = escritorio ? {} : {
    onPointerDown: alAgarrar,
    onPointerMove: alMover,
    onPointerUp: alSoltar,
    onPointerCancel: alSoltar,
    style: { touchAction: 'none' },
  }

  const contenido = (
    <>
      {/* Asa: solo en móvil. En un modal centrado no significa nada.
          Va dentro de una franja ANCHA que es la que recoge el dedo: un asa de
          4px de alto es imposible de agarrar en marcha. La franja mide 26 y el
          asa sigue midiendo 4 — se agarra lo que se ve más un margen alrededor,
          que es como se hacen los blancos pequeños. */}
      {!escritorio && (
        <div {...asas} style={{ ...asas.style, display: 'flex', justifyContent: 'center',
          alignItems: 'center', height: 26, flex: 'none', cursor: 'grab' }}>
          <span aria-hidden style={{
            width: 38, height: 4, borderRadius: 999,
            background: 'rgba(20,20,28,.16)',
          }} />
        </div>
      )}

      <div {...(escritorio ? {} : asas)} style={{
        ...(escritorio ? {} : asas.style),
        display: 'flex', alignItems: 'flex-start', gap: 12, flex: 'none',
        padding: escritorio ? '18px 22px' : '4px 22px 14px',
        background: escritorio ? 'var(--cf-card)' : 'transparent',
        borderBottom: escritorio ? '1px solid var(--cf-border)' : 'none',
      }}>
        {/* ⚠ LA FLECHA DE VOLVER, CUANDO SE LLEGÓ DESDE UN MENÚ.
             «Ninguna de esas opciones de gestión permite volver hacia atrás, al
              menú general de la gestión. Solo permite salirse, y al salirse
              vuelve a la pantalla general del préstamo.»   — el dueño, 31 ago

             Van las DOS salidas y significan cosas distintas: la flecha vuelve
             al menú de donde salió, la X cierra y deja la pantalla. Sin la
             flecha, corregir dos cosas seguidas obliga a rehacer el camino
             entero cada vez. */}
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver"
            style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', flex: 'none', marginTop: 1, marginLeft: -6 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.25,
            color: 'var(--cf-ink)',
          }}>{titulo}</span>
          {subtitulo && (
            <span style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-3)', marginTop: 3, lineHeight: 1.4 }}>
              {subtitulo}
            </span>
          )}
        </span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', flex: 'none', marginTop: -2 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* AIRE DEBAJO DE LA CABECERA. Iba a `padding-top: 0`, asi que en
          escritorio el primer rotulo del contenido nacia pegado al filete que
          separa el titulo — «Más filtros» y debajo, sin respirar, «CADA CUÁNTO
          COBRA». Abajo si tenia, y por eso se leia torcido: el bloque parecia
          empujado hacia arriba.

          En movil no hay filete y la cabecera ya deja 14px, asi que basta un
          poco menos. */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: escritorio ? '18px 22px 18px' : '4px 22px 18px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>{children}</div>

      {accion && (
        <div style={{
          background: 'var(--cf-card)',
          borderTop: '1px solid rgba(20,20,28,.09)',
          padding: escritorio ? '14px 22px' : '14px 22px 24px',
          display: 'flex', gap: 10, flex: 'none',
        }}>{accion}</div>
      )}
    </>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <div ref={refVelo} onClick={onCerrar} className="cf-velo-llega" style={{
        position: 'absolute', inset: 0,
        background: escritorio ? 'var(--cf-scrim-modal)' : 'var(--cf-scrim)',
      }} />

      <div ref={refCaja} role="dialog" aria-modal="true"
        /* Solo en escritorio: en teléfono el recorrido lo hace el muelle, y una
           animación CSS encima pelearía con el `transform` que él escribe. */
        className={escritorio ? 'cf-modal-llega' : undefined}
        style={escritorio ? {
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: alturaMaxima,
        background: 'var(--cf-surface)',
        borderRadius: 'var(--cf-r-sheet)',
        boxShadow: 'var(--cf-sh-modal)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      } : {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        maxHeight: alturaMaxima,
        background: 'var(--cf-surface)',
        borderRadius: 'var(--cf-r-sheet) var(--cf-r-sheet) 0 0',
        boxShadow: 'var(--cf-sh-sheet)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        /* Arranca fuera de la pantalla en el PRIMER cuadro pintado, no en un
           efecto: si nace en su sitio y salta abajo después, se ve el
           parpadeo. `willChange` avisa al navegador de que esto se va a mover,
           que es lo que le deja darle su propia capa. */
        transform: 'translateY(100%)', willChange: 'transform',
      }}>{contenido}</div>
    </div>
  )
}
