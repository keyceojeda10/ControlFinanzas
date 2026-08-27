// lib/__tests__/las-dos-pantallas-parten-igual-el-peso.test.js
//
// ══ «AQUÍ ME SALE UN VALOR Y EN EL REPORTE OTRO» ═══════════════════════════
//
// 27 de agosto de 2026. El mismo negocio, el mismo mes, el mismo recaudado
// ($8.821.300), y dos pantallas que lo parten distinto:
//
//     Analíticas          ganancia $3.230.648 · capital $5.590.652
//     Informe contador    interés  $2.500.993 · capital $6.320.307
//                                  ────────────
//                         difieren  $  729.655, y la misma cifra al revés
//                                   en el capital: es un problema de REPARTO,
//                                   no de cuánto entró.
//
// «Eso me tiene confundido.»
//
// LA CAUSA, y es mía: el 26 de agosto arreglé `interesPagoAPago` —un abono a
// capital es 100 % capital, un pago de solo interés es 100 % interés, y el
// interés reconocido no puede pasar del que existe— y NO arreglé la corrección
// de analíticas, que seguía repartiendo por la tabla. Antes las dos estaban
// igual de mal y coincidían; al arreglar una, divergieron. Es el «arreglé una
// vía y dejé la otra» que este repo ya pagó con el comprobante.
//
// Medido préstamo a préstamo sobre los 104 de ese negocio: **15 divergían,
// $760.764, y TODOS tenían pagos declarados como abono a capital.**
//
// ⚠ Y LA CORRECCIÓN RESTABA MAL. Analíticas reparte en SQL por velocidad y
// luego corrige en JavaScript; esa corrección tiene que restar EXACTAMENTE lo
// que el SQL puso, y restaba «monto × fracción» a secas. Para un abono a
// capital el SQL ya había puesto CERO, así que la resta se pasaba.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { interesProporcionalDelPago, fraccionInteres, techoDeInteres } from '@/lib/dinero/reparto'
import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('el gemelo en JS del reparto SQL', () => {
  /* Comprobado contra el SQL DE VERDAD sobre los 43 préstamos con pagos en
     agosto de ese negocio: $1.906.018 los dos, 0 divergencias. */
  const conTabla = {
    montoPrestado: 900_000, totalAPagar: 1_206_973, modoInteres: 'saldo',
    cuotasAmortizacion: [{ numeroPeriodo: 1, cuotaTotal: 85_200, interes: 40_000 }],
    pagos: [],
  }
  const sinTabla = {
    montoPrestado: 200_000, totalAPagar: 240_000, modoInteres: 'fijo',
    cuotasAmortizacion: [],
    pagos: [{ tipo: 'intereses', montoPagado: 40_000 }],
  }

  it('un abono a capital es 100 % capital: cero interés', () => {
    expect(interesProporcionalDelPago(conTabla, { tipo: 'capital', montoPagado: 100_000 })).toBe(0)
  })

  it('un pago de solo interés es 100 % interés', () => {
    expect(interesProporcionalDelPago(conTabla, { tipo: 'intereses', montoPagado: 50_000 })).toBe(50_000)
  })

  it('un pago corriente va por la fracción del préstamo', () => {
    const esperado = 100_000 * fraccionInteres(conTabla)
    expect(interesProporcionalDelPago(conTabla, { tipo: 'completo', montoPagado: 100_000 })).toBeCloseTo(esperado, 6)
  })

  it('⚠ SIN tabla, el interés cobrado aparte se saca del total pactado', () => {
    /* Sin esta resta, cobrar interés aparte sube `totalAPagar` y los pagos
       VIEJOS se vuelven a repartir con la fracción nueva. Es la misma condición
       que el `NOT EXISTS (... CuotaAmortizacion ...)` del SQL. */
    const pactado = 240_000 - 40_000            // le quitó los 40.000 de interés suelto
    const esperado = 60_000 * ((pactado - 200_000) / pactado)
    expect(interesProporcionalDelPago(sinTabla, { tipo: 'completo', montoPagado: 60_000 })).toBeCloseTo(esperado, 6)
  })

  it('CON tabla no se saca: ahí el interés suelto no sube el total', () => {
    const conSuelto = { ...conTabla, pagos: [{ tipo: 'intereses', montoPagado: 40_000 }] }
    expect(interesProporcionalDelPago(conSuelto, { tipo: 'completo', montoPagado: 100_000 }))
      .toBeCloseTo(interesProporcionalDelPago(conTabla, { tipo: 'completo', montoPagado: 100_000 }), 6)
  })

  it('un préstamo sin total pactado no reparte interés', () => {
    const roto = { montoPrestado: 100_000, totalAPagar: 0, cuotasAmortizacion: [], pagos: [] }
    expect(interesProporcionalDelPago(roto, { tipo: 'completo', montoPagado: 50_000 })).toBe(0)
  })
})

