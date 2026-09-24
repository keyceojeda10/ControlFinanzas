// lib/__tests__/pdf-texto-destroy.test.js
//
// M12. `paginasDePdf` nunca cerraba el documento que `unpdf` abre: cada PDF
// leído dejaba sus páginas y recursos en memoria. Tiene que destruirse SIEMPRE
// —incluso cuando se corta temprano por exceder `maxPaginas`, o si una página
// revienta al leer su texto—, así que va en un `finally`.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const destroy = vi.fn(async () => {})
const getDocumentProxy = vi.fn()
vi.mock('unpdf', () => ({ getDocumentProxy: (...args) => getDocumentProxy(...args) }))

const { paginasDePdf } = await import('@/lib/importar/pdf-texto')

const paginaDe = (texto) => ({
  getTextContent: vi.fn(async () => ({ items: [{ str: texto, transform: [1, 0, 0, 1, 10, 20] }] })),
})

describe('M12: el documento se destruye siempre', () => {
  it('anclado en el código: `pdf.destroy?.()` corre en un `finally`', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/importar/pdf-texto.js'), 'utf8')
    expect(src).toMatch(/finally \{\s*await pdf\.destroy\?\.\(\)\s*\}/)
  })

  it('lectura normal: destroy se llama una vez, después de leer las páginas', async () => {
    destroy.mockClear()
    const pdf = { numPages: 1, getPage: vi.fn(async () => paginaDe('hola')), destroy }
    getDocumentProxy.mockResolvedValueOnce(pdf)
    const r = await paginasDePdf(Buffer.from('x'))
    expect(r.paginas).toHaveLength(1)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('cortado por exceso de páginas: destroy se llama igual', async () => {
    destroy.mockClear()
    const pdf = { numPages: 5, getPage: vi.fn(), destroy }
    getDocumentProxy.mockResolvedValueOnce(pdf)
    const r = await paginasDePdf(Buffer.from('x'), { maxPaginas: 2 })
    expect(r.error).toBe('demasiadas-paginas')
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('si una página revienta al leer, destroy se llama igual y el error sigue subiendo', async () => {
    destroy.mockClear()
    const pdf = {
      numPages: 1,
      getPage: vi.fn(async () => ({ getTextContent: vi.fn(async () => { throw new Error('página rota') }) })),
      destroy,
    }
    getDocumentProxy.mockResolvedValueOnce(pdf)
    await expect(paginasDePdf(Buffer.from('x'))).rejects.toThrow('página rota')
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
