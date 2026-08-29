import { describe, it, expect } from 'vitest'
import {
  accionTrasThrottle,
  MAX_REBOTES_THROTTLE,
  rachaSinRespuesta,
  reintentarEnVentana,
  MAX_RACHA_SIN_RESPUESTA,
  CODIGOS_SIN_VUELTA,
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

  it('⚠ el 130472 se planta al PRIMER rebote: nunca se recupera', () => {
    /* Medido sobre 30 días de producción: 19 reintentos tras un 130472
       —«el número está en un experimento de Meta»— y CERO llegaron. Cada uno es
       un rebote más contra la reputación del número, que decide la entrega de
       todos los demás mensajes. Insistir ahí es pagar sin comprar.

       Los otros códigos sí se recuperan y por eso conservan su segunda
       oportunidad: 131049 acierta el 55 %. */
    expect(accionTrasThrottle(1, 130472)).toBe('dejar-de-insistir')
    expect(accionTrasThrottle(1, 131049)).toBe('devolver-intento')
    expect(accionTrasThrottle(1, 131026)).toBe('devolver-intento')
  })

  it('sin código se comporta como siempre', () => {
    /* La firma vieja seguía usándose en otros sitios cuando se añadió el
       segundo parámetro; que el comportamiento de antes no cambie es lo que
       permite meterlo sin revisar cada llamada. */
    expect(accionTrasThrottle(1)).toBe('devolver-intento')
    expect(accionTrasThrottle(2)).toBe('dejar-de-insistir')
    expect(accionTrasThrottle(1, null)).toBe('devolver-intento')
  })

  it('la lista de los que no tienen vuelta es corta y explícita', () => {
    /* Si crece, que sea con la misma prueba delante: cada código que entra aquí
       deja de recibir su segunda oportunidad, y eso solo se justifica con una
       medida que diga que esa oportunidad no acierta nunca. */
    expect([...CODIGOS_SIN_VUELTA]).toEqual([130472])
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
