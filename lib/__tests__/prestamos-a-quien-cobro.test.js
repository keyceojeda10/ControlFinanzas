import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { criterioDelEndpoint } from './_criterio-ventana'

const api = readFileSync(join(process.cwd(), 'app', 'api', 'prestamos', 'route.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const pagina = readFileSync(join(process.cwd(), 'app', '(dashboard)', 'prestamos', 'page.jsx'), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('a quién le toca cobrar, y cuándo', () => {
  /* Pedido por el dueño el 21 ago 2026: «si el cliente quiere saber a quién le
     toca cobrar mañana, o en un rango de tiempo, o a quién le tiene que cobrar
     en 7 días, en los próximos 15 días… así no puede filtrar».

     El filtro EXISTÍA (`porVencer`) pero solo aceptaba 5 y 10, y con un solo
     número no se puede pedir un día suelto: «mañana» arrastraba también los de
     hoy. Ahora la ventana tiene dos extremos.

     Medido contra PRESTA MIL en el espejo: hoy 28 préstamos, mañana 43 —sin
     repetir ninguno—, y en «15 días» aparecen sus 16 quincenales. */

  const HOY = new Date('2026-08-22T05:00:00.000Z')
  const cae = (dias, desde, hasta) => criterioDelEndpoint({ inicioHoy: HOY, desde, hasta })(
    { estado: 'activo', diasMora: 0,
      proximoCobro: new Date(HOY.getTime() + dias * 86400000).toISOString() })

  it('la ventana tiene dos extremos, no uno', () => {
    /* Con un solo número no se puede pedir un día suelto. Se comprueba
       ejecutando el criterio: «del 2 al 4» no puede traer al de mañana. */
    expect(cae(1, 2, 4)).toBe(false)
    expect(cae(2, 2, 4)).toBe(true)
    expect(cae(4, 2, 4)).toBe(true)
    expect(cae(5, 2, 4)).toBe(false)
  })

  it('sin extremo de abajo, «en N días» sigue contando desde hoy', () => {
    // Las llamadas viejas no pueden cambiar de resultado: `porVencer=5` a secas
    // sigue queriendo decir «de hoy a 5».
    expect(api, 'se perdió el valor por defecto del extremo de abajo')
      .toMatch(/porVencerDesde\s*=\s*leerDia\('porVencerDesde'\)\s*\?\?\s*0/)
    expect(cae(0, 0, 5)).toBe(true)
    expect(cae(5, 0, 5)).toBe(true)
    expect(cae(6, 0, 5)).toBe(false)
  })

  it('⚠ y la ventana de CERO sigue siendo un filtro', () => {
    /* «Hoy» es la ventana 0 a 0. Con la guarda vieja —un `porVencer ?` a
       secas— el cero se caía por falsy y la pantalla devolvía TODOS los
       préstamos en vez de los de hoy. */
    expect(cae(0, 0, 0)).toBe(true)
    expect(cae(1, 0, 0)).toBe(false)
    expect(cae(-3, 0, 0)).toBe(false)
  })

  it('las ventanas viven en UN solo sitio', () => {
    /* La fila de chips y la sección del filtro leen la misma tabla. Escrita dos
       veces es como acaban diciendo cosas distintas. */
    expect(pagina).toMatch(/const VENTANAS_COBRO = \{/)
    expect(pagina).toMatch(/const VENTANA = VENTANAS_COBRO\[est\]/)
    // «Mañana» es el día 1 y SOLO el día 1.
    expect(pagina).toMatch(/venceManana:\s*\[1,\s*1\]/)
    expect(pagina).toMatch(/venceHoy:\s*\[0,\s*0\]/)
  })

  it('⚠ y están DENTRO del filtro, no solo como chips', () => {
    /* El dueño las buscó en el filtro y no estaban: «no veo lo de los filtros
       por fecha de cobro… en filtro no hay una sección que diga cobras mañana,
       en dos días, en cinco días, o en un mes». Estaban como chips en la fila de
       arriba. Quien busca un filtro abre el filtro. */
    expect(pagina, 'desapareció la sección del filtro')
      .toMatch(/id: 'cuando', titulo: '¿Cuándo le cobras\?'/)
    expect(pagina).toMatch(/opciones: CUANDO_COBRAS/)
    for (const v of ['venceHoy', 'venceManana', 'vence2', 'vence3',
      'vence5', 'vence7', 'vence15', 'vence30']) {
      expect(pagina, `falta ${v} en la lista del filtro`).toMatch(new RegExp(`valor: '${v}'`))
    }
  })

  it('y al quitarlo se vuelve a «activos», no a la nada', () => {
    expect(pagina).toMatch(/setEstado\(v \|\| 'activo'\)/)
  })
})
