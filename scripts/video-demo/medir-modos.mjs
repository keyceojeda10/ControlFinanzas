// Qué cuota y qué total da CADA modo con el MISMO préstamo, incluidos los
// avanzados. De aquí salen las cifras del vídeo de los modos de interés.
import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'
import { IDS } from './montar-demo.mjs'

const t = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'd@ejemplo.com', name: 'S', rol: 'owner',
    organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
})

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 540, height: 960 }, serviceWorkers: 'block' })
await ctx.addCookies([{ name: 'next-auth.session-token', value: t, domain: 'localhost', path: '/' }])
const p = await ctx.newPage()

const toca = async (x) => {
  await p.locator(`button:has-text("${x}"), [role="button"]:has-text("${x}")`)
    .first().click({ timeout: 9000 }).catch(() => {})
  await p.waitForTimeout(1500)
}
const pie = async () => {
  const s = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  const i = s.lastIndexOf('CUOTA')
  return s.slice(i, i + 70)
}

await p.goto('http://localhost:3016/prestamos/nuevo', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4000)
await toca('Fabián Quintero')
await toca('Continuar')
const m = p.locator('input[inputmode="decimal"], input[type="text"]').first()
await m.click()
await m.type('400000', { delay: 25 })
await p.waitForTimeout(1800)

await toca('Ver modos avanzados')
await p.waitForTimeout(2200)

const texto = await p.evaluate(() => {
  const s = document.body.innerText.replace(/\s+/g, ' ')
  const i = s.indexOf('MODO DE INTERÉS')
  return s.slice(i, i + 2600)
})
console.log('TODOS LOS MODOS:\n', texto)

console.log('\n── LA CUENTA, MODO A MODO ──')
for (const modo of [
  'Cuota fija', 'Interés de una sola vez', 'Solo interés, capital al final',
  'Interés sobre lo que falta', 'Yo decido',
]) {
  await toca(modo)
  console.log(`${modo.padEnd(34)} → ${await pie()}`)
}

await nav.close()
