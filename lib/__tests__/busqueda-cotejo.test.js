// Pruebas del buscador global (T34-03). La regla de la casa: la prueba
// comprueba el CONTRATO con el componente que consume, no el adaptador contra
// su propia aritmetica. `BusquedaGlobal` pinta cada fila con `Lista`, que lee
// exactamente { id, nombre, detalle, iniciales | tipo, estado, cuando } — si el
// adaptador devuelve `titulo` en vez de `nombre`, las filas salen en blanco y
// ninguna prueba de aritmetica lo ve. Ya paso con «Necesita tu atencion».
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aFilasBusqueda } from '@/lib/adaptadores/busqueda'
import { comoHace, iniciales, rutaDe, anotarReciente, leerRecientes } from '@/lib/recientes'

describe('aFilasBusqueda · el contrato con la Lista que las pinta', () => {
  it('los campos que lee `Lista` son los que devuelve el adaptador', () => {
    const fuente = readFileSync(
      join(process.cwd(), 'components', 'pantallas', 'Estados.jsx'), 'utf8')
    const cuerpo = fuente.slice(fuente.indexOf('function Lista('))

    const filas = aFilasBusqueda({
      clientes: [{ id: 1, nombre: 'Steven Olmos', cedula: '1088', telefono: '300', estado: 'mora' }],
      prestamos: [], rutas: [],
    })
    // Cada campo que la fila trae tiene que leerse de verdad en `Lista`; y cada
    // campo que `Lista` lee tiene que venir en la fila.
    for (const campo of ['nombre', 'detalle', 'iniciales', 'estado']) {
      expect(cuerpo, `Lista no lee f.${campo}`).toContain(`f.${campo}`)
      expect(filas[0], `el adaptador no devuelve ${campo}`).toHaveProperty(campo)
    }
    expect(cuerpo).toContain('ICONO[f.tipo]')
    expect(filas[0].id).toBeTruthy()   // `key` de React
  })

  it('el mismo cliente no sale dos veces por tener prestamo', () => {
    // El bug que se vio en pantalla: «Carlitos Chaparro · 811767821» y
    // «Carlitos Chaparro · debe $553.658», dos filas para una persona.
    const filas = aFilasBusqueda({
      clientes: [{ id: 7, nombre: 'Carlitos Chaparro', cedula: '811767821', telefono: '300' }],
      prestamos: [{ id: 99, clienteId: 7, clienteNombre: 'Carlitos Chaparro', saldoPendiente: 553658 }],
      rutas: [],
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].nombre).toBe('Carlitos Chaparro')
    // La deuda manda sobre la cedula, y se va al prestamo, que es donde se cobra.
    expect(filas[0].detalle).toBe('debe $553.658')
    expect(filas[0].href).toBe('/prestamos/99')
  })

  it('dos clientes con el MISMO nombre no se funden en uno', () => {
    // Por eso se junta por id y no por nombre. Fundirlos le pondria la deuda de
    // uno al otro, que es una mentira sobre plata.
    const filas = aFilasBusqueda({
      clientes: [
        { id: 1, nombre: 'Carlos Ruiz', cedula: '111' },
        { id: 2, nombre: 'Carlos Ruiz', cedula: '222' },
      ],
      prestamos: [{ id: 50, clienteId: 1, clienteNombre: 'Carlos Ruiz', saldoPendiente: 900000 }],
      rutas: [],
    })
    expect(filas).toHaveLength(2)
    expect(filas.find(f => f.id === 'cliente-1').detalle).toBe('debe $900.000')
    expect(filas.find(f => f.id === 'cliente-2').detalle).toBe('222')
  })

  it('con varios prestamos manda el de mas saldo', () => {
    const filas = aFilasBusqueda({
      clientes: [{ id: 3, nombre: 'Ana Gil' }],
      prestamos: [
        { id: 10, clienteId: 3, clienteNombre: 'Ana Gil', saldoPendiente: 50000 },
        { id: 11, clienteId: 3, clienteNombre: 'Ana Gil', saldoPendiente: 800000 },
      ],
      rutas: [],
    })
    expect(filas).toHaveLength(1)
    expect(filas[0].detalle).toBe('debe $800.000')
    expect(filas[0].href).toBe('/prestamos/11')
  })

  it('la cedula de relleno no se enseña como si fuera un documento', () => {
    const [f] = aFilasBusqueda({
      clientes: [{ id: 1, nombre: 'Sin Papeles', cedula: 'SIN-4821', telefono: '3001234567' }],
    })
    expect(f.detalle).toBe('3001234567')
  })

  it('un prestamo saldado no dice «debe $0»', () => {
    const [f] = aFilasBusqueda({
      prestamos: [{ id: 4, clienteId: 9, clienteNombre: 'Luz', saldoPendiente: 0 }],
    })
    expect(f.detalle).toBe('préstamo saldado')
  })

  it('una ruta con un cliente no dice «1 clientes»', () => {
    const filas = aFilasBusqueda({ rutas: [
      { id: 1, nombre: 'Ruta 1', _count: { clientes: 1 } },
      { id: 2, nombre: 'Ruta 2', _count: { clientes: 5 } },
    ] })
    expect(filas.map(f => f.detalle)).toEqual(['1 cliente', '5 clientes'])
    // Las rutas van por `tipo` para que `Lista` les ponga icono: con iniciales
    // se leerian como una persona.
    expect(filas[0].tipo).toBe('ruta')
    expect(filas[0].iniciales).toBeUndefined()
  })

  it('sin resultados devuelve una lista vacia, no revienta', () => {
    expect(aFilasBusqueda(null)).toEqual([])
    expect(aFilasBusqueda({})).toEqual([])
  })

  it('la API devuelve el clienteId que el adaptador necesita para juntar', () => {
    // Sin este campo la union es imposible y vuelven las filas repetidas.
    const api = readFileSync(join(process.cwd(), 'app', 'api', 'buscar', 'route.js'), 'utf8')
    expect(api).toContain('clienteId: p.cliente.id')
    expect(api).toContain('cliente: { select: { id: true, nombre: true } }')
  })
})

