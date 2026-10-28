import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { limpiarOrigen, leerOrigenParam, canalDeOrigen } from '@/lib/origen-registro'

// 28 oct 2026: nadie guardaba de dónde venía quien se registra (ni referrer, ni
// UTM, ni gclid). La web lo pasa en `?o=` y se guarda en Organization.origenRegistro.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
// Lo mismo que hace la web (landing/components/OrigenVisita.jsx) para armar `?o=`.
const codificar = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('el canal en una palabra', () => {
  const casos = [
    [{ gclid: 'abc' }, 'google_ads'],
    [{ utm_source: 'google', utm_medium: 'cpc' }, 'google_ads'],
    [{ fbclid: 'x' }, 'facebook_ads'],
    [{ utm_source: 'instagram' }, 'facebook_ads'],
    [{ utm_source: 'boletin' }, 'campana'],
    [{ referrer: 'https://chatgpt.com/' }, 'chatgpt'],
    [{ referrer: 'https://www.perplexity.ai/search?q=x' }, 'perplexity'],
    [{ referrer: 'https://gemini.google.com/app' }, 'gemini'],
    [{ referrer: 'https://www.google.com.co/' }, 'google'],
    [{ referrer: 'https://www.bing.com/' }, 'bing'],
    [{ referrer: 'https://m.youtube.com/watch?v=1' }, 'youtube'],
    [{ referrer: 'https://l.facebook.com/' }, 'facebook'],
    [{ referrer: 'https://control-finanzas.com/blog/' }, 'directo'],
    [{ referrer: 'https://un-blog.com/' }, 'otro_sitio'],
    [{ landing: '/blog/' }, 'directo'],
    [null, 'directo'],
  ]
  for (const [o, canal] of casos) it(`${JSON.stringify(o)} → ${canal}`, () => expect(canalDeOrigen(o)).toBe(canal))
})

describe('lo que viaja y lo que se guarda', () => {
  it('ida y vuelta del `?o=`, con tildes', () => {
    const o = { utm_source: 'google', utm_campaign: 'préstamos', landing: '/cobros-y-rutas/', primeraVisita: '2026-10-28' }
    expect(leerOrigenParam(codificar(o))).toEqual(o)
  })
  it('lo que no se entiende no rompe nada', () => {
    expect(leerOrigenParam('%%%')).toBe(null)
    expect(leerOrigenParam('x'.repeat(4000))).toBe(null)
  })
  it('solo claves conocidas, como texto corto', () => {
    expect(limpiarOrigen({ utm_source: 'g', otra: 'x', gclid: 5, referrer: 'r'.repeat(500) })).toEqual({ utm_source: 'g', referrer: 'r'.repeat(300) })
    expect(limpiarOrigen({ otra: 'x' })).toBe(null)
  })
  it('el formulario lo manda y el servidor lo guarda', () => {
    expect(leer('app/registro/page.jsx')).toContain('origenParam={sp?.o || null}')
    expect(leer('app/registro/RegistroForm.jsx')).toContain('origen: origenDelRegistro(origenParam),')
    const r = leer('app/api/auth/registro/route.js')
    expect(r).toContain('const origenLimpio = limpiarOrigen(body.origen)')
    expect(r).toContain('origenRegistro: JSON.stringify(origen),')
    expect(leer('prisma/schema.prisma')).toMatch(/origenRegistro\s+String\?\s+@db\.Text/)
  })
})
