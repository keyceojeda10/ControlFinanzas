// lib/celebrar.js
//
// ══ LO QUE HACE QUE COBRAR SE SIENTA ═══════════════════════════════════════
//
// «que se vuelva como tipo adictivo… que la gente quiera salir a cobrar… un
//  poquito de dopamina… fluida, nada de trabada en ningún dispositivo»
//                                                  — el dueño, 19 sep 2026
//
// Aprobado tras diez versiones de prototipo. Lo comparten el deslizador
// (`components/cf/DeslizarParaConfirmar.jsx`) y el comprobante
// (`components/pantallas/Recibo.jsx`), para que el clic de un dígito y el
// sonido de un billete sean los mismos en todas partes.
//
// Reglas que no se rompen:
//   · Todo lo que se mueve se mueve por `transform`/`opacity`: lo pinta la
//     tarjeta gráfica y no traba los Android de gama baja de los cobradores.
//   · Nada de esto es imprescindible. Sin sonido, sin vibración (iOS no vibra)
//     o con «reducir movimiento», el cobro funciona y se lee igual.

const CLAVE_SONIDO = 'cf-sonido-cobro'

/** ¿Suena? Encendido por defecto; se apaga desde el comprobante. */
export function sonidoEncendido() {
  try { return localStorage.getItem(CLAVE_SONIDO) !== 'no' } catch { return true }
}
export function guardarSonido(encendido) {
  try { localStorage.setItem(CLAVE_SONIDO, encendido ? 'si' : 'no') } catch { /* sin almacenamiento */ }
}

export function vibrar(patron) {
  try { navigator.vibrate?.(patron) } catch { /* sin vibración */ }
}

export function menosMovimiento() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/* ── SONIDO SINTETIZADO ──
   Sin archivos: nada que descargar ni cachear. El AudioContext solo se crea
   dentro de un gesto (el navegador no deja sonar antes) y se reutiliza. */
let contexto = null
let ruido = null
function audio() {
  if (typeof window === 'undefined' || !sonidoEncendido()) return null
  try {
    contexto = contexto || new (window.AudioContext || window.webkitAudioContext)()
    if (contexto.state === 'suspended') contexto.resume()
    return contexto
  } catch { return null }
}
function nota(a, frecuencia, t, duracion, volumen, tipo) {
  const o = a.createOscillator(), g = a.createGain()
  o.type = tipo; o.frequency.setValueAtTime(frecuencia, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion)
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + duracion + 0.02)
}

/** Llamar en el primer toque del gesto: desbloquea el audio en iOS. */
export function despertarAudio() { audio() }

/** Un dígito que se fija. Sube de tono con cada uno: la escalera de «ya casi». */
export function clicDigito(k) {
  const a = audio(); if (a) nota(a, 620 + k * 110, a.currentTime, 0.045, 0.08, 'triangle')
}

/** Un billete que entra: un soplo de ruido filtrado, cada uno en un tono de papel. */
export function sonidoBillete() {
  const a = audio(); if (!a) return
  if (!ruido) {
    ruido = a.createBuffer(1, Math.round(a.sampleRate * 0.2), a.sampleRate)
    const d = ruido.getChannelData(0)
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1
  }
  const t = a.currentTime, fuente = a.createBufferSource(), banda = a.createBiquadFilter(), g = a.createGain()
  fuente.buffer = ruido; banda.type = 'bandpass'; banda.frequency.value = 2000 + Math.random() * 1500; banda.Q.value = 0.9
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
  fuente.connect(banda).connect(g).connect(a.destination); fuente.start(t); fuente.stop(t + 0.15)
}

/** El cierre: dos notas limpias, do y sol. */
export function sonidoCobrado() {
  const a = audio(); if (!a) return
  const t = a.currentTime
  nota(a, 1046.5, t, 0.35, 0.10, 'sine'); nota(a, 1568, t + 0.075, 0.5, 0.10, 'sine')
}

