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
  fraccionInteres, capitalPerdido,
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

describe('cobró MENOS de lo que prestó: eso no es interés negativo', () => {
  /* 850 préstamos en producción tienen `totalAPagar < montoPrestado`, y 758 de
     ellos con `totalPagado == totalAPagar`: se cerraron reescribiendo el total
     hacia abajo hasta lo cobrado. Prestó $1.500.000, recogió $900.000.

     El SQL repartía una fracción NEGATIVA y metía −$118.964.543 de «interés» en
     la ganancia; el JS mandaba el pago entero a capital y la pérdida no salía
     por ningún lado. Aquí la fracción se acota y el faltante tiene rótulo. */
  const cerradoEnPerdida = {
    montoPrestado: 1500000,
    totalAPagar: 900000,
    totalPagado: 900000,
    modoInteres: 'fijo',
    pagos: [],
  }

  it('no reconoce interés donde no lo hubo', () => {
    expect(fraccionInteres(cerradoEnPerdida)).toBe(0)
    expect(repartirPagado(cerradoEnPerdida).interes).toBe(0)
  })

  it('todo lo cobrado es capital volviendo', () => {
    expect(repartirPagado(cerradoEnPerdida).capital).toBe(900000)
  })

  it('y los $600.000 que faltan tienen nombre propio', () => {
    expect(capitalPerdido(cerradoEnPerdida)).toBe(600000)
  })

  it('un préstamo normal no pierde nada', () => {
    expect(capitalPerdido(aMitad())).toBe(0)
    expect(capitalPerdido({ montoPrestado: 500000, totalAPagar: 500000 })).toBe(0)
  })

  it('la fracción nunca se sale de [0, 1]', () => {
    // totalAPagar en cero: ni interés ni división entre cero.
    expect(fraccionInteres({ montoPrestado: 100000, totalAPagar: 0 })).toBe(0)
    // Sin capital prestado (dato incompleto), no se reconoce el 100% de interés
    // por accidente... salvo que de verdad no haya capital, y ahí es 1.
    expect(fraccionInteres({ montoPrestado: 0, totalAPagar: 100000 })).toBe(1)
    expect(fraccionInteres(null)).toBe(0)
  })
})

describe('sin totalAPagar, la plata cobrada NO se evapora', () => {
  /* 56 préstamos con `totalAPagar <= 0` y 8 pagos por $793.000. El fragmento
     SQL devolvía capital CERO para ellos: esos $793.000 no aparecían ni como
     interés ni como capital en analíticas. El JS sí los contaba. */
  const sinTotal = { montoPrestado: 100000, totalAPagar: 0, totalPagado: 50000, pagos: [] }

  it('todo cuenta como capital recuperado', () => {
    const r = repartirPagado(sinTotal)
    expect(r.interes).toBe(0)
    expect(r.capital).toBe(50000)
  })
})

