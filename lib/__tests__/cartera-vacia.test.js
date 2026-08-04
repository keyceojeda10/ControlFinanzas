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
    for (const t of ['Foto de la cartulina', 'Un Excel o CSV', 'Escribir el primero']) {
      expect(pantalla, `falta «${t}»`).toContain(t)
    }
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

  it('con la cartera arrancada NO ofrece «escribir el primero»', () => {
    // Ya lo escribió. Seguir ofreciéndolo es proponerle justo lo que le tiene
    // atascado: cargar de a uno. Ninguna de las 311 atascadas ha hecho nunca
    // una sesión de carga en bloque.
    expect(pantalla).toMatch(/arrancada \? VIAS\.filter\(\(v\) => v\.id !== 'mano'\)/)
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
    for (const f of ['buscar', 'estado', 'grupoFiltro', 'rutaIdFiltro']) {
      expect(bloque[0], `no descarta ${f}`).toContain(`!${f}`)
    }
  })

  it('no se le ofrece a quien no puede crear clientes', () => {
    // Un cobrador sin permiso acabaría en un error.
    expect(lista).toMatch(/total <= 5 && puedeCrearClientes/)
  })
})
