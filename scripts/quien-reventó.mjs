/* ══ QUIÉN REVENTÓ ══════════════════════════════════════════════════════════
 *
 * Traduce el `componentStack` que manda `CazadorDeErrores` a un componente de
 * verdad.
 *
 * En un build de producción los nombres van minificados —el árbol llega como
 * `at ea (…/page-215f….js:1:27459)`— pero eso NO es un callejón sin salida: el
 * byte es exacto y el trozo sigue en el servidor. Cortando alrededor aparece el
 * componente entero. Comprobado el 18 ago 2026 haciendo reventar uno a
 * propósito: el byte 27459 apuntaba al componente exacto, letra por letra.
 *
 * Es la diferencia entre «no se puede reproducir» y «es este».
 *
 *   node scripts/quien-reventó.mjs '<componentStack o una línea suya>'
 *   node scripts/quien-reventó.mjs 'page-215f108f7a0f3948.js:1:27459'
 *
 * En el VPS los trozos están en /home/control-finanzas/.next/static/chunks/.
 */
import { readFileSync, readdirSync } from 'fs'

const entrada = process.argv.slice(2).join(' ')
if (!entrada) {
  console.log('Pásame el componentStack (o una línea con «archivo.js:1:BYTE»).')
  process.exit(1)
}

const RAIZ = process.env.CHUNKS || '.next/static/chunks'

/* Cada marco: el nombre minificado, el archivo y el byte. Solo interesan los
   NUESTROS —`page-…` y los trozos numerados—: los de React no dicen nada, que
   es justo por lo que existe el cazador. */
/* ⚠ Los paréntesis de `(dashboard)` están DENTRO de la URL, así que un
   `[^)]*` corta el marco a la mitad y no encuentra nada. Se busca el patrón
   «algo.js:1:BYTE» a secas y el nombre minificado aparte. */
const marcos = [...entrada.matchAll(/at\s+(\w+)?[^\n]*?([\w%.\-[\]]+\.js):1:(\d+)/g)]
  .map((m) => ({ nombre: m[1] ?? '?', archivo: decodeURIComponent(m[2]), byte: Number(m[3]) }))

if (!marcos.length) {
  console.log('No encontré ningún «archivo.js:1:BYTE» ahí dentro.')
  process.exit(1)
}

/* ⚠ `globSync` no vale aquí: las carpetas de Next llevan corchetes —`[id]`— y
   paréntesis —`(dashboard)`—, que para un patrón de glob son sintaxis. Se
   recorre a mano, que además es más rápido que el glob en 134 archivos. */
const buscar = (nombre) => {
  const pila = [RAIZ]
  while (pila.length) {
    const dir = pila.pop()
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const ruta = `${dir}/${e.name}`
      if (e.isDirectory()) pila.push(ruta)
      else if (e.name === nombre) return ruta
    }
  }
  return null
}

for (const m of marcos) {
  const ruta = buscar(m.archivo)
  console.log(`\n── ${m.nombre}  ·  ${m.archivo}:${m.byte}`)
  if (!ruta) { console.log('   (ese trozo ya no está: se borra con cada despliegue)'); continue }
  const s = readFileSync(ruta, 'utf8')
  const trozo = s.slice(Math.max(0, m.byte - 260), m.byte + 160).replace(/\s+/g, ' ')
  console.log(`   ${trozo}`)
}
