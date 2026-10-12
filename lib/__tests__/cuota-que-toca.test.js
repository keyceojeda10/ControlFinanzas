// La cuota que toca ahora (12 oct 2026): ver `calcularCuotaQueToca` en lib/calculos.js.
import { describe, it, expect } from 'vitest'
import { calcularCuotaQueToca } from '@/lib/calculos'

const DIA = 86400000
const mensual = (diasDesdeInicio, pagos = []) => ({
  estado: 'activo', frecuencia: 'mensual', modoInteres: 'fijo', cuotaDiaria: 450000,
  montoPrestado: 1500000, totalAPagar: 1800000, diasPlazo: 120, tasaInteres: 5,
  fechaInicio: new Date(Date.now() - diasDesdeInicio * DIA),
  pagos: pagos.map((m, i) => ({ id: String(i), tipo: 'completo', montoPagado: m, fechaPago: new Date() })),
})

describe('calcularCuotaQueToca', () => {
  it('Jannette, antes del vencimiento y sin pagos: la cuota entera', () => {
    expect(calcularCuotaQueToca(mensual(2))).toBe(450000)
  })
  it('ya adelantó $200.000 de esta cuota: tocan $250.000 (antes proponía $450.000)', () => {
    expect(calcularCuotaQueToca(mensual(2, [200000]))).toBe(250000)
  })
  it('adelantó la cuota entera: toca la siguiente completa', () => {
    expect(calcularCuotaQueToca(mensual(2, [450000]))).toBe(450000)
  })
  it('adelantó $500.000: de la siguiente faltan $400.000', () => {
    expect(calcularCuotaQueToca(mensual(2, [500000]))).toBe(400000)
  })
  it('atrasado una cuota sin pagos: la cuota (no las acumuladas)', () => {
    expect(calcularCuotaQueToca(mensual(65))).toBe(450000)
  })
  it('atrasado con una cuota a medias: lo que falta de ella', () => {
    expect(calcularCuotaQueToca(mensual(35, [200000]))).toBe(250000)
  })
  it('nunca más que el saldo', () => {
    expect(calcularCuotaQueToca(mensual(2, [1700000]))).toBe(100000)
  })
  it('sin cuota o inactivo: null', () => {
    expect(calcularCuotaQueToca({ ...mensual(2), cuotaDiaria: 0 })).toBeNull()
    expect(calcularCuotaQueToca({ ...mensual(2), estado: 'completado' })).toBeNull()
  })
})
