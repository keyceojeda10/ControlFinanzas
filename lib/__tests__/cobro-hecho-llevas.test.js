import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// T15-03 «Cobro hecho» pone «Llevas hoy $76.500 de $145.000» debajo del monto:
// es lo que el cobrador quiere saber justo despues de cobrar.
//
// El encadenado —«Siguiente: Fulano»— YA existia. Lo que faltaba era el avance
// del dia, y no viajaba: `rutaNav` sale de `sessionStorage` y solo llevaba la
// lista de clientes.
const pago = readFileSync(resolve(process.cwd(), 'components/prestamos/RegistrarPago.jsx'), 'utf8')
const ruta = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')

describe('«Llevas hoy» tras cobrar', () => {
  it('el contexto de ruta lleva el avance del dia', () => {
    expect(ruta).toMatch(/recaudadoHoy: Math\.round\(ruta\.recaudadoHoy \?\? 0\)/)
    expect(ruta).toMatch(/esperadoHoy: Math\.round\(ruta\.esperadoHoy \?\? 0\)/)
  })

  it('la pantalla suma el pago que se acaba de hacer', () => {
    // El contexto es una FOTO de cuando se entro al recorrido: sin sumar este
    // pago, la barra se quedaria atras justo en el cobro que se esta mirando.
    expect(pago).toMatch(/\(rutaNav\.recaudadoHoy \?\? 0\) \+ \(pagoGuardado\.montoPagado \?\? 0\)/)
  })

  it('no sale fuera de un recorrido ni sin meta', () => {
    // Fuera de la ruta no hay «hoy» que llevar, y sin meta la barra no dice
    // nada: un «$14.500 de $0» es peor que no enseñarlo.
    expect(pago).toMatch(/rutaNav\?\.esperadoHoy > 0/)
  })

  it('ni en un pago offline ni en recargo o descuento', () => {
    // Offline el pago aun no cuenta en el recaudado del servidor, y un recargo
    // no es plata que entre: sumarlos mentiria sobre lo que lleva.
    const i = pago.indexOf('Llevas hoy')
    const bloque = pago.slice(Math.max(0, i - 700), i)
    expect(bloque).toMatch(/!pagoGuardado\.offline/)
    expect(bloque).toMatch(/!\['recargo', 'descuento'\]\.includes\(tipo\)/)
  })

  it('la barra nunca desaparece del todo', () => {
    // Con un 0% real el ancho cero borra la barra y la pantalla parece rota:
    // es la misma regla del 2% que ya usan las rutas.
    expect(pago).toMatch(/Math\.max\(2, Math\.min\(100,/)
  })
})
