/* En un préstamo ABIERTO el interés no se reparte: está devengado.
 *
 * Un abierto nace con `totalAPagar === montoPrestado` —el interés se va
 * cerrando período a período en `DevengoInteres`—, así que el reparto
 * proporcional le daba CERO interés, o casi. Todo lo cobrado se contaba como
 * capital devuelto.
 *
 * MEDIDO EN PRODUCCIÓN el 27 ago 2026: de 38 abiertos, 3 en 2 negocios daban
 * distinto, y son $2.049.916 de interés cobrado que no aparecía en ninguna
 * cifra de ganancia. El mayor: prestó $4.000.000, le pagaron $2.800.000 —todo
 * interés, el devengado lo dice al peso— y el informe daba por devuelto
 * $1.647.059 de capital que nadie devolvió.
 *
 * ⚠ SON DOS CAMINOS Y HAY QUE ARREGLAR LOS DOS. `repartirPagado` alimenta la
 * ficha y las tarjetas; `interesPagoAPago` es el que corrige lo que puso el SQL
 * en analíticas, el informe del contador y el reparto a socios. Arreglar uno
 * solo es lo que ya nos costó tres reportes del mismo recibo. */
import { describe, it, expect } from 'vitest'
import { repartirPagado, capitalEnCalle, interesGanado, METODO } from '@/lib/dinero/reparto'
import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'
import { calcularCapitalRestante } from '@/lib/calculos'

/* El préstamo real: $4.000.000 abierto, $2.800.000 cobrados, todo interés. */
const elDeLosCuatroMillones = {
  montoPrestado: 4000000, totalAPagar: 4000000, totalPagado: 2800000,
  estado: 'activo', sinPlazo: true, modoInteres: 'solo_interes',
  devengos: [{ periodo: '2026-06-26', interes: 1400000 }, { periodo: '2026-07-26', interes: 1400000 }],
  pagos: [
    { tipo: 'completo', montoPagado: 1400000, fechaPago: '2026-06-26T05:00:00.000Z' },
    { tipo: 'completo', montoPagado: 1400000, fechaPago: '2026-07-26T05:00:00.000Z' },
  ],
  cuotasAmortizacion: [],
}

describe('el préstamo abierto no se reparte', () => {
  it('lo cobrado fue interés, y el capital sigue entero', () => {
    const r = repartirPagado(elDeLosCuatroMillones)
    expect(r.interes).toBe(2800000)
    expect(r.capital).toBe(0)
    expect(r.metodo).toBe(METODO.ABIERTO)
    // Antes contaba $1.152.941 de interés y daba $1.647.059 por devueltos.
    expect(r.interes).not.toBe(1152941)
  })

  it('⚠ la ficha y los informes contestan el MISMO capital', () => {
    /* `calcularCapitalRestante` ya tenía su rama de abierto y `repartirPagado`
       no. Son gemelas duplicadas a propósito —`calculos.js` importa de
       `reparto.js` y al revés sería un ciclo—, así que esta prueba es lo único
       que impide que vuelvan a separarse. */
    for (const p of [
      elDeLosCuatroMillones,
      { ...elDeLosCuatroMillones, pagos: [{ tipo: 'capital', montoPagado: 1000000 }], totalPagado: 1000000 },
      { ...elDeLosCuatroMillones, pagos: [{ tipo: 'intereses', montoPagado: 500000 }], totalPagado: 500000 },
      { ...elDeLosCuatroMillones, devengos: [], pagos: [{ tipo: 'completo', montoPagado: 900000 }], totalPagado: 900000 },
    ]) {
      expect(capitalEnCalle(p)).toBe(calcularCapitalRestante(p))
    }
  })

  it('un abono a capital baja capital, no interés', () => {
    const p = { ...elDeLosCuatroMillones, totalPagado: 1000000,
      pagos: [{ tipo: 'capital', montoPagado: 1000000 }] }
    const r = repartirPagado(p)
    expect(r.capital).toBe(1000000)
    expect(r.interes).toBe(0)
  })

  it('sin devengos cerrados, un pago corriente es capital', () => {
    // No se le puede cobrar un interés que todavía no ha cerrado.
    const p = { ...elDeLosCuatroMillones, devengos: [], totalPagado: 900000,
      pagos: [{ tipo: 'completo', montoPagado: 900000 }] }
    expect(repartirPagado(p).capital).toBe(900000)
    expect(repartirPagado(p).interes).toBe(0)
  })

  it('⚠ el desglose pago a pago suma lo mismo que el reparto', () => {
    // Es lo que corrige el SQL en las tres pantallas: si no suma igual, una
    // pantalla dirá una cifra y la otra otra, que es de donde venimos.
    const filas = interesPagoAPago({ prestamo: elDeLosCuatroMillones, cuotas: null,
      pagos: elDeLosCuatroMillones.pagos })
    expect(filas.reduce((a, f) => a + f.interes, 0)).toBe(interesGanado(elDeLosCuatroMillones))
  })

  it('las filas traen la misma forma que las del reparto normal', () => {
    /* Devolver otra forma no revienta: da `undefined` y quien lo lee decide mal
       en silencio. Ya nos pasó con `metodoPagoId`. */
    for (const f of interesPagoAPago({ prestamo: elDeLosCuatroMillones, cuotas: null,
      pagos: elDeLosCuatroMillones.pagos })) {
      expect(Object.keys(f).sort()).toEqual(['capital', 'fecha', 'interes', 'monto', 'tipo'])
      expect(f.interes + f.capital).toBe(f.monto)
    }
  })

  it('un préstamo con plazo NO entra por esta rama', () => {
    // La guarda es lo que mantiene el cambio acotado a 38 préstamos.
    const conPlazo = { ...elDeLosCuatroMillones, sinPlazo: false, totalAPagar: 4800000 }
    expect(repartirPagado(conPlazo).metodo).not.toBe(METODO.ABIERTO)
  })
})
