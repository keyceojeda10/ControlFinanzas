// lib/__tests__/informe-contador.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Sería bueno tener un extracto de gastos contra utilidad y utilidades contra
//  capital recuperado, para quienes estamos cerca a topes de declarar y así
//  poder saber cuál es el capital recuperado y las utilidades obtenidas.»
//   — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
//
// ⚠ ESTE PAPEL VA AL CONTADOR. Es la única pantalla de esta app cuyo número sale
//   del negocio y entra en una declaración de impuestos. La forma de fallar no
//   es que reviente: es que dé una cifra creíble y equivocada, y nadie la
//   discuta hasta que la discuta la DIAN.
//
// Lo que estas pruebas cuidan, en orden de lo que costaría equivocarse:
//
//   1. Que la utilidad NO se calcule como «recaudado − gastos». Ese error ya se
//      cometió en analíticas: infló la ganancia 7,9 veces y escondió cinco
//      negocios que iban en pérdida.
//   2. Que el interés salga de la TABLA y no de la proporción. En «sobre saldo»
//      la proporción se queda un 64% corta.
//   3. Que un porcentaje que no se puede calcular salga vacío y no cero.
//   4. Que los meses se corten en Bogotá y no en UTC.

import { describe, it, expect } from 'vitest'
import { calcularContador, rangoDePeriodo, claveMes } from '@/lib/reportes/contador'

const d = (s) => new Date(s)
const VENTANA = { desde: d('2026-08-01T05:00:00Z'), hasta: d('2026-09-01T05:00:00Z') }

/* Un préstamo con tabla: presta 1.000.000, cobra 1.200.000 en dos cuotas de
   600.000 que reconocen 100.000 de interés cada una. */
const CON_TABLA = {
  montoPrestado: 1000000,
  totalAPagar: 1200000,
  modoInteres: 'lineal',
  cuotasAmortizacion: [
    { numeroPeriodo: 1, cuotaTotal: 600000, interes: 100000 },
    { numeroPeriodo: 2, cuotaTotal: 600000, interes: 100000 },
  ],
  pagos: [
    { montoPagado: 600000, fechaPago: d('2026-08-05T05:00:00Z') },
    { montoPagado: 600000, fechaPago: d('2026-08-20T05:00:00Z') },
  ],
}

describe('⚠ la utilidad no es lo recaudado menos los gastos', () => {
  const r = calcularContador({
    prestamos: [CON_TABLA],
    gastos: [{ monto: 50000, fecha: d('2026-08-10T05:00:00Z') }],
    ...VENTANA,
  })

  it('entraron 1.200.000, pero solo 200.000 son ganancia', () => {
    expect(r.recaudado).toBe(1200000)
    expect(r.interes).toBe(200000)
    // El millón que vuelve ya era suyo: es capital, no utilidad.
    expect(r.capitalRecuperado).toBe(1000000)
  })

  it('⚠ la utilidad son 150.000, NO 1.150.000', () => {
    expect(r.utilidad).toBe(150000)          // 200.000 de interés − 50.000 de gastos
    expect(r.utilidad).not.toBe(1150000)     // recaudado − gastos: el error de 7,9x
  })

  it('e interés + capital es exactamente lo que entró', () => {
    /* Si esto se separa, hay plata que no está en ningún lado del papel. */
    expect(r.interes + r.capitalRecuperado).toBe(r.recaudado)
  })

  it('los gastos son el 25% de la ganancia bruta', () => {
    expect(r.porcentajeGastos).toBe(25)
  })

  it('y la utilidad es el 15% del capital recuperado', () => {
    expect(r.utilidadSobreCapital).toBe(15)
  })
})

describe('⚠ el interés sale de la tabla, no de la proporción', () => {
  /* Un francés: la primera cuota es casi todo interés. Repartir a prorrata daría
     la misma cifra en las dos, y en el negocio de Rincón eso se quedaba un 64%
     corto — $141.889 contra $232.119 reales. */
  const SOBRE_SALDO = {
    montoPrestado: 1000000,
    totalAPagar: 1200000,
    modoInteres: 'saldo',
    cuotasAmortizacion: [
      { numeroPeriodo: 1, cuotaTotal: 600000, interes: 170000 },
      { numeroPeriodo: 2, cuotaTotal: 600000, interes: 30000 },
    ],
    pagos: [{ montoPagado: 600000, fechaPago: d('2026-08-05T05:00:00Z') }],
  }

  it('la primera cuota reconoce 170.000, no la fracción plana', () => {
    const r = calcularContador({ prestamos: [SOBRE_SALDO], gastos: [], ...VENTANA })
    expect(r.interes).toBe(170000)
    // La proporción del préstamo entero es (1.200.000−1.000.000)/1.200.000 =
    // 16,67%, que sobre 600.000 daría 100.000. Un 41% de menos.
    expect(r.interes).not.toBe(100000)
  })
})

