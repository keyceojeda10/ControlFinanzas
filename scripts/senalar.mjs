// scripts/senalar.mjs — dibuja el señalamiento SOBRE la página, antes de la foto.
//
// ══ POR QUÉ ASÍ Y NO RETOCANDO LA IMAGEN DESPUÉS ══════════════════════════
//
// «Puedes crear los acentos, seleccionables y flechas para explicar mejor.»
//
// La tentación es sacar la captura y luego pintarle una flecha encima con
// coordenadas. Eso se rompe el día que el botón se mueve un centímetro: la
// flecha se queda apuntando al vacío y NADIE se entera, porque el archivo
// existe y pesa lo suyo.
//
// Aquí el señalamiento se dibuja DENTRO de la página, posicionado sobre el
// elemento de verdad, justo antes de disparar. Si el botón se mueve, la flecha
// se mueve con él. Y si el elemento ya no existe, esto lo dice y la captura
// falla en vez de salir muda.
//
// ⚠ Se dibuja con elementos del DOM, no con un `<canvas>`: la captura es del
// navegador, así que lo que ve la foto es exactamente lo que ve el usuario, con
// su misma tipografía y su mismo antialiasing.

/* Los colores salen de los tokens de la app, no de una paleta aparte: un
   señalamiento de otro color se lee como si fuera parte de otra herramienta. */
const ROJO = '#C23B40'
const TINTA = '#15161A'

/**
 * Rodea un elemento y le pone una flecha con su explicación.
 *
 * @param {import('playwright').Page} p
 * @param {object} orden
 *   texto     — qué decir. Corto: es una etiqueta, no un párrafo.
 *   rotulo    — texto EXACTO del botón/enlace a señalar (como se ve).
 *   selector  — alternativa a `rotulo` cuando no hay texto (un icono).
 *   desde     — de dónde sale la flecha: 'arriba' | 'abajo' (por defecto abajo).
 *   numero    — si va numerado, el número dentro del círculo.
 */
