import { describe, it, expect, vi } from 'vitest'
import { limpiarAlTerminar } from '@/lib/fetch-timeout'

// El bug: `promesa.finally(cb)` devuelve una promesa NUEVA que hereda el
// rechazo. Nadie la escuchaba, así que cada fetch abortado producía un
// "unhandled rejection" — el overlay rojo de Next gritando AbortError aunque la
// pantalla que hizo el fetch lo hubiera capturado bien.
//
// Este test vigila justo eso: que limpiar el temporizador no deje una rama
// suelta.
describe('limpiarAlTerminar', () => {
  it('limpia cuando la promesa se cumple', async () => {
    const limpiar = vi.fn()
    await limpiarAlTerminar(Promise.resolve('ok'), limpiar)
    await Promise.resolve()
    expect(limpiar).toHaveBeenCalledTimes(1)
  })

  it('limpia también cuando la promesa se rechaza', async () => {
    const limpiar = vi.fn()
    const p = limpiarAlTerminar(Promise.reject(new Error('abort')), limpiar)
    await expect(p).rejects.toThrow('abort')
    await Promise.resolve()
    expect(limpiar).toHaveBeenCalledTimes(1)
  })

  it('devuelve la MISMA promesa, no una derivada', () => {
    // Si devolviera una derivada, el llamador capturaría un rechazo distinto
    // del que produjo el fetch y perdería el AbortError original.
    const p = Promise.resolve(1)
    expect(limpiarAlTerminar(p, () => {})).toBe(p)
    return p
  })

  it('no deja rechazos sin manejar', async () => {
    const sueltos = []
    const anotar = (e) => sueltos.push(e)
    process.on('unhandledRejection', anotar)

    const p = limpiarAlTerminar(Promise.reject(new Error('abort')), () => {})
    p.catch(() => {})                       // el llamador SÍ lo maneja
    await new Promise((r) => setTimeout(r, 30))

    process.off('unhandledRejection', anotar)
    expect(sueltos).toEqual([])
  })
})
