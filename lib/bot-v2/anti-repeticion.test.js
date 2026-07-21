import { describe, it, expect } from 'vitest'
import { esRepetido, variarSiRepetido, normalizar, CIERRES_SUAVES } from './anti-repeticion.js'

const conCierre = (texto) => ([
  { rol: 'lead', texto: 'ok' },
  { rol: 'bot', texto },
  { rol: 'lead', texto: 'listo' },
])

describe('anti-repetición — detecta el calco', () => {
  it('normaliza tildes y puntuación', () => {
    expect(normalizar('Perfecto, ¿sí señor?')).toBe('perfecto si senor')
  })

  it('atrapa el mensaje idéntico', () => {
    const h = conCierre('Perfecto, cualquier cosa me avisa.')
    expect(esRepetido('Perfecto, cualquier cosa me avisa.', h)).toBe(true)
  })

  it('atrapa el casi-idéntico (el caso real de producción)', () => {
    // "cualquier cosa" -> "cualquier pregunta": salía así, dos veces seguidas.
    const h = conCierre('Perfecto, cualquier cosa me avisa.')
    expect(esRepetido('Perfecto, cualquier pregunta me avisa.', h)).toBe(true)
  })

  it('NO toca un mensaje largo con contenido real', () => {
    const h = conCierre('Perfecto, cualquier cosa me avisa.')
    const largo = 'Con el sistema usted ve al segundo lo que cada cobrador cobro, sin tener que esperarlo, y sabe cuanto le deben en total.'
    expect(esRepetido(largo, h)).toBe(false)
    expect(variarSiRepetido(largo, h)).toBe(largo)
  })

  it('no marca repetido si no hay historial del bot', () => {
    expect(esRepetido('Listo, quedo atento.', [{ rol: 'lead', texto: 'ok' }])).toBe(false)
  })
})

describe('anti-repetición — varía cuando toca', () => {
  it('cambia el mensaje repetido por un cierre distinto', () => {
    const h = conCierre('Perfecto, cualquier cosa me avisa.')
    const salida = variarSiRepetido('Perfecto, cualquier cosa me avisa.', h)
    expect(salida).not.toBe('Perfecto, cualquier cosa me avisa.')
    expect(CIERRES_SUAVES).toContain(salida)
  })

  it('no reutiliza un cierre que ya se usó', () => {
    const h = [
      { rol: 'bot', texto: CIERRES_SUAVES[0] },
      { rol: 'lead', texto: 'ok' },
    ]
    const salida = variarSiRepetido(CIERRES_SUAVES[0], h)
    expect(salida).not.toBe(CIERRES_SUAVES[0])
  })
})
