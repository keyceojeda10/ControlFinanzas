import { describe, it, expect } from 'vitest'
import { adaptarRutas, adaptarSinRuta, porcentajeDelDia, sinNadaQueCobrar } from '@/lib/adaptadores/rutas'

describe('porcentajeDelDia', () => {
  it('es el recaudado sobre lo esperado', () => {
    expect(porcentajeDelDia(90000, 151700)).toBe(59)
  })

  it('devuelve 0 cuando no había nada que cobrar, no NaN ni Infinity', () => {
    // La división por cero es la vía por la que una ruta tranquila termina
    // mostrando "NaN%" o "Infinity%" en la pantalla del dueño.
    expect(porcentajeDelDia(0, 0)).toBe(0)
    expect(porcentajeDelDia(50000, 0)).toBe(0)
    expect(porcentajeDelDia(0, null)).toBe(0)
  })

  it('no pasa de 100: cobrar de más no es cumplir el 140%', () => {
    expect(porcentajeDelDia(140000, 100000)).toBe(100)
  })
})

describe('sinNadaQueCobrar', () => {
  it('una ruta sin cobros programados no está fallando', () => {
    expect(sinNadaQueCobrar(0)).toBe(true)
    expect(sinNadaQueCobrar(null)).toBe(true)
    expect(sinNadaQueCobrar(undefined)).toBe(true)
  })

  it('con algo esperado, sí se le puede exigir', () => {
    expect(sinNadaQueCobrar(24000)).toBe(false)
  })
})

describe('adaptarRutas', () => {
  const crudas = [
    { id: 'a', nombre: 'Ruta norte', cobrador: { id: 'u1', nombre: 'Davi' },
      cantidadClientes: 12, esperadoHoy: 151700, recaudadoHoy: 90000 },
    { id: 'b', nombre: 'Ruta de pepito', cobrador: null,
      cantidadClientes: 1, esperadoHoy: 24000, recaudadoHoy: 0 },
    { id: 'c', nombre: 'Ruta goty 1', cobrador: { id: 'u2', nombre: 'Camilo' },
      cantidadClientes: 4, esperadoHoy: 0, recaudadoHoy: 0 },
  ]

  it('saca el nombre del cobrador, no el objeto', () => {
    expect(adaptarRutas(crudas, 'CO')[0].cobrador).toBe('Davi')
  })

  it('deja el cobrador en null cuando no hay: es lo que dispara "sin cobrador"', () => {
    // Un string vacío o "—" haría que la ruta huérfana se lea como una más.
    expect(adaptarRutas(crudas, 'CO')[1].cobrador).toBeNull()
  })

  it('marca inactiva la ruta sin cobros de hoy', () => {
    const r = adaptarRutas(crudas, 'CO')
    expect(r[0].inactiva).toBe(false)
    expect(r[2].inactiva).toBe(true)
  })

  it('formatea los montos como plata, no como número suelto', () => {
    const r = adaptarRutas(crudas, 'CO')[0]
    expect(r.recaudado).toContain('90.000')
    expect(r.esperado).toContain('151.700')
  })

  it('sobrevive a una respuesta vacía', () => {
    expect(adaptarRutas([], 'CO')).toEqual([])
    expect(adaptarRutas(undefined, 'CO')).toEqual([])
  })

  it('no inventa ceros: sin clientes son 0 clientes, no undefined', () => {
    const [r] = adaptarRutas([{ id: 'x', nombre: 'Y' }], 'CO')
    expect(r.clientes).toBe(0)
    expect(r.porcentaje).toBe(0)
  })
})

describe('adaptarSinRuta', () => {
  it('no devuelve tarjeta cuando no hay huérfanos', () => {
    expect(adaptarSinRuta({ totalSinRuta: 0 }, 'CO')).toBeNull()
    expect(adaptarSinRuta(null, 'CO')).toBeNull()
  })

  it('devuelve la cantidad y, si viene, el monto', () => {
    expect(adaptarSinRuta({ totalSinRuta: 3, montoSinRuta: 1240000 }, 'CO'))
      .toMatchObject({ cantidad: 3 })
    expect(adaptarSinRuta({ totalSinRuta: 3, montoSinRuta: 1240000 }, 'CO').monto)
      .toContain('1.240.000')
  })

  it('sin monto, la tarjeta sigue apareciendo: el agujero existe igual', () => {
    expect(adaptarSinRuta({ totalSinRuta: 3 }, 'CO')).toEqual({ cantidad: 3, monto: null })
  })
})
