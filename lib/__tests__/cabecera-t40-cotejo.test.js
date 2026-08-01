// lib/__tests__/cabecera-t40-cotejo.test.js
//
// LOS VALORES DE ESTE ARCHIVO SALEN DE MEDIR, no de leer.
//
// Se comparó la lámina T40-00-a con la cabecera construida en /clientes usando
// `node scripts/medir.mjs /clientes header 390`, y estas son las cifras que
// coincidieron al píxel. Están aquí para que no se muevan sin querer.
//
// Se fija el CONTRATO, no la forma del JSX: lo que rompió la comprobación
// anterior fue exigir `<BarraLateral />` literal, que es la versión sin cablear.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const cabecera = leer('components/armazon/CabeceraMovil.jsx')

describe('T40-00-a · las medidas cotejadas contra la lámina', () => {
  it('la fila lleva el relleno y el hueco de la lámina', () => {
    // `0 18px 0 20px` y gap 6. Yo tenía 16 de derecha y 12 de hueco.
    expect(cabecera).toMatch(/padding: '0 18px 0 20px', gap: 6/)
  })

  it('el glifo mide 32 con radio 10', () => {
    expect(cabecera).toMatch(/width: 32, minWidth: 32, height: 32/)
    expect(cabecera).toMatch(/borderRadius: 10/)
  })

  it('los botones de icono miden 40 con radio 12', () => {
    expect(cabecera).toMatch(/width: 40, height: 40, borderRadius: 12/)
  })

  it('el punto de la campana mide 8 y va sobre el fondo de la superficie', () => {
    expect(cabecera).toMatch(/width: 8, height: 8/)
    expect(cabecera).toMatch(/border: '2px solid var\(--cf-surface\)'/)
  })

  it('todo lo de la fila es flex:none menos el espaciador vacío', () => {
    // Regla global 2. Los botones salían con shrink 1 y la fila los estrechaba
    // antes de dejar que el espaciador cediera: el área táctil se encogía.
    const nav = cabecera.slice(cabecera.indexOf('function Navegacion'))
    const fin = nav.indexOf('/* ── Variante de detalle')
    const bloque = nav.slice(0, fin > 0 ? fin : undefined)
    // El único `flex: 1` del bloque es el del <span/> vacío.
    const encogibles = bloque.match(/flex: 1/g) ?? []
    expect(encogibles).toHaveLength(1)
    expect(bloque).toMatch(/<span style=\{\{ flex: 1 \}\} \/>/)
  })
})

describe('T39-05 · lo que el cotejo encontró en la barra lateral', () => {
  const lateral = leer('components/armazon/BarraLateral.jsx')

  it('el logotipo va a 13px, no a 14', () => {
    expect(lateral).toMatch(/fontSize: 13, fontWeight: 700, letterSpacing: '-\.01em', color: 'var\(--cf-ink\)'/)
    expect(lateral).toMatch(/fontSize: 13, fontWeight: 700, letterSpacing: '-\.01em', color: 'var\(--cf-gold-dark\)'/)
  })

  it('el rol se escribe en español', () => {
    // Salía «owner» debajo del nombre, en una app entera en español.
    expect(lateral).toMatch(/rolEnEspanol\(rol\)/)
  })

  it('detecta la conexión ella sola, sin depender de que le pasen la prop', () => {
    // Se montaba sin props: el punto salía verde fijo aunque no hubiera red.
    expect(lateral).toMatch(/navigator\.onLine/)
  })
})
