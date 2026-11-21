'use client'

/* El marcador de cada campo baja de letra hasta caber (ver lib/marcador-que-cabe.js).
   Uno solo para toda la app, en el layout raíz: mira los campos que hay y los que
   aparecen (hojas, pasos), y vuelve a medir cuando un campo cambia de ancho. No
   pinta nada; deja `data-marcador="15|14|13"` y el CSS de globals hace el resto. */
import { useEffect } from 'react'
import { tamanoQueCabe, esCampoConMarcador } from '@/lib/marcador-que-cabe'

export default function MarcadoresQueCaben() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    const lienzo = document.createElement('canvas').getContext('2d')
    if (!lienzo) return
    const vistos = new WeakSet()
    const pendientes = new Set()
    let cuadro = 0

    const ajustar = (el) => {
      if (!el.isConnected || !esCampoConMarcador(el)) {
        if (el.hasAttribute?.('data-marcador')) el.removeAttribute('data-marcador')
        return
      }
      const s = getComputedStyle(el)
      const hay = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
      if (!(hay > 0)) return // escondido: el ResizeObserver avisa cuando se vea
      const base = parseFloat(s.fontSize)
      const espacio = parseFloat(s.letterSpacing) || 0
      const texto = el.placeholder
      const medir = (px) => {
        lienzo.font = `${s.fontStyle} ${s.fontWeight} ${px}px ${s.fontFamily}`
        return lienzo.measureText(texto).width + espacio * texto.length
      }
      const t = tamanoQueCabe({ base, hay, medir })
      if (t) {
        if (el.getAttribute('data-marcador') !== String(t)) el.setAttribute('data-marcador', String(t))
        if (medir(t) > hay + 0.5 && !el.title) { el.title = texto; el.dataset.marcadorTitulo = '1' }
      } else {
        if (el.hasAttribute('data-marcador')) el.removeAttribute('data-marcador')
        if (el.dataset.marcadorTitulo) { el.removeAttribute('title'); delete el.dataset.marcadorTitulo }
      }
    }

    const vaciar = () => { cuadro = 0; for (const el of pendientes) ajustar(el); pendientes.clear() }
    const pedir = (el) => { pendientes.add(el); if (!cuadro) cuadro = requestAnimationFrame(vaciar) }

    const tamano = new ResizeObserver((entradas) => { for (const e of entradas) pedir(e.target) })
    const seguir = (el) => {
      if (vistos.has(el)) { pedir(el); return }
      vistos.add(el)
      tamano.observe(el)
      pedir(el)
    }
    const revisar = (raiz) => {
      if (raiz.nodeType !== 1) return
      if (raiz.tagName === 'INPUT') seguir(raiz)
      else raiz.querySelectorAll?.('input[placeholder]').forEach(seguir)
    }

    revisar(document.body)
    const cambios = new MutationObserver((lista) => {
      for (const m of lista) {
        if (m.type === 'attributes') { if (m.target.tagName === 'INPUT') seguir(m.target); continue }
        m.addedNodes.forEach(revisar)
      }
    })
    cambios.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder'] })
    // La letra de la app llega después del primer pintado: medir otra vez con ella.
    document.fonts?.ready?.then(() => revisar(document.body)).catch(() => {})

    return () => { cambios.disconnect(); tamano.disconnect(); if (cuadro) cancelAnimationFrame(cuadro) }
  }, [])
  return null
}
