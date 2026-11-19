'use client'

// components/armazon/ReparoTecladoIOS.js — devuelve la pantalla que el teclado
// del iPhone deja encogida o corrida en la app instalada (inducción del 18 nov
// 2026, errores 2, 3 y 6). El porqué y la decisión, en lib/ios-teclado.js.
//
// Va en el layout raíz y no en el armazón: el error 6 empezó en /login (correo
// y contraseña), que no tiene armazón, y el alto bueno hay que anotarlo ANTES
// del primer teclado. Se guarda por orientación en sessionStorage, así que
// sobrevive a ir de una pantalla a otra.
//
// Qué hace, solo en iPhone/iPad con la app instalada y solo si hace falta:
//   · 'reacomodar' — vuelve a poner el desplazamiento donde está; así iOS 26
//     recoloca lo fijo arriba y abajo.
//   · 'remedir'    — apaga y prende el <body> en el mismo instante (no llega a
//     pintarse) para que iOS vuelva a medir la ventana; antes guarda dónde iba
//     la página y cada lista con su propio desplazamiento, y lo devuelve.
// Si remedir no sirve tres veces seguidas deja de intentarlo: no se insiste en
// algo que en ese teléfono no funciona.

import { useEffect } from 'react'
import { esAppInstaladaEnIOS, queHacerTrasElTeclado, MAX_FALLOS } from '@/lib/ios-teclado'

const CAMPO = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'

export default function ReparoTecladoIOS() {
  useEffect(() => {
    let instalada = false
    try {
      instalada = esAppInstaladaEnIOS({
        userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
        standalone: navigator.standalone === true,
        displayStandalone: window.matchMedia?.('(display-mode: standalone)').matches === true,
      })
    } catch { instalada = false }
    if (!instalada) return undefined

    const orientacion = () => (window.innerWidth > window.innerHeight ? 'h' : 'v')
    const clave = () => `cf-alto-bueno-${orientacion()}`
    const leerMax = () => { try { return Number(sessionStorage.getItem(clave())) || 0 } catch { return 0 } }
    const guardarMax = (v) => { try { sessionStorage.setItem(clave(), String(Math.round(v))) } catch { /* sin almacenamiento */ } }
    const escribiendo = () => { const a = document.activeElement; return !!a && a !== document.body && !!a.matches?.(CAMPO) }
    const anotar = () => { if (!escribiendo() && window.innerHeight > leerMax()) guardarMax(window.innerHeight) }
    const medir = () => {
      const vv = window.visualViewport
      return queHacerTrasElTeclado({
        alto: window.innerHeight, altoMaximo: leerMax(),
        visibleAlto: vv?.height ?? null, visibleTop: vv?.offsetTop ?? null, escribiendo: escribiendo(),
      })
    }

    let fallos = 0
    let espera = null
    let comprobar = null

    const remedir = () => {
      const x = window.scrollX
      const y = window.scrollY
      // Las listas con su propio desplazamiento (hojas, tablas) también vuelven a su sitio.
      const listas = [...document.querySelectorAll('body *')].filter((el) => el.scrollTop > 0).map((el) => [el, el.scrollTop])
      const body = document.body
      const antes = body.style.display
      body.style.display = 'none'
      void body.offsetHeight
      body.style.display = antes
      for (const [el, top] of listas) el.scrollTop = top
      window.scrollTo(x, y)
    }

    const revisar = () => {
      const que = medir()
      if (que === 'nada') { fallos = 0; anotar(); return }
      window.scrollTo(window.scrollX, window.scrollY)
      if (que === 'remedir' && fallos < MAX_FALLOS) {
        remedir()
        clearTimeout(comprobar)
        comprobar = setTimeout(() => { fallos = medir() === 'remedir' ? fallos + 1 : 0 }, 300)
      }
    }
    const programar = (ms) => { clearTimeout(espera); espera = setTimeout(revisar, ms) }

    anotar()
    const alSalirDeUnCampo = () => programar(160)
    const alCambiarElAlto = () => { if (!escribiendo()) programar(220) }
    const alVolver = () => { if (document.visibilityState === 'visible') programar(300) }

    document.addEventListener('focusout', alSalirDeUnCampo, true)
    window.visualViewport?.addEventListener('resize', alCambiarElAlto)
    window.addEventListener('resize', alCambiarElAlto)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearTimeout(espera); clearTimeout(comprobar)
      document.removeEventListener('focusout', alSalirDeUnCampo, true)
      window.visualViewport?.removeEventListener('resize', alCambiarElAlto)
      window.removeEventListener('resize', alCambiarElAlto)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])
  return null
}
