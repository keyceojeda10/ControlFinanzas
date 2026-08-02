// «NUEVO» = creado en las ÚLTIMAS 24 HORAS.
//
// El dueño: «el estado "Nuevo" no sale, debería identificarse fácilmente cuáles
// clientes y cuáles préstamos son nuevos (creados en las últimas 24 horas);
// después de ese tiempo ya no serían nuevos».
//
// Antes esto usaba `isHoy`, que compara el DÍA DE CALENDARIO. Suena razonable
// —«la jornada de hoy»— pero el rótulo duraba entre diez minutos y un día entero
// según la hora en que se tecleara: uno metido a las 23:50 dejaba de ser nuevo
// diez minutos después. Estas pruebas fijan la ventana de 24 horas, que dura lo
// mismo para todos.

import { describe, it, expect } from 'vitest'
import { esNuevo, adaptarClientes } from '../adaptadores/clientes'
import { adaptarPrestamos } from '../adaptadores/prestamos'

const haceHoras = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

describe('la ventana de 24 horas', () => {
  it('recién creado es nuevo', () => {
    expect(esNuevo({ createdAt: new Date().toISOString() })).toBe(true)
  })

  it('a las 23 horas TODAVÍA es nuevo', () => {
    expect(esNuevo({ createdAt: haceHoras(23) })).toBe(true)
  })

  it('a las 25 horas YA NO', () => {
    expect(esNuevo({ createdAt: haceHoras(25) })).toBe(false)
  })

  it('NO depende de la hora del día — es lo que arregla', () => {
    // Con `isHoy`, uno de hace 2 horas creado ayer a las 23:50 daba `false`
    // mientras otro de hace 20 horas creado hoy a las 00:10 daba `true`. La
    // ventana los trata igual: los dos por debajo de 24, los dos nuevos.
    expect(esNuevo({ createdAt: haceHoras(2) })).toBe(true)
    expect(esNuevo({ createdAt: haceHoras(20) })).toBe(true)
  })

  it('sin fecha, no es nuevo', () => {
    expect(esNuevo({})).toBe(false)
    expect(esNuevo(null)).toBe(false)
    expect(esNuevo({ createdAt: 'no es una fecha' })).toBe(false)
  })

  it('el FUTURO no es nuevo', () => {
    // Un `createdAt` adelantado por un reloj desajustado dejaría la etiqueta
    // pegada para siempre.
    expect(esNuevo({ createdAt: haceHoras(-5) })).toBe(false)
  })
})

describe('llega a las dos pantallas', () => {
  it('los clientes lo traen', () => {
    const [a] = adaptarClientes([{ id: 'c1', nombre: 'Ana', createdAt: haceHoras(1) }], 'co')
    expect(a.nuevo).toBe(true)
  })

  it('y los PRÉSTAMOS también, que era donde faltaba', () => {
    // No existía: un préstamo recién metido no se distinguía en la lista de los
    // mil que llevan meses.
    const [a] = adaptarPrestamos([{
      id: 'p1', cliente: { nombre: 'Ana' }, montoPrestado: 100000,
      totalAPagar: 124000, totalPagado: 0, createdAt: haceHoras(1),
    }], 'co')
    expect(a.nuevo).toBe(true)
  })

  it('y el viejo NO lo trae', () => {
    const [a] = adaptarPrestamos([{
      id: 'p2', cliente: { nombre: 'Ana' }, montoPrestado: 100000,
      totalAPagar: 124000, totalPagado: 0, createdAt: haceHoras(48),
    }], 'co')
    expect(a.nuevo).toBe(false)
  })
})
