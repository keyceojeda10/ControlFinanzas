// Nuevo préstamo (19 nov 2026): mientras la lista de clientes carga, o si no
// llega (sin señal, error del servidor), NO es «no tienes clientes». Decirlo
// empuja a «Crear mi primer cliente» o a «Crear este cliente»: un duplicado.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const src = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

describe('la lista de clientes que no llegó', () => {
  it('un error del servidor no cuenta como lista vacía', () => {
    expect(src).toMatch(/if \(r\.ok && Array\.isArray\(d\)\) \{ lista = d; respondio = true \}/)
    expect(src).toMatch(/setEstadoClientes\(respondio \|\| lista\.length > 0 \? 'listo' : 'fallo'\)/)
  })
  it('«Todavía no tienes clientes» solo con la lista ya traída', () => {
    const i = src.indexOf('Todavía no tienes clientes. Un préstamo')
    const antes = src.slice(Math.max(0, i - 400), i)
    expect(antes).toMatch(/recientes\.length === 0 && estadoClientes === 'listo' && \(/)
  })
  it('al buscar, «Nadie con…» y «Crear este cliente» solo con la lista ya traída', () => {
    const i = src.indexOf('Nadie con «{buscadorCliente.trim()}» en tu cartera.')
    const antes = src.slice(Math.max(0, i - 2000), i)
    expect(antes).toMatch(/clientesFiltrados\.length === 0 && estadoClientes !== 'listo' \?/)
    expect(antes).toMatch(/: clientesFiltrados\.length === 0 \? \(/)
  })
  it('hay cómo reintentar', () => {
    expect(src).toMatch(/\}, \[clienteIdParam, reintentoClientes\]\)/)
    expect(src.match(/setReintentoClientes\(\(n\) => n \+ 1\)/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
