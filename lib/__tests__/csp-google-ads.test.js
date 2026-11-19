// Google Ads (19 nov 2026): app/layout.js carga gtag y el registro manda la
// conversión, pero la CSP de next.config.mjs no incluía a Google desde el 30 jun:
// el navegador bloqueaba el script y no llegaba ninguna conversión.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const config = readFileSync('next.config.mjs', 'utf8')
const csp = (config.match(/'Content-Security-Policy', value: "([^"]+)"/) || [])[1] || ''
const directiva = (nombre) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(nombre + ' ')) || '')

describe('la CSP deja medir Google Ads', () => {
  it('si el layout carga gtag, script-src lo permite', () => {
    const layout = readFileSync('app/layout.js', 'utf8')
    if (/googletagmanager\.com\/gtag/.test(layout)) {
      expect(directiva('script-src')).toMatch(/https:\/\/www\.googletagmanager\.com/)
    }
  })
  it('y puede mandar el dato (connect-src)', () => {
    const c = directiva('connect-src')
    for (const d of ['https://www.google.com', 'https://www.googleadservices.com', 'https://*.doubleclick.net']) expect(c).toContain(d)
  })
})