describe('⚠ un porcentaje que no se puede calcular sale vacío, no en cero', () => {
  it('sin interés cobrado no hay «los gastos fueron el 0%»', () => {
    /* Escribir 0% en el papel que va al contador es peor que dejar el hueco:
       un cero se lee como un dato y este no lo es. */
    const r = calcularContador({
      prestamos: [],
      gastos: [{ monto: 80000, fecha: d('2026-08-10T05:00:00Z') }],
      ...VENTANA,
    })
    expect(r.interes).toBe(0)
    expect(r.porcentajeGastos).toBeNull()
    expect(r.utilidadSobreCapital).toBeNull()
    // Pero la pérdida SÍ se dice: gastó 80.000 y no cobró interés.
    expect(r.utilidad).toBe(-80000)
  })

  it('⚠ y el negocio sin gastos registrados da 0%, que sí es un dato', () => {
    /* Rincón no tiene ni un gasto registrado. Su informe dirá 0%, y eso es
       cierto: no es que falte el dato, es que no gastó nada anotado. Hay que
       decírselo al entregarle el informe. */
    const r = calcularContador({ prestamos: [CON_TABLA], gastos: [], ...VENTANA })
    expect(r.porcentajeGastos).toBe(0)
    expect(r.utilidad).toBe(r.interes)
  })
})

describe('⚠ los meses se cortan en Bogotá, no en UTC', () => {
  it('el 1 de agosto a las 02:00 de Bogotá todavía es julio en UTC', () => {
    /* 2026-08-01T02:00 en Bogotá es 2026-08-01T07:00Z. Con los métodos UTC
       crudos caería en agosto igual, así que el caso que separa es el otro: */
    expect(claveMes(d('2026-08-01T03:00:00Z'), 5)).toBe('2026-07')  // 31 jul, 22:00 en Bogotá
    expect(claveMes(d('2026-08-01T06:00:00Z'), 5)).toBe('2026-08')  // 1 ago, 01:00 en Bogotá
  })

  it('un pago de la medianoche no cambia de mes según la máquina', () => {
    /* Producción va en UTC y el portátil en Bogotá: con los métodos locales,
       este pago cae en un mes en una máquina y en otro en la otra, y el fallo
       es invisible en local. */
    const r = calcularContador({
      prestamos: [{
        ...CON_TABLA,
        pagos: [{ montoPagado: 600000, fechaPago: d('2026-08-01T04:00:00Z') }],
      }],
      gastos: [],
      desde: d('2026-07-01T05:00:00Z'),
      hasta: d('2026-09-01T05:00:00Z'),
    })
    expect(r.meses.map((m) => m.mes)).toEqual(['2026-07'])
  })

  it('el desglose por meses suma el total', () => {
    const r = calcularContador({
      prestamos: [CON_TABLA],
      gastos: [{ monto: 50000, fecha: d('2026-08-10T05:00:00Z') }],
      ...VENTANA,
    })
    expect(r.meses.reduce((a, m) => a + m.interes, 0)).toBe(r.interes)
    expect(r.meses.reduce((a, m) => a + m.gastos, 0)).toBe(r.gastos)
    expect(r.meses.reduce((a, m) => a + m.utilidad, 0)).toBe(r.utilidad)
  })
})

describe('los períodos van de primero de mes a primero de mes', () => {
  const ahora = d('2026-08-16T15:00:00Z')

  it('el mes es agosto entero', () => {
    const { desde, hasta } = rangoDePeriodo('mes', 5, ahora)
    expect(desde.toISOString()).toBe('2026-08-01T05:00:00.000Z')
    expect(hasta.toISOString()).toBe('2026-09-01T05:00:00.000Z')
  })

  it('el trimestre son los tres meses que acaban en este', () => {
    const { desde } = rangoDePeriodo('trimestre', 5, ahora)
    expect(desde.toISOString()).toBe('2026-06-01T05:00:00.000Z')
  })

  it('el año son los doce', () => {
    const { desde } = rangoDePeriodo('anio', 5, ahora)
    expect(desde.toISOString()).toBe('2025-09-01T05:00:00.000Z')
  })

  it('⚠ y el mes en curso va COMPLETO, hasta su último día', () => {
    /* Cortar en «hoy» daría un mes a medias sin decirlo, y el contador lo
       leería como el mes cerrado. */
    const { hasta } = rangoDePeriodo('mes', 5, d('2026-08-03T15:00:00Z'))
    expect(hasta.toISOString()).toBe('2026-09-01T05:00:00.000Z')
  })
})
