import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── NADA POR DEBAJO DE 10px ─────────────────────────────────────────────────
//
// `11-ESCALAS §1C` lo dice sin margen:
//
//   «Nada por debajo de 10px. Y el 10px solo existe en mayúsculas con
//    letter-spacing.»
//
// Y esta no es una regla estética: quien usa esta app la lee **de pie, en la
// calle, con el teléfono en una mano y el cuaderno en la otra**. Un 8px ahí no
// es «pequeñito», es ilegible.
//
// Había 146 sitios por debajo: 1 de 7px, 19 de 8, 111 de 9 y 15 de 9,5. 126 de
// ellos en pantallas que ve el cliente. Subidos según el papel del texto:
//
//   uppercase con tracking  →  10   (etiqueta de sección; 50 sitios)
//   texto normal            →  11   (metadato pequeño;    96 sitios)
//
// ⚠ El destino NO se puede decidir con un reemplazo ciego, y el primer intento
// se equivocó: miraba la línea y sus dos vecinas, así que «{pctMora}% en mora»
// —minúsculas— salía clasificado como etiqueta porque el rótulo de ARRIBA sí lo
// era. Hay que mirar el elemento, del `<` de apertura a su `>`.

function jsxDe(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsxDe(p, acc)
    else if (e.endsWith('.jsx')) acc.push(p)
  }
  return acc
}

const RAIZ = process.cwd()
const FICHEROS = [...jsxDe(resolve(RAIZ, 'app')), ...jsxDe(resolve(RAIZ, 'components'))]

describe('el mínimo legible de la app es 10px', () => {
  it('ninguna pantalla baja de ahí', () => {
    // 9,5 incluido: no está en la escala y además es medio píxel, que en un
    // teléfono se resuelve como le da la gana.
    const flojos = []
    for (const p of FICHEROS) {
      const src = readFileSync(p, 'utf8')
      const re = /text-\[(\d+(?:\.\d+)?)px\]|fontSize: (\d+(?:\.\d+)?)(?=[,\s}])/g
      let m
      while ((m = re.exec(src))) {
        const px = parseFloat(m[1] ?? m[2])
        if (px < 10) {
          const linea = src.slice(0, m.index).split('\n').length
          flojos.push(`${p.slice(RAIZ.length + 1)}:${linea} → ${px}px`)
        }
      }
    }
    expect(flojos, `texto por debajo del mínimo:\n  ${flojos.slice(0, 25).join('\n  ')}`)
      .toEqual([])
  })

  it('y las que quedaron en 10 son mayúsculas, como manda el canon', () => {
    /* El 10px es un permiso condicionado, no un tamaño libre: solo vale para
       la etiqueta de sección en mayúsculas y con `letter-spacing`, donde las
       versales dan altura de x aunque el cuerpo sea pequeño.

       Esta prueba mira SOLO lo que este barrido tocó —los que subieron de
       7/8/9 a 10—; los 10px que ya existían antes son otra tanda pendiente y
       no se cuelan aquí para no dar por revisado lo que no lo está. */
    /* ⚠ Buscar el TEXTO con `indexOf` y mirar hacia atrás no sirve: «Disponible»
       aparece antes en `lineas-credito` dentro de `linea.cupoDisponible`, y la
       prueba se enganchaba a un `<div>` que no tenía nada que ver. Se busca el
       elemento entero. */
    const muestra = [
      ['app/(dashboard)/dashboard/analiticas/page.jsx', 'Préstamos activos'],
      ['app/(dashboard)/cobradores/[id]/page.jsx', 'Cobros'],
      ['app/(dashboard)/lineas-credito/page.jsx', 'Disponible'],
    ]
    for (const [f, texto] of muestra) {
      const src = readFileSync(resolve(RAIZ, f), 'utf8')
      const re = new RegExp(`<p [^>]*text-\\[10px\\][^>]*>${texto}</p>`)
      const el = src.match(re)?.[0]
      expect(el, `no encontré el rótulo «${texto}» a 10px en ${f}`).toBeTruthy()
      expect(el, `«${texto}» quedó en 10px sin ser mayúsculas`).toMatch(/uppercase/)
    }
  })
})

describe('el pagaré sigue siendo legible al imprimirlo', () => {
  it('sus rótulos subieron de 9,5 a 10', () => {
    /* Miré este aparte antes de tocarlo: un documento que se imprime podría
       justificar un cuerpo menor. No era el caso —son dos rótulos en
       mayúsculas con tracking, exactamente el papel que el canon permite a
       10px—, así que suben como los demás. */
    const src = readFileSync(resolve(RAIZ, 'components/pantallas/Pagare.jsx'), 'utf8')
    expect(src).not.toMatch(/fontSize: 9\.5/)
    expect(src).toMatch(/fontSize: 10, fontWeight: 700, letterSpacing: '\.06em', textTransform: 'uppercase'/)
  })
})
