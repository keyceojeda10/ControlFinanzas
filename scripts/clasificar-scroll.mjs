// scripts/clasificar-scroll.mjs — cuáles pierden su scroll propio y cuáles NO.
//
// DECIDIDO por el dueño: scrollea el DOCUMENTO, las pantallas dejan de montar
// su propio contenedor. Así el hueco de 112px del armazón llega a todas y la
// pastilla deja de tapar el último renglón.
//
// ⚠ PERO NO A TODAS. En la lista de 50 hay tres familias muy distintas y
// mezclarlas rompe cosas:
//
//   PANTALLA · vive dentro del armazón, ocupa el flujo. Su `overflowY: auto`
//              sobra: que scrollee el documento.
//
//   FLOTANTE · modal, hoja inferior, menú. Vive ENCIMA de todo con su propio
//              alto acotado. Su scroll es lo que le permite ser más alto que
//              la ventana sin desbordarla. QUITÁRSELO LO ROMPE.
//
//   INTERNO  · una lista con scroll DENTRO de una tarjeta (una tabla larga,
//              un selector). No es el scroll de la pantalla; se queda.
//
// Se clasifica por señales del propio archivo, y lo dudoso se marca como tal
// en vez de decidirlo solo: son 50 archivos y una migración en bloque es
// exactamente lo que este proyecto ya aprendió a no hacer.
//
//   node scripts/clasificar-scroll.mjs

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

const pantallas = [], flotantes = [], dudosos = []

for (const f of [...archivos('app'), ...archivos('components')]) {
  const rel = norm(f)
  if (rel.includes('/estilo/')) continue
  const s = fs.readFileSync(f, 'utf8')
  if (!/overflowY:\s*['"]auto['"]/.test(s) && !/overflow-y-auto/.test(s)) continue

  // Señales de FLOTANTE: se posiciona fijo cubriendo la pantalla, o se llama
  // como lo que es, o recibe la prop de abrir/cerrar típica de un overlay.
  const esFijo = /position:\s*['"]fixed['"]/.test(s) || /\bfixed inset-0\b/.test(s)
  const nombraOverlay = /(Modal|BottomSheet|HojaInferior|Sheet|Overlay|Drawer|Menu)/.test(path.basename(f))
  const tieneCerrar = /\bonCerrar\b|\bonClose\b/.test(s)
  const zAlta = /zIndex:\s*(\d{2,})|z-\[?\d{2,}/.test(s)

  const puntos = [esFijo, nombraOverlay, tieneCerrar && zAlta].filter(Boolean).length

  if (puntos >= 2) flotantes.push(rel)
  else if (puntos === 1) dudosos.push({ rel, esFijo, nombraOverlay, tieneCerrar, zAlta })
  else pantallas.push(rel)
}

console.log('── PANTALLAS · les sobra el scroll propio, que scrollee el documento ──\n')
for (const x of pantallas) console.log(`   ${x}`)

console.log('\n── FLOTANTES · NO TOCAR, su scroll es lo que las hace funcionar ──\n')
for (const x of flotantes) console.log(`   ${x}`)

console.log('\n── DUDOSOS · una sola señal; mirarlos a mano antes de decidir ──\n')
for (const x of dudosos) {
  const por = [x.esFijo && 'fixed', x.nombraOverlay && 'nombre', x.tieneCerrar && 'onCerrar', x.zAlta && 'z alto']
    .filter(Boolean).join(', ')
  console.log(`   ${x.rel.padEnd(52)} (${por})`)
}

console.log(`\nTotal: ${pantallas.length} pantallas · ${flotantes.length} flotantes · ${dudosos.length} dudosos`)
