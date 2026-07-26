import { describe, it, expect } from 'vitest'
import { soloDecimal } from '../i18n'

describe('soloDecimal (entrada de tasa en movil)', () => {
  it('acepta punto', () => expect(soloDecimal('7.5')).toBe('7.5'))
  it('acepta coma y la vuelve punto', () => expect(soloDecimal('7,5')).toBe('7.5'))
  it('quita letras y simbolos', () => expect(soloDecimal('7.5%')).toBe('7.5'))
  it('deja escribir el punto al final', () => expect(soloDecimal('7.')).toBe('7.'))
  it('colapsa varios separadores a un solo punto', () => {
    expect(soloDecimal('7.5.3')).toBe('7.53')
    expect(soloDecimal('1,2,3')).toBe('1.23')
  })
  it('vacio y null', () => {
    expect(soloDecimal('')).toBe('')
    expect(soloDecimal(null)).toBe('')
  })
  it('entero simple intacto', () => expect(soloDecimal('20')).toBe('20'))
})
