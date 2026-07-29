// scripts/ver-diseno.mjs — MIRAR la lámina del diseño, no leerla.
//
// EL ERROR QUE ESTO CORRIGE, y hundió el primer intento: yo extraía el .dc.html
// como texto plano —quitando etiquetas y leyendo las palabras en orden— y
// construía a partir de eso. Un flujo de texto NO TIENE FORMA: ocho nombres
// seguidos parecen una fila de pestañas cuando son una columna de tarjetas.
//
//   node scripts/ver-diseno.mjs T39-01
//   node scripts/ver-diseno.mjs T02-05 .auditoria/d/clientes.png
//
// El argumento es un PREFIJO: busca en PAQUETE-FINAL/pantallas/ el archivo que
// empiece por ahí, así que «T39-01» basta y no hay que teclear el slug entero.
//
// Recorta EL MARCO de la pantalla, no la página: el borde de 30px, la barra de
// estado con la hora y el pie de foto son andamio del mockup. Lo que hay que
// construir es lo de dentro.

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const RAIZ = path.join(process.cwd(), 'CF Diseño 2026', 'Nuevo', 'PAQUETE-FINAL', 'pantallas')

const prefijo = process.argv[2]
if (!prefijo) {
  console.error('uso: node scripts/ver-diseno.mjs <ID de pantalla> [salida.png]')
  process.exit(1)
}

const candidatos = fs.readdirSync(RAIZ).filter((f) => f.startsWith(prefijo))
if (!candidatos.length) {
  console.error(`no hay ninguna pantalla que empiece por «${prefijo}»`)
  process.exit(1)
}
if (candidatos.length > 1) {
  console.error(`«${prefijo}» es ambiguo:\n  ` + candidatos.join('\n  '))
  process.exit(1)
}

const archivo = path.join(RAIZ, candidatos[0])
const salida = process.argv[3] || path.join('.auditoria', 'd', candidatos[0].replace('.dc.html', '.png'))
fs.mkdirSync(path.dirname(salida), { recursive: true })

const navegador = await chromium.launch()
const pagina = await (await navegador.newContext({ deviceScaleFactor: 2 })).newPage()

const fallos = []
pagina.on('pageerror', (e) => fallos.push(String(e.message).slice(0, 120)))

await pagina.goto(pathToFileURL(archivo).href, { waitUntil: 'load', timeout: 60000 })
// Las láminas traen Manrope y Space Grotesk de Google. Sin esperarlas, la
// captura sale con la tipografía del sistema y las medidas no son comparables.
await pagina.evaluate(() => document.fonts?.ready).catch(() => {})
await pagina.waitForTimeout(1200)

// El marco se busca por TAMAÑO y radio, que es lo único estable entre láminas:
// unas son de 390 y otras de 1440, y ninguna trae clases ni ids.
const marco = await pagina.evaluate(() => {
  const cand = [...document.querySelectorAll('div')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width >= 360 && r.height >= 480)
    .sort((a, b) => (b.r.width * b.r.height) - (a.r.width * a.r.height))
  const esMarco = ({ el, r }) => {
    const radio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    return radio >= 20 || Math.round(r.width) === 390 || Math.round(r.width) === 1440
  }
  const m = cand.find(esMarco) ?? cand[0]
  if (!m) return null
  const r = m.r
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})

if (!marco) {
  console.error('no encontré el marco de la pantalla dentro del archivo')
  await navegador.close()
  process.exit(1)
}

await pagina.setViewportSize({
  width: Math.ceil(marco.x + marco.w + 60),
  height: Math.ceil(Math.max(marco.y + marco.h + 60, 900)),
})
await pagina.waitForTimeout(500)

const m2 = await pagina.evaluate(() => {
  const cand = [...document.querySelectorAll('div')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width >= 360 && r.height >= 480)
    .sort((a, b) => (b.r.width * b.r.height) - (a.r.width * a.r.height))
  const esMarco = ({ el, r }) => {
    const radio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
    return radio >= 20 || Math.round(r.width) === 390 || Math.round(r.width) === 1440
  }
  const m = cand.find(esMarco) ?? cand[0]
  const r = m.r
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})

await pagina.screenshot({
  path: salida,
  clip: { x: m2.x, y: m2.y, width: m2.w, height: m2.h },
})

// Si la lámina saliera vacía es que hace falta el runtime: support.js necesita
// window.React y window.ReactDOM, y el archivo no los carga.
const texto = await pagina.evaluate(() => document.body.innerText.trim().length)

console.log(`lámina : ${candidatos[0]}`)
console.log(`marco  : ${Math.round(m2.w)}×${Math.round(m2.h)}`)
console.log(`texto  : ${texto} caracteres${texto < 40 ? '  ← SOSPECHOSO: ¿hace falta el runtime?' : ''}`)
console.log(`errores: ${fallos.length ? fallos.join(' · ') : 'ninguno'}`)
console.log(`→ ${salida}`)

await navegador.close()
