// Invariante del patrimonio del dashboard.
// El bug: el dashboard hacía `saldoPorCobrar + caja − gastosMes`, pero
// capital.saldo YA tiene los gastos descontados (lib/capital.js trata 'gasto'
// como egreso). El patrimonio salía subestimado justo en los gastos del mes.
import { describe, it, expect } from 'vitest'
import { calcularPatrimonio } from './calculos.js'

describe('calcularPatrimonio', () => {
  it('suma lo que te deben más lo que tienes en caja', () => {
    expect(calcularPatrimonio({ saldoPorCobrar: 2_800_000, cajaDisponible: 500_000 })).toBe(3_300_000)
  })

  it('NO resta los gastos: la caja ya los descontó', () => {
    // Mismo escenario con y sin gastos del mes: el patrimonio no cambia,
    // porque los gastos ya bajaron `cajaDisponible` en su momento.
    const caja = 500_000
    const patrimonio = calcularPatrimonio({ saldoPorCobrar: 2_800_000, cajaDisponible: caja })
    const gastosMes = 300_000
    expect(patrimonio).toBe(3_300_000)
    expect(patrimonio).not.toBe(3_300_000 - gastosMes) // el bug viejo
  })

  it('tolera valores ausentes o nulos', () => {
    expect(calcularPatrimonio()).toBe(0)
    expect(calcularPatrimonio({})).toBe(0)
    expect(calcularPatrimonio({ saldoPorCobrar: null, cajaDisponible: 400 })).toBe(400)
  })

  it('soporta caja en negativo (saldo descuadrado)', () => {
    expect(calcularPatrimonio({ saldoPorCobrar: 1_000_000, cajaDisponible: -200_000 })).toBe(800_000)
  })
})
