// lib/__tests__/adaptadores-cobros.test.js
//
// «Cobrar hoy» — T02-02, «el arreglo del muro».

import { describe, it, expect } from 'vitest'
import {
  adaptarCobrosHoy, agruparPorRuta, ordenar, estadoDe, etiquetaAtraso, horaDe,
} from '@/lib/adaptadores/cobros'

const cliente = (over = {}) => ({
  id: 'c1', nombre: 'Carlos Chaparro', rutaId: 'r1', rutaNombre: 'Ruta #1',
  direccion: 'Santa Fe', cuota: 12000, saldoTotal: 160000, diasMora: 36,
  pagoHoy: false, ...over,
})

describe('el estado y su etiqueta', () => {
  it('el umbral es el mismo del resto del sistema: 7 días', () => {
    expect(estadoDe({ diasMora: 0 })).toBe('aldia')
    expect(estadoDe({ diasMora: 7 })).toBe('atraso')
    expect(estadoDe({ diasMora: 8 })).toBe('mora')
  })

  it('la pastilla dice SOLO los días — manda T03-01, no T02-02', () => {
    // Fijaba «36d de atraso», que es T02-02. El turno 03 la recorta a «36d»,
    // igual que en clientes y prestamos: la palabra la dice el color, y esas
    // nueve letras las necesita el «donde» —la direccion— que comparte linea
    // con la pastilla y salia cortada.
    expect(etiquetaAtraso(36)).toBe('36d')
    expect(etiquetaAtraso(1)).toBe('1d')
    // Sin atraso NO se pone «0d»: es «Al día», que es otra cosa.
    expect(etiquetaAtraso(0)).toBe('Al día')
  })
})

describe('la hora del cobro', () => {
  it('se formatea desde ISO, no desde un texto ya hecho', () => {
    // El endpoint manda ISO a propósito: formateado en el servidor saldría en
    // UTC, y «Cobrado 14:06» cuando fue a las 9:06 es una mentira de zona.
    expect(horaDe('2026-07-29T14:06:00.000Z')).toMatch(/\d{1,2}:\d{2}/)
  })

  it('sin hora, null — no «Cobrado undefined»', () => {
    expect(horaDe(null)).toBeNull()
    expect(horaDe('no es una fecha')).toBeNull()
  })
})

describe('agruparPorRuta', () => {
  it('agrupa conservando el orden de aparición', () => {
    const g = agruparPorRuta([
      cliente({ id: 'a', rutaId: 'r1', rutaNombre: 'Ruta #1' }),
      cliente({ id: 'b', rutaId: 'r2', rutaNombre: 'Ruta 2' }),
      cliente({ id: 'c', rutaId: 'r1', rutaNombre: 'Ruta #1' }),
    ], 'CO')
    expect(g.map((x) => x.nombre)).toEqual(['Ruta #1', 'Ruta 2'])
    expect(g[0].filas).toHaveLength(2)
  })

  it('el total del grupo suma SOLO lo pendiente', () => {
    // Dice cuánta plata queda por levantar en esa ruta, así que baja al ir
    // cobrando. Sumando lo cobrado, el número no se movería nunca.
    const [g] = agruparPorRuta([
      cliente({ id: 'a', cuota: 12000, pagoHoy: false }),
      cliente({ id: 'b', cuota: 45000, pagoHoy: true }),
    ], 'CO')
    expect(g.pendientes).toBe(1)
    expect(g.total).toBe('$12.000')
  })

  it('el cliente sin ruta tiene su grupo, no desaparece', () => {
    const g = agruparPorRuta([cliente({ rutaId: null, rutaNombre: null })], 'CO')
    expect(g).toHaveLength(1)
    expect(g[0].nombre).toBe('Sin ruta')
  })
})

