import { describe, it, expect } from 'vitest'
import { toWaNumber, telefonoEnviable } from '../bot/whatsapp-cloud'

// Casos REALES sacados de produccion que estaban llegando crudos a Meta:
//   '0000000000'  -> #131009 dos veces al dia por 17 dias (una sola org)
//   '13001234567' -> movil colombiano con prefijo 1 (EE.UU.) -> #131026 (16 numeros)

describe('toWaNumber: normaliza lo arreglable', () => {
  it('movil colombiano de 10 digitos -> 57 + numero', () => {
    expect(toWaNumber('3001234567')).toBe('573001234567')
  })
  it('acepta formato con espacios/guiones', () => {
    expect(toWaNumber('300 123 4567')).toBe('573001234567')
    expect(toWaNumber('+57 300-123-4567')).toBe('573001234567')
  })
  it('ya normalizado se queda igual', () => {
    expect(toWaNumber('573001234567')).toBe('573001234567')
  })
  it('prefijo 1 (EE.UU.) mal guardado en movil colombiano -> corrige a 57', () => {
    expect(toWaNumber('13001234567')).toBe('573001234567')
    expect(toWaNumber('13173335889')).toBe('573173335889')
  })
  it('numero internacional valido se respeta (ej: Costa Rica +506)', () => {
    expect(toWaNumber('50688881702')).toBe('50688881702')
  })
})

describe('toWaNumber: RECHAZA la basura (devuelve null)', () => {
  it('todo ceros (el caso que genero el bucle de 17 dias)', () => {
    expect(toWaNumber('0000000000')).toBeNull()
  })
  it('digitos repetidos', () => {
    expect(toWaNumber('1111111111')).toBeNull()
  })
  it('vacio / null / undefined', () => {
    expect(toWaNumber('')).toBeNull()
    expect(toWaNumber(null)).toBeNull()
    expect(toWaNumber(undefined)).toBeNull()
  })
  it('demasiado corto', () => {
    expect(toWaNumber('12345')).toBeNull()
  })
  it('demasiado largo (mas de 15, fuera de E.164)', () => {
    expect(toWaNumber('1234567890123456')).toBeNull()
  })
  it('empieza en 0 (E.164 no admite el 0 nacional)', () => {
    expect(toWaNumber('031234567890')).toBeNull()
  })
  it('texto sin digitos', () => {
    expect(toWaNumber('no tiene')).toBeNull()
  })
})

describe('telefonoEnviable', () => {
  it('true para un movil valido', () => {
    expect(telefonoEnviable('3001234567')).toBe(true)
  })
  it('false para el telefono del bucle', () => {
    expect(telefonoEnviable('0000000000')).toBe(false)
  })
})
