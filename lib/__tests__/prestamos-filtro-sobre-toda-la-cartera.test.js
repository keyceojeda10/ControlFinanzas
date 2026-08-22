import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/* El fallo que cierra esta prueba:
 *
 * El dueño escogia «Hoy» en Prestamos y le salia CERO teniendo 43 clientes para
 * cobrar hoy. La base devolvia UNA PAGINA de 20 prestamos —los ultimos creados—
 * y el filtro de la ventana se aplicaba encima de esos 20. Si ninguno de los 20
 * vencia hoy, la respuesta era «no tienes a quien cobrarle».
 *
 * Cuatro filtros se resuelven en JS (mora, dias de mora, listos para renovar y
 * la ventana de cobro) y los cuatro necesitan la cartera entera. Se corrigio
 * para la mora hace meses y los otros tres se quedaron atras.
 *
 * La prueba EJECUTA la condicion del endpoint en vez de leerla, para que siga
 * valiendo aunque se reescriba. */

const FUENTE = readFileSync(join(process.cwd(), 'app/api/prestamos/route.js'), 'utf8')

// La expresion que decide si el filtro vive en JS, sacada del propio endpoint.
function condicionReal() {
  const m = FUENTE.match(/const\s+filtraEnJs\s*=\s*([^\n]+)/)
  expect(m, 'el endpoint ya no declara `filtraEnJs`').toBeTruthy()
  return new Function('soloMora', 'diasMoraMin', 'listosRenovar', 'porVencer',
    `return (${m[1].replace(/\s*$/, '')})`)
}

describe('los filtros que se calculan en JS ven la cartera entera', () => {
  const APAGADO = { soloMora: false, diasMoraMin: null, listosRenovar: false, porVencer: null }
  const correr = (fn, x) => !!fn(x.soloMora, x.diasMoraMin, x.listosRenovar, x.porVencer)

  it('sin ningun filtro, la base pagina como siempre', () => {
    expect(correr(condicionReal(), APAGADO)).toBe(false)
  })

  const CASOS = [
    ['en mora',            { soloMora: true }],
    ['mas de N dias',      { diasMoraMin: 30 }],
    ['listos para renovar',{ listosRenovar: true }],
    ['vence hoy',          { porVencer: 0 }],      // ⚠ cero: el caso que fallaba
    ['vence manana',       { porVencer: 1 }],
    ['de aqui a 15 dias',  { porVencer: 15 }],
  ]
  for (const [nombre, encendido] of CASOS) {
    it(`«${nombre}» trae todos los activos antes de filtrar`, () => {
      expect(correr(condicionReal(), { ...APAGADO, ...encendido })).toBe(true)
    })
  }

  it('la paginacion en SQL depende de esa condicion, no solo de la mora', () => {
    // El `take`/`skip` de Prisma tiene que estar colgado de la condicion
    // completa. Colgado solo de `soloMora` era exactamente el fallo.
    const linea = FUENTE.match(/\.\.\.\(page != null && ([^&]+)&&\s*\{\s*take:/)
    expect(linea, 'ya no se ve el take/skip condicionado').toBeTruthy()
    expect(linea[1]).toContain('filtraEnJs')
    expect(linea[1]).not.toMatch(/^\s*!soloMora\s*$/)
  })
})
