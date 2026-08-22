// lib/__tests__/caja-por-ruta-orden.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «En caja por ruta, el selector sale después de la lista de todas las rutas.
//  Un usuario que tenga diez rutas, como hay un caso, tiene que bajar hasta el
//  final para poder seleccionar la que quiere ver.» — el dueño, 22 ago 2026.
//
// ⚠ Y ESTABA ABAJO A PROPÓSITO: la pestaña empezaba con un `<select>` vacío y
//   media pantalla en blanco hasta elegir a alguien. Esta prueba fija el orden
//   nuevo Y la condición que lo hace seguro —que la lista de rutas se sigue
//   pintando siempre—, para que quien lea el comentario viejo no lo devuelva
//   creyendo que se le escapó algo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/caja/page.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// El trozo de la pestaña, no la pantalla entera: `<CajaPorRuta` aparece una vez
// pero el `<select>` de cobradores tiene hermanos en otras pestañas.
const pestaña = src.slice(src.indexOf("{cajaTab === 'porruta' &&"), src.indexOf("{cajaTab === 'cuadre' &&"))

describe('en «Por ruta» se elige primero y se baja después', () => {
  it('el selector va ANTES del listado de rutas', () => {
    const iSelector = pestaña.indexOf('— Elige un cobrador —')
    const iLista = pestaña.indexOf('<CajaPorRuta')
    expect(iSelector, 'no está el selector').toBeGreaterThan(-1)
    expect(iLista, 'no está el listado').toBeGreaterThan(-1)
    expect(iSelector, 'volvió a quedar debajo de las rutas').toBeLessThan(iLista)
  })

  it('y el detalle del cobrador, pegado a su selector', () => {
    /* Si se quedara debajo de la lista, elegir a alguien no cambiaría nada de lo
       que se ve: el mismo problema una pieza más abajo. */
    const iDetalle = pestaña.indexOf('<CajaCobradorDetalle')
    const iLista = pestaña.indexOf('<CajaPorRuta')
    expect(iDetalle).toBeGreaterThan(-1)
    expect(iDetalle).toBeLessThan(iLista)
  })

  it('⚠ la lista de rutas se pinta SIEMPRE, que es lo que hace seguro el cambio', () => {
    /* Es la razón por la que el selector puede ir arriba sin repetir el fallo
       viejo: no hay pantalla en blanco esperando a que elijas. Si algún día
       `<CajaPorRuta>` queda detrás de una condición, esto salta. */
    /* ⚠ Contar `&& (` contra `)}` en todo el trozo NO sirve: el propio
       `{cajaTab === 'porruta' && (` abre y no cierra hasta el final, así que
       siempre sobra uno. Me lo dijo la prueba en rojo con el código correcto
       delante. Lo que se mira es lo que hay JUSTO ANTES del listado. */
    const i = pestaña.indexOf('<CajaPorRuta')
    const justoAntes = pestaña.slice(Math.max(0, i - 140), i)
    expect(justoAntes, 'el listado quedó dentro de una condición').not.toMatch(/&&/)
  })

  it('sin el hueco vacío entre el selector y la lista', () => {
    // 120px para decir lo que el propio selector ya dice, y volvían a empujar
    // la lista hacia abajo.
    expect(pestaña).not.toMatch(/Selecciona un cobrador/)
  })
})
