// Que la fórmula del reparto no vuelva a escribirse a mano.
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// El reparto interés/capital estaba copiado a mano en NUEVE sitios —cuatro en
// SQL y cinco en JavaScript— y cada copia había ido divergiendo por su cuenta:
// unas aplicaban la corrección por tabla y otras no, unas acotaban los casos
// borde y otras no. La misma pregunta daba cifras distintas en la misma
// pantalla, y sobre la cartera real las diferencias eran de cientos de millones.
//
// Unificarlo no sirve de nada si mañana alguien escribe la décima copia. Esta
// prueba recorre el código y falla si la fórmula aparece fuera de su módulo.
//
// Es el mismo dispositivo que `lib/__tests__/tokens-existen.test.js`: barato,
// mecánico, y caza justo lo que las pruebas de unidad no pueden ver porque cada
// copia, por separado, funciona.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(process.cwd())
const CARPETAS = ['app', 'components', 'lib']

// El módulo es el dueño de la fórmula. `calculos.js` la tiene duplicada a
// propósito y documentado (importarla crearía un ciclo de imports); ese caso
// está fijado por `coherencia-dinero.test.js`, que exige que las dos digan lo
// mismo.
const PERMITIDOS = [
  join('lib', 'dinero', 'reparto.js'),
  join('lib', 'calculos.js'),
]

function archivos(dir, acc = []) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.next' || nombre.startsWith('.')) continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) archivos(ruta, acc)
    else if (/\.(js|jsx)$/.test(nombre) && !/\.test\.jsx?$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

/* La fracción de interés, en sus dos idiomas:
     JS   (totalAPagar - montoPrestado) / totalAPagar
     SQL  (pr.totalAPagar - pr.montoPrestado) / pr.totalAPagar
   Se busca el patrón con o sin alias delante, y en cualquier orden de espacios. */
const FRACCION = /\(\s*(?:\w+\.)?totalAPagar\s*-\s*(?:\w+\.)?montoPrestado\s*\)\s*\/\s*(?:\w+\.)?totalAPagar/

/* Y el reparto del capital por división directa, que es la otra mitad:
     montoPagado * pr.montoPrestado / pr.totalAPagar   */
const CAPITAL = /(?:\w+\.)?montoPrestado\s*\/\s*(?:\w+\.)?totalAPagar/

describe('la fórmula del reparto vive en un solo sitio', () => {
  const todos = CARPETAS.flatMap((c) => archivos(join(RAIZ, c)))

  it('encuentra archivos que revisar (si no, la prueba no prueba nada)', () => {
    expect(todos.length).toBeGreaterThan(300)
  })

  it('nadie escribe la fracción de interés a mano', () => {
    const culpables = []
    for (const ruta of todos) {
      const relativa = ruta.slice(RAIZ.length + 1)
      if (PERMITIDOS.some((p) => relativa === p)) continue
      const texto = readFileSync(ruta, 'utf8')
      for (const [i, linea] of texto.split('\n').entries()) {
        if (linea.trimStart().startsWith('//') || linea.trimStart().startsWith('*')) continue
        if (FRACCION.test(linea)) culpables.push(`${relativa}:${i + 1}`)
      }
    }
    expect(culpables, 'usa fraccionInteres() o repartoSql() de lib/dinero/reparto.js').toEqual([])
  })

  it('nadie reparte el capital por su cuenta', () => {
    const culpables = []
    for (const ruta of todos) {
      const relativa = ruta.slice(RAIZ.length + 1)
      if (PERMITIDOS.some((p) => relativa === p)) continue
      const texto = readFileSync(ruta, 'utf8')
      for (const [i, linea] of texto.split('\n').entries()) {
        if (linea.trimStart().startsWith('//') || linea.trimStart().startsWith('*')) continue
        if (CAPITAL.test(linea)) culpables.push(`${relativa}:${i + 1}`)
      }
    }
    expect(culpables, 'el capital sale por RESTA del pago, en lib/dinero/reparto.js').toEqual([])
  })
})
