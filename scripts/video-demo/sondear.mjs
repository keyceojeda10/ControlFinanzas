import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'
import { IDS } from './montar-demo.mjs'

const t = await encode({
  token: {
    sub: IDS.cobrador, id: IDS.cobrador, email: 'd@e.invalid', name: 'Andrés Vargas',
    rol: 'cobrador', organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [IDS.ruta],
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

const info = await p.evaluate(() => {
  const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim()
  return {
    botones: [...document.querySelectorAll('button')].map((b) => limpiar(b.innerText)).filter(Boolean).slice(0, 20),
    roleButton: [...document.querySelectorAll('[role="button"]')].map((b) => limpiar(b.innerText).slice(0, 45)).filter(Boolean).slice(0, 10),
    enlaces: [...document.querySelectorAll('a')].map((a) => limpiar(a.innerText)).filter(Boolean).slice(0, 12),
    texto: limpiar(document.body.innerText).slice(0, 420),
  }
})

console.log('URL:', url)
console.log('BOTONES   :', JSON.stringify(info.botones))
console.log('ROLE=BUTTON:', JSON.stringify(info.roleButton))
console.log('ENLACES   :', JSON.stringify(info.enlaces))
console.log('TEXTO     :', info.texto)
await nav.close()
