// El soporte de Jannette Díaz (12 oct 2026): ver lib/dinero/cuota-de-referencia.js.
import { describe, it, expect } from 'vitest'
import { cuotaDeReferencia, comoFueElPago, textoDelPago } from '@/lib/dinero/cuota-de-referencia'

describe('cuotaDeReferencia: la misma que propone la hoja', () => {
  it('la cuota entera', () => expect(cuotaDeReferencia({ cuota: 450000, saldo: 1800000, alDia: 450000 })).toBe(450000))
  it('lo que falta de una cuota a medias', () => expect(cuotaDeReferencia({ cuota: 325000, saldo: 900000, alDia: 250000 })).toBe(250000))
  it('debe tres cuotas: la referencia sigue siendo UNA cuota', () => expect(cuotaDeReferencia({ cuota: 20000, saldo: 400000, alDia: 60000 })).toBe(20000))
  it('nunca más que el saldo (la última cuota pequeña)', () => expect(cuotaDeReferencia({ cuota: 20000, saldo: 7000, alDia: 0 })).toBe(7000))
  it('sin cuota no hay referencia', () => expect(cuotaDeReferencia({ cuota: 0, saldo: 500000 })).toBeNull())
})

describe('comoFueElPago', () => {
  it('Jannette: $200.000 de $450.000 es PARCIAL, aunque tipo diga completo', () => {
    const c = comoFueElPago({ tipo: 'completo', montoPagado: 200000, cuotaEsperada: 450000 })
    expect(c).toEqual({ clase: 'parcial', cuota: 450000, diferencia: -250000 })
    expect(textoDelPago(c)).toEqual({ etiqueta: 'Parcial', detalle: 'Le tocaba $450.000 · pagó $200.000 · faltaron $250.000' })
  })
  it('$500.000 sobre $450.000: con $50.000 de más', () => {
    const c = comoFueElPago({ tipo: 'completo', montoPagado: 500000, cuotaEsperada: 450000 })
    expect(textoDelPago(c)).toEqual({ etiqueta: 'Con extra', detalle: 'Le tocaba $450.000 · pagó $50.000 de más' })
  })
  it('exacto: completo', () => expect(comoFueElPago({ tipo: 'parcial', montoPagado: 250000, cuotaEsperada: 250000 }).clase).toBe('completo'))
  it('pagos de antes (sin cuotaEsperada): lo que diga tipo', () => {
    expect(comoFueElPago({ tipo: 'completo', montoPagado: 1, cuotaEsperada: null }).clase).toBe('completo')
    expect(comoFueElPago({ tipo: 'parcial', montoPagado: 1 }).clase).toBe('parcial')
  })
  it('capital, interés, recargo… no se comparan con la cuota', () => {
    for (const tipo of ['capital', 'intereses', 'recargo', 'descuento', 'liquidacion']) expect(comoFueElPago({ tipo, montoPagado: 1, cuotaEsperada: 450000 })).toBeNull()
  })
})
