// «SIN RUTA» en vez de una celda en blanco.
//
// El dueño: «en clientes, en ese modo de lista, a los clientes que no tienen
// ruta salen en blanco, y más bien debería decir algo como sin ruta».
//
// Un hueco no se distingue de un dato que no ha cargado. Y un cliente sin ruta
// no es un dato que falte: es un estado real y accionable —hay que asignarle
// una—, así que se dice con palabras.

import { describe, it, expect } from 'vitest'
import { piezasDeCliente, adaptarClientes } from '../adaptadores/clientes'

describe('la ruta de un cliente siempre dice algo', () => {
  it('con ruta, su nombre', () => {
    expect(piezasDeCliente({ rutaNombre: 'RUTA #1' }).ruta).toBe('RUTA #1')
  })

  it('sin ruta, «Sin ruta» — nunca vacío', () => {
    expect(piezasDeCliente({ rutaNombre: null }).ruta).toBe('Sin ruta')
    expect(piezasDeCliente({ rutaNombre: '' }).ruta).toBe('Sin ruta')
    expect(piezasDeCliente({}).ruta).toBe('Sin ruta')
  })

  it('y llega a la lista', () => {
    const [a] = adaptarClientes([{ id: 'c1', nombre: 'Ana' }], 'co')
    expect(a.piezas.ruta).toBe('Sin ruta')
  })
})
