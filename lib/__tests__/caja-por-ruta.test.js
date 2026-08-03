// La caja agrupada por RUTA (T08-02), con el efectivo separado de lo digital.
//
// Es la pregunta del cierre: de lo que cobró esta ruta, ¿cuánto tiene el
// cobrador EN LA MANO? Lo digital ya está en la cuenta y no se entrega. Si la
// partición está mal, se le reclama a alguien plata que nunca tocó.

import { describe, it, expect } from 'vitest'
import { agruparCajaPorRuta, totalesCajaPorRuta } from '../adaptadores/caja-por-ruta'

const pago = (extra = {}) => ({
  montoPagado: 10000, tipo: 'completo', metodoPago: 'efectivo',
  rutaId: 'r1', rutaNombre: 'Ruta #1', cobradorNombre: 'Pepito', ...extra,
})

describe('el efectivo y lo digital no se mezclan', () => {
  it('separa por el medio de pago', () => {
    const [f] = agruparCajaPorRuta([
      pago({ montoPagado: 41000, metodoPago: 'efectivo' }),
      pago({ montoPagado: 20500, metodoPago: 'transferencia' }),
    ], [])
    expect(f.brutoEfectivo).toBe(41000)
    expect(f.brutoDigital).toBe(20500)
    expect(f.bruto).toBe(61500)
  })

  it('lo que no es transferencia cuenta como efectivo', () => {
    // `metodoPago` puede venir null en pagos viejos: antes de T08-01 no se
    // guardaba. Contarlos como digital le quitaría al cobrador plata que sí
    // tiene en la mano.
    const [f] = agruparCajaPorRuta([pago({ metodoPago: null })], [])
    expect(f.brutoEfectivo).toBe(10000)
    expect(f.brutoDigital).toBe(0)
  })

  it('los porcentajes de la barra suman lo que hay', () => {
    const [f] = agruparCajaPorRuta([
      pago({ montoPagado: 75000, metodoPago: 'efectivo' }),
      pago({ montoPagado: 25000, metodoPago: 'transferencia' }),
    ], [])
    expect(f.pctEfectivo).toBe(75)
    expect(f.pctDigital).toBe(25)
  })
})

describe('qué entra y qué no', () => {
  it('recargo y descuento NO son plata que entró', () => {
    // Mueven la deuda en los papeles y nadie entrega un billete. Es el mismo
    // criterio que usa toda la caja.
    const filas = agruparCajaPorRuta([
      pago({ montoPagado: 10000 }),
      pago({ montoPagado: 99999, tipo: 'recargo' }),
      pago({ montoPagado: 88888, tipo: 'descuento' }),
    ], [])
    expect(filas[0].bruto).toBe(10000)
  })

  it('un pago sin ruta no se pierde: va a su propia fila', () => {
    const filas = agruparCajaPorRuta([
      pago({ montoPagado: 5000 }),
      pago({ montoPagado: 7000, rutaId: null, rutaNombre: null }),
    ], [])
    const sin = filas.find((f) => f.sinRuta)
    expect(sin).toBeTruthy()
    expect(sin.bruto).toBe(7000)
    expect(sin.nombre).toBe('Sin ruta')
  })

  it('«sin ruta» va SIEMPRE al final, aunque sea la que más movió', () => {
    // Es un agujero por resolver, no una ruta más: arriba parecería la ruta
    // estrella del día.
    const filas = agruparCajaPorRuta([
      pago({ montoPagado: 1000 }),
      pago({ montoPagado: 999999, rutaId: null, rutaNombre: null }),
    ], [])
    expect(filas[filas.length - 1].sinRuta).toBe(true)
  })

  it('las demás van de mayor a menor', () => {
    const filas = agruparCajaPorRuta([
      pago({ montoPagado: 1000, rutaId: 'a', rutaNombre: 'A' }),
      pago({ montoPagado: 9000, rutaId: 'b', rutaNombre: 'B' }),
    ], [])
    expect(filas.map((f) => f.nombre)).toEqual(['B', 'A'])
  })
})

describe('lo que dice cada fila', () => {
  it('cuenta los cobros contra los programados de la ruta', () => {
    const [f] = agruparCajaPorRuta(
      [pago(), pago()],
      [{ id: 'r1', esperadoHoy: 74500, cobrosHoy: 5 }],
    )
    expect(f.subtitulo).toContain('2 de 5 cobros')
    expect(f.subtitulo).toContain('Pepito')
  })

  it('con varios cobradores en la ruta, los dice todos', () => {
    // Es el dato que explica una diferencia al cuadrar.
    const [f] = agruparCajaPorRuta([
      pago({ cobradorNombre: 'Pepito' }),
      pago({ cobradorNombre: 'Marta' }),
    ], [])
    expect(f.subtitulo).toContain('Pepito')
    expect(f.subtitulo).toContain('Marta')
  })

  it('sin datos de la ruta, no inventa el esperado', () => {
    const [f] = agruparCajaPorRuta([pago()], [])
    expect(f.esperado).toBeNull()
  })
})

describe('el total de arriba es la suma de abajo', () => {
  it('cuadra al peso', () => {
    const filas = agruparCajaPorRuta([
      pago({ montoPagado: 41000, metodoPago: 'efectivo' }),
      pago({ montoPagado: 20500, metodoPago: 'transferencia' }),
      pago({ montoPagado: 9000, rutaId: 'r2', rutaNombre: 'Ruta #2' }),
    ], [])
    const t = totalesCajaPorRuta(filas)
    const suma = filas.reduce((a, f) => a + f.bruto, 0)
    expect(suma).toBe(70500)
    expect(t.hayAlgo).toBe(true)
    // El total formateado tiene que corresponder a esa suma.
    expect(t.total).toContain('70.500')
  })

  it('sin cobros, no se pinta nada', () => {
    expect(totalesCajaPorRuta([]).hayAlgo).toBe(false)
  })
})
