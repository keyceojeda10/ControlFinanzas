// lib/__tests__/pagare-dice-por-que.test.js
//
// «Error al generar el pagare», sin más (captura de un cliente, 3 oct 2026).
// El servidor lo generaba bien; lo que falló fue la conexión. Anclado en el
// código, no en los comentarios.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const sw = leer('public/sw.js')
const firma = leer('components/prestamos/FirmaDigital.jsx')

describe('el pagaré no pasa por la caché de la app', () => {
  it('se salta ANTES de la rama que cachea /api/prestamos', () => {
    const salto = sw.indexOf("if (/^\\/api\\/prestamos\\/[^/]+\\/pagare$/.test(url.pathname)) return")
    const cache = sw.indexOf("if (url.pathname.startsWith('/api/') && CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {")
    expect(salto).toBeGreaterThan(0)
    expect(cache).toBeGreaterThan(salto)
  })
})

describe('la pantalla dice por qué no salió, y deja rastro', () => {
  it('sin conexión, con sesión cerrada o con otro error, cada uno su mensaje', () => {
    expect(firma).toMatch(/alert\('No hay conexión\. El pagaré se arma en el servidor/)
    expect(firma).toMatch(/res\.status === 401\s*\? 'Tu sesión se cerró/)
    expect(firma).toMatch(/`No se pudo generar el pagaré \(error \$\{res\.status\}\)/)
    expect(firma).not.toMatch(/alert\('Error al generar el pagare'\)/)
  })

  it('el fallo se reporta al servidor con origen «pagare»', () => {
    expect(firma).toMatch(/fetch\('\/api\/errores-cliente'/)
    expect(firma).toMatch(/origen: 'pagare'/)
  })
})
