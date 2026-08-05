import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── ARRASTRAR Y SOLTAR NO HACÍA NADA ────────────────────────────────────────
//
// Reportado DOS veces por el dueño: «en el apartado de ordenar no se está
// pudiendo ordenar», y luego «la función de ordenar al arrastrar y soltar no
// funciona, la de los números sí».
//
// La causa no era dónde estaban los manejadores —eso ya se corrigió, van en el
// asa por `setPointerCapture`— sino QUÉ LEÍAN: `mover` y `soltar` se creaban en
// el render y capturaban el `arrastrando` de ese momento, que era `null`.
// Cuando `empezar` ponía el estado, esos manejadores ya estaban atados al
// navegador con el valor viejo: `mover` salía por su primera línea y al soltar
// no había nada que reordenar.
//
// La pista la dio el dueño: «hay ya una función de ordenar de la que te puedes
// guiar, la de ordenar las rutas y la de ordenar cobradores, esa sí funciona
// como debería». Las dos leen de un `useRef`, no del estado.

const src = readFileSync(resolve(process.cwd(), 'components/pantallas/RutaEditar.jsx'), 'utf8')

describe('el arrastre de las paradas', () => {
  it('los manejadores leen de un ref, no del estado', () => {
    // Con `if (!arrastrando) return` el manejador mira una foto vieja. Es el
    // fallo entero en una línea.
    expect(src, 'volvió a leer el estado dentro del manejador')
      .not.toMatch(/const mover = \(e\) => \{\s*\n\s*if \(!arrastrando\) return/)
    expect(src, 'no hay ref para el gesto').toMatch(/const gesto = useRef\(null\)/)
    expect(src).toMatch(/if \(!gesto\.current\) return/)
  })

  it('al soltar se lee el ref, no el estado', () => {
    const i = src.indexOf('const soltar =')
    const bloque = src.slice(i, src.indexOf('}', src.indexOf('onReordenar', i)))
    expect(bloque, '`soltar` vuelve a leer el estado').not.toMatch(/const \{ desde, hasta \} = arrastrando/)
    expect(bloque).toContain('const g = gesto.current')
  })

  it('el ref se limpia al soltar', () => {
    // Sin esto, el siguiente arrastre arrancaría con el gesto anterior dentro.
    const i = src.indexOf('const soltar =')
    const bloque = src.slice(i, i + 400)
    expect(bloque).toContain('gesto.current = null')
  })

  it('el estado sigue existiendo para PINTAR', () => {
    // La fila que se mueve se levanta y el destino se marca: eso necesita
    // re-render, así que `arrastrando` no sobra — solo dejó de ser la fuente
    // que leen los manejadores.
    expect(src).toContain('const [arrastrando, setArrastrando] = useState(null)')
    expect(src, 'la fila arrastrada ya no se marca').toMatch(/arrastrando\?\.desde === i/)
  })

  it('los gestos siguen en el asa', () => {
    // Lo de antes no se pierde: `setPointerCapture` manda todos los eventos al
    // elemento que captura, así que en el contenedor el arrastre se cortaba en
    // cuanto el dedo salía de su área.
    expect(src).toMatch(/<Asa activa=\{activa\} \{\.\.\.gestos\(i\)\} \/>/)
    expect(src).toContain('e.currentTarget.setPointerCapture?.(e.pointerId)')
  })

  it('`gestos` se declara DESPUÉS de lo que usa', () => {
    // Mismo patrón que tiró producción con la TDZ. Aquí no reventaría —se
    // ejecuta al pintar— pero no se deja escrito de una forma que la próxima
    // vez sí rompa.
    expect(src.indexOf('const gestos = (i) =>')).toBeGreaterThan(src.indexOf('const soltar ='))
    expect(src.indexOf('const soltar =')).toBeGreaterThan(src.indexOf('const mover ='))
    expect(src.indexOf('const mover =')).toBeGreaterThan(src.indexOf('const gesto = useRef'))
  })
})

describe('las dos listas montadas', () => {
  it('cada una mide DENTRO de sí misma', () => {
    // La página monta `OrdenRecorrido` dos veces —escritorio dentro de un
    // `hidden lg:block`, y móvil— y `document.querySelector` devuelve el
    // PRIMERO del documento: el de escritorio. En un teléfono ese está oculto
    // y mide 0×0, así que las cajas salían vacías.
    expect(src, 'vuelve a medir en todo el documento')
      .not.toMatch(/const el = document\.querySelector\(`\[data-parada/)
    expect(src).toContain('const raiz = lista.current ?? document')
    expect(src).toMatch(/raiz\.querySelector\(`\[data-parada="\$\{j\}"\]`\)/)
  })

  it('el contenedor tiene su ref', () => {
    expect(src).toMatch(/const lista = useRef\(null\)/)
    expect(src).toContain('<div ref={lista}')
  })
})

describe('ordenando, lo de cobrar no estorba', () => {
  const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')

  it('el capital y lo recaudado se ocultan en móvil', () => {
    // Seguían saliendo al entrar en «Ordenar»: 740px de cosas que no sirven
    // para ordenar. Medido a 393px, la primera parada arrancaba en y=817 de
    // una pantalla de 852. Ahora arranca en 419 y se ven 5 paradas de entrada.
    expect(pagina, 'el capital vuelve a salir ordenando')
      .toContain("{modoVista !== 'ordenar' && (esOwner || puedeVerCapitalRuta) && (")
    expect(pagina, '«lo de hoy» vuelve a salir ordenando')
      .toMatch(/\{modoVista !== 'ordenar' && \(\s*\n\s*<LoDeHoy/)
  })

  it('la fila de herramientas también', () => {
    expect(pagina).toMatch(/modoVista === 'ordenar' \? 'hidden' : ''/)
  })

  it('en escritorio ya se resolvía, y sigue', () => {
    // La rama de PC se oculta entera. Esto no se toca: es de donde salió el
    // criterio.
    expect(pagina).toContain("modoVista === 'ordenar' ? 'hidden' : 'hidden lg:block'")
  })
})
