// lib/__tests__/anular-un-cobro-no-descuadra.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Oswaldo Castilla (Inversiones L&D), 22 ago 2026, con su caja del día:
//
//     Correcciones            − $60.000
//     ⚠ Hoy la cuenta no cierra: $60.000 asentados de más.
//
// «No sabe por qué le sale ese valor de corrección de menos sesenta mil.»
//
// A las 9:42 registró un cobro de $60.000 y a las 9:44 lo anuló. El libro
// conserva el cobro —es el rastro— y le pone encima el reverso; la fila del pago
// desaparece. La conciliación comparaba 45 asientos contra 44 pagos vivos.
//
// ⚠ Y ES EL MISMO FALLO QUE ÉL YA HABÍA REPORTADO EL 16 DE AGOSTO con los
//   gastos, arreglado entonces con `esReversoDeGasto`. Arreglar una vía y dejar
//   la otra es lo que costó dos días con el comprobante; estas pruebas fijan las
//   DOS.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resumirLibro, conciliar, esReversoDePago, esReversoDeGasto, afectaCaja } from '@/lib/dinero/conciliacion'

// Un asiento con sus dos fotos de saldo, que es como los guarda la base.
function asiento(saldo, { tipo, monto, entra, ...resto }) {
  return {
    tipo, monto,
    saldoAnterior: saldo,
    saldoNuevo: entra ? saldo + monto : saldo - monto,
    createdAt: resto.createdAt ?? '2026-08-22T14:00:00.000Z',
    ...resto,
  }
}

describe('el día de Inversiones L&D, al peso', () => {
  /* Sus cifras reales: amaneció con $1.000.000, entraron $3.759.000 en 45
     asientos, salieron $2.400.000 en préstamos y se anuló un cobro de $60.000.
     El saldo que enseñaba la pantalla era $2.299.000, y estaba bien. */
  const movimientos = [
    asiento(1000000, { tipo: 'recaudo', monto: 3699000, entra: true, referenciaTipo: 'pago', createdAt: '2026-08-22T13:00:00.000Z' }),
    asiento(4699000, { tipo: 'recaudo', monto: 60000, entra: true, referenciaTipo: 'pago', createdAt: '2026-08-22T14:42:00.000Z' }),
    asiento(4759000, { tipo: 'ajuste', monto: 60000, entra: false, referenciaTipo: 'pago', descripcion: 'Reverso pago anulado - préstamo', createdAt: '2026-08-22T14:44:00.000Z' }),
    asiento(4699000, { tipo: 'desembolso', monto: 2400000, entra: false, referenciaTipo: 'prestamo', createdAt: '2026-08-22T16:37:00.000Z' }),
  ]
  const libro = resumirLibro(movimientos, 1000000)

  it('el saldo del día sigue siendo el que enseñaba: $2.299.000', () => {
    expect(libro.cierre).toBe(2299000)
  })

  it('«Lo que entró» dice lo mismo que la lista de movimientos de abajo', () => {
    /* Era el otro síntoma, el que se ve sin leer el aviso: arriba $3.759.000 y
       la lista de abajo sumando $3.699.000. */
    expect(libro.recaudo).toBe(3699000)
  })

  it('y «Correcciones» queda en cero, porque nadie corrigió nada a mano', () => {
    expect(libro.ajustes).toBe(0)
  })

  it('⚠ la alarma se apaga: ya no hay $60.000 «asentados de más»', () => {
    const c = conciliar({
      alcance: 'organizacion',
      libro,
      // 44 pagos vivos: el anulado ya no está en la tabla.
      operaciones: { pagos: 3699000, pagosEfectivo: 2309000, pagosDigital: 1390000, gastos: 0, desembolsos: 2400000 },
    })
    expect(c.diferencias.recaudo, 'sigue comparando 45 asientos contra 44 pagos').toBe(0)
    expect(c.diferencias.sinExplicar).toBe(0)
    expect(c.cuadra).toBe(true)
  })
})

describe('⚠ el cubo del que sale es el de la cuenta por la que entró', () => {
  it('anular un cobro por Nequi no le baja el efectivo al cobrador', () => {
    /* Sin esto, el reverso iba sin cuenta y el libro lo daba por efectivo: le
       dejaba al cobrador un faltante de caja que no existía. */
    const movs = [
      asiento(0, { tipo: 'recaudo', monto: 100000, entra: true, referenciaTipo: 'pago', metodoPago: 'transferencia' }),
      asiento(100000, { tipo: 'ajuste', monto: 100000, entra: false, referenciaTipo: 'pago', metodoPago: 'transferencia', descripcion: 'Reverso pago anulado - préstamo' }),
    ]
    const l = resumirLibro(movs, 0)
    expect(l.recaudoEfectivo, 'se lo restó al efectivo').toBe(0)
    expect(l.recaudoDigital).toBe(0)
    expect(l.recaudo).toBe(0)
  })

  it('y el reverso de un cobro en efectivo sí baja del efectivo', () => {
    const movs = [
      asiento(0, { tipo: 'recaudo', monto: 100000, entra: true, referenciaTipo: 'pago', metodoPago: 'efectivo' }),
      asiento(100000, { tipo: 'ajuste', monto: 100000, entra: false, referenciaTipo: 'pago', metodoPago: 'efectivo', descripcion: 'Reverso pago anulado - préstamo' }),
    ]
    const l = resumirLibro(movs, 0)
    expect(l.recaudoEfectivo).toBe(0)
    expect(l.recaudoDigital).toBe(0)
  })

  it('el API copia la cuenta del pago que anula', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/pagos/[id]/route.js'), 'utf8')
    const bloque = src.slice(src.indexOf('Reverso pago anulado'), src.indexOf('Reverso pago anulado') + 700)
    expect(bloque).toMatch(/metodoPago: pago\.metodoPago \|\| null/)
    expect(bloque).toMatch(/metodoPagoId: pago\.metodoPagoId \|\| null/)
  })
})

describe('⚠ las DOS vías del mismo fallo, no una', () => {
  it('gasto anulado y cobro anulado se reconocen igual: por la referencia', () => {
    expect(esReversoDeGasto({ tipo: 'ajuste', referenciaTipo: 'gasto' })).toBe(true)
    expect(esReversoDePago({ tipo: 'ajuste', referenciaTipo: 'pago' })).toBe(true)
  })

  it('un ajuste de verdad sigue siendo un ajuste', () => {
    // El que el prestamista mete a mano: no tiene referencia a nada.
    expect(esReversoDePago({ tipo: 'ajuste', referenciaTipo: null })).toBe(false)
    const l = resumirLibro([
      asiento(0, { tipo: 'ajuste', monto: 50000, entra: false, referenciaTipo: null, descripcion: 'Corrección de caja' }),
    ], 0)
    expect(l.ajustes).toBe(-50000)
    expect(l.recaudo).toBe(0)
  })

  it('el reverso de un DESCUENTO no llega a tocar el recaudo', () => {
    /* Se queda fuera antes, en `afectaCaja`: un descuento baja la cartera, no la
       bolsa, y restarlo del recaudo sería inventar plata que nunca entró. */
    expect(afectaCaja({ descripcion: 'Reverso descuento anulado - préstamo' })).toBe(false)
    const l = resumirLibro([
      asiento(0, { tipo: 'recaudo', monto: 100000, entra: true, referenciaTipo: 'pago', metodoPago: 'efectivo' }),
      asiento(100000, { tipo: 'ajuste', monto: 30000, entra: true, referenciaTipo: 'pago', descripcion: 'Reverso descuento anulado - préstamo' }),
    ], 0)
    expect(l.recaudo).toBe(100000)
  })
})
