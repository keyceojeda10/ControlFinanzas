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

const componente = readFileSync(resolve(process.cwd(), 'components/caja/CajaPorRuta.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('en «Por ruta» se elige sin pasar por las rutas', () => {
  it('el selector entra por el hueco, no después de la lista', () => {
    expect(pestaña, 'volvió a estar suelto debajo de las rutas').toMatch(/selector=\{\(/)
    expect(pestaña).toMatch(/— Elige un cobrador —/)
  })

  it('y el hueco está ENTRE el total del día y las rutas', () => {
    /* Del todo arriba tampoco vale: el total es el titular de la pantalla y
       taparlo con un `<select>` cambia un problema por otro. */
    const iTotal = componente.indexOf('Recaudado hoy')
    const iHueco = componente.indexOf('{selector}', iTotal)
    const iFilas = componente.indexOf('filas.map')
    expect(iTotal, 'ya no está el total').toBeGreaterThan(-1)
    expect(iHueco, 'el hueco desapareció').toBeGreaterThan(iTotal)
    expect(iHueco, 'el hueco quedó debajo de las rutas').toBeLessThan(iFilas)
  })

  it('⚠ y también cuando no hay ninguna ruta con movimiento', () => {
    /* La rama vacía sale por un `return` propio: sin el hueco ahí, el día sin
       cobros se quedaría sin selector y no habría forma de mirar una caja. El
       cero es un dato. */
    const vacia = componente.slice(0, componente.indexOf('Todavía no hay cobros'))
    expect(vacia, 'la rama vacía se quedó sin selector').toMatch(/\{selector\}/)
  })

  it('el detalle del cobrador viaja con su selector', () => {
    /* Si se quedara debajo de la lista, elegir a alguien no cambiaría nada de lo
       que se ve: el mismo problema una pieza más abajo. */
    const hueco = pestaña.slice(pestaña.indexOf('selector={('))
    expect(hueco).toMatch(/<CajaCobradorDetalle/)
  })

  it('sin el hueco vacío entre el selector y la lista', () => {
    // 120px para decir lo que el propio selector ya dice, y volvían a empujar
    // la lista hacia abajo.
    expect(pestaña).not.toMatch(/Selecciona un cobrador/)
  })
})
