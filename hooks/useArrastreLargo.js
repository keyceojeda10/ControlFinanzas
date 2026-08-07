'use client'

// hooks/useArrastreLargo.js — dejar la tarjeta apretada un momento y moverla.
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// Pedido por el dueño, y viene de los cobradores:
//
//   «antes estas tarjetas, así estuvieran en el modo de cobro y no en el modo
//    de ordenar, también uno las podía dejar apretadas un ratico y se podían
//    correr […] de pronto están haciendo el cobro y rápidamente necesitan
//    moverla hacia arriba o hacia abajo»
//
// El modo «Ordenar» sigue existiendo y es el bueno para reordenar veinte
// paradas de una sentada. Esto es para el movimiento suelto que se hace en la
// calle sin salir de lo que estás haciendo.
//
// ══ LO QUE HACE DIFÍCIL ESTE GESTO ════════════════════════════════════════
//
// La tarjeta ya tiene tres usos del dedo encima: se toca para cobrar, se
// desliza para hacer scroll, y dentro lleva botones. El arranque tiene que
// distinguirse de los tres.
//
//   1. UN TOQUE NO ES UN ARRASTRE. Se exige mantener 420 ms.
//   2. UN SCROLL TAMPOCO. Si el dedo se mueve más de 9px antes de que cumpla
//      el tiempo, se cancela: iba a deslizar la lista.
//   3. ⚠ Y CUANDO ARRANCA, HAY QUE FRENAR EL SCROLL DEL NAVEGADOR. `touch-action`
//      solo se lee al EMPEZAR el gesto, así que ponerlo a `none` a mitad no
//      hace nada. La única forma de parar la página con el dedo ya apoyado es
//      un `touchmove` NO PASIVO con `preventDefault()`. React registra sus
//      `onTouchMove` como pasivos, así que este va a mano sobre `document`.
//   4. AL SOLTAR NO PUEDE ABRIRSE LA HOJA DE COBRO. Un `pointerup` tras el
//      arrastre dispara el `click` de la tarjeta, y el cobrador acabaría con
//      el teclado del pago abierto cada vez que mueve a alguien. Se traga el
//      primer clic siguiente.
//
// El movimiento se aplica AL SOLTAR, no en cada píxel: reordenar treinta filas
// en cada `pointermove` va a tirones en el teléfono en el que se cobra.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Cuánto hay que mantener el dedo. Por debajo de ~400ms se dispara al tocar. */
const MS_LARGO = 420
/** Si se mueve más que esto antes de cumplir el tiempo, era un scroll. */
const PX_TOLERANCIA = 9
/** Franja del borde donde la lista se desplaza sola mientras se arrastra. */
const PX_BORDE = 90

