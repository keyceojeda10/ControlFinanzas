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

// ── «PRESTADO» POR RUTA ────────────────────────────────────────────────────
//
// La cuarta cifra de la lámina, que no estaba porque ningún endpoint la mandaba.
// Ahora la cuenta `/api/caja` préstamo a préstamo.
//
// Lo que se vigila aquí es que sea lo ENTREGADO EN MANO y no el valor de la
// cartulina: en una renovación el monto nuevo absorbe el saldo viejo, que nunca
// salió de la caja. Si esto se rompe, la pestaña dice que salió plata que sigue
// en el cajón — y es la pantalla del dinero.
describe('lo prestado por ruta', () => {
  it('cada ruta lleva SU prestado, no el del negocio repartido', () => {
    const filas = agruparCajaPorRuta(
      [pago({ rutaId: 'r1' }), pago({ rutaId: 'r2', rutaNombre: 'Ruta #2' })],
      [],
      undefined,
      [{ rutaId: 'r1', prestado: 500000, cuantos: 2 },
       { rutaId: 'r2', prestado: 120000, cuantos: 1 }],
    )
    expect(filas.find((f) => f.id === 'r1').brutoPrestado).toBe(500000)
    expect(filas.find((f) => f.id === 'r2').brutoPrestado).toBe(120000)
  })

  it('una ruta donde HOY solo se prestó también sale', () => {
    // Sin esto la fila no existiría: se construyen desde los pagos, y aquí no
    // hubo ninguno. Pero salió plata a la calle y eso es movimiento del día.
    const filas = agruparCajaPorRuta([], [{ id: 'r9', nombre: 'Ruta #9' }], undefined,
      [{ rutaId: 'r9', prestado: 300000, cuantos: 1 }])
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Ruta #9')
    expect(filas[0].brutoPrestado).toBe(300000)
    expect(filas[0].bruto).toBe(0)
  })

  it('un día de puras renovaciones puede tener $0 prestado', () => {
    // El servidor ya manda 0 (el saldo viejo absorbido no salió de la caja).
    // La pantalla NO debe pintar un «Prestado $0» que parezca un dato.
    const [f] = agruparCajaPorRuta([pago()], [], undefined,
      [{ rutaId: 'r1', prestado: 0, cuantos: 3 }])
    expect(f.brutoPrestado).toBe(0)
    expect(f.prestado).toBeNull()
  })

  it('sin el dato, no se inventa', () => {
    const [f] = agruparCajaPorRuta([pago()], [])
    expect(f.prestado).toBeNull()
    expect(f.brutoPrestado).toBe(0)
  })

  it('el total de prestado es la suma de las filas', () => {
    const filas = agruparCajaPorRuta(
      [pago({ rutaId: 'r1' }), pago({ rutaId: 'r2', rutaNombre: 'Ruta #2' })],
      [],
      undefined,
      [{ rutaId: 'r1', prestado: 500000 }, { rutaId: 'r2', prestado: 120000 }],
    )
    const t = totalesCajaPorRuta(filas)
    expect(t.prestado).toContain('620.000')
    // Y NO se mezcla con lo recaudado: son plata que sale y plata que entra.
    expect(t.total).toContain('20.000')
  })

  it('un día de solo préstamos NO se pinta como vacío', () => {
    const filas = agruparCajaPorRuta([], [{ id: 'r1', nombre: 'Ruta #1' }], undefined,
      [{ rutaId: 'r1', prestado: 80000 }])
    expect(totalesCajaPorRuta(filas).hayAlgo).toBe(true)
  })

  it('la ruta que más movió va primero, aunque lo suyo sea prestar', () => {
    // Ordenando solo por lo cobrado, la que salió a prestar 2 millones caía al
    // último puesto debajo de una que cobró 30 mil.
    const filas = agruparCajaPorRuta(
      [pago({ rutaId: 'r2', rutaNombre: 'Ruta #2', montoPagado: 30000 })],
      [{ id: 'r1', nombre: 'Ruta #1' }],
      undefined,
      [{ rutaId: 'r1', prestado: 2000000 }],
    )
    expect(filas[0].nombre).toBe('Ruta #1')
  })

  it('los préstamos sin ruta van al final, como los pagos sin ruta', () => {
    const filas = agruparCajaPorRuta([], [], undefined, [
      { rutaId: null, prestado: 900000 },
      { rutaId: 'r1', prestado: 10000 },
    ])
    // Primero que de verdad haya DOS filas: si solo saliera una, el
    // `[length - 1]` de abajo pasaría sin comprobar ningún orden.
    expect(filas).toHaveLength(2)
    expect(filas[filas.length - 1].sinRuta).toBe(true)
    // Y la de «sin ruta» va al final AUNQUE sea la que más movió.
    expect(filas[filas.length - 1].brutoPrestado).toBe(900000)
  })
})

