// lib/__tests__/reserva-de-ruta-no-es-caja.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Inversiones L&D mandó la captura de su caja del 15 de agosto y un «¿qué pasa
// aquí?»:
//
//     Con lo que amaneciste   $1.000.000
//     Lo que entró          + $2.952.000
//     Lo que prestaste      − $4.150.000
//     ⚠ Hoy la cuenta no cierra: $1.200.000 sin explicación
//     SALDO EN CAJA           $1.002.000
//
// Reconstruido contra su base: ese día prestó **$2.950.000**, no $4.150.000.
// Los $1.200.000 de diferencia son DOS asientos de $600.000 con la descripción
// «Reserva de capital por préstamo de cliente asignado a la ruta», que salen al
// asignar clientes a una ruta con capital (`app/api/rutas/[id]/clientes`).
// Llevan `ajusteArranqueRuta` y mueven la bolsa de la RUTA, no la caja: en el
// propio asiento, `saldoAnterior` y `saldoNuevo` son idénticos.
//
// ⚠ Y LA CONCILIACIÓN TENÍA RAZÓN. Los $1.200.000 que denunciaba como «sin
//   explicación» eran exactamente esos dos asientos. El que estaba mal era el
//   renglón de arriba, no el aviso. Esa es la regla de oro de este módulo
//   funcionando: el residuo no se sumó al saldo, se enseñó.
//
// Lo que estas pruebas cuidan:
//
//   1. Que un asiento que no mueve el saldo vuelva a contarse como plata que
//      salió. Son 4 rutas de la app las que leen esto.
//   2. Que la comprobación se haga solo con NÚMEROS. Un `select` sin los
//      saldos los deja en `undefined`, y `undefined === undefined` escondería
//      TODOS los movimientos sin dar un solo error.

import { describe, it, expect } from 'vitest'
import { afectaCaja, resumirLibro, conciliar, lineasDeLaBanda, ALCANCE } from '@/lib/dinero/conciliacion'

const asiento = (c) => ({
  tipo: 'desembolso', monto: 0, saldoAnterior: 0, saldoNuevo: 0,
  descripcion: '', metodoPago: null, createdAt: new Date('2026-08-15T15:00:00Z'), ...c,
})

describe('⚠ un asiento que deja el saldo donde estaba no movió efectivo', () => {
  it('la reserva de capital de una ruta no cuenta como plata que salió', () => {
    expect(afectaCaja(asiento({
      monto: 600000, saldoAnterior: 1362000, saldoNuevo: 1362000,
      descripcion: 'Reserva de capital por préstamo de cliente asignado a la ruta',
    }))).toBe(false)
  })

  it('un desembolso de verdad sí cuenta', () => {
    expect(afectaCaja(asiento({
      monto: 500000, saldoAnterior: 1862000, saldoNuevo: 1362000,
      descripcion: 'Desembolso préstamo a Nancy Molina',
    }))).toBe(true)
  })

  it('⚠ sin los saldos en el select, NO se esconde nada', () => {
    /* `undefined === undefined` es `true`: sin esta guarda, una consulta que no
       pidiera los saldos habría dejado la caja entera en cero, en silencio. */
    expect(afectaCaja({ descripcion: 'Pago recibido - préstamo' })).toBe(true)
    expect(afectaCaja({})).toBe(true)
    expect(afectaCaja({ saldoAnterior: 100 })).toBe(true)
    expect(afectaCaja({ saldoNuevo: 100 })).toBe(true)
  })
})

describe('el día 15 de Inversiones L&D, al peso', () => {
  /* Su día real, recortado a lo que decide: los cobros como una sola entrada,
     sus cuatro desembolsos de verdad y las dos reservas. */
  const movimientos = [
    asiento({ tipo: 'recaudo', monto: 2952000, saldoAnterior: 1000000, saldoNuevo: 3952000, descripcion: 'Pago recibido - préstamo' }),
    asiento({ monto: 150000,  saldoAnterior: 3952000, saldoNuevo: 3802000, descripcion: 'Desembolso préstamo a Mirian' }),
    asiento({ monto: 200000,  saldoAnterior: 3802000, saldoNuevo: 3602000, descripcion: 'Desembolso préstamo a Arelis' }),
    asiento({ monto: 600000,  saldoAnterior: 3602000, saldoNuevo: 3002000, descripcion: 'Desembolso préstamo a Isabel' }),
    asiento({ monto: 1000000, saldoAnterior: 3002000, saldoNuevo: 2002000, descripcion: 'Desembolso préstamo a Julio' }),
    asiento({ monto: 500000,  saldoAnterior: 2002000, saldoNuevo: 1502000, descripcion: 'Desembolso préstamo a Nancy' }),
    asiento({ monto: 600000,  saldoAnterior: 1502000, saldoNuevo: 1502000, descripcion: 'Reserva de capital por préstamo de cliente asignado a la ruta' }),
    asiento({ monto: 500000,  saldoAnterior: 1502000, saldoNuevo: 1002000, descripcion: 'Desembolso préstamo a Mileidys' }),
    asiento({ monto: 600000,  saldoAnterior: 1002000, saldoNuevo: 1002000, descripcion: 'Reserva de capital por préstamo de cliente asignado a la ruta' }),
  ]

  const libro = resumirLibro(movimientos, null)

  it('lo prestado son $2.950.000, no $4.150.000', () => {
    expect(libro.desembolsos).toBe(2950000)
  })

  it('las dos reservas se cuentan aparte, con su nombre', () => {
    expect(libro.sinEfectoCantidad).toBe(2)
    expect(libro.sinEfecto).toBe(1200000)
  })

  it('⚠ la banda CUADRA y no queda nada sin explicación', () => {
    const conc = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro,
      operaciones: { pagos: 2952000, pagosEfectivo: 1652000, pagosDigital: 1300000, gastos: 0, desembolsos: 2950000 },
      esperado: { esperado: 0, atrasado: 0 },
    })
    expect(conc.diferencias.sinExplicar, 'volvió a quedar plata sin explicar').toBe(0)

    const banda = lineasDeLaBanda(conc)
    expect(banda.cuadra, `la banda suma ${banda.suma} y el saldo dice ${banda.saldo}`).toBe(true)
    expect(banda.saldo).toBe(1002000)
  })
})
