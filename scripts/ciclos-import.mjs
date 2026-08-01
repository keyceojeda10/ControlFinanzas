// scripts/ciclos-import.mjs — busca importaciones circulares.
//
// ══ POR QUE EXISTE ═════════════════════════════════════════════════════════
//
// «Cannot access 'O' before initialization» en un bundle minificado casi nunca
// es una variable mal puesta dentro de un archivo —eso lo caza
// `no-use-before-define`— sino un CICLO DE IMPORTACIONES: A importa B, B importa
// A, y al evaluar el modulo uno de los dos lee una `const` del otro que todavia
// no existe.
//
// No lo detecta el build, ni las pruebas, ni ESLint. Y aparece solo en algunas
// rutas, segun el orden en que el empaquetador decida evaluar los modulos, que
// es justo por que un error asi puede vivir semanas en produccion.
//
//   node scripts/ciclos-import.mjs                  → todos los ciclos
//   node scripts/ciclos-import.mjs app/x/page.jsx   → solo los que tocan ese archivo
//
// Solo mira imports estaticos con ruta relativa o con el alias `@/`.

import fs from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
const FOCO = process.argv[2] ? path.resolve(RAIZ, process.argv[2]) : null
const EXT = ['.js', '.jsx', '.ts', '.tsx']

function resolver(desde, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(RAIZ, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(desde), spec)
  else return null

  for (const e of EXT) {
    if (fs.existsSync(base + e)) return base + e
    const idx = path.join(base, 'index' + e)
    if (fs.existsSync(idx)) return idx
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  return null
}

const RE_IMPORT = /^\s*import\s[^'"]*from\s*['"]([^'"]+)['"]/gm
const RE_SOLO = /^\s*import\s*['"]([^'"]+)['"]/gm

const cache = new Map()
function importaDe(archivo) {
  if (cache.has(archivo)) return cache.get(archivo)
  let src = ''
  try { src = fs.readFileSync(archivo, 'utf8') } catch { cache.set(archivo, []); return [] }
  const salida = []
  for (const re of [RE_IMPORT, RE_SOLO]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src))) {
      const r = resolver(archivo, m[1])
      if (r) salida.push(r)
    }
  }
  cache.set(archivo, salida)
  return salida
}

function archivos(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) archivos(p, salida)
    else if (EXT.includes(path.extname(e.name))) salida.push(p)
  }
  return salida
}

const raices = ['app', 'components', 'lib', 'hooks']
  .filter((d) => fs.existsSync(path.join(RAIZ, d)))
  .flatMap((d) => archivos(path.join(RAIZ, d)))

const ciclos = []
const enPila = new Set()
const visto = new Set()

function recorrer(nodo, pila) {
  if (enPila.has(nodo)) {
    const i = pila.indexOf(nodo)
    if (i >= 0) ciclos.push([...pila.slice(i), nodo])
    return
  }
  if (visto.has(nodo)) return
  visto.add(nodo)
  enPila.add(nodo)
  pila.push(nodo)
  for (const hijo of importaDe(nodo)) recorrer(hijo, pila)
  pila.pop()
  enPila.delete(nodo)
}

for (const f of raices) recorrer(f, [])

const corto = (p) => path.relative(RAIZ, p).replace(/\\/g, '/')
const unicos = [...new Map(ciclos.map((c) => [c.map(corto).sort().join('|'), c])).values()]
const filtrados = FOCO ? unicos.filter((c) => c.includes(FOCO)) : unicos

if (!filtrados.length) {
  console.log(FOCO ? 'sin ciclos que toquen ese archivo' : 'sin ciclos')
} else {
  console.log(`${filtrados.length} ciclo${filtrados.length === 1 ? '' : 's'}:`)
  for (const c of filtrados) console.log('  ' + c.map(corto).join('\n    → '))
}
process.exit(filtrados.length ? 1 : 0)
