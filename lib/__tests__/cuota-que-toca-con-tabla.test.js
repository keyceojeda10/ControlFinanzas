// Crediya, Jhon Arteaga (15 oct 2026): préstamo sobre saldo, cuotas distintas y
// abonos a capital de $3.500. La app dijo «le tocaba $93.500» cuando le tocaban
// $104.000, y tras pagar $120.000 la ficha dijo «parcial, faltan $90.000».
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcularCuotaQueToca } from '@/lib/calculos'
import { faltaDeLaCuotaDeHoy, comoFueElPago } from '@/lib/dinero/cuota-de-referencia'

const DIA = 86400000
const hoy = Date.now()
const FILAS = [
  [1, -60, 89350, 27150, 116500, 510650], [2, -45, 92751, 22949, 115700, 414399],
  [3, -30, 96107, 18593, 114700, 314792], [4, -15, 99214, 14086, 113300, 212078],
  [5, 0, 103703, 9597, 113300, 108375], [6, 15, 108375, 4904, 113279, 0],
].map(([n, d, capital, interes, cuotaTotal, saldoRestante]) => ({
  numeroPeriodo: n, fechaEsperada: new Date(hoy + d * DIA), capital, interes, cuotaTotal, saldoRestante, pagado: 0, interesPagado: 0,
}))
const PAGOS = [116500, ['capital', 3500], 116500, ['capital', 3500], 116500, ['capital', 3500], 120000]
const arteaga = (extra = []) => {
  const pagos = [...PAGOS, ...extra].map((x, i) => {
    const [tipo, montoPagado] = Array.isArray(x) ? x : ['completo', x]
    return { id: String(i), tipo, montoPagado, fechaPago: new Date(hoy - (60 - i) * DIA) }
  })
  return {
    estado: 'activo', frecuencia: 'quincenal', modoInteres: 'saldo', cuotaDiaria: 116500, tasaInteres: 9.05,
    montoPrestado: 600000, totalAPagar: 697279, fechaInicio: new Date(hoy - 75 * DIA), diasPlazo: 90,
    totalPagado: pagos.reduce((s, p) => s + p.montoPagado, 0), pagos, cuotasAmortizacion: FILAS,
  }
}

describe('la cuota que toca, en un préstamo con tabla', () => {
  it('lo que falta de la cuota 5, sin contar los abonos a capital como cuota', () => {
    // Cuotas 1-5 = 573.500; pagado contra la tabla = 480.000 − 10.500 de abonos.
    expect(calcularCuotaQueToca(arteaga())).toBe(104000)
  })
  it('tras pagar $120.000: lo que falta de la cuota 6, no la cuota fija menos el extra', () => {
    expect(calcularCuotaQueToca(arteaga([120000]))).toBe(97279)
  })
})

describe('el aviso «cobrado hoy · parcial»', () => {
  const p = (montoPagado, cuotaEsperada, min, tipo = 'completo') => ({ tipo, montoPagado, cuotaEsperada, createdAt: new Date(Date.UTC(2026, 9, 15, 14, min)) })
  it('un pago con extra no deja nada por cobrar', () => {
    expect(faltaDeLaCuotaDeHoy([p(120000, 104000, 0)])).toBe(0)
    expect(comoFueElPago(p(120000, 104000, 0)).clase).toBe('extra')
  })
  it('Jannette: $200.000 de una cuota de $450.000 → faltan $250.000; y al completarlo, nada', () => {
    expect(faltaDeLaCuotaDeHoy([p(200000, 450000, 0)])).toBe(250000)
    expect(faltaDeLaCuotaDeHoy([p(250000, 250000, 5), p(200000, 450000, 0)])).toBe(0)
  })
  it('sin cuota guardada no sabe (null) y los abonos a capital no cuentan', () => {
    expect(faltaDeLaCuotaDeHoy([p(200000, null, 0)])).toBeNull()
    expect(faltaDeLaCuotaDeHoy([p(50000, null, 0, 'capital')])).toBeNull()
  })
  it('la ficha lo usa antes que la deducción por la cuota que toca', () => {
    const f = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
    expect(f).toMatch(/const faltaHoy = faltaDeLaCuotaDeHoy\(pagosDelDia\(\{ pagos \}\)\)\s+const restaDeLaCuota = faltaHoy !== null/)
  })
})
