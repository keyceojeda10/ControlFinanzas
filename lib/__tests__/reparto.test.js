// Una sola respuesta a «cuánto de lo cobrado es ganancia».
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// El reparto estaba escrito A MANO en NUEVE sitios: cuatro en SQL y cinco en
// JavaScript. Cuatro aplicaban la corrección por tabla y cinco no, así que la
// misma pregunta daba respuestas distintas en la misma pantalla.
//
// Sobre la cartera real, la diferencia entre las dos convenciones son
// $264.614.219 en «capital en la calle» — la cifra con la que el prestamista
// decide si puede prestar más.

import { describe, it, expect } from 'vitest'
import {
  METODO, metodoDe, repartirPagado, capitalEnCalle, interesGanado, porGanar, repartoSql,
} from '../dinero/reparto'

// El caso corriente de un gota a gota: $500.000 al 20%, 30 cobros de $20.000.
// A mitad de plazo, con la mitad pagada.
function aMitad(extra = {}) {
  return {
    montoPrestado: 500000,
    totalAPagar: 600000,
    totalPagado: 300000,
    modoInteres: 'fijo',
    pagos: [],
    ...extra,
  }
}

describe('el reparto proporcional', () => {
  /* La cifra que fija la convención elegida. `lib/__tests__/coherencia-dinero.test.js`
     documenta la contradicción; esta prueba fija cuál ganó. */
  it('cada peso lleva su parte: 5/6 capital, 1/6 interés', () => {
    const r = repartirPagado(aMitad())
    expect(r.capital).toBe(250000)
    expect(r.interes).toBe(50000)
    expect(r.metodo).toBe(METODO.PROPORCIONAL)
  })

  it('y por lo tanto quedan $250.000 en la calle, no $300.000', () => {
    // $300.000 es lo que daba la cascada. La diferencia sobre la cartera real
    // son $264.614.219.
    expect(capitalEnCalle(aMitad())).toBe(250000)
  })

  it('capital + interés es exactamente lo pagado', () => {
    for (const pagado of [0, 1, 12345, 300000, 599999, 600000]) {
      const r = repartirPagado(aMitad({ totalPagado: pagado }))
      expect(r.capital + r.interes, `con ${pagado} pagado`).toBe(pagado)
    }
  })

  it('sin pagos, todo el capital sigue en la calle', () => {
    expect(capitalEnCalle(aMitad({ totalPagado: 0 }))).toBe(500000)
    expect(interesGanado(aMitad({ totalPagado: 0 }))).toBe(0)
  })

  it('pagado del todo, no queda capital en la calle', () => {
    expect(capitalEnCalle(aMitad({ totalPagado: 600000 }))).toBe(0)
    expect(interesGanado(aMitad({ totalPagado: 600000 }))).toBe(100000)
  })
})

