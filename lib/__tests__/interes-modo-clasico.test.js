// Pago de SOLO INTERÉS en modo clásico — G6.3.
//
// ══ QUÉ DEFIENDE ═══════════════════════════════════════════════════════════
//
// El dueño: «hay personas que utilizan el modo clásico, la mayoría, y a veces
// les pagan cuota de solo interés». Hasta el 2 ago 2026 el botón «Interés» sólo
// existía para los 4 modos CON tabla — 443 préstamos de 5.577. Estaba cerrado
// para el 93% de la cartera, incluidos los 2.886 clásicos vivos.
//
// Lo que se decidió, y lo que estas pruebas fijan:
//
//   · CON tabla → paga el interés que YA debía. La deuda no sube. (Lo de siempre.)
//   · SIN tabla → compra tiempo. El capital NO baja y `totalAPagar` SUBE por ese
//     interés nuevo. El saldo pendiente queda igual.
//
// El riesgo real no es que falle: es que funcione mal en silencio. Un pago de
// solo interés que se reparta proporcionalmente anota ~83% como «capital
// devuelto» y la cartera dice que volvió plata que sigue en la calle. Es el
// mismo fallo que ya obligó a sacar los abonos a capital de la cascada.

import { describe, it, expect } from 'vitest'
import { repartirPagado, capitalEnCalle, porGanar, interesGanado } from '../dinero/reparto'
import { elInteresSubeLaDeuda, MODOS_CON_TABLA } from '../dinero/modos'
import { efectoSobreLaDeuda, adaptarDespuesDelPago } from '../adaptadores/pago'

// El caso corriente: $500.000 al 20%, total $600.000.
const clasico = (extra = {}) => ({
  id: 'p1',
  montoPrestado: 500000,
  totalAPagar: 600000,
  totalPagado: 0,
  modoInteres: 'fijo',
  pagos: [],
  ...extra,
})

describe('quién sube la deuda y quién no', () => {
  it('en los modos SIN tabla, el interés es nuevo y sube la deuda', () => {
    for (const modo of ['fijo', 'unico', 'manual', 'proporcional']) {
      expect(elInteresSubeLaDeuda(clasico({ modoInteres: modo })), modo).toBe(true)
    }
  })

  it('en los modos CON tabla cargada, NO sube: ese interés ya estaba pactado', () => {
    for (const modo of MODOS_CON_TABLA) {
      const p = clasico({
        modoInteres: modo,
        cuotasAmortizacion: [{ numeroPeriodo: 1, capital: 100, interes: 20, cuotaTotal: 120, pagado: 0, interesPagado: 0, fechaEsperada: new Date() }],
      })
      expect(elInteresSubeLaDeuda(p), modo).toBe(false)
    }
  })

  it('un modo CON tabla que llega SIN las filas REVIENTA, no adivina', () => {
    // Es un `include` de Prisma que falta. Contestar «sí sube» por defecto le
    // subiría la deuda a un cliente real por un olvido de programación, y el
    // fallo no se vería hasta semanas después en la cartera.
    expect(() => elInteresSubeLaDeuda(clasico({ modoInteres: 'lineal' })))
      .toThrow(/cuotasAmortizacion/)
  })
})