describe('ordenar', () => {
  const lista = [
    cliente({ id: 'a', diasMora: 5, saldoTotal: 100000 }),
    cliente({ id: 'b', diasMora: 36, saldoTotal: 100000 }),
    cliente({ id: 'c', diasMora: 36, saldoTotal: 900000 }),
  ]

  it('«orden de ruta» NO reordena: es el que el cobrador ya conoce', () => {
    expect(ordenar(lista, 'ruta').map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('«más atrasados» ordena por días, y a igualdad por lo que debe', () => {
    expect(ordenar(lista, 'atrasados').map((c) => c.id)).toEqual(['c', 'b', 'a'])
  })

  it('«cerca de mí» NO finge una distancia sin GPS', () => {
    // Mandar al cobrador a caminar mal cuesta gasolina y tiempo de verdad. La
    // pantalla deshabilita el chip en vez de inventar el orden.
    expect(ordenar(lista, 'cerca').map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('adaptarCobrosHoy', () => {
  const datos = {
    clientes: [
      cliente({ id: 'a' }),
      cliente({ id: 'b', nombre: 'Carmen Jiménez', pagoHoy: false, diasMora: 0 }),
      cliente({
        id: 'c', nombre: 'Cobrada Ya', pagoHoy: true, diasMora: 0,
        cobradoA: '2026-07-29T14:06:00.000Z', montoCobradoHoy: 45000,
      }),
    ],
    resumen: { total: 68, pendientes: 2, pagados: 1, esperadoHoy: 872867, recaudadoHoy: 412000 },
  }

  it('el avance cuenta los de HOY, no todos los de la ruta', () => {
    // `resumen.total` son TODOS los clientes. Usarlo diría «1 de 68 cobrados»
    // un día en que solo tocan 3.
    const a = adaptarCobrosHoy(datos, { pais: 'CO' }).avance
    expect(a.cobrados).toBe(1)
    expect(a.deCuantos).toBe(3)
    expect(a.recaudado).toBe('$412.000')
    expect(a.porcentaje).toBe(47)
  })

  it('el cobrado viene marcado, con su hora y su monto', () => {
    const { grupos } = adaptarCobrosHoy(datos, { pais: 'CO' })
    const fila = grupos[0].filas.find((f) => f.id === 'c')
    expect(fila.cobrada).toBe(true)
    expect(fila.cobradoA).toMatch(/\d{1,2}:\d{2}/)
    expect(fila.montoCobrado).toBe('$45.000')
  })

  it('el cobrado SIGUE en la lista: no se colapsa ni se borra', () => {
    // Lo dice el pie de la lámina: «lo ya cobrado se tacha en vez de
    // desaparecer». El cobrador recorre la calle en orden, y si el cobrado
    // desaparece pierde la referencia de dónde iba.
    const { grupos } = adaptarCobrosHoy(datos, { pais: 'CO' })
    expect(grupos.flatMap((g) => g.filas).map((f) => f.id)).toContain('c')
  })

  it('el «debe» dice el saldo, que es lo que distingue una visita de otra', () => {
    const { grupos } = adaptarCobrosHoy(datos, { pais: 'CO' })
    expect(grupos[0].filas[0].debe).toBe('debe $160.000')
  })

  it('sin saldo no escribe «debe $0»', () => {
    const d = { ...datos, clientes: [cliente({ saldoTotal: 0 })] }
    expect(adaptarCobrosHoy(d, { pais: 'CO' }).grupos[0].filas[0].debe).toBeNull()
  })

  it('el «dónde» sale de `direccion` O de `referencia`', () => {
    // Son dos campos distintos del cliente y en la práctica unos tienen uno y
    // otros el otro. Mirando solo `direccion`, la segunda línea salía con la
    // pastilla sola y sin el dónde.
    const d = { ...datos, clientes: [cliente({ direccion: null, referencia: 'Cl 30 # 7-22' })] }
    expect(adaptarCobrosHoy(d, { pais: 'CO' }).grupos[0].filas[0].donde).toBe('Cl 30 # 7-22')
  })

  it('sin datos no revienta', () => {
    const a = adaptarCobrosHoy(null, { pais: 'CO' })
    expect(a.grupos).toEqual([])
    expect(a.pendientes).toBe(0)
    expect(a.avance.porcentaje).toBe(0)
  })
})