export function useArrastreLargo({ activo = true, cantidad = 0, onReordenar } = {}) {
  const [arrastrando, setArrastrando] = useState(null)   // { desde, hasta } — solo para pintar
  const gesto = useRef(null)                             // lo que leen los manejadores
  const lista = useRef(null)                             // el contenedor de ESTA lista
  const cajas = useRef([])
  const reloj = useRef(null)
  const inicio = useRef(null)
  /* ⚠ UNA MARCA DE TIEMPO, NO UN INTERRUPTOR.
     Empezó siendo `bloquearClick = true`, que se apagaba al tragarse el
     siguiente clic. Pero tras un arrastre largo el navegador NO emite ningún
     clic —el puntero se movió demasiado— así que la bandera se quedaba
     encendida y se comía el TOQUE SIGUIENTE, que sí era de verdad. Medido en el
     espejo: se movía una tarjeta y la próxima que se tocaba no abría el cobro.

     Con la hora del último arrastre no hay estado que se quede pegado: pasados
     400 ms, cualquier clic es del usuario. */
  const ultimoArrastre = useRef(0)
  const puntero = useRef({ y: 0 })

  const limpiarReloj = () => {
    if (reloj.current) { clearTimeout(reloj.current); reloj.current = null }
  }

  const cancelar = useCallback(() => {
    limpiarReloj()
    gesto.current = null
    inicio.current = null
    setArrastrando(null)
  }, [])

  /* ⚠ EL ESTADO LO LEEN DESDE UN `ref`, NO DESDE `arrastrando`.
     Es el mismo fallo que ya costó dos reportes en «Ordenar»: los manejadores
     se crean en el render y capturan el valor de ESE momento —`null`—, así que
     al soltar no había nada que reordenar. Un ref siempre da el valor de ahora;
     `arrastrando` se queda aparte solo para pintar. */

  const medir = useCallback(() => {
    const raiz = lista.current
    if (!raiz) return false
    cajas.current = Array.from({ length: cantidad }, (_, j) => {
      const el = raiz.querySelector(`[data-arrastrable="${j}"]`)
      return el ? el.getBoundingClientRect() : null
    })
    return cajas.current.some(Boolean)
  }, [cantidad])

  const empezar = (i) => (e) => {
    if (!activo || cantidad < 2) return
    // Solo el dedo o el botón principal. Un clic derecho no ordena nada.
    if (e.button != null && e.button !== 0) return
    /* Los botones de dentro de la tarjeta —cobrar, WhatsApp, mapa— NO arrancan
       el arrastre: quien aprieta «Cobrar» un segundo de más no quiere mover a
       nadie de sitio.

       ⚠ `[role="button"]` NO puede estar en esta lista, y me costó la primera
       prueba en el espejo: la tarjeta ENTERA lleva `role="button"` —se toca
       para cobrar— así que `closest('[role="button"]')` encontraba la propia
       tarjeta y el gesto no arrancaba nunca. Se salía por aquí en silencio: sin
       error, sin vibración y sin nada que mirar en el código.

       Los elementos de verdad interactivos se listan por su etiqueta. */
    if (e.target?.closest?.('button, a, input, select, textarea, label')) return

    inicio.current = { x: e.clientX, y: e.clientY, id: e.pointerId, el: e.currentTarget }
    puntero.current = { y: e.clientY }
    limpiarReloj()
    reloj.current = setTimeout(() => {
      if (!inicio.current) return
      if (!medir()) { cancelar(); return }
      try { inicio.current.el.setPointerCapture?.(inicio.current.id) } catch {}
      // El golpecito que dice «ya la tienes». Sin él no hay forma de saber que
      // el gesto arrancó hasta que la lista se mueve.
      try { navigator.vibrate?.(18) } catch {}
      gesto.current = { desde: i, hasta: i }
      setArrastrando({ desde: i, hasta: i })
    }, MS_LARGO)
  }

  const mover = (e) => {
    if (!gesto.current) {
      // Todavía esperando el tiempo: si se mueve, era un scroll.
      if (inicio.current) {
        const dx = Math.abs(e.clientX - inicio.current.x)
        const dy = Math.abs(e.clientY - inicio.current.y)
        if (dx > PX_TOLERANCIA || dy > PX_TOLERANCIA) cancelar()
      }
      return
    }
    puntero.current = { y: e.clientY }
    const y = e.clientY
    const dentro = cajas.current.findIndex((r) => r && y >= r.top && y <= r.bottom)
    if (dentro >= 0 && dentro !== gesto.current.hasta) {
      gesto.current = { ...gesto.current, hasta: dentro }
      setArrastrando(gesto.current)
    }
  }

  const soltar = () => {
    const g = gesto.current
    limpiarReloj()
    inicio.current = null
    gesto.current = null
    setArrastrando(null)
    if (!g) return
    // Hubo arrastre: el `click` que viene detrás abriría la hoja de cobro.
    ultimoArrastre.current = Date.now()
    if (g.desde !== g.hasta) onReordenar?.(g.desde, g.hasta)
  }

  /* ── FRENAR LA PÁGINA (punto 3 de arriba) ──
     Va sobre `document` y NO pasivo. Mientras se arrastra, la lista no puede
     desplazarse debajo del dedo o el índice medido deja de corresponder con lo
     que se ve. */
  useEffect(() => {
    if (!arrastrando) return
    const frenar = (ev) => ev.preventDefault()
    document.addEventListener('touchmove', frenar, { passive: false })
    return () => document.removeEventListener('touchmove', frenar)
  }, [arrastrando])

  /* ── LA LISTA SE ASOMA SOLA EN LOS BORDES ──
     Sin esto solo se puede mover dentro de lo que cabe en pantalla, que en un
     teléfono son tres tarjetas. Con la página frenada, el desplazamiento lo
     hace este bucle. */
  useEffect(() => {
    if (!arrastrando) return
    let vivo = true
    const paso = () => {
      if (!vivo) return
      const y = puntero.current.y
      const alto = window.innerHeight
      const v = y < PX_BORDE ? -12 : y > alto - PX_BORDE ? 12 : 0
      if (v) {
        window.scrollBy(0, v)
        // Las cajas se miden en coordenadas de pantalla, así que al desplazar
        // hay que volver a medirlas o el destino se calcula sobre lo de antes.
        medir()
      }
      requestAnimationFrame(paso)
    }
    const t = requestAnimationFrame(paso)
    return () => { vivo = false; cancelAnimationFrame(t) }
  }, [arrastrando, medir])

  // Al desmontar, que no quede un temporizador apuntando a nada.
  useEffect(() => () => limpiarReloj(), [])

  const gestos = (i) => (activo ? {
    'data-arrastrable': i,
    onPointerDown: empezar(i),
    onPointerMove: mover,
    onPointerUp: soltar,
    onPointerCancel: soltar,
    // En fase de captura: llega ANTES que el `onClick` de la tarjeta.
    onClickCapture: (e) => {
      if (Date.now() - ultimoArrastre.current > 400) return
      e.preventDefault()
      e.stopPropagation()
    },
    style: {
      // Impide el menú de «copiar/seleccionar» que sale al mantener pulsado en
      // iOS y en Android, que taparía la tarjeta justo cuando arranca el gesto.
      WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none',
    },
  } : { 'data-arrastrable': i })

  return { lista, gestos, arrastrando, cancelar }
}

export default useArrastreLargo
