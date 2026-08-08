// lib/__tests__/canvas-sin-variables-css.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// `ctx.fillStyle = 'var(--cf-ink)'` **no falla**. Canvas no entiende CSS: en
// vez de lanzar un error descarta la asignación y se queda el color anterior,
// que de fábrica es negro. No hay aviso en consola, no hay excepción, no lo ve
// ninguna prueba de comportamiento.
//
// Estaba en siete sitios. El más visible: el marco del comprobante en imagen se
// dibujaba con `strokeStyle = 'var(--cf-border)'`, así que salía un borde NEGRO
// de 2 px alrededor de todo. Eso es, literalmente, «un cuadradito feo que no
// tiene nada que ver, no nos representa».
//
// ⚠ Y la trampa al arreglarlo: en un `style` de JSX `var(--cf-ink)` es CORRECTO
// y el navegador sí lo resuelve. Sustituyendo la cadena suelta toqué 41 sitios
// en la pantalla de préstamo nuevo, de los que uno solo estaba mal. Por eso
// esta prueba mira **la línea completa**, no la cadena.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
/* ⚠ `__tests__` fuera: la primera versión de esta prueba SE ACUSABA A SÍ MISMA
   —los ejemplos del comentario de arriba llevan el patrón literal— y fallaba
   con tres «fallos» que eran su propia documentación. Van ya cinco veces con
   esta clase de prueba; por eso además se quitan los comentarios antes de
   mirar. */
const SALTAR = new Set(['node_modules', '.next', '.git', 'public', '.auditoria', '__tests__'])

/** El código de verdad, sin comentarios de bloque ni de línea. */
function sinNotas(txt) {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length))
}

function fuentes(dir, acc = []) {
  for (const entrada of readdirSync(dir)) {
    if (SALTAR.has(entrada)) continue
    const p = path.join(dir, entrada)
    if (statSync(p).isDirectory()) fuentes(p, acc)
    else if (/\.(jsx?|mjs)$/.test(entrada)) acc.push(p)
  }
  return acc
}

/* Cualquier propiedad de Canvas que reciba un color o una fuente. `font` entra
   igual: `ctx.font = 'var(--font-manrope)'` tampoco funciona. */
const PELIGRO = /\bctx\s*\.\s*(fillStyle|strokeStyle|shadowColor|font)\s*=\s*[^\n]*var\(--/

describe('Canvas no acepta variables CSS', () => {
  const archivos = [
    ...fuentes(path.join(RAIZ, 'components')),
    ...fuentes(path.join(RAIZ, 'app')),
    ...fuentes(path.join(RAIZ, 'lib')),
  ]

  it('ningún dibujo en canvas usa var(--…)', () => {
    const malos = []
    for (const archivo of archivos) {
      const lineas = sinNotas(readFileSync(archivo, 'utf8')).split(/\r?\n/)
      lineas.forEach((linea, i) => {
        if (PELIGRO.test(linea)) {
          malos.push(`${path.relative(RAIZ, archivo).replace(/\\/g, '/')}:${i + 1}  ${linea.trim()}`)
        }
      })
    }
    expect(malos, malos.join('\n')).toEqual([])
  })

  it('la prueba encuentra el patrón cuando existe', () => {
    // Sin esto, un fallo del recorrido de archivos se leería como «todo bien».
    expect(PELIGRO.test("  ctx.fillStyle = 'var(--cf-ink)'")).toBe(true)
    expect(PELIGRO.test('  style={{ color: "var(--cf-ink)" }}')).toBe(false)
    expect(archivos.length).toBeGreaterThan(100)
  })
})
