import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/* ══ EL FALLO QUE TIRÓ PRODUCCIÓN EL 4 AGO ═══════════════════════════════════
 *
 * Declaré `reordenarPorNumero` en la línea 1130 usando `clientesFiltrados`, que
 * se declara en la 1365. Un `const` leído antes de existir revienta al
 * renderizar —«Cannot access before initialization»— y la página de detalle de
 * ruta dejó de abrir: los cobradores no pudieron trabajar.
 *
 * ⚠ `next build` COMPILÓ SIN QUEJARSE. Y abrir la página con Playwright TAMPOCO
 * lo detecta: sin sesión redirige al login y el componente no llega a
 * ejecutarse. Lo comprobé reintroduciendo el fallo a propósito — las dos
 * comprobaciones daban verde con el código roto.
 *
 * Lo único que lo caza sin una sesión real es mirar el ORDEN en el fuente. Eso
 * es lo que hace esta prueba.
 */

const ARCHIVOS = [
  ['app', '(dashboard)', 'rutas', '[id]', 'page.jsx'],
  ['app', '(dashboard)', 'clientes', 'page.jsx'],
  ['app', '(dashboard)', 'prestamos', '[id]', 'page.jsx'],
  ['app', '(dashboard)', 'caja', 'page.jsx'],
  ['app', '(dashboard)', 'dashboard', 'page.jsx'],
]

/** Dónde se declara cada `const` de primer nivel del componente. */
function declaraciones(src) {
  const donde = new Map()
  src.split('\n').forEach((linea, i) => {
    // Solo las de dos espacios: las del cuerpo del componente, no las anidadas.
    const m = linea.match(/^ {2}const \[?([A-Za-z_$][\w$]*)/)
    if (m && !donde.has(m[1])) donde.set(m[1], i)
  })
  return donde
}

/** Los `useCallback` / `useMemo` de primer nivel, con el rango que ocupan. */
function hooks(src) {
  const lineas = src.split('\n')
  const out = []
  lineas.forEach((linea, i) => {
    const m = linea.match(/^ {2}const ([A-Za-z_$][\w$]*) = use(Callback|Memo)\(/)
    if (!m) return
    // El hook acaba en la línea que cierra con `}, [...])` a dos espacios.
    let fin = i
    for (let j = i + 1; j < lineas.length && j < i + 120; j++) {
      if (/^ {2}\}, \[/.test(lineas[j])) { fin = j; break }
    }
    out.push({ nombre: m[1], desde: i, hasta: fin })
  })
  return out
}

describe('ningún hook usa una variable declarada MÁS ABAJO', () => {
  for (const partes of ARCHIVOS) {
    const rel = partes.join('/')
    it(rel, () => {
      const src = readFileSync(join(process.cwd(), ...partes), 'utf8')
      const donde = declaraciones(src)
      const lineas = src.split('\n')
      const fallos = []

      for (const h of hooks(src)) {
        const cuerpo = lineas.slice(h.desde, h.hasta + 1).join('\n')
        for (const [nombre, linea] of donde) {
          if (nombre === h.nombre) continue
          // Declarada DESPUÉS de donde arranca este hook.
          if (linea <= h.desde) continue
          // ¿La usa? Palabra completa, y no dentro de un comentario NI DE UNA
          // CADENA. Sin quitar las cadenas, el texto de un `confirm()` que dice
          // «…deja de salir en este recorrido» se contaba como uso de la
          // variable `recorrido`: un falso positivo. Y una prueba que grita sin
          // motivo se acaba ignorando, que es peor que no tenerla.
          const limpio = cuerpo
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '')
            // ⚠ En las plantillas se borra SOLO el texto, no las `${}`: lo de
            // dentro de una interpolación es código de verdad. Vaciar la
            // plantilla entera dejaría pasar un `${clientesFiltrados.length}`
            // —comprobado— y la prueba se volvería un adorno.
            .replace(/`(?:[^`\\$]|\\.|\$(?!\{))*`/g, '``')
            .replace(/`((?:[^`\\]|\\.)*)`/g, (_, dentro) =>
              [...dentro.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(';'))
            .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
            .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
          if (new RegExp(`\\b${nombre}\\b`).test(limpio)) {
            fallos.push(`${h.nombre} (línea ${h.desde + 1}) usa «${nombre}», declarada en la ${linea + 1}`)
          }
        }
      }

      expect(fallos, `\n  ${fallos.join('\n  ')}\n`).toEqual([])
    })
  }
})
