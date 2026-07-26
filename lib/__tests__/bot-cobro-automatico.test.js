import { describe, it, expect } from 'vitest'
import { sanitizar, detectarViolaciones } from '../bot-v2/sanitizador'

// Frase REAL que el bot le dijo a una lead en produccion (26 jul 2026) cuando ella
// pregunto "Es con debito automatico o debo transferir?":
//   "El cobro es automatico. Se debita de tu cuenta bancaria todos los meses el dia
//    que vence tu plan."
// Es FALSO: en Colombia se paga por checkout de Wompi cuando el prestamista decide
// (el recurrente de MercadoPago esta desactivado). Es la pregunta mas sensible del
// embudo, asi que no puede pasar el filtro.

const FRASE_REAL = 'El cobro es automatico. Se debita de tu cuenta bancaria todos los meses el dia que vence tu plan.'

describe('sanitizador: cobro automatico / debito de cuenta', () => {
  it('borra la frase real que dijo el bot', () => {
    const out = sanitizar(FRASE_REAL)
    expect(out.toLowerCase()).not.toContain('debita')
    expect(out.toLowerCase()).not.toContain('cuenta bancaria')
    expect(out.toLowerCase()).not.toMatch(/cobro es autom/)
  })

  it('la detecta como violacion (para poder medirla)', () => {
    expect(detectarViolaciones(FRASE_REAL)).toContain('cobro_automatico_inventado')
  })

  it('atrapa la variante con tilde', () => {
    const out = sanitizar('Se débita de su cuenta cada mes.')
    expect(out.toLowerCase()).not.toContain('débita')
    expect(detectarViolaciones('Se débita de su cuenta cada mes.')).toContain('cobro_automatico_inventado')
  })

  it('atrapa "pago automatico" y "descuento automatico"', () => {
    expect(detectarViolaciones('El pago es automatico cada mes.')).toContain('cobro_automatico_inventado')
    expect(detectarViolaciones('Hay descuento automatico de la tarjeta.')).toContain('cobro_automatico_inventado')
  })

  it('NO borra funciones reales que si son automaticas (calculo de cuotas/mora)', () => {
    const ok = 'El sistema calcula las cuotas y la mora automaticamente.'
    const out = sanitizar(ok)
    expect(out).toContain('calcula')
    expect(out.toLowerCase()).toContain('automatica')
    expect(detectarViolaciones(ok)).not.toContain('cobro_automatico_inventado')
  })

  it('no deja el mensaje vacio: cae al fallback', () => {
    const out = sanitizar('Se debita de tu cuenta.')
    expect(out.trim().length).toBeGreaterThan(0)
  })
})
