import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '../calculos'

// El selector de modo de interes (components/prestamos/ModoInteresSelector.jsx)
// le dice al prestamista QUE SIGNIFICA el % que escribio:
//
//   'El % es por mes'             -> fijo, saldo
//   'El % es de todo el prestamo' -> unico
//   'El % es por cada cobro'      -> solo_interes, lineal, lineal_dinamico
//
// Estos tests fijan esa semantica. Si alguien cambia el calculo y no cambia la
// etiqueta, la pantalla queda mintiendo sobre plata — que es exactamente el
// problema que estos letreros vinieron a resolver.

const BASE = {
  montoPrestado: 250000,
  tasaInteres: 20,
  fechaInicio: new Date('2026-07-20'),
  frecuencia: 'semanal',
}

const interesDe = (modoInteres, diasPlazo) =>
  calcularPrestamo({ ...BASE, diasPlazo, modoInteres }).totalInteres

describe('la etiqueta de cada modo dice la verdad', () => {
  it('unico: "de todo el prestamo" — el plazo NO cambia el interes', () => {
    // 6 semanas y 24 semanas tienen que cobrar lo mismo: 20% de $250.000.
    expect(interesDe('unico', 42)).toBe(50000)
    expect(interesDe('unico', 168)).toBe(50000)
  })

  it('fijo: "por mes" — al doble de meses, el doble de interes', () => {
    const seisSemanas = interesDe('fijo', 42)   // 1,4 meses
    const doceSemanas = interesDe('fijo', 84)   // 2,8 meses
    const ratio = doceSemanas / seisSemanas
    expect(ratio).toBeGreaterThan(1.95)
    expect(ratio).toBeLessThan(2.05)
  })

  it('saldo: "por mes" — cobra menos que fijo porque va sobre lo que falta', () => {
    expect(interesDe('saldo', 42)).toBeLessThan(interesDe('fijo', 42))
  })

  it('solo_interes: "por cada cobro" — el interes escala con el NUMERO de cobros', () => {
    // 6 cobros al 20% del capital = 120% del capital.
    expect(interesDe('solo_interes', 42)).toBe(250000 * 0.20 * 6)
    // Al doble de cobros, el doble de interes.
    expect(interesDe('solo_interes', 84)).toBe(250000 * 0.20 * 12)
  })

  it('solo_interes cobra MUCHO mas que fijo con el mismo % y plazo', () => {
    // Esta es la trampa que la etiqueta tiene que evitar: alguien que elige
    // "globo" pensando en 20% mensual esta cobrando 20% SEMANAL.
    // Con semanal=4 (convencion del gota a gota), fijo a 6 semanas es 30% y
    // solo_interes es 120% (6 cobros x 20%): exactamente 4x. El umbral 3.5x
    // captura "mucho mas" sin quedar pegado al valor exacto.
    expect(interesDe('solo_interes', 42)).toBeGreaterThan(interesDe('fijo', 42) * 3.5)
  })

  it('lineal: "por cada cobro" sobre saldo decreciente', () => {
    // Capital baja parejo; el interes de cada periodo es 20% del saldo.
    // 250k + 208,3k + 166,7k + 125k + 83,3k + 41,7k = 875k; 20% = 175k
    const esperado = [250000, 208333.33, 166666.67, 125000, 83333.33, 41666.67]
      .reduce((a, saldo) => a + saldo * 0.20, 0)
    expect(interesDe('lineal', 42)).toBeCloseTo(esperado, -2)
  })

  it('el modo mas caro y el mas barato difieren en mas de 6x', () => {
    // Justifica que la pantalla tenga que ser explicita: con el MISMO 20% y el
    // MISMO plazo, elegir mal el modo multiplica lo que paga el cliente.
    const todos = ['fijo', 'unico', 'solo_interes', 'saldo', 'lineal']
      .map((m) => interesDe(m, 42))
    expect(Math.max(...todos) / Math.min(...todos)).toBeGreaterThan(6)
  })
})
