// lib/__tests__/mora-el-interes-no-salda-el-capital.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño de un negocio, sobre su propia cartera:
//
//   «los préstamos de los clientes no están saliendo con la mora correcta, ya
//    deberían tener mora o retraso y el sistema no le está avisando y no los
//    está mostrando».
//
// Medido contra la base de producción antes de tocar nada: **14 préstamos
// activos en 6 negocios** con CERO días de mora y, a la vez, un «le falta X
// para ponerse al día» de **$14.664.349**. La misma ficha decía las dos cosas.
//
// La causa era una regla escrita para los modos de solo interés —«interés
// cubierto = al día»— aplicada a TODOS los modos con tabla. En `lineal`,
// `saldo` y en el balloon del globo, un cliente que abonaba los $200.000 de
// interés y dejaba $2.000.000 de capital vencido aparecía al día. Y para
// siempre: la fila ya venció, no vuelve a vencer.
//
// Caso real de esa medición (préstamo `lineal` mensual, cuota única del 13 de
// julio de $2.200.000 = $200.000 de interés + $2.000.000 de capital; el cliente
// pagó los $200.000 y nada más): 29 días después el sistema decía **0 días de
// mora**, **próximo cobro el 12 de agosto** —una fecha futura— y no lo sacaba
// en Cobros de hoy.
//
// ⚠ Y AL REVÉS TAMBIÉN FALLABA. `fila.pagado` solo lo llenan los pagos
// completo/parcial: los abonos a capital y los pagos de interés se anotan en
// otras columnas a propósito, para no contarlos dos veces. Así que «esta fila
// no está pagada» tampoco probaba que el cliente debiera. Tres préstamos
// llevaban días de mora con $0 para ponerse al día.
//
// La vara es el ACUMULADO: se suman las cuotas y se compara con todo lo que el
// cliente entregó. Es la misma que ya usaba `calcularMontoParaPonerseAlDia`.

import { describe, it, expect } from 'vitest'
import {
  calcularDiasMora, calcularMontoEnMora, calcularProximoCobro,
  calcularMontoParaPonerseAlDia, tieneCobroPendienteHoy, coberturaDeLaTabla,
} from '../calculos.js'

const DIA = 24 * 60 * 60 * 1000
const haceDias = (n) => new Date(Date.now() - n * DIA)
const enDias = (n) => new Date(Date.now() + n * DIA)

/** El caso real: `lineal` mensual, una sola cuota, solo el interés pagado. */
function soloElInteresPagado(extra = {}) {
  return {
    estado: 'activo',
    modoInteres: 'lineal',
    frecuencia: 'mensual',
    fechaInicio: haceDias(59),
    diasPlazo: 30,
    cuotaDiaria: 2_200_000,
    totalAPagar: 2_200_000,
    totalPagado: 200_000,
    pagos: [{ tipo: 'intereses', montoPagado: 200_000 }],
    cuotasAmortizacion: [{
      numeroPeriodo: 1, fechaEsperada: haceDias(29),
      cuotaTotal: 2_200_000, interes: 200_000, capital: 2_000_000,
      pagado: 0, interesPagado: 200_000,
    }],
    ...extra,
  }
}

describe('el interés pagado NO salda una cuota que lleva capital', () => {
  it('entra en mora', () => {
    expect(calcularDiasMora(soloElInteresPagado())).toBeGreaterThan(0)
  })

  it('la mora son los días desde que venció, no desde hoy', () => {
    expect(calcularDiasMora(soloElInteresPagado())).toBe(29)
  })

  it('el monto en mora es el capital que quedó debiendo', () => {
    expect(calcularMontoEnMora(soloElInteresPagado())).toBe(2_000_000)
  })

  it('⚠ el próximo cobro NO se corre al mes siguiente', () => {
    /* Eran dos recorridos: el primero saltaba las cuotas con el interés al día y
       el segundo recogía «la primera con capital pendiente». Con varias cuotas,
       el primero devolvía la de agosto y la de julio quedaba escondida. */
    const conMasCuotas = soloElInteresPagado({
      totalAPagar: 6_500_000, totalPagado: 500_000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, fechaEsperada: haceDias(29), cuotaTotal: 1_500_000, interes: 500_000, capital: 1_000_000, pagado: 0, interesPagado: 500_000 },
        { numeroPeriodo: 2, fechaEsperada: enDias(1),    cuotaTotal: 1_400_000, interes: 400_000, capital: 1_000_000, pagado: 0, interesPagado: 0 },
      ],
    })
    const prox = calcularProximoCobro(conMasCuotas)
    expect(prox.toISOString().slice(0, 10)).toBe(haceDias(29).toISOString().slice(0, 10))
    expect(calcularDiasMora(conMasCuotas)).toBe(29)
  })

  it('⚠ y por eso SÍ sale en los cobros de hoy', () => {
    // La otra mitad del reporte: «no los está mostrando». Con la cuota dada por
    // saldada, `tieneCobroPendienteHoy` decía que no y el cliente no aparecía.
    expect(tieneCobroPendienteHoy(soloElInteresPagado())).toBe(true)
  })

  it('la mora y el «para ponerse al día» dejan de contradecirse', () => {
    const p = soloElInteresPagado()
    expect(calcularMontoParaPonerseAlDia(p)).toBeGreaterThan(0)
    expect(calcularDiasMora(p)).toBeGreaterThan(0)
  })
})

