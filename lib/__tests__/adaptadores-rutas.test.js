import { describe, it, expect } from 'vitest'
import { adaptarRutas, adaptarSinRuta, porcentajeDelDia, sinNadaQueCobrar , pastillaRuta, resumenDelDia, subtituloRuta } from '@/lib/adaptadores/rutas'

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

describe('T27-01 · dos cifras en vez de cinco', () => {
  const ruta = (o = {}) => ({
    id: 'r1', nombre: 'Ruta 2', cobrador: { nombre: 'Pepito Perez' },
    cantidadClientes: 5, esperadoHoy: 128500, recaudadoHoy: 34500,
    cobrosHoy: 5, cobradosHoy: 1, atrasados: 3, enMora: 0,
    proximoCobro: '2026-07-30T05:00:00.000Z', ...o,
  })

  it('«FALTA» es la resta ya hecha, no «de $X esperados»', () => {
    // El pie de la lamina: «es la resta que el cobrador hacia de cabeza».
    const [r] = adaptarRutas([ruta()], 'CO')
    expect(r.recaudado).toBe('$34.500')
    expect(r.falta).toBe('$94.000')
  })

  it('la falta NO baja de cero', () => {
    // Cobrar mas de la meta no es una falta negativa: es que ya esta.
    const [r] = adaptarRutas([ruta({ recaudadoHoy: 200000 })], 'CO')
    expect(r.falta).toBe('$0')
  })

  it('el subtitulo cuenta VISITAS: «Pepito · 1 de 5 cobros»', () => {
    // Por cliente, no por prestamo: uno con tres prestamos que vencen hoy es UNA
    // visita, y «3 de 5» mandaria al cobrador con la cuenta mal.
    expect(adaptarRutas([ruta()], 'CO')[0].subtitulo).toBe('Pepito \u00b7 1 de 5 cobros')
  })

  it('la pastilla dice mora O atraso, nunca las dos', () => {
    // Dos pastillas obligan a sumarlas para saber cuanta gente hay mal, y la que
    // importa es la peor.
    expect(pastillaRuta({ enMora: 4, atrasados: 3 })).toEqual({ texto: '4 en mora', tono: 'mora' })
    expect(pastillaRuta({ enMora: 0, atrasados: 3 })).toEqual({ texto: '3 atrasados', tono: 'atraso' })
    expect(pastillaRuta({ enMora: 0, atrasados: 1 })).toEqual({ texto: '1 atrasado', tono: 'atraso' })
    expect(pastillaRuta({ enMora: 0, atrasados: 0 })).toBeNull()
  })

  it('la ruta sin cobros hoy se colapsa y dice cuando vuelve', () => {
    // «Andres · sin cobros hoy · proximo jue 30». No tiene nada de hoy que
    // contar, asi que no gasta una tarjeta con dos cifras en cero.
    const [r] = adaptarRutas([ruta({ esperadoHoy: 0, recaudadoHoy: 0, cobrosHoy: 0 })], 'CO')
    expect(r.inactiva).toBe(true)
    expect(r.subtitulo).toMatch(/^Pepito \u00b7 sin cobros hoy \u00b7 pr\u00f3ximo /)
  })

  it('el resumen suma SOLO las rutas con cobros hoy', () => {
    // Incluir el esperado de una ruta a la que hoy no le toca inflaria la meta,
    // que es el defecto que ya se corrigio en el hero del panel.
    const r = resumenDelDia([
      ruta(),
      ruta({ id: 'r2', esperadoHoy: 79000, recaudadoHoy: 0 }),
      ruta({ id: 'r3', esperadoHoy: 0, recaudadoHoy: 0 }),
    ], 'CO')
    expect(r).toBe('3 rutas \u00b7 $34.500 de $207.500 hoy')
  })

  it('sin cobros en ninguna, lo dice en palabras', () => {
    // «0 de $0 hoy» no significa nada.
    expect(resumenDelDia([ruta({ esperadoHoy: 0 })], 'CO')).toBe('1 ruta \u00b7 sin cobros hoy')
    expect(resumenDelDia([], 'CO')).toBeNull()
  })
})
