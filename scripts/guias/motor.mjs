// scripts/guias/motor.mjs
// Motor reusable para generar guias visuales (tutoriales con screenshots
// anotados) del sistema, para que el bot de WhatsApp las envie a los usuarios.
//
// Uso: cada guia es un archivo guia-*.mjs que importa este motor y define sus
// pasos. Correr: node scripts/guias/<archivo>.mjs
//
// Requiere: playwright (dev, se instala al generar) + sharp (ya en el proyecto).
// Credenciales de prueba: scripts/guias/.creds.json (gitignored) con
//   { "email": "...", "pass": "..." }
//
// Salida: scripts/guias/output/<slug>/paso-N.png (gitignored).

import { chromium } from 'playwright'
import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://app.control-finanzas.com'
const SCALE = 2
const ACCENT = '#f5c518'
const ROJO = '#ef4444'

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function wrap(t, max=46){ const w=t.split(' '); const L=[]; let c=''; for(const x of w){ if((c+' '+x).trim().length>max){L.push(c.trim());c=x} else c+=' '+x } if(c.trim())L.push(c.trim()); return L }

export function leerCreds() {
  const p = join(__dir, '.creds.json')
  if (!existsSync(p)) throw new Error('Falta scripts/guias/.creds.json con { email, pass } de una cuenta de prueba')
  return JSON.parse(readFileSync(p, 'utf8'))
}

// Compone el screenshot con anotaciones (recuadro/circulo + flecha + banda texto)
async function anotar(buffer, out, { titulo, msg, box, forma }) {
  const meta = await sharp(buffer).metadata()
  const W = meta.width, H = meta.height
  let ov = ''
  if (box && forma) {
    const x=box.x*SCALE, y=box.y*SCALE, w=box.width*SCALE, h=box.height*SCALE, pad=10
    if (forma==='circulo') {
      const cx=x+w/2, cy=y+h/2, r=Math.max(w,h)/2+pad
      ov += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ROJO}" stroke-width="6"/>`
      ov += `<line x1="${cx-r-90}" y1="${cy-r-40}" x2="${cx-r*0.7}" y2="${cy-r*0.7}" stroke="${ROJO}" stroke-width="6" marker-end="url(#a)"/>`
    } else {
      ov += `<rect x="${x-pad}" y="${y-pad}" width="${w+pad*2}" height="${h+pad*2}" rx="14" fill="none" stroke="${ROJO}" stroke-width="6"/>`
    }
  }
  const lines = wrap(msg); const lh=40, padB=28
  const bandH = padB*2 + 54 + lines.length*lh
  const abajo = box && (box.y*SCALE + box.height*SCALE/2) > H*0.62
  const bandY = abajo ? 0 : H - bandH
  ov += `<rect x="0" y="${bandY}" width="${W}" height="${bandH}" fill="rgba(10,10,12,0.92)"/>`
  ov += `<rect x="0" y="${abajo?bandH-6:bandY}" width="${W}" height="6" fill="${ACCENT}"/>`
  const tY = bandY+padB+34
  ov += `<text x="36" y="${tY}" font-family="Arial,sans-serif" font-size="34" font-weight="800" fill="${ACCENT}">${esc(titulo)}</text>`
  lines.forEach((ln,i)=> ov += `<text x="36" y="${tY+44+i*lh}" font-family="Arial,sans-serif" font-size="30" fill="#fff">${esc(ln)}</text>`)
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="a" markerWidth="12" markerHeight="12" refX="8" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="${ROJO}"/></marker></defs>${ov}</svg>`
  await sharp(buffer).composite([{ input: Buffer.from(svg), top:0, left:0 }]).png().toFile(out)
}

// API principal. def = { slug, titulo, login (bool), pasos: [...] }
// Cada paso = { goto?, accion?(page), resaltar?(page)->locator, titulo, msg, forma, scrollTo? }
export async function generarGuia(def) {
  const outDir = join(__dir, 'output', def.slug)
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()

  if (def.login) {
    const { email, pass } = leerCreds()
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    await page.fill('input#email', email)
    await page.fill('input#password', pass)
    await page.getByRole('button', { name: /Iniciar sesi/i }).click()
    await page.waitForTimeout(7000)
  }

  console.log(`\n=== Guia: ${def.slug} ===`)
  let i = 0
  for (const paso of def.pasos) {
    i++
    if (paso.goto) { await page.goto(`${BASE}${paso.goto}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(paso.wait ?? 3500) }
    if (paso.accion) { await paso.accion(page); await page.waitForTimeout(paso.wait ?? 1500) }
    if (paso.scrollTo != null) { await page.evaluate((y)=>window.scrollTo(0,y), paso.scrollTo); await page.waitForTimeout(500) }
    let box = null
    if (paso.resaltar) { try { box = await paso.resaltar(page).boundingBox() } catch {} }
    const buffer = await page.screenshot()
    const out = join(outDir, `paso-${i}.png`)
    await anotar(buffer, out, { titulo: paso.titulo, msg: paso.msg, box, forma: paso.forma })
    console.log(`  paso ${i}: ${out}${box?'':' (sin resaltado)'}`)
  }
  await browser.close()
  console.log(`Listo: ${i} pasos en ${outDir}`)
}
