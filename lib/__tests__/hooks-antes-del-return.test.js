import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── UN HOOK DESPUÉS DE UN `return` TUMBA LA PANTALLA ────────────────────────
//
// `/prestamos/nuevo` llamaba a `useCabecera` DESPUÉS de:
//
//     if (authLoading) return null
//     if (!puedeCrearPrestamos) return null
//
// Con la sesión cargando, el componente salía antes de llamar al hook; cuando
// terminaba de cargar, lo llamaba. Dos renders con distinto número de hooks es
// el React error #310, y la pantalla entera se caía con «No podemos conectarnos
// ahora mismo» — justo la pantalla con la que se crea un préstamo.
//
// ⚠ LLEGÓ A PRODUCCIÓN, y es la tercera vez que cometo este fallo. Por qué se
// cuela siempre:
//
//   · `next build` NO lo detecta: es un error de tiempo de ejecución.
//   · Las 2.849 pruebas tampoco — ninguna monta estas pantallas.
//   · En desarrollo la sesión suele estar caliente, así que el primer render ya
//     trae `authLoading = false` y el hook se llama desde el principio.
//
// Solo aparece cargando la página de verdad, con la sesión fría. Esta prueba
// mira la FORMA del código, que es lo único que se puede comprobar sin montar.

const RAIZ = process.cwd()

function jsxDe(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsxDe(p, acc)
    else if (e.endsWith('.jsx')) acc.push(p)
  }
  return acc
}

/** Vacía los comentarios: explican los fallos y contienen las palabras que se
 *  buscan. Se VACÍAN en vez de borrarse para que los números de línea del aviso
 *  sigan siendo los del archivo de verdad — con `filter` salían corridos y el
 *  aviso mandaba a mirar una línea que no era. */
const sinComentarios = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

/** El detector, suelto, para poder probarlo con casos conocidos. */
function hooksTrasReturn(texto) {
  const lineas = sinComentarios(texto).split('\n')
  const arranques = []
  lineas.forEach((l, i) => {
    if (/^(export (default )?)?(async )?function \w/.test(l)
      || /^(export )?const \w+ = (async )?(\([^)]*\)|\w+) =>/.test(l)) arranques.push(i)
  })
  const malos = []
  for (let b = 0; b < arranques.length; b++) {
    const desde = arranques[b]
    const hasta = arranques[b + 1] ?? lineas.length
    let primerReturn = -1
    for (let i = desde + 1; i < hasta; i++) {
      if (/^ {2}(if \([^)]*\) )?return[\s(]/.test(lineas[i])) { primerReturn = i; break }
    }
    if (primerReturn < 0) continue
    for (let i = primerReturn + 1; i < hasta; i++) {
      const m = lineas[i].match(/^ {2}(const .*= )?(use[A-Z]\w*)\(/)
      if (!m) continue
      malos.push({ hook: m[2], linea: i + 1, trasLinea: primerReturn + 1 })
      break
    }
  }
  return malos
}

describe('el detector caza lo que dice cazar', () => {
  /* Sin esto es un adorno: una prueba que nunca ha visto un fallo no prueba
     que sepa verlo. Ya tuve un barredor que no encontró ni uno real. */

  it('ve el fallo exacto que llegó a producción', () => {
    const malos = hooksTrasReturn(`
function NuevoPrestamo() {
  const [paso, setPaso] = useState(0)
  if (authLoading) return null
  useCabecera({ titulo: 'x' })
  return <div />
}`)
    expect(malos).toHaveLength(1)
    expect(malos[0].hook).toBe('useCabecera')
  })

  it('y NO se queja del mismo código bien ordenado', () => {
    expect(hooksTrasReturn(`
function NuevoPrestamo() {
  const [paso, setPaso] = useState(0)
  useCabecera({ titulo: 'x' })
  if (authLoading) return null
  return <div />
}`)).toEqual([])
  })

  it('no cruza dos funciones distintas (los 21 falsos positivos)', () => {
    /* Auxiliar con `return null` arriba + componente con hooks abajo, y el
       envoltorio de una línea en medio. Las tres formas que me engañaron. */
    expect(hooksTrasReturn(`
const Tooltip = ({ activo }) => {
  if (!activo) return null
  return <div />
}

export default function Pantalla() {
  return <PantallaDentro />
}

function PantallaDentro() {
  const router = useRouter()
  const [x, setX] = useState(0)
  return <div />
}`)).toEqual([])
  })

  it('tampoco con un return dentro de un callback', () => {
    expect(hooksTrasReturn(`
function Pantalla() {
  const filas = datos.map((d) => {
    if (!d.activo) return null
    return d.nombre
  })
  const [x, setX] = useState(0)
  return <div />
}`)).toEqual([])
  })
})

