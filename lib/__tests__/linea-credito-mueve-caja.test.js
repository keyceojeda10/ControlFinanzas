// lib/__tests__/linea-credito-mueve-caja.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El módulo de líneas de crédito estaba **desconectado del libro de capital**.
// Medido en producción el 18 ago 2026:
//
//   · 6 desembolsos por $1.994.443 · CERO asientos de capital
//   · 1 pago por $150.000          · CERO asientos de capital
//   · ningún `referenciaTipo` mencionaba líneas
//
// Un negocio —EOFinancial Corp— tenía **$1.594.443 prestados por esta vía con
// la caja diciendo $3.870.043 sin descontarlos**: el 41% de lo que creía tener
// no estaba. La plata salía al cliente y el saldo no se enteraba.
//
// Comprobado contra el espejo tras el arreglo: desembolsar 100.000 baja la caja
// en 100.000 y cobrar 30.000 la sube en 30.000, con su asiento y el nombre del
// cliente dentro.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const desembolso = leer('app/api/lineas-credito/[id]/desembolso/route.js')
const pago = leer('app/api/lineas-credito/[id]/pago/route.js')

describe('⚠ el desembolso de línea sale de la caja', () => {
  it('asienta el movimiento', () => {
    expect(desembolso).toMatch(/registrarMovimientoCapital/)
    expect(desembolso).toMatch(/tipo: 'desembolso'/)
    expect(desembolso).toMatch(/referenciaTipo: 'linea_desembolso'/)
  })

  it('⚠ y va en la MISMA transacción que el desembolso', () => {
    /* Un desembolso guardado sin su asiento es exactamente el descuadre que se
       viene a arreglar: las dos cosas van juntas o no van. */
    const bloque = desembolso.slice(desembolso.indexOf('prisma.$transaction'))
    expect(desembolso).toMatch(/prisma\.\$transaction\(async \(tx\) =>/)
    expect(bloque).toMatch(/tx\.desembolsoLinea\.create/)
    expect(bloque).toMatch(/registrarMovimientoCapital\(tx/)
  })

  it('no frena a quien tiene la caja en rojo', () => {
    /* La línea ya tiene su propio freno —el cupo—. Quien presta con la caja en
       rojo tiene un problema de capital que no se arregla bloqueándole aquí. */
    expect(desembolso).toMatch(/permitirNegativo: true/)
  })
})

describe('⚠ el pago de línea entra a la caja', () => {
  it('asienta el recaudo con su cuenta', () => {
    expect(pago).toMatch(/tipo: 'recaudo'/)
    expect(pago).toMatch(/referenciaTipo: 'linea_pago'/)
    /* Con el método de pago va a «Movimientos por cuenta» y al cuadre del día. */
    expect(pago).toMatch(/metodoPago: metodoPago \|\| null/)
  })

  it('⚠ entra el monto ENTERO, no solo el capital', () => {
    /* A la caja entra lo que el cliente entregó; el reparto entre interés y
       capital es cuenta de la línea, no del efectivo. Asentando solo
       `montoACapital`, el interés se quedaría fuera de la caja para siempre. */
    /* ⚠ Se busca la LLAMADA (`registrarMovimientoCapital(tx`), no la palabra:
       la primera aparición es el `import`, y cortando ahí medía el encabezado
       del archivo. */
    const i = pago.indexOf('registrarMovimientoCapital(tx')
    const bloque = pago.slice(i, i + 420)
    expect(bloque).toMatch(/monto,/)
    expect(bloque).not.toMatch(/monto: montoACapital/)
  })

  it('y en la misma transacción', () => {
    const bloque = pago.slice(pago.indexOf('prisma.$transaction'))
    expect(bloque).toMatch(/tx\.pagoLinea\.create/)
    expect(bloque).toMatch(/registrarMovimientoCapital\(tx/)
  })
})

describe('⚠ el asiento dice a quién', () => {
  it('los dos traen el nombre del cliente', () => {
    /* «Desembolso de línea» a secas obliga a abrir la línea para saber a quién
       se le dio la plata, y el libro se lee para cuadrar la caja. */
    for (const [quien, src] of [['desembolso', desembolso], ['pago', pago]]) {
      expect(src, `${quien}: el asiento no dice de quién es`).toMatch(/linea\.cliente\?\.nombre/)
      expect(src, `${quien}: no pide el nombre a Prisma`).toMatch(/nombre: true/)
    }
  })
})
