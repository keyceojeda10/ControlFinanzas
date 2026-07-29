// scripts/ver-diseno.mjs — MIRAR el diseño, no leerlo.
//
// EL ERROR QUE ESTO CORRIGE, y me costó media sesión: yo venía extrayendo el
// texto del .dc.html —quitando etiquetas y leyendo las palabras en orden— y
// construyendo a partir de eso. Pero un flujo de texto no tiene forma: ocho
// nombres seguidos parecen una fila de pestañas cuando en realidad son una
// columna de tarjetas. Así me inventé una sección, me faltó otra, y monté
// Configuración como pestañas cuando el diseño son dos columnas con todo
// apilado a la derecha.
//
// El .dc.html es una PÁGINA. Se abre y se mira.
//
//   node scripts/ver-diseno.mjs "01 · Configuración" .auditoria/d-config.png
//
// Requiere que el archivo esté servido. Una vez:
//   cp "CF Diseño 2026/design_handoff_control_finanzas/Control Finanzas - Rediseno.dc.html" public/diseno.html
//
// (public/diseno.html está en .gitignore: pesa 1,8 MB y es material de diseño,
//  no código.)

import { chromium } from 'playwright'

const buscar = process.argv[2] || '01 · Configuración'
const salida = process.argv[3] || '.auditoria/diseno.png'

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage()
await p.goto('http://localhost:3000/diseno.html', { waitUntil: 'networkidle', timeout: 120000 })
await p.waitForTimeout(1500)

// El título va DEBAJO de su lámina, así que se sube al contenedor que lo tiene
// y se recorta ese bloque entero.
const caja = await p.evaluate((txt) => {
  const todos = [...document.querySelectorAll('*')]
  const t = todos.find((e) => e.children.length === 0 && e.textContent.trim().startsWith(txt))
  if (!t) return null
  let n = t
  for (let i = 0; i < 6 && n.parentElement; i++) {
    n = n.parentElement
    const r = n.getBoundingClientRect()
    if (r.height > 500) break
  }
  n.scrollIntoView()
  const r = n.getBoundingClientRect()
  return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }
}, buscar)

if (!caja) { console.log('no encontré:', buscar); await b.close(); process.exit(1) }
await p.waitForTimeout(700)
const v = p.viewportSize()
const r = await p.evaluate((txt) => {
  const todos = [...document.querySelectorAll('*')]
  const t = todos.find((e) => e.children.length === 0 && e.textContent.trim().startsWith(txt))
  let n = t
  for (let i = 0; i < 6 && n.parentElement; i++) { n = n.parentElement; if (n.getBoundingClientRect().height > 500) break }
  const b = n.getBoundingClientRect()
  return { x: Math.max(0, b.x), y: Math.max(0, b.y), w: b.width, h: b.height }
}, buscar)

await p.screenshot({ path: salida, clip: {
  x: r.x, y: Math.max(0, r.y), width: Math.min(r.w, v.width - r.x), height: Math.min(r.h, v.height - Math.max(0, r.y)),
} })
console.log('capturado', salida, JSON.stringify(r))
await b.close()
import { chromium } from 'playwright'

const buscar = process.argv[2] || '01 · Configuración'
const salida = process.argv[3] || '.auditoria/diseno.png'

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage()
await p.goto('http://localhost:3000/diseno.html', { waitUntil: 'networkidle', timeout: 120000 })
await p.waitForTimeout(1500)

// El título va DEBAJO de su lámina, así que se sube al contenedor que lo tiene
// y se recorta ese bloque entero.
const caja = await p.evaluate((txt) => {
  const todos = [...document.querySelectorAll('*')]
  const t = todos.find((e) => e.children.length === 0 && e.textContent.trim().startsWith(txt))
  if (!t) return null
  let n = t
  for (let i = 0; i < 6 && n.parentElement; i++) {
    n = n.parentElement
    const r = n.getBoundingClientRect()
    if (r.height > 500) break
  }
  n.scrollIntoView()
  const r = n.getBoundingClientRect()
  return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }
}, buscar)

if (!caja) { console.log('no encontré:', buscar); await b.close(); process.exit(1) }
await p.waitForTimeout(700)
const v = p.viewportSize()
const r = await p.evaluate((txt) => {
  const todos = [...document.querySelectorAll('*')]
  const t = todos.find((e) => e.children.length === 0 && e.textContent.trim().startsWith(txt))
  let n = t
  for (let i = 0; i < 6 && n.parentElement; i++) { n = n.parentElement; if (n.getBoundingClientRect().height > 500) break }
  const b = n.getBoundingClientRect()
  return { x: Math.max(0, b.x), y: Math.max(0, b.y), w: b.width, h: b.height }
}, buscar)

await p.screenshot({ path: salida, clip: {
  x: r.x, y: Math.max(0, r.y), width: Math.min(r.w, v.width - r.x), height: Math.min(r.h, v.height - Math.max(0, r.y)),
} })
console.log('capturado', salida, JSON.stringify(r))
await b.close()
