// scripts/barrer-scroll.mjs — por qué los espacios de abajo están desparejos.
//
// ── LA HIPÓTESIS ───────────────────────────────────────────────────────────
// El armazón reserva 112px al final para que la pastilla no tape la última
// tarjeta, y lo pinta DESPUÉS de `{children}`:
//
//     {children}
//     {armazon.pastilla && <div className="h-[112px] lg:hidden" />}
//
// Eso funciona si la página deja scrollear al DOCUMENTO. Pero si la pantalla
// monta su propio contenedor con `overflowY: auto` y `height: 100%`, el hueco
// queda FUERA de lo que scrollea: el contenedor termina donde termina la
// ventana y la pastilla tapa su último renglón.
//
// Un solo defecto con dos síntomas opuestos, que es justo lo que reporta el
// dueño: «o hay demasiado espacio o hay muy poco y no se ven las cosas».
//
// Y una tercera familia: pantallas con barra de acciones fija abajo (`fixed
// bottom-0`), que necesitan MÁS hueco que 112, no menos.
//
//   node scripts/barrer-scroll.mjs

import fs from 'node:fs'
import path from 'node:path'

function archivos(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      archivos(p, out)
    } else if (e.name.endsWith('.jsx')) out.push(p)
  }
  return out
}
const norm = (p) => p.split(path.sep).join('/')

const propio = []   // scrollean por su cuenta → el hueco del armazón NO les llega
const fijos = []    // barra fija abajo → necesitan MÁS hueco
const suyo = []     // ya se reservan hueco ellas mismas → puede quedar doble

for (const f of [...archivos('app'), ...archivos('components')]) {
  const rel = norm(f)
  if (rel.includes('/estilo/')) continue
  const s = fs.readFileSync(f, 'utf8')

  // 1 · Contenedor con scroll propio.
  if (/overflowY:\s*['"]auto['"]/.test(s) || /overflow-y-auto/.test(s)) {
    const conAlto = /height:\s*['"]100%['"]/.test(s) || /h-full/.test(s) || /h-\[100/.test(s)
    propio.push({ rel, conAlto })
  }

  // 2 · Barra de acciones fija abajo.
  if (/fixed[^"']*bottom-0/.test(s) || /position:\s*['"]fixed['"][\s\S]{0,120}bottom:\s*0/.test(s)) {
    fijos.push(rel)
  }

  // 3 · Se reservan hueco ellas mismas (puede sumarse al del armazón).
  const m = s.match(/(?:paddingBottom|pb-\[?)\s*:?\s*['"]?(\d{2,3})/g)
  if (m) {
    const grandes = m.filter((x) => Number(x.match(/(\d{2,3})/)[1]) >= 80)
    if (grandes.length) suyo.push({ rel, hueco: grandes.join(' ') })
  }
}

console.log('── A · SCROLLEAN POR SU CUENTA ──')
console.log('   El hueco de 112px del armazón queda FUERA. La pastilla tapa el final.\n')
for (const x of propio) console.log(`   ${x.conAlto ? '⚠ con alto fijo ' : '   sin alto fijo '} ${x.rel}`)

console.log('\n── B · BARRA FIJA ABAJO ──')
console.log('   Necesitan MÁS hueco que 112px, no menos.\n')
for (const x of fijos) console.log(`   ${x}`)

console.log('\n── C · SE RESERVAN HUECO ELLAS MISMAS ──')
console.log('   Se suma al del armazón: puede quedar el doble.\n')
for (const x of suyo) console.log(`   ${x.rel}  (${x.hueco})`)

console.log(`\nTotal: ${propio.length} con scroll propio · ${fijos.length} con barra fija · ${suyo.length} con hueco propio`)
