import { describe, it, expect } from 'vitest'
import { adaptarClientes, estadoVisual, iniciales, contextoDe, cedulaDe, truncado, etiquetaDe, DIAS_MORA } from '@/lib/adaptadores/clientes'

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
  it('es «CC 81283812 · 3 prestamos», lo que dibuja la lamina', () => {
    expect(contextoDe({ cedula: '81283812', prestamosActivos: 3 }))
      .toBe('CC 81283812 · 3 préstamos')
  })

  it('escribe «1 prestamo» en singular, y SI lo escribe', () => {
    // Antes se omitia con uno solo, por no repetir «1 prestamo» en cada
    // tarjeta. Con la cedula delante la linea ya no es solo el conteo, y
    // omitirlo dejaria un «CC 43987112 ·» colgando. La lamina lo pone.
    expect(contextoDe({ cedula: '43987112', prestamosActivos: 1 }))
      .toBe('CC 43987112 · 1 préstamo')
  })

  it('la RUTA y la DIRECCION ya no van aca', () => {
    // Estaban, y la lamina no las pone. No se pierden: viven en «Cobrar hoy»,
    // que es la pantalla donde se camina. Con tres cosas en una linea `nowrap`
    // la tercera se truncaba siempre.
    const linea = contextoDe({ cedula: '123', prestamosActivos: 2, rutaNombre: 'Ruta sur', referencia: 'Cl 8 # 31-05' })
    expect(linea).not.toMatch(/Ruta sur|Cl 8/)
    expect(linea).toBe('CC 123 · 2 préstamos')
  })

  it('NO escribe el marcador de una importacion sin cedulas', () => {
    // El importador genera «SIN-001», «SIN-002»… cuando el cuaderno no las
    // trae. «CC SIN-012» es peor que nada: parece un dato y no lo es. Son 68
    // clientes reales en la cartera de prueba.
    expect(contextoDe({ cedula: 'SIN-012', prestamosActivos: 2 })).toBe('2 préstamos')
    expect(cedulaDe({ cedula: 'SIN-001' })).toBeNull()
    expect(cedulaDe({ cedula: '81283812' })).toBe('CC 81283812')
  })

  it('no deja el separador colgando cuando falta una parte', () => {
    expect(contextoDe({ cedula: '81283812', prestamosActivos: 0 })).toBe('CC 81283812')
    expect(contextoDe({ prestamosActivos: 2 })).toBe('2 préstamos')
    expect(contextoDe({})).toBeNull()
    expect(contextoDe({ cedula: '   ' })).toBeNull()
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

  it('los dias van DENTRO del texto de la pastilla, no en una segunda', () => {
    // Antes eran dos pastillas: el estado arriba y los dias abajo. T02-05 dibuja
    // UNA sola, con los dias en el texto y SOLO los dias: «10d». La palabra
    // la dice el color, y esos ~40px los necesita la linea de identidad.
    // Una tarjeta con riel de color, dos pastillas y una barra tiene cuatro
    // cosas diciendo lo mismo, y la segunda pastilla le robaba el sitio a la
    // linea de contexto.
    const [a, b] = adaptarClientes(crudos, 'CO')
    expect(a.etiquetaEstado).toBe('36d')
    expect(b.etiquetaEstado).toBe('Al dia'.replace('dia', 'día'))
    // Y ya no se pasa `diasAtraso`: la tarjeta no dibuja una segunda pastilla.
    expect(a.diasAtraso).toBeUndefined()
  })

  it('con cero dias no escribe «0d»', () => {
    // `estadoVisual` devuelve 'atraso' tambien cuando la base dice
    // `estado === 'mora'` con CERO dias. Sin guardia saldria «0d».
    expect(etiquetaDe('atraso', 0)).toBe('Atraso leve')
    expect(etiquetaDe('mora', null)).toBe('En mora')
    expect(etiquetaDe('aldia', 5)).toBe('Al día')
  })

  it('el ambar dice «vencido» y el rojo «mora», como la lamina', () => {
    expect(etiquetaDe('atraso', 6)).toBe('6d')
    expect(etiquetaDe('mora', 10)).toBe('10d')
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
