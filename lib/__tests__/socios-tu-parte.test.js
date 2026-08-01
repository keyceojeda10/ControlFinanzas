// «Tu parte» (T45-04) — la resta que decide si el dueño usa el módulo.
//
// La lámina: «Sin ese dato, el dueño no sabe si los $1.240.000 que va a repartir
// son toda su ganancia o una parte, y esa duda es la que hace que nadie use el
// módulo.»
//
// Se prueba el CONTRATO con la tarjeta que lo consume, no la aritmética contra
// sí misma: lo que importa es que `propio` salga formateado, que la nota diga
// las dos cifras, y que los casos raros no inventen un número.

import { describe, it, expect } from 'vitest'
import { tuParte } from '../adaptadores/socios'

const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

describe('tuParte', () => {
  it('resta lo de los socios de lo que hay en la calle', () => {
    const r = tuParte({ capitalEnCalle: 27_600_000, puestoPorSocios: 12_000_000 }, fmt)
    expect(r.propio).toBe(fmt(15_600_000))
    expect(r.nota).toContain(fmt(12_000_000))
    expect(r.nota).toContain(fmt(27_600_000))
  })

  it('sin socios no hay tarjeta — no hay nada que separar', () => {
    expect(tuParte({ capitalEnCalle: 27_600_000, puestoPorSocios: 0 }, fmt)).toBeNull()
  })

  it('si los socios pusieron más de lo prestado, lo dice en vez de enseñar $0 a secas', () => {
    // Pasa de verdad: parte de su plata está en caja, no en la calle.
    const r = tuParte({ capitalEnCalle: 5_000_000, puestoPorSocios: 12_000_000 }, fmt)
    expect(r.propio).toBe(fmt(0))
    expect(r.nota).toContain('en caja')
  })

  it('no revienta ni inventa con datos ausentes', () => {
    expect(tuParte(undefined, fmt)).toBeNull()
    expect(tuParte({ capitalEnCalle: null, puestoPorSocios: null }, fmt)).toBeNull()
  })

  it('el número que recibe tiene que ser número: un texto formateado no cuenta', () => {
    // El fallo real: la página le pasaba `puesto.total`, que es «$14.000.000».
    // Si eso colara como cifra, la tarjeta enseñaría una resta falsa.
    expect(tuParte({ capitalEnCalle: 27_600_000, puestoPorSocios: '$12.000.000' }, fmt)).toBeNull()
  })
})