/* ══ LOS RODILLOS ══════════════════════════════════════════════════════════
   Cada dígito es una columna 0-9 repetida tres veces que se corre con
   `translateY`: así el rodillo siempre puede avanzar HACIA DELANTE, como un
   contador de verdad, sin saltar hacia atrás. Lo que no es dígito ($, puntos,
   letras de la moneda) queda fijo. Funciona con cualquier formato de país. */
export const ALTO_RODILLO = 1.15      // em
const CELDAS = 30

export function construirRodillos(el, texto) {
  el.innerHTML = ''
  el.setAttribute('aria-label', texto)
  const rodillos = []
  for (const ch of texto) {
    if (/\d/.test(ch)) {
      const rodillo = document.createElement('span')
      rodillo.className = 'cf-rodillo'
      const col = document.createElement('span')
      col.className = 'cf-rodillo-col'
      for (let c = 0; c < CELDAS; c++) {
        const s = document.createElement('span')
        s.textContent = String(c % 10)
        col.appendChild(s)
      }
      rodillo.appendChild(col)
      el.appendChild(rodillo)
      const r = { el: rodillo, col, d: Number(ch), pos: 10 + Number(ch), fija: true }
      col.style.transform = `translateY(${-r.pos * ALTO_RODILLO}em)`
      rodillos.push(r)
    } else {
      const s = document.createElement('span')
      s.className = 'cf-rodillo-fijo'
      s.textContent = ch
      el.appendChild(s)
    }
  }
  return rodillos
}

export function moverRodillo(r, pos, transicion) {
  r.pos = pos
  r.col.style.transition = transicion
  r.col.style.transform = `translateY(${-pos * ALTO_RODILLO}em)`
}

/** La celda del dígito `d` que queda por delante de donde está el rodillo. */
export function haciaDelante(r, d) {
  let t = 10 + d
  while (t < r.pos) t += 10
  return Math.min(CELDAS - 1, t)
}

const EXPO = 'cubic-bezier(.16,1,.3,1)'

/**
 * Hace rodar un contador ya construido hasta `texto`. El dígito que cambia
 * rueda; los de su derecha dan una vuelta entera detrás, en cascada.
 * Devuelve los rodillos (nuevos si cambió la forma: $99.000 → $101.000).
 */
export function rodarContador(el, rodillos, texto) {
  const viejo = el.getAttribute('aria-label') || ''
  const forma = (s) => s.replace(/\d/g, '0')
  if (menosMovimiento() || forma(viejo) !== forma(texto) || rodillos.length === 0) {
    return construirRodillos(el, texto)
  }
  const nuevos = [...texto].filter((c) => /\d/.test(c)).map(Number)
  const m = nuevos.findIndex((d, k) => d !== rodillos[k].d)
  if (m < 0) return rodillos
  el.setAttribute('aria-label', texto)
  rodillos.forEach((r, k) => {
    if (k < m) return
    const paso = k - m
    const destino = nuevos[k] !== r.d ? haciaDelante(r, nuevos[k]) : r.pos + 10
    r.d = nuevos[k]
    moverRodillo(r, Math.min(CELDAS - 1, destino), `transform ${620 + paso * 90}ms ${EXPO} ${paso * 40}ms`)
  })
  // Al terminar, cada columna vuelve a su tercio del medio sin que se note:
  // así el siguiente cobro también puede avanzar.
  setTimeout(() => rodillos.forEach((r) => moverRodillo(r, 10 + r.d, 'none')), 1400)
  return rodillos
}

/** El CSS de los rodillos. Se inyecta una vez junto al componente que los usa. */
export const CSS_RODILLOS = `
  .cf-rodillos { display: inline-flex; font-variant-numeric: tabular-nums; line-height: ${ALTO_RODILLO}em; white-space: nowrap; }
  .cf-rodillo { display: inline-block; height: ${ALTO_RODILLO}em; overflow: hidden; }
  .cf-rodillo-col { display: flex; flex-direction: column; will-change: transform; }
  .cf-rodillo-col span, .cf-rodillo-fijo { display: block; height: ${ALTO_RODILLO}em; line-height: ${ALTO_RODILLO}em; text-align: center; }
`
