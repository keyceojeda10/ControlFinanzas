import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'
import { IDS } from './montar-demo.mjs'

// ROL=owner para las pantallas del dueño (crear cliente, préstamos, capital…).
const ROL = process.env.ROL || 'cobrador'
const esOwner = ROL === 'owner'
const t = await encode({
  token: {
    sub: esOwner ? IDS.owner : IDS.cobrador,
    id: esOwner ? IDS.owner : IDS.cobrador,
    email: 'd@e.invalid', name: esOwner ? 'Sofía Restrepo' : 'Andrés Vargas',
    rol: ROL, organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: esOwner ? [] : [IDS.ruta],
  },
  secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
})

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 540, height: 960 }, serviceWorkers: 'block' })
await ctx.addCookies([{ name: 'next-auth.session-token', value: t, domain: 'localhost', path: '/' }])
const p = await ctx.newPage()

const url = process.env.URL || 'http://localhost:3016/cobros-hoy'
await p.goto(url, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(Number(process.env.ESPERA || 8000))

/* CLIC="Crear manual|Continuar" para llegar a una pantalla que está detrás de
   uno o varios botones. Sin esto solo se puede sondear lo que sale de entrada. */
for (const txt of (process.env.CLIC || '').split('|').filter(Boolean)) {
  await p.locator(`button:has-text("${txt}"), a:has-text("${txt}")`).first().click().catch(() => {})
  await p.waitForTimeout(2500)
}

const info = await p.evaluate(() => {
  const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim()
  return {
    botones: [...document.querySelectorAll('button')].map((b) => limpiar(b.innerText)).filter(Boolean).slice(0, 20),
    roleButton: [...document.querySelectorAll('[role="button"]')].map((b) => limpiar(b.innerText).slice(0, 45)).filter(Boolean).slice(0, 10),
    campos: [...document.querySelectorAll('input, select, textarea')].map((i) => ({
      tipo: i.type || i.tagName.toLowerCase(),
      name: i.name || '', id: i.id || '',
      pista: limpiar(i.placeholder || ''), modo: i.inputMode || '',
    })),
    enlaces: [...document.querySelectorAll('a')].map((a) => limpiar(a.innerText)).filter(Boolean).slice(0, 12),
    texto: limpiar(document.body.innerText).slice(0, 1500),
  }
})

console.log('URL:', url)
console.log('BOTONES   :', JSON.stringify(info.botones))
console.log('ROLE=BUTTON:', JSON.stringify(info.roleButton))
console.log('CAMPOS    :', JSON.stringify(info.campos))
console.log('ENLACES   :', JSON.stringify(info.enlaces))
console.log('TEXTO     :', info.texto)
await nav.close()