describe('LA IDENTIDAD que hasta ahora cuadraba de casualidad', () => {
  /* La ficha de ruta parte la cartera en «lo puesto» y «lo que falta por
     ganar». Con la fórmula vieja —Σ montoPrestado— en cuanto un cliente
     abonaba, «por ganar» salía NEGATIVO y la ruta que más cobraba era la que
     peor se veía. */
  it('capital en la calle + por ganar = lo que falta cobrar', () => {
    for (const pagado of [0, 100000, 300000, 450000, 600000]) {
      const p = aMitad({ totalPagado: pagado })
      const saldo = 600000 - pagado
      expect(capitalEnCalle(p) + porGanar(p), `con ${pagado} pagado`).toBe(saldo)
    }
  })

  it('«por ganar» nunca sale negativo', () => {
    for (const pagado of [0, 300000, 600000, 700000]) {
      expect(porGanar(aMitad({ totalPagado: pagado }))).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('cuando hay tabla, manda la tabla', () => {
  // Un decreciente: el interés del primer periodo se calcula sobre el saldo
  // completo y es mucho mayor que el del último. Repartir proporcionalmente lo
  // subestima — medido sobre 295 préstamos, en un 27,3%.
  function decreciente(totalPagado) {
    return {
      montoPrestado: 100000,
      totalAPagar: 130000,
      totalPagado,
      modoInteres: 'lineal',
      pagos: [],
      cuotasAmortizacion: [
        { numeroPeriodo: 1, capital: 25000, interes: 15000, cuotaTotal: 40000, pagado: 0, interesPagado: 0 },
        { numeroPeriodo: 2, capital: 25000, interes: 10000, cuotaTotal: 35000, pagado: 0, interesPagado: 0 },
        { numeroPeriodo: 3, capital: 25000, interes: 5000, cuotaTotal: 30000, pagado: 0, interesPagado: 0 },
        { numeroPeriodo: 4, capital: 25000, interes: 0, cuotaTotal: 25000, pagado: 0, interesPagado: 0 },
      ],
    }
  }

  it('usa el método de la tabla, no la proporción', () => {
    expect(metodoDe(decreciente(0))).toBe(METODO.TABLA)
    expect(repartirPagado(decreciente(40000)).metodo).toBe(METODO.TABLA)
  })

  it('la primera cuota lleva MUCHO más interés que la proporción', () => {
    // Con la tabla: la cuota 1 son $15.000 de interés de $40.000 pagados.
    expect(repartirPagado(decreciente(40000)).interes).toBe(15000)
    // Proporcionalmente habrían sido 40.000 × (30.000/130.000) = $9.231.
    // Casi $6.000 menos de ganancia reconocida en un solo pago.
  })

  it('y capital + interés sigue siendo lo pagado', () => {
    for (const pagado of [0, 40000, 75000, 105000, 130000]) {
      const r = repartirPagado(decreciente(pagado))
      expect(r.capital + r.interes, `con ${pagado}`).toBe(pagado)
    }
  })
})

describe('los abonos a capital van directos, sin repartirse', () => {
  /* El prestamista dijo «esto es capital». Repartirlo sería contradecirle — y
     es el fallo que ya está documentado: un abono a capital se repartía primero
     en intereses y casi no bajaba el capital. */
  it('un abono a capital baja el capital entero', () => {
    const p = aMitad({
      totalPagado: 300000,
      pagos: [{ tipo: 'capital', montoPagado: 100000 }],
    })
    const r = repartirPagado(p)
    // De los $300.000, cien mil son abono directo. Los otros $200.000 se
    // reparten: 5/6 capital.
    expect(r.capital).toBe(100000 + Math.round(200000 * (500000 / 600000)))
    expect(r.interes).toBe(200000 - Math.round(200000 * (500000 / 600000)))
  })
})

describe('el SQL dice lo MISMO que el JavaScript', () => {
  /* Analíticas, el PDF y el reparto a socios agregan en la base con `SUM(...)`.
     Traer miles de filas a JavaScript sería absurdo, pero tener la fórmula
     escrita dos veces es como empezó todo esto. Esta prueba evalúa la expresión
     SQL con números y exige que coincida. */
  const evaluarSql = (expr, { montoPagado, totalAPagar, montoPrestado }) => {
    const js = expr
      .replace(/CASE WHEN (.+?) THEN (.+?) ELSE (.+?) END/, '($1) ? ($2) : ($3)')
      .replace(/pr\./g, 'PR_').replace(/p\./g, 'P_')
    // eslint-disable-next-line no-new-func
    return new Function('P_montoPagado', 'PR_totalAPagar', 'PR_montoPrestado',
      `return ${js}`)(montoPagado, totalAPagar, montoPrestado)
  }

  it('el interés sale igual por los dos caminos', () => {
    const sql = repartoSql()
    for (const pagado of [10000, 300000, 600000]) {
      const enJs = repartirPagado(aMitad({ totalPagado: pagado })).interes
      const enSql = evaluarSql(sql.interes, { montoPagado: pagado, totalAPagar: 600000, montoPrestado: 500000 })
      expect(Math.round(enSql), `con ${pagado} pagado`).toBe(enJs)
    }
  })

  it('y el capital también', () => {
    const sql = repartoSql()
    for (const pagado of [10000, 300000, 600000]) {
      const enJs = repartirPagado(aMitad({ totalPagado: pagado })).capital
      const enSql = evaluarSql(sql.capital, { montoPagado: pagado, totalAPagar: 600000, montoPrestado: 500000 })
      expect(Math.round(enSql), `con ${pagado} pagado`).toBe(enJs)
    }
  })

  it('con totalAPagar en cero no divide entre cero', () => {
    const sql = repartoSql()
    expect(evaluarSql(sql.interes, { montoPagado: 1000, totalAPagar: 0, montoPrestado: 0 })).toBe(0)
  })
})
