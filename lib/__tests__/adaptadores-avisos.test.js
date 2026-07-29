import { describe, it, expect } from 'vitest'
import { ordenarAvisos, pesoDe, PRIORIDAD } from '@/lib/adaptadores/avisos'

// «Una sola franja de aviso, la de mayor prioridad, y el resto a la campana.»
// Cuatro franjas ámbar seguidas no son cuatro avisos: son una pared. Y cuando
// todo está en ámbar, nada lo está.

describe('el orden lo decide el dinero en juego', () => {
  it('lo que IMPIDE COBRAR va antes que lo que caduca', () => {
    expect(pesoDe('sinRuta')).toBeLessThan(pesoDe('suscripcion'))
    expect(pesoDe('sinRuta')).toBeLessThan(pesoDe('limitePlan'))
  })

  it('lo cómodo va al final: no pierdes un peso por no hacerlo hoy', () => {
    expect(pesoDe('verificarCorreo')).toBeGreaterThan(pesoDe('suscripcion'))
    expect(pesoDe('instalarApp')).toBeGreaterThan(pesoDe('limitePlan'))
  })

  it('el negocio de la app NUNCA abre la pantalla si hay plata parada', () => {
    const { principal } = ordenarAvisos([
      { id: 'instalarApp' }, { id: 'suscripcion' }, { id: 'sinRuta' },
    ])
    expect(principal.id).toBe('sinRuta')
  })

  it('un aviso desconocido va al final, no delante de todo', () => {
    const { principal } = ordenarAvisos([{ id: 'algoNuevo' }, { id: 'verificarCorreo' }])
    expect(principal.id).toBe('verificarCorreo')
  })
})

describe('solo uno arriba', () => {
  it('el resto se cuenta, no se apila', () => {
    const r = ordenarAvisos([{ id: 'verificarCorreo' }, { id: 'limitePlan' }, { id: 'instalarApp' }])
    expect(r.principal.id).toBe('limitePlan')
    expect(r.cuantosMas).toBe(2)
    expect(r.textoResto).toBe('Hay 2 avisos más de la app')
  })

  it('en singular no dice «1 avisos»', () => {
    expect(ordenarAvisos([{ id: 'limitePlan' }, { id: 'instalarApp' }]).textoResto)
      .toBe('Hay 1 aviso más de la app')
  })

  it('con uno solo no hay nada que contar', () => {
    const r = ordenarAvisos([{ id: 'limitePlan' }])
    expect(r.cuantosMas).toBe(0)
    expect(r.textoResto).toBeNull()
  })

  it('sin avisos no se pinta franja', () => {
    expect(ordenarAvisos([]).principal).toBeNull()
    expect(ordenarAvisos(null).principal).toBeNull()
  })
})

describe('estabilidad', () => {
  it('dos avisos igual de urgentes no bailan de sitio entre recargas', () => {
    const entrada = [{ id: 'suscripcion' }, { id: 'limitePlan' }]
    expect(PRIORIDAD.suscripcion).toBe(PRIORIDAD.limitePlan)
    // Mismo peso → se respeta el orden de entrada, siempre.
    expect(ordenarAvisos(entrada).principal.id).toBe('suscripcion')
    expect(ordenarAvisos(entrada).principal.id).toBe('suscripcion')
  })
})