describe('ningún hook se llama después de un return', () => {
  it('en ninguna pantalla del panel', () => {
    /* Se busca el patrón que de verdad rompe: un `return` de primer nivel
       —dos espacios de sangría, o sea el cuerpo del componente— seguido más
       abajo por una llamada a un hook al mismo nivel.

       Los `return` DENTRO de callbacks, efectos o funciones anidadas van con
       más sangría, así que no entran.

       ⚠ HAY QUE PARTIR EL ARCHIVO POR FUNCIONES. Un hook solo tiene que ir
       antes de los `return` DE SU PROPIA función, y estas pantallas tienen
       varias funciones de primer nivel cada una. Dos rondas de falsos
       positivos, las dos por mirar el archivo entero como si fuera una:

         · 12 avisos por cruzar el `return null` de un componentito auxiliar
           de arriba —los `MoneyTooltip`, las pastillas— con el `useState` del
           componente principal.
         · 9 avisos más por empezar en `export default function`: aquí el
           export suele ser un envoltorio de una línea
           (`return <CobradoresPageInner />`, o el `<Suspense>` que pide
           `useSearchParams`) y el componente de verdad va DESPUÉS.

       Ninguno de los 21 era real. Por eso el barrido corta en cada definición
       de primer nivel y mira cada cuerpo por separado. */
    const malos = []
    for (const p of jsxDe(resolve(RAIZ, 'app'))) {
      if (p.includes('estilo')) continue          // banco de pruebas
      for (const m of hooksTrasReturn(readFileSync(p, 'utf8'))) {
        malos.push(`${p.slice(RAIZ.length + 1)}:${m.linea} → ${m.hook}() tras el return de la línea ${m.trasLinea}`)
      }
    }
    expect(malos, `hooks después de un return (React #310):\n  ${malos.join('\n  ')}`)
      .toEqual([])
  })
})

describe('el caso que llegó a producción', () => {
  /* ⚠ Sin comentarios: el comentario que explica el arreglo CITA el
     `if (authLoading) return null`, y como va justo encima del hook, la prueba
     lo encontraba antes y se declaraba rota a sí misma. Van cuatro veces con
     este mismo patrón en el repo. */
  const src = sinComentarios(readFileSync(
    resolve(RAIZ, 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8'))

  it('`useCabecera` va ANTES de los return de permisos', () => {
    const iHook = src.indexOf('useCabecera({')
    const iReturn = src.indexOf('if (authLoading) return null')
    expect(iHook).toBeGreaterThan(-1)
    expect(iReturn).toBeGreaterThan(-1)
    expect(iHook, 'volvió a quedar por debajo del return: eso es el #310')
      .toBeLessThan(iReturn)
  })

  it('y DESPUÉS de las constantes que lee', () => {
    /* La otra punta del mismo problema, y también me ha pasado: subirlo del
       todo lo rompe por leer `PASOS` antes de declararla. El sitio correcto es
       el hueco entre las dos cosas. */
    const iPasos = src.indexOf('const PASOS = [')
    const iHook = src.indexOf('useCabecera({')
    expect(iPasos).toBeGreaterThan(-1)
    expect(iHook, 'se subió por encima de `PASOS` y ahora peta por la otra punta')
      .toBeGreaterThan(iPasos)
  })

  it('se llama UNA sola vez', () => {
    // Al moverlo quedó el de abajo sin borrar durante un momento: con dos
    // llamadas gana la última y el arreglo no sirve de nada.
    expect((src.match(/useCabecera\(\{/g) ?? []).length).toBe(1)
  })
})