describe('comoHace · el «hace 1 h» de la lamina', () => {
  const T = 1_700_000_000_000
  const h = (n) => T - n * 3_600_000

  it('dice lo mismo que la lamina', () => {
    expect(comoHace(h(1), T)).toBe('hace 1 h')
    expect(comoHace(h(26), T)).toBe('ayer')
  })

  it('«ayer» solo si de verdad fue ayer', () => {
    // A las 50 horas «ayer» seria mentira; a las 23, todavia es hoy.
    expect(comoHace(h(23), T)).toBe('hace 23 h')
    expect(comoHace(h(50), T)).toBe('hace 2 d')
  })

  it('no se atasca en los extremos', () => {
    expect(comoHace(T, T)).toBe('ahora')
    expect(comoHace(h(24 * 40), T)).toBe('hace tiempo')
    expect(comoHace(undefined, T)).toBe('')
  })
})

describe('iniciales · las dos letras del avatar', () => {
  it('toma la primera de cada nombre, como «SO» y «HP»', () => {
    expect(iniciales('Steven Olmos')).toBe('SO')
    expect(iniciales('Hollando Pérez')).toBe('HP')
  })
  it('con un solo nombre usa sus dos primeras letras', () => {
    expect(iniciales('Madonna')).toBe('MA')
  })
  it('sin nombre no deja el circulo en blanco', () => {
    expect(iniciales('')).toBe('·')
    expect(iniciales(null)).toBe('·')
  })
})

describe('recientes · los ultimos que abriste', () => {
  beforeEach(() => {
    const almacen = new Map()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k) => almacen.get(k) ?? null,
        setItem: (k, v) => almacen.set(k, v),
      },
    })
  })

  it('el ultimo que abriste sale primero', () => {
    anotarReciente({ tipo: 'cliente', id: 1, nombre: 'Ana' })
    anotarReciente({ tipo: 'cliente', id: 2, nombre: 'Beto' })
    expect(leerRecientes().map(r => r.nombre)).toEqual(['Beto', 'Ana'])
  })

  it('abrir dos veces al mismo no lo duplica: lo sube', () => {
    anotarReciente({ tipo: 'cliente', id: 1, nombre: 'Ana' })
    anotarReciente({ tipo: 'cliente', id: 2, nombre: 'Beto' })
    anotarReciente({ tipo: 'cliente', id: 1, nombre: 'Ana' })
    expect(leerRecientes().map(r => r.nombre)).toEqual(['Ana', 'Beto'])
  })

  it('enseña tres, que son los que dibuja la lamina', () => {
    for (let i = 0; i < 8; i++) anotarReciente({ tipo: 'cliente', id: i, nombre: `N${i}` })
    expect(leerRecientes()).toHaveLength(3)
  })

  it('las filas salen en la forma que pinta `Lista`', () => {
    anotarReciente({ tipo: 'cliente', id: 5, nombre: 'Steven Olmos', detalle: 'debe $130.500', estado: 'rojo' })
    const [f] = leerRecientes()
    expect(f).toMatchObject({
      nombre: 'Steven Olmos', detalle: 'debe $130.500',
      estado: 'rojo', iniciales: 'SO', href: '/clientes/5',
    })
    expect(f.cuando).toBe('ahora')
  })

  it('una ruta va con icono, no con iniciales', () => {
    anotarReciente({ tipo: 'ruta', id: 3, nombre: 'Ruta 2' })
    const [f] = leerRecientes()
    expect(f.iniciales).toBeUndefined()
    expect(f.tipo).toBe('ruta')
    expect(f.href).toBe('/rutas/3')
  })

  it('sin nombre no se anota: una fila en blanco no es un reciente', () => {
    anotarReciente({ tipo: 'cliente', id: 1 })
    expect(leerRecientes()).toEqual([])
  })

  it('cada tipo vuelve a su sitio', () => {
    expect(rutaDe({ tipo: 'cliente', id: 1 })).toBe('/clientes/1')
    expect(rutaDe({ tipo: 'prestamo', id: 2 })).toBe('/prestamos/2')
    expect(rutaDe({ tipo: 'ruta', id: 3 })).toBe('/rutas/3')
    expect(rutaDe({ tipo: 'invento', id: 4 })).toBeNull()
  })

  it('con el almacen roto la busqueda sigue funcionando', () => {
    // Modo incognito o cuota llena. Sin recientes se puede buscar igual; lo que
    // no puede pasar es que la pantalla entera reviente por esto.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('bloqueado') },
        setItem: () => { throw new Error('bloqueado') },
      },
    })
    expect(() => anotarReciente({ tipo: 'cliente', id: 1, nombre: 'Ana' })).not.toThrow()
    expect(leerRecientes()).toEqual([])
  })
})