// ── CAPITAL Y GASTOS POR RUTA ──────────────────────────────────────────────
//
// «Dinero en mano» = capital de la ruta − gastos. Es la cifra principal que
// pidió el dueño.
//
// Lo que se vigila aquí es lo que NO se puede hacer:
//   · `GastoMenor` no tiene rutaId. Solo se asigna si el cobrador lleva UNA
//     ruta; con varias no se reparte, se dice aparte.
//   · El capital NO se reconstruye: se lee `Ruta.saldoCapital`, que la app ya
//     mantiene. Reconstruirlo a mano da cifras absurdas ($2.501 millones donde
//     hay $14 millones) porque `ajusteArranqueRuta` cuenta para la ruta pero no
//     para el saldo global.
const capOK = (rutaId, saldo) => ({ rutaId, saldoCapital: saldo, capitalHabilitado: true })

describe('dinero en mano por ruta', () => {
  it('es capital menos gastos, y la resta se puede seguir', () => {
    const [f] = agruparCajaPorRuta([pago()], [], undefined, [],
      { porRuta: [capOK('r1', 3096800)], global: 3096800, enRutas: 3096800, sinAsignar: 0, negativas: 0 },
      { porRuta: [{ rutaId: 'r1', gastado: 47000 }], ambiguos: 0, sinCobrador: 0 })
    expect(f.enMano).toContain('3.049.800')   // 3.096.800 − 47.000
    expect(f.capital).toContain('3.096.800')
    expect(f.gastos).toContain('47.000')
  })

  it('sin capital propio NO se pinta un cero: es otra cosa', () => {
    // La ruta sin capital propio tiene su plata en la bolsa global. Un «$0»
    // ahí se leería como «esta ruta no tiene nada», que es mentira.
    const [f] = agruparCajaPorRuta([pago()], [], undefined, [],
      { porRuta: [{ rutaId: 'r1', saldoCapital: 0, capitalHabilitado: false }],
        global: 500000, enRutas: 0, sinAsignar: 500000, negativas: 0 },
      { porRuta: [], ambiguos: 0, sinCobrador: 0 })
    expect(f.enMano).toBeNull()
    expect(f.capital).toBeNull()
  })

  it('con capital propio, un gasto de CERO sí se pinta', () => {
    // Forma parte de la resta: una resta con un sumando invisible no se sigue.
    const [f] = agruparCajaPorRuta([pago()], [], undefined, [],
      { porRuta: [capOK('r1', 100000)], global: 100000, enRutas: 100000, sinAsignar: 0, negativas: 0 },
      { porRuta: [], ambiguos: 0, sinCobrador: 0 })
    expect(f.gastos).toContain('0')
    expect(f.enMano).toContain('100.000')
  })

  it('el dinero en mano puede quedar NEGATIVO y se marca', () => {
    // Gastó más de lo que llevaba: es una señal, no un dato para esconder.
    const [f] = agruparCajaPorRuta([pago()], [], undefined, [],
      { porRuta: [capOK('r1', 30000)], global: 30000, enRutas: 30000, sinAsignar: 0, negativas: 0 },
      { porRuta: [{ rutaId: 'r1', gastado: 50000 }], ambiguos: 0, sinCobrador: 0 })
    expect(f.enManoNegativo).toBe(true)
    expect(f.enMano).toContain('20.000')
  })
})