describe('en los modos de solo interés la regla sigue valiendo', () => {
  /* Ahí la cuota del mes ES el interés (capital = 0) y pagarlo sí deja al día.
     Si esto se rompe, medio producto empieza a marcar mora falsa. */
  const globo = (extra = {}) => ({
    estado: 'activo',
    modoInteres: 'solo_interes',
    frecuencia: 'mensual',
    fechaInicio: haceDias(90),
    diasPlazo: 360,
    cuotaDiaria: 125_000,
    totalAPagar: 4_000_000,
    totalPagado: 375_000,
    pagos: [{ tipo: 'intereses', montoPagado: 375_000 }],
    cuotasAmortizacion: [
      { numeroPeriodo: 1, fechaEsperada: haceDias(60), cuotaTotal: 125_000, interes: 125_000, capital: 0, pagado: 0, interesPagado: 125_000 },
      { numeroPeriodo: 2, fechaEsperada: haceDias(30), cuotaTotal: 125_000, interes: 125_000, capital: 0, pagado: 0, interesPagado: 125_000 },
      { numeroPeriodo: 3, fechaEsperada: haceDias(1),  cuotaTotal: 125_000, interes: 125_000, capital: 0, pagado: 0, interesPagado: 125_000 },
      { numeroPeriodo: 4, fechaEsperada: enDias(29),   cuotaTotal: 3_625_000, interes: 125_000, capital: 3_500_000, pagado: 0, interesPagado: 0 },
    ],
    ...extra,
  })

  it('al día con los intereses = sin mora', () => {
    expect(calcularDiasMora(globo())).toBe(0)
    expect(tieneCobroPendienteHoy(globo())).toBe(false)
  })

  it('el próximo cobro es la cuota que sigue, no la primera', () => {
    expect(calcularProximoCobro(globo()).toISOString().slice(0, 10))
      .toBe(enDias(29).toISOString().slice(0, 10))
  })

  it('el balloon vencido con su interés pagado SÍ entra en mora', () => {
    // El balloon con interés > 0 era el hueco que quedaba: el arreglo anterior
    // solo cubrió el balloon con interés = 0.
    const vencido = globo({
      cuotasAmortizacion: globo().cuotasAmortizacion.map((f) =>
        f.numeroPeriodo === 4
          ? { ...f, fechaEsperada: haceDias(10), interesPagado: f.interes }
          : f),
      totalPagado: 500_000,
    })
    expect(calcularDiasMora(vencido)).toBe(10)
  })
})

describe('lo que se pagó por otra vía cuenta', () => {
  /* `fila.pagado` solo lo llenan los pagos completo/parcial. Un abono a capital
     salda la deuda pero deja la casilla en cero, y con la regla vieja el cliente
     salía en mora habiendo pagado. Tres préstamos de producción estaban así. */
  const pagoPorOtraVia = {
    estado: 'activo',
    modoInteres: 'lineal',
    frecuencia: 'mensual',
    fechaInicio: haceDias(45),
    diasPlazo: 60,
    cuotaDiaria: 1_260_000,
    totalAPagar: 1_825_000,
    totalPagado: 1_825_000,
    pagos: [
      { tipo: 'completo', montoPagado: 1_260_000 },
      { tipo: 'intereses', montoPagado: 65_000 },
      { tipo: 'capital', montoPagado: 500_000 },
    ],
    cuotasAmortizacion: [
      { numeroPeriodo: 1, fechaEsperada: haceDias(45), cuotaTotal: 1_260_000, interes: 260_000, capital: 1_000_000, pagado: 1_260_000, interesPagado: 0 },
      { numeroPeriodo: 2, fechaEsperada: haceDias(15), cuotaTotal: 565_000, interes: 65_000, capital: 500_000, pagado: 0, interesPagado: 65_000 },
    ],
  }

  it('sin mora: entregó más de lo que le tocaba a la fecha', () => {
    expect(calcularDiasMora(pagoPorOtraVia)).toBe(0)
    expect(calcularMontoEnMora(pagoPorOtraVia)).toBe(0)
  })

  it('las dos cuotas cuentan como cubiertas aunque una tenga `pagado` en cero', () => {
    expect(coberturaDeLaTabla(pagoPorOtraVia).map((c) => c.cubierta)).toEqual([true, true])
  })
})

describe('sin saber lo pagado no se inventa una deuda', () => {
  /* Un `select` de Prisma sin `totalPagado` ni `pagos` no puede acumular nada.
     Antes de este respaldo, eso habría puesto en mora a la cartera entera — que
     es la forma en que nació el bug de «0 en mora» en Analíticas, al revés. */
  it('se cae a la fila, y una cuota pagada sigue estando al día', () => {
    const sinLibro = {
      estado: 'activo', modoInteres: 'lineal', frecuencia: 'mensual',
      fechaInicio: haceDias(45), diasPlazo: 60, cuotaDiaria: 500_000,
      totalAPagar: 1_000_000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, fechaEsperada: haceDias(45), cuotaTotal: 500_000, interes: 100_000, capital: 400_000, pagado: 500_000, interesPagado: 0 },
        { numeroPeriodo: 2, fechaEsperada: enDias(15), cuotaTotal: 500_000, interes: 100_000, capital: 400_000, pagado: 0, interesPagado: 0 },
      ],
    }
    expect(coberturaDeLaTabla(sinLibro).map((c) => c.cubierta)).toEqual([true, false])
    expect(calcularDiasMora(sinLibro)).toBe(0)
  })
})