describe('el SQL dice lo MISMO que el JavaScript', () => {
  /* Analíticas, el PDF y el reparto a socios agregan en la base con `SUM(...)`.
     Traer miles de filas a JavaScript sería absurdo, pero tener la fórmula
     escrita dos veces es como empezó todo esto. Esta prueba evalúa la expresión
     SQL con números y exige que coincida. */
  const evaluarSql = (expr, { montoPagado, totalAPagar, montoPrestado, tipo = 'completo', cobradoDeInteres = 0 }) => {
    const js = expr
      // La subconsulta que suma los pagos de solo interés no se puede ejecutar
      // aquí —no hay base—, así que se sustituye por el valor del caso. Lo que
      // esta prueba compara sigue siendo la FÓRMULA de verdad, incluida la resta
      // que evita que subir `totalAPagar` reparta otra vez los pagos viejos.
      .replace(
        /COALESCE\(\(SELECT SUM\(pi\.montoPagado\) FROM Pago pi WHERE pi\.prestamoId = pr\.id AND pi\.tipo = 'intereses'\), 0\)/g,
        String(cobradoDeInteres),
      )
      // DOS `WHEN` desde que el pago etiquetado como interés no se reparte. El
      // traductor sólo entendía uno y el `CASE` entero se colaba crudo al
      // `new Function`, que reventaba con «Unexpected identifier 'WHEN'».
      .replace(
        /CASE WHEN (.+?) THEN (.+?) WHEN (.+?) THEN (.+?) ELSE (.+?) END/g,
        '(($1) ? ($2) : (($3) ? ($4) : ($5)))',
      )
      .replace(/CASE WHEN (.+?) THEN (.+?) ELSE (.+?) END/g, '(($1) ? ($2) : ($3))')
      .replace(/GREATEST\(/g, 'Math.max(')
      .replace(/LEAST\(/g, 'Math.min(')
      .replace(/=/g, '===')
      .replace(/>===/g, '>=').replace(/<===/g, '<=')
      .replace(/pr\./g, 'PR_').replace(/p\./g, 'P_')
    // eslint-disable-next-line no-new-func
    return new Function('P_montoPagado', 'PR_totalAPagar', 'PR_montoPrestado', 'P_tipo',
      `return ${js}`)(montoPagado, totalAPagar, montoPrestado, tipo)
  }

  /* Los tres casos que separaban a las copias entre sí. Si alguien vuelve a
     escribir el reparto a mano en un `$queryRaw`, esta tabla es la que dice qué
     tenía que haber contestado. */
  const CASOS = [
    { nombre: 'normal',            montoPagado: 10000,  totalAPagar: 600000, montoPrestado: 500000 },
    { nombre: 'normal, la mitad',  montoPagado: 300000, totalAPagar: 600000, montoPrestado: 500000 },
    { nombre: 'normal, completo',  montoPagado: 600000, totalAPagar: 600000, montoPrestado: 500000 },
    { nombre: 'cerrado en pérdida', montoPagado: 900000, totalAPagar: 900000, montoPrestado: 1500000 },
    { nombre: 'sin totalAPagar',   montoPagado: 50000,  totalAPagar: 0,      montoPrestado: 100000 },
  ]

  it('interés y capital coinciden en los tres casos, no solo en el fácil', () => {
    const sql = repartoSql()
    for (const c of CASOS) {
      const enJs = repartirPagado({
        montoPrestado: c.montoPrestado, totalAPagar: c.totalAPagar,
        totalPagado: c.montoPagado, pagos: [],
      })
      expect(Math.round(evaluarSql(sql.interes, c)), `interés · ${c.nombre}`).toBe(enJs.interes)
      expect(Math.round(evaluarSql(sql.capital, c)), `capital · ${c.nombre}`).toBe(enJs.capital)
    }
  })

  it('y en SQL también, capital + interés es exactamente el pago', () => {
    const sql = repartoSql()
    for (const c of CASOS) {
      const suma = evaluarSql(sql.interes, c) + evaluarSql(sql.capital, c)
      expect(Math.round(suma), `suma · ${c.nombre}`).toBe(c.montoPagado)
    }
  })

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

  it('un pago ETIQUETADO como interés es 100% interés por los dos caminos', () => {
    // Es el caso nuevo del modo clásico, y el que más fácil se descuadra: si el
    // SQL lo repartiera y el JavaScript no, la ganancia del mes de analíticas
    // diría una cosa y la ficha del préstamo otra sobre el MISMO pago.
    const sql = repartoSql()
    // Un préstamo 500.000/600.000 al que ya le cobraron 100.000 de interés: el
    // total vive en 700.000 y la subconsulta devuelve esos 100.000.
    const caso = {
      montoPagado: 100000, totalAPagar: 700000, montoPrestado: 500000,
      tipo: 'intereses', cobradoDeInteres: 100000,
    }

    expect(evaluarSql(sql.interes, caso)).toBe(100000)
    expect(evaluarSql(sql.capital, caso)).toBe(0)

    const enJs = repartirPagado({
      montoPrestado: 500000, totalAPagar: 700000, totalPagado: 100000,
      pagos: [{ tipo: 'intereses', montoPagado: 100000 }],
    })
    expect(enJs.interes).toBe(100000)
    expect(enJs.capital).toBe(0)
  })

  it('y un pago NORMAL en ese mismo préstamo se reparte con el total PACTADO', () => {
    // El caso que destapó el espejo: con interés ya cobrado aparte, la fracción
    // tiene que seguir mirando el 600.000 pactado, no el 700.000 de hoy. Los dos
    // lenguajes tienen que equivocarse o acertar JUNTOS.
    const sql = repartoSql()
    const caso = {
      montoPagado: 60000, totalAPagar: 700000, montoPrestado: 500000,
      tipo: 'completo', cobradoDeInteres: 100000,
    }
    // 1/6 de 60.000 = 10.000, la fracción del préstamo COMO SE PACTÓ.
    expect(Math.round(evaluarSql(sql.interes, caso))).toBe(10000)
    expect(Math.round(evaluarSql(sql.capital, caso))).toBe(50000)
  })
})
