// scripts/acercar.mjs — amplía un recorte de un PNG para MIRARLO de cerca.
//
// Es la pieza que faltaba del cotejo de cierre: a tamaño real, una cabecera son
// 56 píxeles y ahí no se distingue un punto de 8px de uno de 11px, ni un radio
// de 10 de uno de 12. Comparar «a ojo» a 1x es lo mismo que no comparar.
//
//   node scripts/acercar.mjs <png> <x> <y> <ancho> <alto> <salida.png> [escala]
//
// OJO CON LAS COORDENADAS: son píxeles DE LA IMAGEN, no CSS. Tanto ver-diseno
// como recorrer capturan a deviceScaleFactor 2, así que una cabecera de 56 CSS
// mide 112 en el archivo.

import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const [img, x, y, w, h, out, escalaArg] = process.argv.slice(2)
if (!img || !out) {
  console.error('uso: node scripts/acercar.mjs <png> <x> <y> <ancho> <alto> <salida.png> [escala]')
  process.exit(1)
}
const s = Number(escalaArg || 3)
fs.mkdirSync(path.dirname(out), { recursive: true })

const nav = await chromium.launch()
const pag = await nav.newPage({
  viewport: { width: Math.ceil(w * s), height: Math.ceil(h * s) },
})
// El PNG va incrustado como data URI, no como file://. Con setContent la página
// es about:blank y el navegador BLOQUEA los file:// de otro origen: la captura
// salía en blanco y no daba ningún error.
const datos = `data:image/png;base64,${fs.readFileSync(path.resolve(img)).toString('base64')}`
await pag.setContent(`<body style="margin:0;background:#fff;overflow:hidden">
  <img id="i" src="${datos}"
       style="position:absolute;left:${-x * s}px;top:${-y * s}px;
              transform-origin:0 0;transform:scale(${s})">
</body>`)
await pag.waitForFunction(() => document.getElementById('i')?.complete)
await pag.screenshot({ path: out })
await nav.close()

console.log(`${out}  (${w}×${h} de ${path.basename(img)}, a ${s}x)`)
