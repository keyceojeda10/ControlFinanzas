import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(process.cwd(), 'app', '(dashboard)', 'dashboard', 'analiticas')
const pantalla = readFileSync(join(RAIZ, 'page.jsx'), 'utf8')

// Los comentarios de este archivo explican POR QUÉ está cada cosa y citan las
// mismas palabras que busco (columna, rendimiento, sin ruta...). Si mido sobre
// el texto crudo, una prueba puede pasar por su propio comentario explicativo:
// ya me pasó buscando `borderRadius: 999` y encontrándolo dentro de un comentario
// que yo mismo había escrito para justificar haberlo quitado.
const codigo = pantalla
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('T31-02 · analíticas en escritorio', () => {
  it('reparte en dos columnas a partir de lg', () => {
    expect(codigo).toContain('lg:grid-cols-[1.55fr_1fr]')
  })

  it('en móvil sigue siendo UNA columna', () => {
    // `lg:grid` (no `grid` a secas) es lo que deja el apilado intacto por debajo
    // de 1024. Con `grid` suelto, el teléfono partiría en dos columnas de 190px.
    const rejilla = codigo.match(/className="[^"]*lg:grid-cols-\[1\.55fr_1fr\][^"]*"/)[0]
    expect(rejilla).toContain('lg:grid')
    expect(rejilla).not.toMatch(/(^|\s)grid(\s|")/)
  })

  it('los carriles no se estiran al más alto', () => {
    // Sin `items-start` las dos columnas crecen hasta igualarse y la corta queda
    // con un hueco blanco enorme al final.
    const rejilla = codigo.match(/className="[^"]*lg:grid-cols-\[1\.55fr_1fr\][^"]*"/)[0]
    expect(rejilla).toContain('lg:items-start')
  })

  it('cada columna puede encogerse (min-w-0)', () => {
    // Sin `min-w-0` una tabla ancha empuja su columna y desborda la rejilla:
    // el mínimo por defecto de un item de grid es su contenido, no cero.
    const columnas = codigo.match(/<div className="space-y-4 lg:space-y-5 min-w-0">/g) || []
    expect(columnas.length).toBe(2)
  })
})

describe('T31-02 · qué rinde cada ruta', () => {
  it('ordena por RENDIMIENTO, no por ganancia en pesos', () => {
    // El fallo que arregla: ordenado por pesos, un 16,5% sobre $1,5M caía por
    // debajo de un 8,7% sobre $6,4M y la ruta que mejor trabaja el capital
    // parecía la peor.
    expect(codigo).toMatch(/rutasOrdenadas\s*=[\s\S]{0,160}sort\(\(a, b\) => b\.roi - a\.roi\)/)
  })

  it('aparta «sin ruta» del ranking', () => {
    expect(codigo).toMatch(/rutasOrdenadas\s*=[\s\S]{0,120}filter\(\(r\) => r\.rutaId\)/)
    expect(codigo).toMatch(/sinRuta\s*=[\s\S]{0,80}find\(\(r\) => !r\.rutaId\)/)
  })

  it('reconoce la huérfana por rutaId, NUNCA por el nombre', () => {
    // El API le pone el nombre 'Sin ruta' cuando `rutaNombre` viene vacío.
    // Comparar por ese texto rompe en cuanto un cliente bautice una ruta suya
    // «Sin ruta» — y esa ruta real se pintaría como el agujero rojo.
    expect(codigo).not.toMatch(/(nombre|r\.nombre)\s*===\s*['"]Sin ruta['"]/)
  })

  it('la fila huérfana se pinta aparte', () => {
    expect(codigo).toMatch(/<FilaRuta[^>]*\bhuerfana\b/)
  })

  it('cabecera y filas comparten LA MISMA rejilla', () => {
    // La trampa que ya se cobró la lista de clientes: la cabecera acabó con una
    // columna más que las filas, en el JSX se veía bien y solo apareció
    // midiendo la rejilla en el navegador. Con una constante única no puede
    // volver a pasar — pero hay que comprobar que de verdad es única.
    const anchos = codigo.match(/gridTemplateColumns: '[^']+'/g) || []
    const literales = anchos.filter((a) => !a.includes('COLS_RUTA'))
    // Solo se admite el de móvil (dos columnas); el de escritorio va por COLS_RUTA.
    expect(literales).toEqual(["gridTemplateColumns: 'minmax(0,1fr) auto'"])

    const cols = codigo.match(/const COLS_RUTA = '([^']+)'/)[1]
    expect(cols.trim().split(/\s+/)).toHaveLength(5)
  })

  it('la cabecera de escritorio tiene tantas celdas como columnas', () => {
    const cab = codigo.match(/if \(cabecera\) \{[\s\S]*?\n  \}/)[0]
    const celdas = cab.match(/<span/g) || []
    expect(celdas).toHaveLength(5)
  })

  it('la barra se mide contra el mejor ROI, no contra 100', () => {
    // Los ROI mensuales reales rondan el 8-17%: contra 100 todas las barras
    // saldrían casi vacías y no distinguirían la buena de la mala.
    expect(codigo).toMatch(/pctBarra[\s\S]{0,90}r\.roi \/ maxRoi/)
  })

  it('lleva las tres cifras juntas: capital, ganancia y porcentaje', () => {
    // El pie de la lámina: un porcentaje solo no se puede juzgar.
    const fila = codigo.match(/function FilaRuta[\s\S]*?\n\}/)[0]
    expect(fila).toContain('r.capitalDesplegado')
    expect(fila).toContain('r.interesGanado')
    expect(fila).toContain('r.roi')
  })
})

describe('T31-02 · el API no cambia', () => {
  it('no pide campos nuevos: todo sale del payload que ya llega', () => {
    const api = readFileSync(
      join(process.cwd(), 'app', 'api', 'dashboard', 'analiticas', 'route.js'), 'utf8')
    for (const campo of ['rutaId', 'capitalDesplegado', 'interesGanado', 'prestamos', 'roi']) {
      expect(api, `falta ${campo} en porRuta`).toMatch(new RegExp(`${campo}[:,]`))
    }
  })
})
