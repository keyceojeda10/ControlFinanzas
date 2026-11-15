import { describe, it, expect } from 'vitest'
import { detalleDeCuenta, adaptarCuentas } from '@/lib/adaptadores/cuentas'

const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

// Las cifras de la demo «Créditos del Valle» (14 nov 2026): cuadró con
// Efectivo $4.200.000, Nequi $1.850.000 y Bancolombia $1.356.900, y pasó
// $500.000 de Nequi a Bancolombia.
const CUENTAS = [
  { key: 'efectivo', nombre: 'Efectivo', tipoCuenta: 'efectivo', entradas: 13606900, salidas: 9406900, neto: 4200000, trasladado: -3206900, trasladoEntra: 0, trasladoSale: 3206900 },
  { key: 'b', nombre: 'Bancolombia', tipoCuenta: 'transferencia', entradas: 1856900, salidas: 0, neto: 1856900, trasladado: 1856900, trasladoEntra: 1856900, trasladoSale: 0 },
  { key: 'n', nombre: 'Nequi', tipoCuenta: 'transferencia', entradas: 1850000, salidas: 500000, neto: 1350000, trasladado: 1350000, trasladoEntra: 1850000, trasladoSale: 500000 },
]

describe('«Cuentas»: lo pasado entre cuentas no se cuenta dos veces', () => {
  it('«salió» ya no incluye lo que se pasó a otra cuenta', () => {
    expect(detalleDeCuenta(CUENTAS[0], false, fmt)).toBe('entró $13.606.900 · salió $6.200.000 · entre cuentas −$3.206.900')
  })
  it('una cuenta que solo recibió traslados no dice que le «entró» plata', () => {
    expect(detalleDeCuenta(CUENTAS[1], false, fmt)).toBe('entró $0 · salió $0 · entre cuentas +$1.856.900')
    expect(detalleDeCuenta(CUENTAS[2], false, fmt)).toBe('entró $0 · salió $0 · entre cuentas +$1.350.000')
  })
  it('entró − salió ± entre cuentas da, al peso, el saldo de cada fila', () => {
    for (const c of CUENTAS) {
      const entro = c.entradas - c.trasladoEntra
      const salio = c.salidas - c.trasladoSale
      expect(entro - salio + c.trasladado, c.nombre).toBe(c.neto)
    }
  })
  it('el saldo y el total no cambian', () => {
    const v = adaptarCuentas(CUENTAS, fmt)
    expect(v.numeros.total).toBe(7406900)
    expect(v.cuentas.map((c) => c.saldo)).toEqual(['$4.200.000', '$1.856.900', '$1.350.000'])
  })
  it('sin traslados, la línea es la de siempre', () => {
    expect(detalleDeCuenta({ entradas: 500000, salidas: 200000, trasladado: 0 }, false, fmt)).toBe('entró $500.000 · salió $200.000')
  })
  it('el servidor manda las dos mitades del traslado', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('lib/capital.js', 'utf8')
    expect(src).toMatch(/acc\.trasladoEntra \+= v; acc\.entradas \+= v/)
    expect(src).toMatch(/acc\.trasladoSale \+= v; acc\.salidas \+= v/)
  })
})
