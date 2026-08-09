import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const pantallaRaw = leer('components', 'pantallas', 'CarteraVacia.jsx')
const pantalla = sinComentarios(pantallaRaw)
const lista    = sinComentarios(leer('app', '(dashboard)', 'clientes', 'page.jsx'))
const wizard   = sinComentarios(leer('components', 'onboarding', 'wizard', 'WizardCartulina.jsx'))

describe('T05-04 · las tres vías cuadran con el asistente', () => {
  it('la pantalla ofrece las tres', () => {
    for (const t of ['Foto de la cartulina', 'Un Excel o CSV', 'Escribir un cliente']) {
      expect(pantalla, `falta «${t}»`).toContain(t)
    }
  })

  it('⚠ y la PRIMERA es escribir a mano, que es la que se usa', () => {
    /* Estaba primera la foto, con el argumento de que es la más rápida y la que
       más gente puede usar. Medido en producción, no era cierto:

           clientes creados de a poco   5.026  (97%)
           en ráfaga de 5+ por minuto     152  (3%)

       Y de los 78 negocios que llegaron a 10 clientes, ninguno cargó
       mayoritariamente en bloque. Se recomendaba de primeras la vía del 3%.

       Lo reportó el dueño antes de que nadie lo midiera: «lo que más usan los
       usuarios no es la opción de foto, sino la manual». */
    const orden = ['mano', 'foto', 'excel']
      .map((id) => pantalla.indexOf(`id: '${id}'`))
    expect(orden[0], 'la vía manual ya no existe').toBeGreaterThan(-1)
    expect(orden[0], 'la foto volvió a ir primera').toBeLessThan(orden[1])
    expect(orden[1]).toBeLessThan(orden[2])
  })

  it('el asistente también ofrece las tres', () => {
    // La lámina pide «los mismos métodos, con el mismo orden y las mismas
    // palabras». El asistente ofrecía DOS —foto y a mano— así que quien se lo
    // saltaba veía luego una opción que antes no existía.
    expect(wizard, 'falta la foto').toContain('Sube una foto de tu cartulina')
    expect(wizard, 'falta el Excel').toMatch(/Tengo un Excel o CSV/)
    expect(wizard, 'falta el manual').toContain('quiero registrar manualmente')
  })

  it('las dos llevan al mismo sitio con el archivo', () => {
    expect(pantalla).toContain("destino: '/carga-masiva'")
    expect(wizard).toMatch(/href="\/carga-masiva"/)
  })
})

describe('T05-04 · la cartera arrancada pero mínima', () => {
  it('la pantalla distingue los dos casos', () => {
    // `carteraVacia` solo se cumple con CERO clientes. Quien tiene uno o dos no
    // veía las vías de carga por ningún lado: ni el onboarding —se cierra solo—
    // ni esta pantalla. Medido: 138 de los 311 negocios atascados están así.
    expect(pantalla).toMatch(/arrancada = false/)
    expect(lista).toMatch(/total > 0 && total <= 5/)
  })

  it('no le dice «tu cartera está vacía» a quien ya cargó clientes', () => {
    // Negarle lo que sí hizo. Con uno cargado, el mensaje correcto es otro.
    expect(pantalla).toMatch(/arrancada[\s\S]{0,120}Llevas \$\{cuantos\}|Llevas \$\{cuantos\}/)
    expect(pantalla).toMatch(/'Tu cartera está vacía'/)
  })

  it('⚠ con la cartera arrancada SÍ ofrece escribir a mano', () => {
    /* Antes se caía esa vía en cuanto había un cliente, con este argumento:
       «ya lo escribió, y seguir ofreciéndolo es proponerle justo lo que le tiene
       atascado; ninguna de las 311 atascadas ha hecho una sesión de carga en
       bloque».

       La premisa era cierta y la conclusión no. Medido después: casi NADIE hace
       carga en bloque —el 97% de los clientes se crean de a poco— ni siquiera
       los 78 negocios que sí arrancaron. El dato no separaba a los que
       funcionan de los que no, así que no decía lo que parecía decir.

       Lo reportó el dueño con la pantalla delante: «cuando sugiere seguir
       creando clientes, no está el apartado principal recomendado, que sería
       crear cliente manual». Quedaban solo las dos vías que casi nadie usa: una
       tarjeta de ayuda sin ninguna ayuda usable.

       Tampoco vale decir «el FAB sigue ahí»: si hay que explicar dónde está el
       botón, no está donde se busca. */
    expect(pantalla, 'volvió a esconderse la vía manual')
      .not.toMatch(/VIAS\.filter\(\(v\) => v\.id !== 'mano'\)/)
    expect(pantalla).toMatch(/const vias = puedeCrear \? VIAS : \[\]/)
  })

  it('va DEBAJO de la lista, no encima', () => {
    // Sus dos clientes son lo que vino a ver. Taparlos con un cartel de ayuda
    // es el mismo error que esconder los KPIs en cero: optimizar para el caso
    // vacío y romper el que sí tiene datos.
    const iVacia = lista.indexOf('{carteraVacia && (')
    const iArrancada = lista.indexOf('total > 0 && total <= 5')
    expect(iVacia).toBeGreaterThan(-1)
    expect(iArrancada).toBeGreaterThan(iVacia)
  })

  it('se calla en cuanto la cartera crece', () => {
    // A partir de 5 ya sabe cargar; seguir insistiendo es ruido permanente.
    expect(lista).not.toMatch(/total <= (1[0-9]|[6-9])\b/)
  })

  it('no se pinta si hay un filtro puesto', () => {
    // Con un filtro, «llevas 2 clientes» sería falso: la cartera puede tener
    // doscientos y el filtro dejar dos.
    const bloque = lista.match(/!loading && !error && !buscar[\s\S]{0,220}total <= 5/)
    expect(bloque, 'el bloque no comprueba los filtros').toBeTruthy()
    for (const f of ['buscar', 'estado', 'rutaIdFiltro']) {
      expect(bloque[0], `no descarta ${f}`).toContain(`!${f}`)
    }
  })

  it('no se le ofrece a quien no puede crear clientes', () => {
    // Un cobrador sin permiso acabaría en un error.
    expect(lista).toMatch(/total <= 5 && puedeCrearClientes/)
  })
})
