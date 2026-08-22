import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const recibo = leer('components', 'pantallas', 'Recibo.jsx')
const registrar = leer('components', 'prestamos', 'RegistrarPago.jsx')
const ruta = leer('app', '(dashboard)', 'rutas', '[id]', 'page.jsx')

describe('el comprobante en escritorio es un modal, no una página estirada', () => {
  /* Reportado con captura el 21 ago 2026: «la pantalla de pago en computadora
     sale a todo lo ancho, no como un modal; se ve muy fea así estirada, cuando
     la mayoría de las cosas del sistema son modales».

     En 1440px la fila «Cliente ......... Fantasma 4» quedaba con media pantalla
     de puntos en medio y los botones de lado a lado. */

  it('⚠ la capa está en UN solo sitio y los dos caminos la usan', () => {
    /* Estaba escrita a mano en los dos, y así es como este mismo recibo ya
       divergió antes: se arregla un camino y el otro se queda con el fallo. */
    expect(recibo).toMatch(/export const CAPA_RECIBO/)
    for (const [nombre, src] of [['RegistrarPago', registrar], ['la ficha de la ruta', ruta]]) {
      expect(src, `${nombre} volvió a escribir su propia capa`)
        .toMatch(/className=\{CAPA_RECIBO\.className\} style=\{CAPA_RECIBO\.style\}/)
      expect(src).toMatch(/CAPA_RECIBO/)
    }
  })

  it('⚠ el fondo va por CLASE, no en el `style`', () => {
    /* Un estilo en línea le gana siempre a la clase: con `background` inline el
       `lg:bg-…` no pintaba y la capa seguía saliendo clara en el monitor. */
    const capa = recibo.slice(recibo.indexOf('export const CAPA_RECIBO'),
      recibo.indexOf('export function Recibo'))
    expect(capa, 'el fondo volvió al style en línea').not.toMatch(/style: \{[\s\S]*background:/)
    expect(capa).toMatch(/bg-\[var\(--cf-surface\)\]/)
    expect(capa).toMatch(/lg:bg-\[rgba\(/)
  })

  it('y el comprobante tiene ancho fijo, no se encoge al contenido', () => {
    /* Dentro de un contenedor flex, `w-full` se encoge: la tarjeta salió de
       289px, más estrecha que en el teléfono. */
    expect(recibo).toMatch(/max-w-\[520px\]/)
    expect(recibo).toMatch(/lg:w-\[520px\]/)
  })
})
