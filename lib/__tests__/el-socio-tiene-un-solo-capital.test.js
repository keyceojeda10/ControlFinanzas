/* El socio tenía DOS capitales y una mora que siempre decía cero.
 *
 * ══ LAS DOS PANTALLAS DEL MISMO SOCIO ══════════════════════════════════════
 *
 *   la lista  `Σ capitalEnCalle(p)` sobre los ACTIVOS  ← estaba bien
 *   la ficha  `Σ montoPrestado`     sobre TODOS        ← contaba los pagados,
 *                                                        y por su monto original
 *
 * El comentario que hay en la lista describe literalmente el fallo que seguía
 * en la ficha: «lo que del socio sigue AFUERA, no lo que salió algún día; con
 * `Σ montoPrestado` la tarjeta decía que tenía en la calle plata que el cliente
 * ya le había devuelto». Se arregló una vía y se dejó la otra.
 *
 * MEDIDO EN PRODUCCIÓN el 27 ago 2026: 2 socios, 35 préstamos, $4.533.334 de
 * más. Uno tiene sus DOS préstamos pagados y su ficha decía $1.800.000.
 *
 * ══ Y LA MORA DECÍA CERO SIEMPRE ═══════════════════════════════════════════
 *
 * La ficha filtraba por `p.diasMora > 0` y el API nunca ha devuelto `diasMora`:
 * `undefined ?? 0` es 0, el filtro dejaba la lista vacía y la tarjeta escribía
 * «$0 en mora» tuviera lo que tuviera. La trampa del campo que no se pide. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const ficha = readFileSync('app/(dashboard)/socios/[id]/page.jsx', 'utf8')
const apiFicha = readFileSync('app/api/socios/[id]/route.js', 'utf8')
const apiLista = readFileSync('app/api/socios/route.js', 'utf8')

describe('el socio tiene un solo capital', () => {
  it('la ficha NO vuelve a sumar `montoPrestado` para el capital en la calle', () => {
    expect(ficha).toMatch(/const capitalEnCalle = socio\.capitalEnCalle/)
    expect(ficha).not.toMatch(/capitalEnCalle = socio\.prestamos\.reduce/)
  })

  it('la ficha NO vuelve a filtrar por `diasMora`, que nunca llega', () => {
    expect(ficha).toMatch(/const enMora = socio\.capitalEnMora/)
    expect(ficha).not.toMatch(/filter\(\(p\) => \(p\.diasMora \?\? 0\) > 0\)/)
  })

  it('⚠ los dos APIs cuentan igual: activos y capital vivo', () => {
    /* Es la razón de ser del arreglo. Si uno de los dos vuelve a contar los
       pagados o a usar el monto original, el mismo socio tendrá otra vez dos
       cifras y nadie sabrá cuál creerse. */
    for (const src of [apiFicha, apiLista]) {
      expect(src).toMatch(/capitalEnCalle as capitalEnCalleDe/)
      expect(src).toMatch(/estado === 'activo'/)
      expect(src).toMatch(/capitalEnCalleDe\(p\)/)
    }
  })

  it('el API de la ficha devuelve las dos cifras', () => {
    // Sin esto la pantalla lee `undefined` y escribe cero, que es de donde
    // venía el fallo de la mora.
    expect(apiFicha).toMatch(/^\s*capitalEnCalle,$/m)
    expect(apiFicha).toMatch(/^\s*capitalEnMora,$/m)
  })

  it('la mora se mide con la función, no con un campo que no viene', () => {
    expect(apiFicha).toMatch(/calcularDiasMora\(p\) > 0/)
  })
})
