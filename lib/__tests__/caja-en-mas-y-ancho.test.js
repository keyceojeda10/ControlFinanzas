import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DESTINOS } from '@/lib/armazon'

// ── DOS COSAS DE LA CAJA EN MÓVIL ───────────────────────────────────────────
//
// El dueño:
//   «caja debería estar en el menú de los 4 cuadritos porque es una opción muy
//    importante y en móvil solo sale en el menú FAB»
//   «el primer bloque de caja en móvil sale más angosto que el resto de
//    elementos de contenido de esa pantalla»

const mas = readFileSync(resolve(process.cwd(), 'components/pantallas/PantallaMas.jsx'), 'utf8')
const caja = readFileSync(resolve(process.cwd(), 'components/pantallas/Caja.jsx'), 'utf8')
const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/caja/page.jsx'), 'utf8')

describe('la caja se alcanza desde «Más»', () => {
  it('tiene su fila', () => {
    expect(mas).toMatch(/nombre: 'Caja',\s+cifra: null, destino: '\/caja'/)
  })

  it('va pegada a «Capital»: son las dos preguntas de dinero', () => {
    // Separarlas obligaría a recorrer la lista para pasar de «cuánto tengo para
    // prestar» a «cuánto entró hoy».
    const iPlata = mas.indexOf("nombre: 'Capital'")
    const iCaja = mas.indexOf("nombre: 'Caja'")
    const iNegocio = mas.indexOf("nombre: '¿Cómo va el negocio?'")
    expect(iPlata).toBeGreaterThan(0)
    expect(iCaja).toBeGreaterThan(iPlata)
    expect(iCaja).toBeLessThan(iNegocio)
  })

  it('sin cifra inventada', () => {
    /* El API de esta pantalla no trae nada de la caja del día, y añadir una
       consulta a la pantalla que más se abre para llenar un renglón no
       compensa. `10 §7`: «un número inventado es peor que un hueco». */
    const api = readFileSync(resolve(process.cwd(), 'app/api/mas/route.js'), 'utf8')
    expect(api).not.toMatch(/saldoRealCaja|cobradoHoy/)
  })

  it('y su icono es de trazo, como los demás', () => {
    expect(mas).toMatch(/caja:\s+<><rect/)
  })
})

describe('la barra de navegación NO se toca', () => {
  it('siguen siendo los cinco destinos de siempre', () => {
    /* ⚠ La primera lectura fue meter Caja en la pastilla, y el dueño lo
       corrigió: «ojo, no quiero agregar eso al menú sticky de móvil».

       Y el código ya avisaba: `lib/armazon.js:212` documenta que sacar un
       destino «rompió una vez al cliente con más cobradores, el mismo día. Un
       destino que aparece y desaparece rompe la memoria muscular, que es lo
       único que tiene alguien que cobra de pie». */
    expect(DESTINOS.map((d) => d.href)).toEqual([
      '/dashboard', '/clientes', '/prestamos', '/rutas', '/mas',
    ])
  })
})

describe('el primer bloque de la caja mide lo mismo que el resto', () => {
  it('el componente admite montarse sin su relleno', () => {
    /* El componente añadía `--cf-pad-screen` (20px) por su cuenta, y la página
       que lo monta ya está dentro del armazón, que pone el suyo. Medido a
       393px antes del arreglo:

           «Aquí ves el efectivo…»    x=20  ancho 353   ← lo normal
           «CÓMO SE ARMA EL SALDO»    x=40  ancho 313   ← 20px de más por lado

       La salida es la misma que ya usaba `Cobradores.jsx:94`: una prop
       `sinMargen`. No se inventa otra. */
    expect(caja).toMatch(/sinMargen = false,/)
    expect(caja).toMatch(/const padLateral = sinMargen \? '0' : 'var\(--cf-pad-screen\)'/)
  })

  it('y los DOS montajes de la página la usan', () => {
    // Si solo se arreglara uno, el fallo seguiría vivo en la mitad de los casos
    // —es como se han colado otros de esta misma pantalla—.
    expect((pagina.match(/sinMargen/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})
