'use client'
/* ══ QUIÉN FALLÓ, NO SOLO QUE FALLÓ ══════════════════════════════════════════
 *
 * Hoy llegaron 25 «Minified React error #300» desde tres negocios, ocho
 * préstamos y una sola pantalla, en hora y cuarto. La pila que mandamos es
 * esta:
 *
 *     at l7 (…/4bd1b696-…js:1:51274)
 *     at l9 (…/4bd1b696-…js:1:51163)
 *     at o_ (…)  at oq (…)  at ik (…)
 *
 * Son las TRIPAS DE REACT. Ni un nombre nuestro. Y los mapas de origen no
 * ayudarían: resolverían esos marcos a código de React, no al componente.
 *
 * ⚠ REACT SÍ SABE CUÁL ES —lo pone en `componentStack`— y no se lo estábamos
 *   pidiendo. `error.jsx` de Next recibe `{ error, reset }` y nada más; el
 *   `componentStack` solo llega a `componentDidCatch` de una barrera de clase.
 *   Por eso existe este archivo.
 *
 * Se escribió después de descartar, uno por uno y midiendo: abrir la pantalla
 * con cuatro formas de préstamo, el pago entero, las cuatro acciones del
 * comprobante, el préstamo que ya no existe, y la regla de hooks de ESLint
 * —comprobando además que ESLint no estuviera ciego, metiéndole una violación a
 * propósito—. Nada de eso lo reproduce. Cuando no se puede reproducir, lo que
 * toca es instrumentar, no seguir adivinando.
 *
 * ── POR QUÉ VUELVE A LANZAR ─────────────────────────────────────────────────
 *
 * Esta barrera NO pinta nada: apunta quién fue y relanza para que la pantalla
 * de error de siempre siga siendo la que ve el prestamista. Si pintara su
 * propio mensaje habría DOS pantallas de error distintas según por dónde
 * reventara, que es peor que el fallo que viene a diagnosticar.
 */

import { Component } from 'react'

export default class CazadorDeErrores extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, callado: false }
  }

  /* ⚠ AQUÍ NO SE RELANZA TODAVÍA.
     Mi primera versión ponía el error en el estado y lo relanzaba en el mismo
     render. React da entonces la barrera por fallida, la sube a `error.jsx`… y
     `componentDidCatch` NO LLEGA A CORRER, que es el único sitio donde está el
     árbol de componentes. Comprobado: llegaban dos avisos y los dos de
     `error.jsx`, ninguno de aquí.
     Este render pinta nada y le da a React el turno de llamar a
     `componentDidCatch`; el relanzamiento va en el de después. */
  static getDerivedStateFromError() {
    return { callado: true }
  }

  componentDidCatch(error, info) {
    /* De todo el árbol solo interesan los primeros renglones: son el componente
       que falló y sus padres inmediatos. Enteros son cientos de líneas y el
       servidor los recorta igual. */
    const arbol = String(info?.componentStack ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join(' > ')

    try {
      fetch('/api/errores-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: error?.message ?? String(error),
          ruta: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
          navegador: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          stack: error?.stack ?? '',
          digest: error?.digest ?? null,
          componentStack: arbol || '(react no lo dio)',
          origen: 'cazador',
        }),
        keepalive: true,   // el aviso sale aunque la pantalla se esté yendo
      }).catch(() => {})
    } catch {}

    // Ya se apuntó quién fue: ahora sí, que suba a la pantalla de error.
    this.setState({ error })
  }

  render() {
    // Relanzar sube el error a `error.jsx`, que es quien pinta. Un parpadeo en
    // blanco entre medias, y a cambio sabemos qué componente falló.
    if (this.state.error) throw this.state.error
    if (this.state.callado) return null
    return this.props.children
  }
}
