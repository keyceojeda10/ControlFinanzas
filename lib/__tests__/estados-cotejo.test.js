import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const est = readFileSync(join(process.cwd(), 'components/pantallas/Estados.jsx'), 'utf8')
const cuerpo = est.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('sin conexión no es un error (T05-05)', () => {
  it('la franja va en carbón, nunca en rojo', () => {
    // Un cobrador pierde señal cinco veces al día. Si la app dijera «error» cinco
    // veces al día, dejaría de cobrar con la app.
    const i = cuerpo.indexOf('export function FranjaSinSenal')
    const bloque = cuerpo.slice(i, i + 1200)
    expect(bloque).toMatch(/background: CARBON/)
    expect(bloque).not.toMatch(/--cf-red/)
  })

  it('dice que se sigue trabajando, no que algo falló', () => {
    expect(est).toMatch(/trabajando en el teléfono/)
  })

  it('lo que manda es CUÁNTO hay guardado, no cuántos', () => {
    // «4 pendientes» no dice nada; «$61.500 guardados aquí» dice que hay medio día
    // de trabajo dentro del teléfono — y eso impide que alguien cierre la app.
    expect(cuerpo).toMatch(/fontSize: 30, fontWeight: 600/)
    expect(est).toMatch(/Cobros guardados aquí/)
  })

  it('los ya sincronizados NO se borran de la lista', () => {
    // Verlos irse uno a uno es lo que da confianza de que el resto va a irse.
    expect(cuerpo).toMatch(/c\.sincronizado \?/)
  })
})

describe('la búsqueda arranca con algo (T34-03)', () => {
  it('sin texto enseña lo reciente y los atajos', () => {
    // Una búsqueda en blanco obliga a teclear para descubrir qué se puede buscar,
    // y con teclado en pantalla eso son cuatro segundos por vez.
    expect(cuerpo).toMatch(/const buscando = String\(texto \?\? ''\)\.trim\(\)\.length > 0/)
    expect(cuerpo).toMatch(/buscando \? \(/)
  })

  it('no enseña resultados y recientes a la vez', () => {
    // La lista de abajo empujaría el primer resultado fuera de la pantalla.
    expect(cuerpo).toMatch(/\) : \(/)
  })

  it('el campo dice qué se puede escribir', () => {
    // En este negocio se busca por cédula tanto como por nombre.
    expect(est).toMatch(/Nombre, cédula o teléfono/)
  })

  it('el campo no baja de 16px o iOS hace zoom', () => {
    expect(est).toMatch(/fontSize: 16,\s*\/\/ menos de 16/)
  })

  it('el aro del avatar trae el estado del cliente', () => {
    // Quien busca a alguien casi siempre quiere saber cómo va, no solo entrar.
    expect(cuerpo).toMatch(/f\.estado \? `2px solid/)
  })

  it('lo que no es una persona lleva icono, no iniciales', () => {
    // Una ruta con iniciales se leería como un cliente. El icono ya no viene
    // dado: se deriva del tipo, para que los adaptadores devuelvan datos y no
    // JSX (un `<svg>` dentro de un `.js` no se puede probar sin montar React).
    expect(cuerpo).toMatch(/const icono = f\.icono \?\? ICONO\[f\.tipo\]/)
    expect(cuerpo).toMatch(/borderRadius: icono \? 11 : 999/)
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    expect(est).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('fuera del bloque carbón todo va por token', () => {
    const sinCarbon = cuerpo.replace(/const CARBON[^\n]*\n/g, '')
    expect((sinCarbon.match(/#[0-9A-Fa-f]{6}/g) ?? [])).toEqual([])
  })
})
