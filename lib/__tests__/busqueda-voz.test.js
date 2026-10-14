import { describe, it, expect } from 'vitest'
import { limpiarDictado, sonido, puntuar, buscarPorVoz, plataHablada, resumenHablado, avisoHablado } from '@/lib/busqueda-voz'

const CLIENTES = [
  { id: '1', nombre: 'Pepito Pérez' },
  { id: '2', nombre: 'Pepito Gómez Rodríguez' },
  { id: '3', nombre: 'Jeison Andrés Valencia' },
  { id: '4', nombre: 'Vivian Llanos' },
  { id: '5', nombre: 'María de la Cruz Henao' },
  { id: '6', nombre: 'José Quintero' },
  { id: '7', nombre: 'José Quintero Ríos' },
]

describe('lo que dijo, sin el relleno', () => {
  it('quita la frase de alrededor y la puntuación', () => {
    expect(limpiarDictado('Buscar el crédito de Pepito Pérez.')).toBe('pepito perez')
    expect(limpiarDictado('búscame a la señora María de la Cruz')).toBe('maria de la cruz')
    expect(limpiarDictado('Don José Quintero')).toBe('jose quintero')
    expect(limpiarDictado('buscar')).toBe('')
  })
  it('suena igual aunque se escriba distinto', () => {
    expect(sonido('Vivian')).toBe(sonido('Bibian'))
    expect(sonido('Llanos')).toBe(sonido('Yanos'))
    expect(sonido('Henao')).toBe(sonido('Enao'))
    expect(sonido('Quintero')).toBe(sonido('Kintero'))
  })
})

describe('encontrar al cliente', () => {
  it('la frase completa abre directo al único que encaja', () => {
    const r = buscarPorVoz('Buscar el crédito de Pepito Pérez', CLIENTES)
    expect(r.resultados[0].id).toBe('1')
    expect(r.unico).toBe(true)
  })
  it('perdona cómo lo escribió el dictado', () => {
    expect(buscarPorVoz('Yeison Valencia', CLIENTES).resultados[0].id).toBe('3')
    expect(buscarPorVoz('Bibian Yanos', CLIENTES).resultados[0].id).toBe('4')
    expect(buscarPorVoz('maria enao', CLIENTES).resultados[0].id).toBe('5')
  })
  it('solo el nombre: enseña a todos los que se llaman así, no abre ninguno', () => {
    const r = buscarPorVoz('Pepito', CLIENTES)
    expect(r.resultados.map((c) => c.id).sort()).toEqual(['1', '2'])
    expect(r.unico).toBe(false)
  })
  it('un apellido que no es el suyo no lo trae', () => {
    expect(puntuar('Pepito Gómez', 'Pepito Pérez')).toBe(0)
  })
  it('dos que encajan casi igual no se abren solos', () => {
    expect(buscarPorVoz('José Quintero', CLIENTES).unico).toBe(false)
  })
  it('nadie: lista vacía', () => {
    expect(buscarPorVoz('Ramón Zuluaga', CLIENTES)).toEqual({ resultados: [], unico: false })
  })
})

describe('lo que se lee en voz alta', () => {
  it('la plata dicha como se dice', () => {
    expect(plataHablada(250000)).toBe('250 mil')
    expect(plataHablada(1250000)).toBe('1 millón 250 mil')
    expect(plataHablada(2001500)).toBe('2 millones mil 500')
    expect(plataHablada(1000)).toBe('mil')
    expect(plataHablada(0)).toBe('cero')
  })
  it('suma SOLO los créditos activos, con el saldo que trae la ficha', () => {
    const prestamos = [
      { estado: 'activo', saldoPendiente: 200000, diasMora: 0 },
      { estado: 'activo', saldoPendiente: 50000, diasMora: 3 },
      { estado: 'completado', saldoPendiente: 0, diasMora: 0 },
    ]
    expect(resumenHablado({ nombre: 'Pepito Pérez', prestamos }))
      .toBe('Pepito Pérez. Tiene 2 créditos. Debe en total 250 mil. Lleva 3 días de atraso.')
    expect(resumenHablado({ nombre: 'Ana', prestamos: [{ estado: 'activo', saldoPendiente: 90000, diasMora: 0 }] }))
      .toBe('Ana. Debe 90 mil. Va al día.')
    expect(resumenHablado({ nombre: 'Ana', prestamos: [] })).toBe('Ana. No tiene créditos activos.')
  })
  it('cuando hay varios, los nombra', () => {
    expect(avisoHablado([{ nombre: 'A' }, { nombre: 'B' }])).toBe('Encontré 2: A, B. Toca el que es.')
    expect(avisoHablado([])).toMatch(/^No encontré a nadie/)
  })
})

describe('dónde está y qué no puede saltarse', () => {
  const leer = (f) => require('node:fs').readFileSync(f, 'utf8')
  it('el cobrador solo busca entre los de sus rutas', () => {
    expect(leer('app/api/buscar/voz/route.js')).toMatch(/\.\.\.\(rol === 'cobrador' \? \{ rutaId: \{ in: rutaIds \} \} : \{\}\)/)
  })
  it('lo que se lee sale de la ficha, no de un cálculo propio', () => {
    const v = leer('components/cf/BuscarPorVoz.jsx')
    expect(v).toMatch(/fetch\(`\/api\/clientes\/\$\{c\.id\}`\)/)
    expect(v).toMatch(/hablar\(resumenHablado\(\{ nombre: c\.nombre, prestamos: d\.prestamos \}\)\)/)
  })
  it('la lupa lleva el micrófono y la pastilla grande', () => {
    const g = leer('components/layout/GlobalSearch.jsx')
    expect(g).toMatch(/voz=\{<BuscarPorVoz variante="icono"/)
    expect(g).toMatch(/vozGrande=\{<BuscarPorVoz variante="boton"/)
  })
})
