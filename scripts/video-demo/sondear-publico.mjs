// Sondea una pantalla PÚBLICA (sin sesión): registro, login, recuperar clave.
import { chromium } from 'playwright'

const url = process.env.URL || 'http://localhost:3016/registro'
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 540, height: 960 }, serviceWorkers: 'block' })
const p = await ctx.newPage()
await p.goto(url, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(Number(process.env.ESPERA || 4000))

const info = await p.evaluate(() => {
  const l = (s) => (s || '').replace(/\s+/g, ' ').trim()
  return {
    urlFinal: location.pathname,
    campos: [...document.querySelectorAll('input, select, textarea')].map((i) => ({
      tipo: i.type || i.tagName.toLowerCase(),
      nombre: i.name || i.id || '',
      pista: l(i.placeholder || ''),
      etiqueta: l(i.closest('label')?.innerText || document.querySelector(`label[for="${i.id}"]`)?.innerText || ''),
    })),
    botones: [...document.querySelectorAll('button')].map((b) => l(b.innerText)).filter(Boolean),
    texto: l(document.body.innerText).slice(0, 500),
  }
})
console.log('URL final :', info.urlFinal)
console.log('CAMPOS    :', JSON.stringify(info.campos, null, 1))
console.log('BOTONES   :', JSON.stringify(info.botones))
console.log('TEXTO     :', info.texto)
await p.screenshot({ path: '/tmp/publico.png' })
await nav.close()
