// lib/__tests__/anular-no-devuelve-de-mas.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Anular un préstamo deja sus cobros vivos —a propósito, esa plata entró—. Así
// que devolver ADEMÁS el desembolso entero cuenta la misma plata dos veces:
//
//     salió 2.119.000 · entró 1.000.001 · devuelve 2.119.000  =  +1.000.001
//
// La pantalla lo ofrecía como una opción, y la describía tal cual: «conserva
// los cobros ya registrados y regresa el monto completo prestado».
//
// Reportado por Crediya (16 ago 2026) con su caso: escribió $1.000.001 donde
// iban $100.000 y anuló el préstamo. Medido en producción ese día:
// **$22.088.226 de más repartidos en 120 préstamos anulados.** Con el otro modo
// el neto da cero, que es lo correcto.
//
// Lo que estas pruebas cuidan:
//
//   1. Que vuelva a aparecer la opción en la pantalla.
//   2. Que el API la acepte si llega igual. La pantalla NO puede ser la única
//      defensa: la app se usa sin señal y el service worker sirve pantallas
//      viejas, así que una versión anterior seguiría mandando `devolver_todo`.
//   3. Que se pierda la salida buena. Para deshacer un cobro mal escrito hay
//      que ELIMINAR el préstamo, y eso hay que decirlo donde se está anulando.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const crudo = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const leer = (r) => crudo(r)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const API = 'app/api/prestamos/[id]/route.js'
const PANTALLA = 'app/(dashboard)/prestamos/[id]/page.jsx'

describe('⚠ el API no devuelve el préstamo entero si ya hubo cobros', () => {
  const src = leer(API)

  it('fuerza «solo lo pendiente» aunque le pidan «todo»', () => {
    expect(src).toMatch(/totalPagosReales > 0 && modoPedido === 'devolver_todo'/)
    expect(src).toMatch(/\?\s*'devolver_restante'/)
  })

  it('la decisión se toma ANTES de calcular el monto a reversar', () => {
    /* Si se colara después, el importe ya estaría calculado con el modo viejo y
       el arreglo no serviría de nada. */
    const i = src.indexOf('modoReversionSolicitado =')
    const j = src.indexOf('montoReversion =')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(-1)
    expect(i).toBeLessThan(j)
  })

  it('deja rastro cuando corrige lo que le pidieron', () => {
    // Sin esto, el día que una pantalla vieja mande el modo malo no se sabría.
    expect(src).toMatch(/console\.warn[\s\S]{0,160}devolver_todo/)
  })
})

describe('⚠ la pantalla ya no ofrece devolver todo', () => {
  const src = crudo(PANTALLA)

  it('no queda ningún control para elegirlo', () => {
    expect(src, 'volvió el selector de modo de reverso')
      .not.toMatch(/name="modo-reversion-capital"/)
    expect(src).not.toMatch(/setModoReversionCapital/)
  })

  it('con cobros manda siempre «solo lo pendiente»', () => {
    expect(src).toMatch(/modoReversionCapital: hayCobrosRegistrados \? 'devolver_restante' : 'devolver_todo'/)
  })

  it('dice cuánto vuelve a caja y por qué', () => {
    expect(src).toMatch(/Vuelven a caja/)
    expect(src).toMatch(/formatMoney\(saldoFinancieroPendiente\)/)
  })

  it('⚠ señala ELIMINAR como la salida para un cobro mal escrito', () => {
    /* Es el caso que de verdad tenía quien reportó esto. Sin este renglón, el
       arreglo le quita una opción y no le da ninguna. */
    expect(src).toMatch(/elimina el préstamo/i)
  })
})
