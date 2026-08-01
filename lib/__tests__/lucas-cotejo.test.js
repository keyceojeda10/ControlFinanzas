import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const lucas = readFileSync(join(process.cwd(), 'components/pantallas/Lucas.jsx'), 'utf8')
const cuerpo = lucas.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('Lucas dice que HACE cosas, no solo que contesta', () => {
  it('el titular lo anuncia antes que nada', () => {
    // El fallo que la lamina señala como el principal: la pantalla promete
    // «pideme que haga algo» y luego solo ofrece preguntas.
    expect(cuerpo).toMatch(/Pregúntame lo que sea de tu negocio/)
    expect(cuerpo).toMatch(/O pídeme que haga algo/)
  })

  it('las sugerencias van en dos grupos, no en una lista', () => {
    expect(cuerpo).toMatch(/Lo que más te preguntas/)
    expect(cuerpo).toMatch(/Cosas que puedo hacer por ti/)
  })

  it('el placeholder lo repite en el ultimo sitio donde se puede', () => {
    expect(cuerpo).toMatch(/placeholder="Pregúntame o pídeme algo…"/)
  })
})

describe('el compositor', () => {
  it('tiene microfono: el publico teclea poco y va caminando', () => {
    expect(cuerpo).toMatch(/aria-label="Dictar"/)
  })

  it('enviar arranca apagado y se enciende al escribir', () => {
    // Un boton dorado sin nada que enviar es una promesa vacia.
    expect(cuerpo).toMatch(/disabled=\{!listo\}/)
  })

  it('el campo no baja de 16px o iOS hace zoom al enfocar', () => {
    expect(lucas).toMatch(/fontSize: 16,\s*\/\/ menos de 16 y iOS/)
  })

  it('el descargo esta siempre', () => {
    expect(cuerpo).toMatch(/Lucas se puede equivocar/)
    expect(cuerpo).toMatch(/Los números salen de tu app/)
  })
})

describe('lo que NO va aqui', () => {
  it('no hay contador de cuota «200 de 200»', () => {
    // Doscientos de que. Un contador en la primera pantalla dice «esto se te va a
    // acabar» antes de que el usuario vea para que sirve. Va en Plan y pagos.
    expect(cuerpo).not.toMatch(/\d+\s*de\s*200/)
    expect(lucas).toMatch(/NO va aquí el contador/)
  })

  it('no hay emojis: los iconos son SVG', () => {
    expect(lucas).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })
})
