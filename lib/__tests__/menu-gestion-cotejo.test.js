import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const men = readFileSync(join(process.cwd(), 'components/pantallas/MenuGestion.jsx'), 'utf8')
const cuerpo = men.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el color vuelve a su semántica (T05-01)', () => {
  it('solo la acción de peligro lleva color', () => {
    // Hoy el menú son mosaicos teñidos de cinco colores donde el color no
    // significa nada, y «días sin cobro» parece deshabilitado por ir en gris.
    expect(cuerpo).toMatch(/peligro \? ROJO : 'var\(--cf-ink\)'/)
  })

  it('y ese color es el rojo, una sola vez', () => {
    const rojos = cuerpo.match(/ROJO/g) ?? []
    expect(rojos.length).toBe(2)   // la constante y su único uso
  })

  it('cada fila puede traer su valor actual', () => {
    // Sin el valor hay que entrar a cada hoja para saber cómo está el préstamo,
    // y la mitad de las veces se entra solo a mirar.
    expect(cuerpo).toMatch(/\{valor && \(/)
  })

  it('el valor va en gris y no compite con el nombre', () => {
    expect(cuerpo).toMatch(/fontSize: 13, color: 'var\(--cf-ink-3\)'/)
  })

  it('las acciones llegan por prop: la pantalla no las inventa', () => {
    expect(cuerpo).toMatch(/grupos = \[\]/)
  })
})

describe('cobro hecho (T15-03)', () => {
  it('el botón dorado es el SIGUIENTE cliente, no «listo»', () => {
    // Quien acaba de cobrar está en la puerta de al lado; volver a la lista a
    // buscar dónde se quedó es el paso que sobra.
    expect(cuerpo).toMatch(/Siguiente: \{siguiente\}/)
  })

  it('volver a la lista existe pero queda de segunda', () => {
    const i = cuerpo.indexOf('Siguiente: {siguiente}')
    const j = cuerpo.indexOf('Volver a la lista')
    expect(j).toBeGreaterThan(i)
  })

  it('sin siguiente no se pinta un botón sin destino', () => {
    expect(cuerpo).toMatch(/\{siguiente && onSiguiente && \(/)
  })

  it('contesta las dos preguntas que quedan tras cobrar', () => {
    // Cuánto le queda debiendo a este, y cuánto lleva hoy el cobrador. La
    // segunda es la que le dice si va bien o le falta media ruta.
    expect(men).toMatch(/Le queda debiendo/)
    expect(men).toMatch(/Llevas hoy/)
  })

  it('el recibo se confirma con el número', () => {
    // Sin él, «recibo enviado» no se puede comprobar cuando el cliente diga que
    // no le llegó.
    expect(cuerpo).toMatch(/\{recibo\}/)
  })

  it('la barra no se encoge y no se sale de 0-100', () => {
    expect(cuerpo).toMatch(/Math\.max\(0, Math\.min\(100, progreso\)\)/)
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    expect(men).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('todo el color va por token salvo el verde de WhatsApp', () => {
    const literales = (cuerpo.match(/#[0-9A-Fa-f]{6}/g) ?? []).filter((c) => c.toUpperCase() !== '#25D366')
    expect(literales).toEqual([])
  })
})
