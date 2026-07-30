// ── UN ENLACE A UNA RUTA QUE NO EXISTE ES UN 404 EN LA CARA DEL CLIENTE ──
//
// Va por la tercera vez. Primero el FAB: cinco de diez destinos daban 404
// (`/cobrar`, `/qr`, `/gastos/nuevo`, `/plan`, `/lucas`). Los arreglé y no
// revisé el resto del menú. Luego la pantalla «Más»: `/analiticas` cuando la
// ruta real es `/dashboard/analiticas`, y `/perdidos` cuando es `/clavos`.
//
// No se detecta con nada: `<Link href>` acepta cualquier cadena, el build pasa,
// los tipos no existen (no hay TypeScript) y la prueba unitaria del componente
// no sabe qué rutas hay. Solo se descubre pulsando — que es como lo descubrió
// el usuario las dos veces.
//
// Esta prueba lee los destinos escritos en los menús y comprueba que cada uno
// tenga su `page.jsx` en el disco.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()

// Los menús: lo que el usuario pulsa para navegar.
const MENUS = [
  'components/pantallas/PantallaMas.jsx',
  'components/pantallas/MenuCrear.jsx',
  'components/armazon/BarraLateral.jsx',
  'components/layout/BottomNav.jsx',
  'lib/searchCommands.js',
]

/**
 * Los destinos escritos en el archivo. Cada menú los escribe a su manera
 * —`destino:`, `href=`, `ir('/…')`— asi que se buscan TODAS las cadenas que
 * empiezan por barra. Es de brocha gorda a proposito: mas vale revisar de mas
 * que dejar pasar un 404 por no conocer la forma de escribirlo.
 */
function destinos(codigo) {
  // Sin comentarios: los mios CITAN los enlaces rotos de antes («/cobrar daba
  // 404») y la prueba los tomaba por destinos vivos.
  const fuente = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const fuera = new Set()
  const re = /['"`](\/[a-z0-9][^'"`${}\s]*)['"`]/gi
  let m
  while ((m = re.exec(fuente)) !== null) fuera.add(m[1])
  return [...fuera]
}

/**
 * ¿Existe la ruta? Se resuelve contra `app/`, probando los grupos —`(dashboard)`,
 * `(auth)`…— porque en el disco viven dentro de un paréntesis que la URL no ve.
 * Los segmentos dinámicos (`/clientes/3`) casan con la carpeta `[id]`.
 */
function existeRuta(ruta) {
  const partes = ruta.split('?')[0].split('#')[0].split('/').filter(Boolean)
  const grupos = readdirSync(join(RAIZ, 'app'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('('))
    .map((d) => d.name)

  for (const base of ['', ...grupos]) {
    let dir = join(RAIZ, 'app', base)
    let vale = true
    for (const parte of partes) {
      const directo = join(dir, parte)
      if (existsSync(directo)) { dir = directo; continue }
      // Un grupo intermedio: /prestamos/nuevo puede estar en (dashboard)/prestamos
      const dinamico = existsSync(dir)
        ? readdirSync(dir, { withFileTypes: true })
            .find((d) => d.isDirectory() && d.name.startsWith('['))
        : null
      if (dinamico) { dir = join(dir, dinamico.name); continue }
      vale = false
      break
    }
    if (vale && (existsSync(join(dir, 'page.jsx')) || existsSync(join(dir, 'page.js')))) return true
  }
  return false
}

describe('los menús no llevan a ningún 404', () => {
  for (const archivo of MENUS) {
    it(archivo.split('/').pop(), () => {
      const rutas = destinos(readFileSync(join(RAIZ, archivo), 'utf8'))
        // Ni las externas, ni las anclas, ni las llamadas al servidor: `/api/…`
        // no es una pantalla a la que se navegue.
        .filter((r) => !r.startsWith('//') && !r.startsWith('/api/') && !r.includes('.'))
      expect(rutas.length, `${archivo} no declara ningún destino — ¿cambió la forma de escribirlos?`)
        .toBeGreaterThan(0)

      const rotos = rutas.filter((r) => !existeRuta(r))
      expect(rotos, `estos destinos de ${archivo} dan 404: ${rotos.join(', ')}`).toEqual([])
    })
  }

  it('la prueba de verdad detecta un 404', () => {
    // Sin esto, un fallo en `existeRuta` haría pasar todo en silencio.
    expect(existeRuta('/clientes')).toBe(true)
    expect(existeRuta('/dashboard/analiticas')).toBe(true)
    expect(existeRuta('/clientes/3')).toBe(true)          // segmento dinámico
    expect(existeRuta('/analiticas')).toBe(false)         // el que rompía «Más»
    expect(existeRuta('/perdidos')).toBe(false)           // el otro
    expect(existeRuta('/no-existe-esta-ruta')).toBe(false)
  })
})
