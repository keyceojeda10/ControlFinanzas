import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ren = readFileSync(join(process.cwd(), 'components/pantallas/Renovar.jsx'), 'utf8')
const cuerpo = ren.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('renovar: lo que sale del bolsillo se calcula (T05-02)', () => {
  it('el botón repite la cifra que se entrega', () => {
    // Con un «Renovar» a secas habría que mirar arriba otra vez antes de pulsar,
    // con el cliente delante y la plata en la mano.
    expect(cuerpo).toMatch(/Renovar y entregar \$\{entrega\}/)
  })

  it('sin entrega calculada el botón no promete una cifra', () => {
    expect(cuerpo).toMatch(/entrega \? `Renovar y entregar/)
  })

  it('el campo sigue siendo el TOTAL, como lo piensa quien presta', () => {
    expect(ren).toMatch(/totalEtiqueta = 'Total del nuevo préstamo'/)
  })

  it('el campo no es type=number', () => {
    // Doce países, dos convenios de miles.
    expect(cuerpo).toMatch(/type="text" inputMode="decimal"/)
    expect(cuerpo).not.toMatch(/type="number"/)
  })

  it('la frase de que el total incluye lo que ya debe es prop', () => {
    // Es la que evita que alguien escriba solo lo nuevo y entregue de más.
    expect(cuerpo).toMatch(/\{incluye && \(/)
  })
})

describe('días sin cobro: la herencia se ve (T05-03)', () => {
  it('están los siete días, siempre', () => {
    // Enseñar solo los marcados obligaría a saber de antemano cuáles se pueden
    // marcar.
    const dias = ren.match(/corto: '(Dom|Lun|Mar|Mié|Jue|Vie|Sáb)'/g) ?? []
    expect(dias).toHaveLength(7)
  })

  it('el domingo es el día 0, como en Date.getDay()', () => {
    // El backend guarda `diasSinCobro` como array de números; si aquí el domingo
    // fuera 1, se marcaría el día equivocado.
    expect(ren).toMatch(/\{ id: 0, corto: 'Dom' \}/)
    expect(ren).toMatch(/\{ id: 6, corto: 'Sáb' \}/)
  })

  it('la herencia lleva el orden en que se busca', () => {
    // Primero el cliente, luego la ruta, luego el negocio: el número es la mitad
    // de la explicación.
    expect(cuerpo).toMatch(/\{i \+ 1\}/)
  })

  it('el nivel que manda se distingue de los demás', () => {
    // Es el que explica lo que se ve hoy en el préstamo.
    expect(cuerpo).toMatch(/h\.manda \? 'var\(--cf-gold-dark\)'/)
  })

  it('sin valor en un nivel se pinta una raya, no un vacío', () => {
    expect(cuerpo).toMatch(/h\.valor \?\? '—'/)
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    expect(ren).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })
})
