import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '../calculos'

// Un prestamo de N dias tiene que costar lo mismo sin importar cada cuanto se
// cobre. La frecuencia decide el TAMAÑO de la cuota, no cuanto interes se paga.
//
// Fallaba solo en semanal: PERIODOS_POR_MES.semanal estaba fijo en 4, o sea que
// un mes duraba 28 dias (4 x 7) en esa frecuencia y 30 en las otras tres. Todo
// prestamo semanal cobraba 6,67% de interes de mas sin durar un dia mas.

const BASE = {
  montoPrestado: 250000,
  tasaInteres: 20,
  fechaInicio: new Date('2026-07-20'),
  modoInteres: 'fijo',
}

const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']

describe('un mes son 30 dias en todas las frecuencias', () => {
  it('el plazo cobrado coincide con el plazo real, frecuencia por frecuencia', () => {
    // Un plazo de 30 dias exactos: cada frecuencia lo cubre en un numero
    // distinto de cuotas, pero el total de dias tiene que ser el mismo.
    // (Semanal no divide 30, asi que redondea a 5 semanas = 35 dias.)
    for (const frecuencia of ['diario', 'quincenal', 'mensual']) {
      const r = calcularPrestamo({ ...BASE, diasPlazo: 30, frecuencia })
      expect(r.numPeriodos * r.diasPeriodo).toBe(30)
    }
  })

  it('42 dias cobrados semanal duran 42 dias, no 45', () => {
    const r = calcularPrestamo({ ...BASE, diasPlazo: 42, frecuencia: 'semanal' })
    expect(r.numPeriodos).toBe(6)
    expect(r.numPeriodos * r.diasPeriodo).toBe(42)
  })

  it('el caso reportado: $250.000 al 20% a 6 semanas', () => {
    const r = calcularPrestamo({ ...BASE, diasPlazo: 42, frecuencia: 'semanal' })
    // Antes: cuota $54.200, total $325.200 (interes 30,08% del capital).
    // Ahora: 42/30 = 1,4 meses al 20% = $70.000, mas el redondeo de cuota.
    expect(r.totalInteres).toBeGreaterThanOrEqual(70000)
    expect(r.totalInteres).toBeLessThan(71000)
    expect(r.totalAPagar).toBe(320400)
    expect(r.cuotaDiaria).toBe(53400)
  })

  it('diario y semanal cobran el mismo interes por el mismo plazo', () => {
    const diario  = calcularPrestamo({ ...BASE, diasPlazo: 42, frecuencia: 'diario' })
    const semanal = calcularPrestamo({ ...BASE, diasPlazo: 42, frecuencia: 'semanal' })

    // Los dos duran 42 dias, asi que el interes pactado es el mismo ($70.000).
    // Lo que difiere es el total realizado, porque la cuota se redondea hacia
    // arriba al siguiente multiplo de 100 (nadie cobra $7.619,05 en monedas) y
    // ese sobrante se suma una vez por cuota. Esta acotado por 100 x cuotas.
    for (const r of [diario, semanal]) {
      const sobrante = r.totalInteres - 70000
      expect(sobrante).toBeGreaterThanOrEqual(0)
      expect(sobrante).toBeLessThan(100 * r.numPeriodos)
    }
  })

  it('a doble plazo, doble interes (semanal)', () => {
    const seis = calcularPrestamo({ ...BASE, diasPlazo: 42, frecuencia: 'semanal' })
    const doce = calcularPrestamo({ ...BASE, diasPlazo: 84, frecuencia: 'semanal' })
    const ratio = doce.totalInteres / seis.totalInteres
    expect(ratio).toBeGreaterThan(1.95)
    expect(ratio).toBeLessThan(2.05)
  })

  it('ninguna frecuencia cobra mas dias de los que dura el prestamo', () => {
    const interesDeUnMes = 250000 * 0.20

    for (const frecuencia of FRECUENCIAS) {
      for (const diasPlazo of [14, 28, 30, 42, 60, 90]) {
        const r = calcularPrestamo({ ...BASE, diasPlazo, frecuencia })
        const diasReales = r.numPeriodos * r.diasPeriodo
        const mesesCobrados = r.totalInteres / interesDeUnMes

        // Cota derivada, no inventada: el redondeo de cuota agrega como maximo
        // $100 por cuota (ceil al siguiente multiplo de 100), asi que el exceso
        // en "meses" esta acotado por 100 x cuotas / interes-de-un-mes.
        // Por eso un prestamo diario, que tiene muchas mas cuotas, tolera mas
        // sobrante que uno mensual.
        const holguraRedondeo = (100 * r.numPeriodos) / interesDeUnMes
        const mesesReales = diasReales / 30

        expect(mesesCobrados).toBeLessThanOrEqual(mesesReales + holguraRedondeo)
        expect(mesesCobrados).toBeGreaterThanOrEqual(mesesReales - 0.001)
      }
    }
  })
})
