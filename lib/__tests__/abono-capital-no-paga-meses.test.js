// lib/__tests__/abono-capital-no-paga-meses.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Le presté $2.000.000 en abril. Pagó mayo, junio, julio, y en agosto abonó
//  $500.000 y también pagó el interés que le correspondía, o sea $75.000 porque
//  ya el saldo capital quedaba en $1.500.000. Y veo la pantalla y me dice que el
//  próximo pago será el 27 de feb del 2027.»
//   — PRESTAMOS PEDRO, 14 ago 2026, sobre su cliente David Popayán.
//
// Y en la nota de voz dio él mismo el diagnóstico, que era el correcto: «como si
// cogiera ese abono y lo distribuyera en cuotas».
//
// Medido en producción ese día: **22 préstamos vivos con abono a capital en 12
// negocios ($17.040.100 abonados)**, de los cuales **14 tienen tabla** y por
// tanto enseñaban una fecha inventada. Entre ellos otros dos del mismo Pedro con
// $3.000.000 abonados cada uno.
//
// Lo que estas pruebas cuidan son las tres formas de que vuelva a pasar:
//
//   1. Que el abono se cuente otra vez al recorrer la tabla. Es la cuarta
//      función a la que se le cuela el mismo abono.
//   2. Que se reste SIEMPRE. Hay un caso en que el abono sí está dentro de la
//      tabla —cuando cae sobre una cuota vencida y no se rehace nada— y restarlo
//      pone en mora a quien pagó. La primera versión de este arreglo lo rompió.
//   3. Que las fechas mensuales vuelvan a ir a bloques de 30 días.

import { describe, it, expect } from 'vitest'
import {
  coberturaDeLaTabla,
  calcularProximoCobro,
  recalcularTablaSoloInteresDesdeSaldo,
  recalcularTablaDesdeSaldo,
} from '@/lib/calculos'

const d = (s) => new Date(`${s}T05:00:00.000Z`)

/* El préstamo de David Popayán tal como quedó en la base tras el abono:
   $2.000.000 al 5% mensual solo-interés, 12 periodos. Pagó los tres primeros
   meses de interés, abonó $500.000 y pagó $75.000. La tabla ya se rehizo sobre
   $1.500.000 — las cuotas bajaron de $100.000 a $75.000 — y `totalAPagar` suma
   el abono aparte. */
