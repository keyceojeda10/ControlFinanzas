import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── UN `display` EN LÍNEA SE COME EL `hidden` DE TAILWIND ──────────────────
//
// Un estilo en línea SIEMPRE gana a una clase. Así que un elemento con
// `className="lg:hidden"` y `style={{ display: 'flex' }}` se ve SIEMPRE: la
// clase no puede hacer nada contra él.
//
// No falla nada. No hay error, el build pasa, y una prueba que lea el JSX ve la
// clase puesta y la da por buena. Solo se ve mirando la pantalla en el tamaño
// donde debía esconderse.
//
// ⚠ ME PASÓ TRES VECES EN LA MISMA SESIÓN:
//
//   1 · `display:'grid'` comiéndose un `hidden sm:grid` — «Rinde» se salía de
//       la tarjeta.
//   2 · `display:'flex'` en la caja del panel: el `hidden lg:flex` de la caja
//       de la semana no hacía nada y la gráfica salía DOS VECES en el
//       teléfono. Lo reportó el dueño con captura, ya desplegado.
//   3 · `display:'flex'` en el carril de paradas: se pintaba también en
//       escritorio, donde la lista va a dos columnas y no hay una sola
//       secuencia que numerar.
//
// Las dos primeras las cacé con pruebas puntuales en el sitio donde fallaron, y
// por eso hubo una tercera. Ésta barre el código entero.

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

/* Un elemento JSX completo, de `<` a su `>`, contando llaves para no cortar en
   medio de un `style={{...}}`. Buscar por líneas sueltas no vale: `className` y
   `style` suelen estar en renglones distintos. */
function elementos(src) {
  const out = []
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '<' || !/[A-Za-z]/.test(src[i + 1] ?? '')) continue
    let llaves = 0
    for (let j = i + 1; j < src.length && j < i + 4000; j++) {
      const c = src[j]
      if (c === '{') llaves++
      else if (c === '}') llaves--
      else if (c === '>' && llaves === 0) { out.push(src.slice(i, j + 1)); i = j; break }
    }
  }
  return out
}

/* ¿La clase decide el `display` según el TAMAÑO de pantalla?
   El `(?:^|\s)` y el `(?=\s|$)` hacen falta: con `\b` a secas el guion cuenta
   como límite de palabra y colaban `overflow-hidden` y `lg:flex-col` —que es
   una dirección, no un `display`—. */
const RE_CLASE = /(?:^|\s)(hidden|(?:sm|md|lg|xl|2xl):(?:hidden|flex|grid|block|inline-flex|contents))(?=\s|$)/

/**
 * ¿Este `style` PISA de verdad el `display` de la clase?
 *
 * ⚠ `display: abierto ? 'none' : undefined` NO lo pisa, y es el patrón
 * correcto: React omite la propiedad cuando el valor es `undefined`, así que la
 * clase vuelve a mandar. Sirve para ocultar por ESTADO sin romper el que decide
 * por TAMAÑO — está así en `AsistenteButton`, y la primera versión de esta
 * prueba lo señaló como fallo cuando era correcto.
 */
function pisaElDisplay(estilo) {
  const m = estilo.match(/(?:^|[\s,{])display\s*:([^,\n]*)/)
  if (!m) return false
  return !/undefined/.test(m[1])
}

function buscarEn(src) {
  const malos = []
  for (const el of elementos(src)) {
    const clases = el.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
    const txt = clases ? (clases[1] ?? clases[2] ?? '') : ''
    if (!RE_CLASE.test(txt)) continue
    const estilo = el.match(/style=\{\{([\s\S]*?)\}\}/)
    if (!estilo || !pisaElDisplay(estilo[1])) continue
    malos.push({ el, txt })
  }
  return malos
}

describe('ningún elemento que se esconda por tamaño lleva `display` en el `style`', () => {
  it('en toda la app', () => {
    const malos = []
    for (const p of [...jsxDe(resolve(RAIZ, 'components')), ...jsxDe(resolve(RAIZ, 'app'))]) {
      const src = readFileSync(p, 'utf8')
      for (const m of buscarEn(src)) {
        const linea = src.slice(0, src.indexOf(m.el)).split('\n').length
        malos.push(`${p.slice(RAIZ.length + 1)}:${linea} → ${m.txt.slice(0, 46)}`)
      }
    }
    expect(malos, `el \`display\` en línea se come el \`hidden\`:\n  ${malos.join('\n  ')}`)
      .toEqual([])
  })
})

describe('el detector caza lo que dice cazar', () => {
  /* Sin esto es un adorno: una prueba que nunca ha visto el fallo no demuestra
     que sepa verlo. Se le dan los tres casos reales de la sesión. */
  const buscar = (src) => buscarEn(src).map((m) => m.txt)

  it('ve el caso del carril (`lg:hidden` + display flex)', () => {
    expect(buscar(`<div className="lg:hidden" style={{ width: 34, display: 'flex' }} />`))
      .toHaveLength(1)
  })

  it('ve el caso de la gráfica duplicada, con la clase en plantilla', () => {
    // Sin marca de tamaño no es este fallo.
    expect(buscar('<div className={`flex-col ${x}`} style={{ display: \'flex\' }} />'))
      .toHaveLength(0)
    expect(buscar('<div className={`hidden lg:flex ${x}`} style={{ display: \'flex\' }} />'))
      .toHaveLength(1)
  })

  it('y NO se queja de lo correcto', () => {
    // El `display` en la clase, no en el `style`.
    expect(buscar(`<div className="lg:hidden flex flex-col" style={{ width: 34 }} />`)).toEqual([])
    // Un `display` en línea sin nada que se esconda por tamaño: es legítimo.
    expect(buscar(`<div className="rounded-xl" style={{ display: 'flex' }} />`)).toEqual([])
    // Palabras que CONTIENEN la clase pero no son la clase.
    expect(buscar(`<div className="overflow-hidden" style={{ display: 'flex' }} />`)).toEqual([])
    expect(buscar(`<div className="lg:flex-col" style={{ display: 'flex' }} />`)).toEqual([])
    // Y el patrón bueno para ocultar por ESTADO sin romper el de TAMAÑO.
    expect(buscar(`<div className="hidden lg:flex" style={{ display: open ? 'none' : undefined }} />`))
      .toEqual([])
  })
})