describe('lo que no se puede asignar se DICE, no se reparte', () => {
  it('el capital sin ruta tiene su línea y explica la diferencia', () => {
    // Sin ella, la suma de las tarjetas parece que le falta plata al negocio.
    const filas = agruparCajaPorRuta([pago()], [], undefined, [],
      { porRuta: [capOK('r1', 5554155)], global: 14357755, enRutas: 5554155, sinAsignar: 8803600, negativas: 0 },
      null)
    const t = totalesCajaPorRuta(filas, undefined,
      { porRuta: [capOK('r1', 5554155)], global: 14357755, enRutas: 5554155, sinAsignar: 8803600, negativas: 0 },
      null)
    expect(t.capitalEnRutas).toContain('5.554.155')
    expect(t.capitalSinAsignar).toContain('8.803.600')
    expect(t.capitalGlobal).toContain('14.357.755')
  })

  it('las tres cifras del capital cuadran entre sí', () => {
    // en rutas + sin asignar = global. Si un día no da, es que el API cambió.
    const cap = { porRuta: [capOK('r1', 5554155)], global: 14357755, enRutas: 5554155, sinAsignar: 8803600, negativas: 0 }
    expect(cap.enRutas + cap.sinAsignar).toBe(cap.global)
  })

  it('el gasto de un cobrador con VARIAS rutas no se reparte', () => {
    const t = totalesCajaPorRuta([], undefined, null,
      { porRuta: [], ambiguos: 120000, sinCobrador: 0 })
    expect(t.gastosAmbiguos).toContain('120.000')
  })

  it('el gasto sin cobrador es del negocio, no de una ruta', () => {
    const t = totalesCajaPorRuta([], undefined, null,
      { porRuta: [], ambiguos: 0, sinCobrador: 4646000 })
    expect(t.gastosSinCobrador).toContain('4.646.000')
  })

  it('sin nada ambiguo, no se pintan esas líneas', () => {
    const t = totalesCajaPorRuta([], undefined, null,
      { porRuta: [{ rutaId: 'r1', gastado: 5000 }], ambiguos: 0, sinCobrador: 0 })
    expect(t.gastosAmbiguos).toBeNull()
    expect(t.gastosSinCobrador).toBeNull()
  })

  it('las sub-bolsas en negativo se cuentan para avisar', () => {
    const t = totalesCajaPorRuta([], undefined,
      { porRuta: [], global: 0, enRutas: 0, sinAsignar: 0, negativas: 28 }, null)
    expect(t.rutasEnNegativo).toBe(28)
  })
})

describe('la pantalla NO se queda vacía por la mañana', () => {
  it('una ruta con capital sale aunque hoy no se haya movido nada', () => {
    // El capital está ahí a las 8 de la mañana, antes de cobrar nada. Sin esto
    // la pestaña salía «todavía no hay cobros ni préstamos» con $3.096.800 de
    // capital sin enseñar. Es el mismo fallo del video: optimizar para el día
    // lleno y romper el vacío, que es cuando se abre la caja.
    const cap = {
      porRuta: [capOK('r1', 3096800)],
      global: 14357755, enRutas: 3096800, sinAsignar: 11260955, negativas: 0,
    }
    const filas = agruparCajaPorRuta([], [{ id: 'r1', nombre: 'Ruta Norte' }], undefined, [], cap,
      { porRuta: [{ rutaId: 'r1', gastado: 47000 }], ambiguos: 0, sinCobrador: 0 })
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Ruta Norte')
    expect(filas[0].bruto).toBe(0)              // no se cobró nada
    expect(filas[0].enMano).toContain('3.049.800')  // pero el capital SÍ se ve
    expect(totalesCajaPorRuta(filas, undefined, cap, null).hayAlgo).toBe(true)
  })

  it('sin capital y sin movimiento, sí está vacía', () => {
    const cap = { porRuta: [], global: 0, enRutas: 0, sinAsignar: 0, negativas: 0 }
    expect(agruparCajaPorRuta([], [], undefined, [], cap, null)).toHaveLength(0)
    expect(totalesCajaPorRuta([], undefined, cap, null).hayAlgo).toBe(false)
  })

  it('una ruta sin capital propio no se cuela en la lista', () => {
    // Solo `capitalHabilitado` genera fila: si no, su plata vive en la bolsa
    // global y la tarjeta no tendría nada que decir.
    const cap = {
      porRuta: [{ rutaId: 'r1', saldoCapital: 0, capitalHabilitado: false }],
      global: 500000, enRutas: 0, sinAsignar: 500000, negativas: 0,
    }
    expect(agruparCajaPorRuta([], [{ id: 'r1', nombre: 'Ruta Sur' }], undefined, [], cap, null))
      .toHaveLength(0)
  })
})
