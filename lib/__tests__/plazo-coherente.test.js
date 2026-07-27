import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '@/lib/calculos'

// El plazo guardado tiene que dar EXACTAMENTE los cobros que el dinero exige.
// Si el plazo dice menos, calcularProximoCobro lo toma como tope y el prestamo
// desaparece de los cobros debiendo plata. Medido en produccion: 252 prestamos
// activos asi, $47.349.052 que se dejarian de cobrar.
//
// Caso reportado: renovacion de $3.000.000 al 20% "a 180 dias" con cuota manual
// de $300.000 quincenal. El prestamista esperaba 12 x 300.000 = $3.600.000 y el
// sistema armo 22 cuotas por $6.600.000, guardando "180 dias" (12 cobros).

const DP = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

describe('el plazo del calculo cubre todo el dinero', () => {
  const casos = []
  for (const freq of ['diario', 'semanal', 'quincenal', 'mensual']) {
    for (const modo of ['fijo', 'unico', 'lineal', 'solo_interes', 'saldo']) {
      casos.push({ freq, modo })
    }
  }

  for (const c of casos) {
    it(`${c.modo} / ${c.freq}: numPeriodos x diasPeriodo alcanza para el total`, () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, diasPlazo: 180,
        fechaInicio: '2026-07-27', frecuencia: c.freq, modoInteres: c.modo,
      })
      const diasGuardados = r.numPeriodos * r.diasPeriodo
      const cobrosPorPlazo = Math.ceil(diasGuardados / DP[c.freq])
      expect(cobrosPorPlazo, `${c.modo}/${c.freq}`).toBe(r.numPeriodos)
    })
  }
})

describe('caso reportado: cuota manual que alarga el plazo', () => {
  const base = {
    montoPrestado: 3000000, tasaInteres: 20, diasPlazo: 180,
    fechaInicio: '2026-07-27', frecuencia: 'quincenal',
  }

  it('avisa que el plazo se extendio, con los numeros para decidir', () => {
    const r = calcularPrestamo({ ...base, cuotaManual: 300000 })
    expect(r.plazoExtendido).toBe(true)
    expect(r.periodosPedidos).toBe(12)
    expect(r.periodosReales).toBe(22)
    expect(r.diasPedidos).toBe(180)
    expect(r.diasReales).toBe(330)
    expect(r.totalSinExtender).toBe(3600000)  // lo que el prestamista esperaba
    expect(r.totalAPagar).toBe(6600000)       // lo que salio
  })

  it('el plazo que se guarda cubre las 22 cuotas, no 12', () => {
    const r = calcularPrestamo({ ...base, cuotaManual: 300000 })
    const diasGuardados = r.numPeriodos * r.diasPeriodo
    expect(diasGuardados).toBe(330)
    // con ese plazo el prestamo NO desaparece antes de tiempo
    expect(Math.ceil(diasGuardados / 15)).toBe(Math.ceil(r.totalAPagar / r.cuotaDiaria))
  })

  it('si la cuota alcanza, no se extiende ni se avisa', () => {
    const r = calcularPrestamo({ ...base, cuotaManual: 550000 })
    expect(r.plazoExtendido).toBeUndefined()
    expect(r.numPeriodos).toBe(12)
    expect(r.totalAPagar).toBe(6600000)
  })

  it('con la tasa que el prestamista queria (20% total = 3,33% mensual) da lo esperado', () => {
    const r = calcularPrestamo({ ...base, tasaInteres: 3.3333, cuotaManual: 300000 })
    expect(r.plazoExtendido).toBeUndefined()
    expect(r.numPeriodos).toBe(12)
    expect(r.totalAPagar).toBe(3600000)
  })
})
