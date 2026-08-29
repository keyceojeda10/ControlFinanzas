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

import { useEffect, useRef, useState, useCallback } from 'react'
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

export default function HojaInferior({
  abierta,
  onCerrar,
  titulo,
  subtitulo,
  children,
  accion,                  // la barra de acción inferior
  // `undefined` = que lo decida sola por el ancho. Se puede forzar pasando
  // true/false. Antes el valor por defecto era `false`, así que cualquier hoja
  // que no lo pasara —todas— salía en PC como una franja pegada al borde
  // inferior de una pantalla de 1440: el patrón es de teléfono y en escritorio
  // no se lee como un modal, se lee como algo roto.
  escritorio: escritorioProp,
  alturaMaxima = '88vh',
}) {
  // La detección va en un EFECTO, no en el primer render: leer matchMedia al
  // pintar hace que el servidor diga una cosa y el cliente otra, y React tira
  // el árbol entero. Ya me pasó tres veces en este rediseño.
  const [anchaPantalla, setAnchaPantalla] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const leer = () => setAnchaPantalla(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])
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

  // ── EL BOTÓN «ATRÁS» DEL TELÉFONO CIERRA LA HOJA ───────────────────────
  //
  // Reportado por un cobrador: «registro a un cliente y se me queda ahí, no me
  // da arriba la flechita para salir atrás; si le doy con el celular se vuelve a
  // salir afuera». Y es exacto: aquí solo se escuchaba `Escape` —una tecla, o
  // sea SOLO en escritorio— así que en Android el «atrás» no encontraba nada que
  // cerrar y se llevaba por delante la aplicación entera. En medio de una ruta,
  // cobrando.
  //
  // Cómo funciona: al abrir se mete una entrada de historia; el «atrás» la
  // consume y `popstate` cierra la hoja en vez de salir de la página.
  // ⚠ NO SE LLAMA A `history.back()` AL CERRAR. Lo hacía, y rompió media
  // pantalla de gestión: «Recargo», «Descuento», «Días sin cobro», «Cerrar
  // anticipado» y «Mover a perdidos» no hacían nada.
  //
  // La secuencia: al pulsar una opción, el menú se cierra y ABRE otra hoja
  // (`onAccion` hace `setModalGestion(false)` y luego `a.hacer()`). El `back()`
  // del cierre es ASÍNCRONO —el navegador lo procesa en el siguiente ciclo— así
  // que para cuando llega, la hoja nueva ya está abierta y se lleva la SUYA por
  // delante. Se abría y se cerraba sola: desde fuera, un botón muerto.
  //
  // Y no hace falta: la entrada sobrante no molesta —el siguiente «atrás» la
  // consume y el `popstate` no encuentra hoja abierta que cerrar—, mientras que
  // retirarla a mano es justo lo que pisaba la hoja siguiente.
  useEffect(() => {
    if (!abierta || typeof window === 'undefined') return
    window.history.pushState({ cfHoja: true }, '')
    const alVolver = () => { onCerrar?.() }
    window.addEventListener('popstate', alVolver)
    return () => {
      window.removeEventListener('popstate', alVolver)
    }
  }, [abierta, onCerrar])

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
