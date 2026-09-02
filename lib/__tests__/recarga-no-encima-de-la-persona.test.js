/* La recarga que borraba el login a medio escribir (2 sep 2026).
   `sw.js` hace skipWaiting + claim, así que cada versión nueva dispara
   `controllerchange`, y aquí se contestaba con `window.location.reload()` en
   el acto. Con un despliegue al día era una recarga en cada entrada. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('components/providers/OfflineProvider.jsx', 'utf8')

describe('el service worker nuevo no recarga encima de la persona', () => {
  it('`controllerchange` programa la recarga, no la ejecuta', () => {
    const i = SRC.indexOf('const alCambiar = () => {')
    expect(i).toBeGreaterThan(0)
    const bloque = SRC.slice(i, SRC.indexOf("addEventListener('controllerchange', alCambiar)", i))
    expect(bloque, 'volvió la recarga inmediata al cambiar de controlador').not.toMatch(/window\.location\.reload\(\)/)
    expect(bloque).toMatch(/programarRecarga\(\)/)
  })

  it('la primera instalación no recarga: la página vino fresca de la red', () => {
    expect(SRC).toMatch(/let teniaControlador = !!navigator\.serviceWorker\.controller/)
    expect(SRC).toMatch(/if \(primeraInstalacion\) return/)
  })

  it('se recarga cuando la pestaña pasa a segundo plano, nunca delante', () => {
    const i = SRC.indexOf('const programarRecarga = useCallback(')
    expect(i).toBeGreaterThan(0)
    const bloque = SRC.slice(i, SRC.indexOf('}, [])', i))
    expect(bloque).toMatch(/visibilityState === 'hidden'/)
    expect(bloque).toMatch(/addEventListener\('visibilitychange'/)
  })

  it('`SW_UPDATED` pasa por el mismo sitio', () => {
    const i = SRC.indexOf("e.data?.type === 'SW_UPDATED'")
    expect(i).toBeGreaterThan(0)
    const bloque = SRC.slice(i, SRC.indexOf('}', SRC.indexOf('programarRecarga()', i)))
    expect(bloque).toMatch(/programarRecarga\(\)/)
    expect(bloque).not.toMatch(/window\.location\.reload\(\)/)
  })
})
