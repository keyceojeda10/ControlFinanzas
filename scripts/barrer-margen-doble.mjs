// scripts/barrer-margen-doble.mjs — el margen doble, barrido entero.
//
// ── EL PATRÓN ──────────────────────────────────────────────────────────────
// El relleno lateral lo pone el ARMAZÓN (`layout.jsx` con su `px-5`), no el
// componente. Cuando un componente pone además su `--cf-pad-screen`, son 40px
// por lado y la pantalla sale más estrecha que las demás.
//
// Va por su quinta aparición: la ficha de préstamo, la de cliente, el panel, la
// de ruta y ahora `/rutas`. Cada vez se arregló la que alguien reportó, y las
// otras siguieron rotas hasta el siguiente reporte. Esto las lista TODAS de una
// vez, que es la única forma de dejar de jugar al topo.
//
// Dos familias distintas, y conviene no mezclarlas:
//
//   A · El componente pone relleno y NI SIQUIERA ACEPTA `sinMargen`.
//       La página no tiene forma de apagarlo. Hay que añadirle la prop.
//
//   B · El componente SÍ acepta la prop y la página no se la pasa.
//       Arreglo de una palabra. Es lo que le pasaba a `/rutas`.
//
//   node scripts/barrer-margen-doble.mjs

import fs from 'node:fs'
import path from 'node:path'

function archivos(dir, ext = '.jsx', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      archivos(p, ext, out)
    } else if (e.name.endsWith(ext)) out.push(p)
  }
  return out
}

const norm = (p) => p.split(path.sep).join('/')

// ── 1 · Quién pone relleno lateral propio, y quién acepta apagarlo ──
const ponen = new Map()   // nombre -> { archivo, aceptaProp }
for (const f of archivos('components')) {
  const s = fs.readFileSync(f, 'utf8')
  if (!s.includes('cf-pad-screen')) continue
  const nombre = path.basename(f, '.jsx')
  // «Acepta la prop» = la nombra en la lista de props del componente.
  const acepta = /sinMargen\s*=\s*false|sinMargen\s*,|\bsinMargen\s*\}/.test(s)
  ponen.set(nombre, { archivo: norm(f), acepta })
}

// ── 2 · Dónde se montan, y si les pasan la prop ──
const sinPasar = []
const paginas = archivos('app')
for (const f of paginas) {
  const rel = norm(f)
  if (rel.includes('/estilo/')) continue      // el banco de pruebas no cuenta
  const s = fs.readFileSync(f, 'utf8')
  for (const [nombre, info] of ponen) {
    if (!info.acepta) continue                 // familia A, se reporta aparte
    const re = new RegExp('<' + nombre + '(\\s[^>]*?)?/?>', 'gs')
    let m
    while ((m = re.exec(s)) !== null) {
      const props = m[1] || ''
      if (!/\bsinMargen\b/.test(props)) {
        sinPasar.push({ pagina: rel, linea: s.slice(0, m.index).split('\n').length, comp: nombre })
      }
    }
  }
}

const noAceptan = [...ponen.entries()].filter(([, i]) => !i.acepta)

console.log('── A · PONEN RELLENO Y NO ACEPTAN APAGARLO ──')
console.log('   La página no tiene forma de evitar el margen doble.\n')
for (const [n, i] of noAceptan) console.log(`   ${n.padEnd(20)} ${i.archivo}`)

console.log('\n── B · ACEPTAN LA PROP Y LA PÁGINA NO SE LA PASA ──')
console.log('   Arreglo de una palabra.\n')
if (!sinPasar.length) console.log('   (ninguno)')
for (const x of sinPasar) console.log(`   <${x.comp}>`.padEnd(22) + `${x.pagina}:${x.linea}`)

console.log(`\nTotal: ${noAceptan.length} de la familia A · ${sinPasar.length} de la familia B`)
