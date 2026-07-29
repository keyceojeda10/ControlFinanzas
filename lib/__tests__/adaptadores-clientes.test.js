import { describe, it, expect } from 'vitest'
import { adaptarClientes, estadoVisual, iniciales, contextoDe, truncado, DIAS_MORA } from '@/lib/adaptadores/clientes'

// El sistema solo distingue `mora` o `activo`, y `estado === 'mora'` es
// exactamente `diasMoraMax > 0`. El rediseño tiene tres estados, así que el
// corte entre "va atrasado" y "esto ya es mora" se decide aquí — con el mismo
// umbral que la app ya usaba para pintar rojo en vez de naranja.

describe('estadoVisual', () => {
  it('al día cuando no debe días', () => {
    expect(estadoVisual({ diasMoraMax: 0, estado: 'activo' })).toBe('aldia')
  })

  it('atraso leve hasta el umbral del sistema', () => {
    expect(estadoVisual({ diasMoraMax: 1 })).toBe('atraso')
    expect(estadoVisual({ diasMoraMax: DIAS_MORA })).toBe('atraso')
  })

  it('mora al pasarlo', () => {
    expect(estadoVisual({ diasMoraMax: DIAS_MORA + 1 })).toBe('mora')
    expect(estadoVisual({ diasMoraMax: 36 })).toBe('mora')
  })

  it('respeta el estado del backend aunque no vengan los días', () => {
    // Si el API dice mora y no manda diasMoraMax, no se puede pintar de verde.
    expect(estadoVisual({ estado: 'mora' })).toBe('atraso')
  })

  it('no revienta con un cliente vacío', () => {
    expect(estadoVisual(null)).toBe('aldia')
    expect(estadoVisual({})).toBe('aldia')
  })
})

describe('iniciales', () => {
  it('toma nombre y apellido', () => {
    expect(iniciales('Steven Olmos')).toBe('SO')
  })
  it('con un solo nombre usa dos letras', () => {
    expect(iniciales('Pepito')).toBe('PE')
  })
  it('aguanta espacios de más y vacío', () => {
    expect(iniciales('  María   Fernanda  ')).toBe('MF')
    expect(iniciales('')).toBe('·')
    expect(iniciales(undefined)).toBe('·')
  })
})

describe('contextoDe', () => {
  it('une ruta y dirección', () => {
    expect(contextoDe({ rutaNombre: 'Bolivariana', referencia: 'Cl 8 # 31-05' }))
      .toBe('Bolivariana · Cl 8 # 31-05')
  })

  it('no deja el separador colgando cuando falta una parte', () => {
    expect(contextoDe({ rutaNombre: 'Ruta sur' })).toBe('Ruta sur')
    expect(contextoDe({ referencia: 'Cra 9' })).toBe('Cra 9')
    expect(contextoDe({})).toBeNull()
  })

  // La tarjeta enseña "Deuda total", que con varios préstamos es una suma. Sin
  // el conteo, tres créditos abiertos y uno solo se ven idénticos.
  it('pone cuántos préstamos delante, y solo cuando son varios', () => {
    expect(contextoDe({ prestamosActivos: 3, rutaNombre: 'Bolivariana' }))
      .toBe('3 préstamos · Bolivariana')
    expect(contextoDe({ prestamosActivos: 2 })).toBe('2 préstamos')
  })

  it('con uno solo no lo escribe: sería ruido en todas las tarjetas', () => {
    expect(contextoDe({ prestamosActivos: 1, rutaNombre: 'Ruta sur' })).toBe('Ruta sur')
    expect(contextoDe({ prestamosActivos: 0, rutaNombre: 'Ruta sur' })).toBe('Ruta sur')
    expect(contextoDe({ prestamosActivos: 1 })).toBeNull()
  })
})

describe('adaptarClientes', () => {
  const crudos = [
    { id: '1', nombre: 'Steven Olmos', estado: 'mora', diasMoraMax: 36,
      rutaNombre: 'Bolivariana', referencia: 'Cl 8 # 31-05',
      saldoPendienteTotal: 130500, porcentajePagadoPromedio: 18 },
    { id: '2', nombre: 'María Restrepo', estado: 'activo', diasMoraMax: 0,
      rutaNombre: 'Centro', saldoPendienteTotal: 811334, porcentajePagadoPromedio: 72 },
  ]

  it('no pone la pastilla de días cuando no hay atraso', () => {
    // Un "0d" junto al nombre es ruido y roba ancho al nombre.
    const [a, b] = adaptarClientes(crudos, 'CO')
    expect(a.diasAtraso).toBe(36)
    expect(b.diasAtraso).toBeNull()
  })

  it('acota el porcentaje entre 0 y 100', () => {
    const [x] = adaptarClientes([{ id: 'x', nombre: 'A', porcentajePagadoPromedio: 140 }], 'CO')
    expect(x.porcentaje).toBe(100)
    const [y] = adaptarClientes([{ id: 'y', nombre: 'B', porcentajePagadoPromedio: -5 }], 'CO')
    expect(y.porcentaje).toBe(0)
  })

  it('formatea el saldo como plata', () => {
    expect(adaptarClientes(crudos, 'CO')[0].monto).toContain('130.500')
  })

  it('sobrevive a una respuesta vacía', () => {
    expect(adaptarClientes([], 'CO')).toEqual([])
    expect(adaptarClientes(undefined, 'CO')).toEqual([])
  })
})

describe('truncado', () => {
  const todos = [
    { saldoPendienteTotal: 100 }, { saldoPendienteTotal: 200 },
    { saldoPendienteTotal: 300 }, { saldoPendienteTotal: 400 },
  ]

  it('no dice nada si se ven todos', () => {
    expect(truncado(4, todos, 'CO')).toBeNull()
    expect(truncado(9, todos, 'CO')).toBeNull()
  })

  it('suma SOLO lo que no se ve', () => {
    // Si sumara todos, el pie diría que faltan $1.000 cuando faltan $700.
    const r = truncado(1, todos, 'CO')
    expect(r.visibles).toBe(1)
    expect(r.total).toBe(4)
    expect(r.montoFaltante).toContain('900')
  })
})