export async function senalar(p, orden) {
  const encontrado = await p.evaluate(({ texto, rotulo, selector, desde, numero, ROJO, TINTA }) => {
    const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim()

    /* ⚠ SOLO LO QUE SE VE. Esta app pinta el MISMO botón dos veces —uno para
       el teléfono y otro para el escritorio, con `hidden lg:flex`— y el
       recorrido del DOM encuentra primero el que está oculto. El aro salía
       entonces sobre un rectángulo de 0×0 y la captura se caía con un «no
       encontré qué señalar» que era mentira: ahí estaba, invisible.

       Se descartan los de tamaño cero ANTES de elegir, no después. */
    const seVe = (el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return false
      const cs = getComputedStyle(el)
      return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) !== 0
    }

    let obj = null
    if (selector) obj = [...document.querySelectorAll(selector)].find(seVe) ?? null
    if (!obj && rotulo) {
      const candidatos = [...document.querySelectorAll('button, a, input, label, [role="button"]')]
      // El de texto MÁS CORTO que contiene el rótulo: el recorrido del DOM va
      // de fuera adentro, así que sin esto se señala un contenedor entero.
      /* ⚠ TAMBIÉN POR `aria-label`. En el teléfono los botones que importan no
         llevan texto: crear un cliente es el «+» flotante (`aria-label="Crear"`)
         y la ruta nueva es un icono (`aria-label="Nueva ruta"`). Buscando solo
         por texto, los tres pasos donde se CREA algo se quedaban sin foto — que
         son justo los que alguien busca la primera vez. */
      const nombre = (x) => `${limpio(x.textContent)} ${x.getAttribute('aria-label') || ''}`
      const conEl = candidatos.filter((x) => nombre(x).includes(rotulo) && seVe(x))
      if (conEl.length) {
        obj = conEl.reduce((a, b) =>
          (nombre(a).length <= nombre(b).length ? a : b))
      }
    }
    if (!obj) return null

    obj.scrollIntoView({ block: 'center', behavior: 'instant' })
    const r = obj.getBoundingClientRect()
    if (!r.width || !r.height) return null

    const capa = document.createElement('div')
    capa.setAttribute('data-senal', '1')
    capa.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none'

    // El aro alrededor de lo que hay que tocar.
    const aro = document.createElement('div')
    const PAD = 6
    aro.style.cssText = `position:absolute;left:${r.left - PAD}px;top:${r.top - PAD}px;`
      + `width:${r.width + PAD * 2}px;height:${r.height + PAD * 2}px;`
      + `border:3px solid ${ROJO};border-radius:14px;`
      + `box-shadow:0 0 0 9999px rgba(20,20,28,.42)`   // oscurece TODO lo demás
    capa.appendChild(aro)

    /* La etiqueta va arriba o abajo del aro según haya sitio. Fijarla siempre
       abajo la sacaba de la pantalla cuando el botón estaba al pie, que es
       justo donde están los botones de esta app. */
    const abajo = desde !== 'arriba' && (r.bottom + 90 < window.innerHeight)
    const eti = document.createElement('div')
    eti.style.cssText = 'position:absolute;max-width:74%;display:flex;align-items:center;gap:8px;'
      + `background:${TINTA};color:#fff;padding:9px 13px;border-radius:12px;`
      + 'font:600 15px/1.3 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3)'
    if (numero) {
      const n = document.createElement('span')
      n.textContent = String(numero)
      n.style.cssText = `flex:none;width:22px;height:22px;border-radius:999px;background:${ROJO};`
        + 'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px'
      eti.appendChild(n)
    }
    const t = document.createElement('span')
    t.textContent = texto
    eti.appendChild(t)
    capa.appendChild(eti)
    document.body.appendChild(capa)

    // Se mide DESPUÉS de meterla, que es cuando ya se sabe cuánto ocupa.
    const re = eti.getBoundingClientRect()
    const izq = Math.max(12, Math.min(r.left + r.width / 2 - re.width / 2,
      window.innerWidth - re.width - 12))
    eti.style.left = `${izq}px`
    eti.style.top = abajo ? `${r.bottom + PAD + 34}px` : `${r.top - PAD - 34 - re.height}px`

    // La flecha, de la etiqueta al aro.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible')
    const x = Math.max(izq + 18, Math.min(r.left + r.width / 2, izq + re.width - 18))
    const y1 = abajo ? r.bottom + PAD + 32 : r.top - PAD - 32
    const y2 = abajo ? r.bottom + PAD + 4 : r.top - PAD - 4
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    linea.setAttribute('d', `M ${x} ${y1} L ${x} ${y2}`)
    linea.setAttribute('stroke', ROJO)
    linea.setAttribute('stroke-width', '3')
    linea.setAttribute('stroke-linecap', 'round')
    svg.appendChild(linea)
    const punta = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    const d = abajo ? -1 : 1
    punta.setAttribute('d', `M ${x - 6} ${y2 + 8 * d} L ${x} ${y2} L ${x + 6} ${y2 + 8 * d}`)
    punta.setAttribute('fill', 'none')
    punta.setAttribute('stroke', ROJO)
    punta.setAttribute('stroke-width', '3')
    punta.setAttribute('stroke-linecap', 'round')
    punta.setAttribute('stroke-linejoin', 'round')
    svg.appendChild(punta)
    capa.appendChild(svg)

    return { ancho: Math.round(r.width), alto: Math.round(r.height) }
  }, { ...orden, ROJO, TINTA })

  if (!encontrado) {
    throw new Error(`no encontré qué señalar: «${orden.rotulo || orden.selector}»`)
  }
  return encontrado
}

/** Quita el señalamiento, para poder encadenar varias capturas de la misma pantalla. */
export async function borrarSenales(p) {
  await p.evaluate(() => {
    document.querySelectorAll('[data-senal]').forEach((el) => el.remove())
  })
}
