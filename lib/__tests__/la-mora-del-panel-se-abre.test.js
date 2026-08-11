// lib/__tests__/la-mora-del-panel-se-abre.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, sobre un cliente suyo que reclama lo mismo una y otra vez:
//
//   «él me dice que él va a revisar, no le salen los clientes que están en
//    mora, no les puede cobrar, cuando realmente sí están en mora.»
//
// La mitad era el cálculo (ver `mora-el-interes-no-salda-el-capital`). La otra
// mitad es de navegación y se veía en la pantalla de inicio: su panel decía
//
//     EN MORA · 10 de 106 · $118.045.749 expuestos
//
// y esa tarjeta era un `<div>`. La ÚNICA fila del panel que llevaba a alguna
// parte era «N préstamos con más de 30 días de mora», que en su cuenta eran 2
// de los 10. Los otros 8 no tenían camino desde el inicio: había que acordarse
// de que en otra pantalla hay un chip «En mora».
//
// Una cifra que nombra un problema y no se puede abrir es un callejón.
//
// La prueba corre en `environment: 'node'` y lee el archivo como TEXTO: no
// monta React. Por eso pregunta por la INTENCIÓN —que las dos tarjetas
// declaren destino y que el componente sepa volverse pulsable— y no por el
// marcado exacto, que es lo que ya me rompió `nombres-enteros-y-filtros`.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(process.cwd())
const panel = readFileSync(join(RAIZ, 'components/pantallas/Panel.jsx'), 'utf8')

/* Los comentarios de este repo citan el código que describen, así que una
   prueba que busque texto plano se acusa a sí misma. Ya pasó con
   `guias-donde-estas`. */
function sinNotas(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const codigo = sinNotas(panel)

describe('la tarjeta «En mora» del panel se abre', () => {
  it('declara a dónde lleva', () => {
    const bloque = codigo.slice(codigo.indexOf('rotulo="En mora"'), codigo.indexOf('rotulo="En mora"') + 400)
    expect(bloque).toMatch(/destino=/)
    expect(bloque).toMatch(/filtro=mora/)
  })

  it('lleva a CLIENTES, no a préstamos: la tarjeta cuenta personas', () => {
    /* «10 de 106» son clientes. `/prestamos?estado=mora` cuenta préstamos, y un
       cliente con dos préstamos atrasados haría que el panel dijera 10 y la
       lista 11. Ese desajuste ya obligó a rehacer el conteo del panel una vez. */
    const bloque = codigo.slice(codigo.indexOf('rotulo="En mora"'), codigo.indexOf('rotulo="En mora"') + 400)
    expect(bloque).toMatch(/\/clientes\?filtro=mora/)
    expect(bloque).not.toMatch(/\/prestamos\?/)
  })

  it('no se abre si no hay nadie en mora', () => {
    // Una lista vacía es peor respuesta que un número quieto.
    const bloque = codigo.slice(codigo.indexOf('rotulo="En mora"'), codigo.indexOf('rotulo="En mora"') + 400)
    expect(bloque).toMatch(/cuantos > 0/)
  })

  it('la de «En caja» también, que es la otra cifra muerta de la fila', () => {
    const bloque = codigo.slice(codigo.indexOf('rotulo="En caja"'), codigo.indexOf('rotulo="En caja"') + 300)
    expect(bloque).toMatch(/destino=/)
    expect(bloque).toMatch(/\/caja/)
  })
})

describe('TarjetaDato sabe volverse pulsable, y solo cuando tiene a dónde ir', () => {
  const cuerpo = codigo.slice(codigo.indexOf('function TarjetaDato'), codigo.indexOf('function FilaAtencion'))

  it('recibe destino y el que sabe navegar', () => {
    expect(cuerpo).toMatch(/destino/)
    expect(cuerpo).toMatch(/onIr/)
  })

  it('sin destino NO finge ser pulsable', () => {
    /* Un `<button>` con `cursor:pointer` que no hace nada es un control muerto,
       y el producto ya arrastró uno de esos en el botón de compartir. */
    expect(cuerpo).toMatch(/'button'\s*:\s*'div'/)
    expect(cuerpo).toMatch(/cursor:\s*abre\s*\?\s*'pointer'\s*:\s*'default'/)
  })

  it('el chevrón solo sale si se entra', () => {
    const chevron = cuerpo.indexOf('M9 5l7 7-7 7')
    expect(chevron).toBeGreaterThan(-1)
    expect(cuerpo.slice(0, chevron)).toMatch(/\{abre && \(/)
  })
})

describe('el panel sigue sin repetir la mora tres veces', () => {
  it('«Necesita tu atención» conserva su corte de +30 días', () => {
    /* La fila NO pasa a decir «N en mora»: eso ya lo dice la tarjeta blanca, y
       la misma cifra en tres sitios fue un defecto que este panel ya corrigió.
       Lo que faltaba no era repetirla, era poder abrirla. */
    const adaptador = sinNotas(readFileSync(join(RAIZ, 'lib/adaptadores/panel.js'), 'utf8'))
    expect(adaptador).toMatch(/mora30plus/)
    expect(adaptador).toMatch(/30 días de mora/)
  })
})