describe('el reparto: un pago de interés es 100% interés', () => {
  it('NO baja el capital en la calle', () => {
    // La prueba que de verdad importa. Con el reparto proporcional, de $100.000
    // de puro interés se anotarían ~$83.333 como capital devuelto.
    const antes = capitalEnCalle(clasico())
    const despues = capitalEnCalle(clasico({
      totalPagado: 100000,
      totalAPagar: 700000, // subió por el interés nuevo
      pagos: [{ tipo: 'intereses', montoPagado: 100000 }],
    }))
    expect(antes).toBe(500000)
    expect(despues).toBe(500000)
  })

  it('se anota entero como ganancia, no una fracción', () => {
    const r = repartirPagado(clasico({
      totalPagado: 100000,
      totalAPagar: 700000,
      pagos: [{ tipo: 'intereses', montoPagado: 100000 }],
    }))
    expect(r.interes).toBe(100000)
    expect(r.capital).toBe(0)
  })

  it('convive con un pago normal: cada uno por su camino', () => {
    // $60.000 normales (1/6 interés = 10.000) + $100.000 de solo interés.
    const r = repartirPagado(clasico({
      totalPagado: 160000,
      totalAPagar: 700000,
      pagos: [
        { tipo: 'completo', montoPagado: 60000 },
        { tipo: 'intereses', montoPagado: 100000 },
      ],
    }))
    // El proporcional se aplica SÓLO a los $60.000, con la fracción del
    // préstamo ya crecido (200.000/700.000).
    expect(r.interes + r.capital).toBe(160000)
    expect(r.interes).toBeGreaterThan(100000)
    expect(r.capital).toBeLessThan(60000)
  })

  it('NO vuelve a repartir los pagos VIEJOS con la fracción nueva', () => {
    // ⚠ ESTO NO LO CAZÓ NINGUNA PRUEBA — lo cazó medir contra el espejo con un
    // préstamo real. Al subir `totalAPagar` sube también la fracción de interés,
    // y el reparto proporcional mira el total DE HOY: los pagos anteriores se
    // reinterpretaban solos. Con 200.000/237.733 y 112.000 ya pagados, un cobro
    // de 20.000 de interés hacía que la ganancia subiera 27.311 —no 20.000— y
    // que $7.311 de capital que sigue en la calle figuraran como devueltos.
    const antes = {
      montoPrestado: 200000, totalAPagar: 237733, totalPagado: 112000, modoInteres: 'fijo',
      pagos: [{ tipo: 'completo', montoPagado: 112000 }], cuotasAmortizacion: [],
    }
    const despues = {
      ...antes, totalAPagar: 257733, totalPagado: 132000,
      pagos: [...antes.pagos, { tipo: 'intereses', montoPagado: 20000 }],
    }
    // La ganancia sube EXACTAMENTE lo cobrado de interés, ni un peso más.
    expect(interesGanado(despues) - interesGanado(antes)).toBe(20000)
    // Y el capital en la calle no se mueve: nadie devolvió capital.
    expect(capitalEnCalle(despues)).toBe(capitalEnCalle(antes))
  })

  it('la invariante no se rompe: capital en calle + por ganar = saldo', () => {
    // Es la que caza cualquier peso inventado. Misma forma que en reparto.test.js.
    const p = clasico({
      totalPagado: 100000,
      totalAPagar: 700000,
      pagos: [{ tipo: 'intereses', montoPagado: 100000 }],
    })
    const saldo = p.totalAPagar - p.totalPagado
    expect(capitalEnCalle(p) + porGanar(p)).toBe(saldo)
  })

  it('y el interés ganado sube exactamente lo pagado', () => {
    const base = clasico()
    const conPago = clasico({
      totalPagado: 100000,
      totalAPagar: 700000,
      pagos: [{ tipo: 'intereses', montoPagado: 100000 }],
    })
    expect(interesGanado(conPago) - interesGanado(base)).toBe(100000)
  })
})

describe('lo que ve el cobrador antes de confirmar', () => {
  it('el saldo NO se mueve: entra la plata y sube el total, se anulan', () => {
    expect(efectoSobreLaDeuda('intereses', 100000, true)).toBe(0)
  })

  it('con tabla el saldo SÍ baja, que es lo de siempre', () => {
    expect(efectoSobreLaDeuda('intereses', 100000, false)).toBe(-100000)
  })

  it('la hoja lo DICE, para que nadie crea que se colgó la pantalla', () => {
    const { filas } = adaptarDespuesDelPago(
      { saldoPendiente: 600000, cuotaDiaria: 20000 },
      { monto: 100000, tipo: 'intereses', interesSubeLaDeuda: true, metodoPago: 'efectivo' },
    )
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.antes).toBe(saldo.valor)
    expect(saldo.nota).toMatch(/interés, no capital/i)
  })

  it('y NO dice «queda saldado» por un pago de interés', () => {
    // Con el saldo justo en el monto, el camino viejo daría 0 y cerraría el
    // préstamo en el texto. El cliente no ha pagado el capital.
    const { filas } = adaptarDespuesDelPago(
      { saldoPendiente: 100000, cuotaDiaria: 20000 },
      { monto: 100000, tipo: 'intereses', interesSubeLaDeuda: true, metodoPago: 'efectivo' },
    )
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.nota).not.toMatch(/saldado/i)
  })
})