const davidPopayan = {
  id: 'p1',
  estado: 'activo',
  modoInteres: 'solo_interes',
  frecuencia: 'mensual',
  fechaInicio: d('2026-04-01'),
  diasPlazo: 360,
  cuotaDiaria: 100000,
  tasaInteres: 5,
  montoPrestado: 2000000,
  totalAPagar: 2925000,
  totalPagado: 875000,
  abonadoCapital: 500000,
  cuotasAmortizacion: [
    { numeroPeriodo: 1,  fechaEsperada: d('2026-05-01'), cuotaTotal: 100000, interes: 100000, capital: 0, pagado: 100000, interesPagado: 100000 },
    { numeroPeriodo: 2,  fechaEsperada: d('2026-06-01'), cuotaTotal: 100000, interes: 100000, capital: 0, pagado: 100000, interesPagado: 100000 },
    { numeroPeriodo: 3,  fechaEsperada: d('2026-07-01'), cuotaTotal: 100000, interes: 100000, capital: 0, pagado: 100000, interesPagado: 100000 },
    { numeroPeriodo: 4,  fechaEsperada: d('2026-08-01'), cuotaTotal: 100000, interes: 100000, capital: 0, pagado: 75000,  interesPagado: 75000 },
    { numeroPeriodo: 5,  fechaEsperada: d('2026-09-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 6,  fechaEsperada: d('2026-10-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 7,  fechaEsperada: d('2026-11-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 8,  fechaEsperada: d('2026-12-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 9,  fechaEsperada: d('2027-01-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 10, fechaEsperada: d('2027-02-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 11, fechaEsperada: d('2027-03-01'), cuotaTotal: 75000,  interes: 75000,  capital: 0, pagado: 0, interesPagado: 0 },
    { numeroPeriodo: 12, fechaEsperada: d('2027-04-01'), cuotaTotal: 1500000, interes: 0, capital: 1500000, pagado: 0, interesPagado: 0 },
  ],
}

describe('⚠ el abono a capital no compra meses de interés', () => {
  it('el próximo cobro es la cuota de agosto, no la de 2027', () => {
    /* Con la cascada vieja: $875.000 cubrían las cuatro de $100.000 y seis de
       $75.000, y la primera sin cubrir era la once — que en su tabla real caía
       el 27 de febrero de 2027. La cifra que él vio en pantalla. */
    const prox = calcularProximoCobro(davidPopayan)
    expect(prox).not.toBeNull()
    expect(prox.toISOString().slice(0, 10)).toBe('2026-08-01')
  })

  it('solo cubre lo que pagó de verdad: las tres primeras', () => {
    const cubiertas = coberturaDeLaTabla(davidPopayan).filter((c) => c.cubierta).length
    // $875.000 − $500.000 de abono = $375.000, o sea tres cuotas de $100.000.
    expect(cubiertas).toBe(3)
  })

  it('la diferencia entre la deuda y la tabla ES el abono, al peso', () => {
    /* De esto sale la decisión de restar, y por eso no hace falta confiar en el
       tipo del pago. Si esta igualdad se rompe, la regla se apaga sola. */
    const suma = davidPopayan.cuotasAmortizacion.reduce((a, f) => a + f.cuotaTotal, 0)
    expect(davidPopayan.totalAPagar - suma).toBe(davidPopayan.abonadoCapital)
  })

  it('⚠ sin el campo denormalizado se cae a la lista de pagos', () => {
    /* `clientes/route.js` no carga `pagos` y `prestamos/route.js` trae solo los
       diez últimos: por eso el dato va en el préstamo. Pero quien traiga la
       lista entera también tiene que acertar. */
    const { abonadoCapital, ...sinCampo } = davidPopayan
    const conPagos = {
      ...sinCampo,
      pagos: [
        { tipo: 'completo', montoPagado: 100000 },
        { tipo: 'completo', montoPagado: 100000 },
        { tipo: 'completo', montoPagado: 100000 },
        { tipo: 'capital',  montoPagado: 500000 },
        { tipo: 'completo', montoPagado: 75000 },
      ],
    }
    expect(calcularProximoCobro(conPagos).toISOString().slice(0, 10)).toBe('2026-08-01')
  })
})

describe('⚠ pero el abono que SÍ está dentro de la tabla no se resta', () => {
  it('una cuota vencida pagada con un abono sigue cubierta', () => {
    /* Cuando no quedan cuotas futuras, el abono no rehace nada: paga el capital
       de esa fila y se queda dentro. Aquí `totalAPagar` es exactamente la suma
       de la tabla, así que no hay nada «fuera» que restar. Restar a ciegas
       ponía en mora a quien acababa de pagar. */
    const dentroDeLaTabla = {
      id: 'p2', estado: 'activo', modoInteres: 'lineal', frecuencia: 'mensual',
      fechaInicio: d('2026-06-01'), diasPlazo: 60, cuotaDiaria: 1260000,
      totalAPagar: 1825000, totalPagado: 1825000, abonadoCapital: 500000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, fechaEsperada: d('2026-07-01'), cuotaTotal: 1260000, interes: 260000, capital: 1000000, pagado: 1260000, interesPagado: 0 },
        { numeroPeriodo: 2, fechaEsperada: d('2026-08-01'), cuotaTotal: 565000,  interes: 65000,  capital: 500000,  pagado: 0, interesPagado: 65000 },
      ],
    }
    expect(coberturaDeLaTabla(dentroDeLaTabla).map((c) => c.cubierta)).toEqual([true, true])
  })
})

describe('⚠ mensual es el mismo día del mes, no bloques de 30 días', () => {
  it('solo interés: del 1 de agosto salen los días 1, no 31/30/30/29', () => {
    /* La tabla real de David decía 31 ago, 30 sep, 30 oct, 29 nov, 29 dic,
       28 ene y **27 feb**. Ese «27 de febrero» es literalmente esta cuenta. */
    const filas = recalcularTablaSoloInteresDesdeSaldo({
      saldoInicial: 1500000, tasaInteres: 5, numPeriodosRestantes: 4,
      primerNumeroPeriodo: 5, fechaBase: d('2026-08-01'), diasPeriodo: 30,
      frecuencia: 'mensual',
    })
    expect(filas.map((f) => f.fechaEsperada.toISOString().slice(0, 10)))
      .toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'])
  })

  it('respeta el día de corte cuando el préstamo tiene uno', () => {
    const filas = recalcularTablaDesdeSaldo({
      saldoInicial: 900000, tasaInteres: 4, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 2, fechaBase: d('2026-08-05'), diasPeriodo: 30,
      frecuencia: 'mensual', diaCobroMes: 5,
    })
    expect(filas.map((f) => f.fechaEsperada.toISOString().slice(0, 10)))
      .toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
  })

  it('el 31 se recorta al último día del mes corto, no se pasa al siguiente', () => {
    const filas = recalcularTablaSoloInteresDesdeSaldo({
      saldoInicial: 1000000, tasaInteres: 5, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 2, fechaBase: d('2026-12-31'), diasPeriodo: 30,
      frecuencia: 'mensual',
    })
    expect(filas.map((f) => f.fechaEsperada.toISOString().slice(0, 10)))
      .toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
  })

  it('las demás frecuencias siguen yendo por días', () => {
    const filas = recalcularTablaDesdeSaldo({
      saldoInicial: 700000, tasaInteres: 3, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 1, fechaBase: d('2026-08-01'), diasPeriodo: 7,
      frecuencia: 'semanal',
    })
    expect(filas.map((f) => f.fechaEsperada.toISOString().slice(0, 10)))
      .toEqual(['2026-08-08', '2026-08-15', '2026-08-22'])
  })
})
