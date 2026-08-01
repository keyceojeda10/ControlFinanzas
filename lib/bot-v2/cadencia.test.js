import { describe, it, expect } from 'vitest'
import {
  accionTrasThrottle,
  MAX_REBOTES_THROTTLE,
  rachaSinRespuesta,
  reintentarEnVentana,
  MAX_RACHA_SIN_RESPUESTA,
} from './cadencia.js'

describe('accionTrasThrottle', () => {
  it('al primer rebote devuelve el intento (le da una segunda oportunidad)', () => {
    expect(accionTrasThrottle(1)).toBe('devolver-intento')
  })

  it('al segundo rebote deja de insistir', () => {
    expect(accionTrasThrottle(2)).toBe('dejar-de-insistir')
  })

  it('nunca vuelve a devolver el intento por encima del tope', () => {
    // El bug de produccion: 5 rebotes en 5 dias y el contador seguia en cero
    // porque el intento se devolvia SIEMPRE.
    for (const rebotes of [3, 4, 5, 12]) {
      expect(accionTrasThrottle(rebotes), `rebotes=${rebotes}`).toBe('dejar-de-insistir')
    }
  })

  it('trata valores raros como cero en vez de reventar', () => {
    expect(accionTrasThrottle(undefined)).toBe('devolver-intento')
    expect(accionTrasThrottle(null)).toBe('devolver-intento')
    expect(accionTrasThrottle(NaN)).toBe('devolver-intento')
  })

  it('el tope es finito: sin esto el bucle no tiene salida', () => {
    expect(MAX_REBOTES_THROTTLE).toBeGreaterThan(0)
    expect(Number.isFinite(MAX_REBOTES_THROTTLE)).toBe(true)
  })
})

describe('rachaSinRespuesta', () => {
  it('cuenta los mensajes del bot desde el final hasta la ultima respuesta', () => {
    expect(rachaSinRespuesta([
      { rol: 'bot' }, { rol: 'lead' }, { rol: 'bot' }, { rol: 'bot' },
    ])).toBe(2)
  })

  it('se corta en la respuesta del lead', () => {
    expect(rachaSinRespuesta([{ rol: 'bot' }, { rol: 'bot' }, { rol: 'lead' }])).toBe(0)
  })

  it('aguanta historial vacio o invalido', () => {
    expect(rachaSinRespuesta([])).toBe(0)
    expect(rachaSinRespuesta(null)).toBe(0)
  })
})

describe('reintentarEnVentana', () => {
  it('no reintenta el mismo dia si la ventana esta cerrada', () => {
    expect(reintentarEnVentana([], false)).toBe(false)
  })

  it('reintenta si es el primer mensaje del hilo y la ventana esta abierta', () => {
    expect(reintentarEnVentana([{ rol: 'lead' }], true)).toBe(true)
  })

  it('deja de reintentar al llegar al tope de mensajes seguidos', () => {
    // +1 por el mensaje recien enviado que aun no esta en el historial
    const historial = Array.from({ length: MAX_RACHA_SIN_RESPUESTA }, () => ({ rol: 'bot' }))
    expect(reintentarEnVentana(historial, true)).toBe(false)
  })
})