describe('el préstamo donde prestó $900.000 y le devolvieron $900.000', () => {
  /* Su tabla sigue con el calendario viejo y suma $306.973 de interés, pero al
     liquidar se lo perdonó entero: `totalAPagar` bajó a los $900.000 exactos.
     Ganancia real: cero. */
  const jose = {
    montoPrestado: 900_000, totalAPagar: 900_000, modoInteres: 'saldo',
    cuotasAmortizacion: [
      { numeroPeriodo: 1, cuotaTotal: 85_200, interes: 40_000 },
      { numeroPeriodo: 2, cuotaTotal: 85_200, interes: 37_740 },
      { numeroPeriodo: 3, cuotaTotal: 85_200, interes: 35_367 },
    ],
    pagos: [
      { tipo: 'capital', montoPagado: 100_000, fechaPago: '2026-08-14T12:00:00Z' },
      { tipo: 'completo', montoPagado: 800_000, fechaPago: '2026-08-26T12:00:00Z' },
    ],
  }

  it('el reparto bueno no le encuentra ni un peso de ganancia', () => {
    const filas = interesPagoAPago({ prestamo: jose, cuotas: jose.cuotasAmortizacion, pagos: jose.pagos })
    expect(filas.reduce((a, f) => a + f.interes, 0)).toBe(0)
    expect(techoDeInteres(jose)).toBe(0)
  })

  it('y el proporcional del SQL tampoco, porque los dos tipos están declarados', () => {
    expect(interesProporcionalDelPago(jose, jose.pagos[0])).toBe(0)
    // El «completo» va por la fracción, que aquí es cero: no hay interés pactado.
    expect(interesProporcionalDelPago(jose, jose.pagos[1])).toBe(0)
  })

  it('⚠ y la corrección de analíticas, que es la resta de los dos, sale cero', () => {
    /* Antes salía +$295.053: la tabla vieja repartía interés sobre un préstamo
       en el que no se ganó nada, y la resta usaba «monto × fracción» en vez de
       lo que el SQL puso de verdad. */
    const filas = interesPagoAPago({ prestamo: jose, cuotas: jose.cuotasAmortizacion, pagos: jose.pagos })
    const correccion = jose.pagos.reduce(
      (a, p, i) => a + (filas[i].interes - interesProporcionalDelPago(jose, p)), 0)
    expect(Math.round(correccion)).toBe(0)
  })
})

describe('un abono a capital no consume cuotas de la tabla', () => {
  it('el cursor NO avanza con él, así que los pagos siguientes no pierden su interés', () => {
    /* El código viejo hacía `acumulado += pago.montoPagado` con TODOS los pagos.
       Con un abono a capital por delante, consumía las cuotas de interés alto y
       a los pagos corrientes les quedaba poco. Medido en un negocio: un Globo
       pasaba de $485.294 a $1.217.647 de interés reconocido, y el segundo es el
       correcto. */
    const p = {
      montoPrestado: 1_000_000, totalAPagar: 2_200_000, modoInteres: 'solo_interes',
      cuotasAmortizacion: [
        { numeroPeriodo: 1, cuotaTotal: 200_000, interes: 200_000 },
        { numeroPeriodo: 2, cuotaTotal: 200_000, interes: 200_000 },
      ],
      pagos: [
        { tipo: 'capital', montoPagado: 300_000, fechaPago: '2026-08-01T12:00:00Z' },
        { tipo: 'completo', montoPagado: 200_000, fechaPago: '2026-08-10T12:00:00Z' },
      ],
    }
    const filas = interesPagoAPago({ prestamo: p, cuotas: p.cuotasAmortizacion, pagos: p.pagos })
    expect(filas[0].interes).toBe(0)          // el abono: 100 % capital
    expect(filas[0].capital).toBe(300_000)
    expect(filas[1].interes).toBe(200_000)    // el corriente estrena la cuota 1
  })
})

describe('las dos pantallas beben de las mismas funciones', () => {
  const api = leer('app/api/dashboard/analiticas/route.js')

  it('la corrección usa `interesPagoAPago`, la misma del informe del contador', () => {
    expect(api).toContain('const filas = interesPagoAPago({ prestamo, cuotas, pagos })')
    expect(api).not.toContain('interesDelPagoSegunTabla(cuotas, acumulado')
  })

  it('y resta lo que el SQL puso de verdad, no «monto × fracción»', () => {
    expect(api).toContain('const segunProporcion = interesProporcionalDelPago(prestamo, pago)')
  })

  it('corrige también los que llevan pagos declarados, tengan tabla o no', () => {
    expect(api).toContain("{ pagos: { some: { tipo: { in: ['capital', 'intereses'] } } } },")
  })

  it('⚠ y pide el `modoInteres`, sin el cual el reparto se equivoca en silencio', () => {
    const i = api.indexOf('modoInteres: { in: MODOS_CON_TABLA }, cuotasAmortizacion: { some: {} }')
    expect(api.slice(i, i + 900)).toContain('modoInteres: true,')
  })

  it('y el `tipo` de cada pago, que es lo que manda', () => {
    expect(api).toContain('select: { montoPagado: true, fechaPago: true, tipo: true },')
  })
})
