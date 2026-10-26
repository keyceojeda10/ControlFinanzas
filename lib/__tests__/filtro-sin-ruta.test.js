/* Héctor (HCANOCOMERCIALIZADORA, 26 oct 2026): «¿en dónde encuentro los créditos
   sin ruta, que no son del cobrador?». El filtro existía solo por la URL del
   aviso del Inicio; ahora está en la hoja de filtros de Clientes y Préstamos. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('filtro «Sin ruta»', () => {
  it('Clientes: opción en el grupo Ruta (solo dueño) y manda sinRuta=1', () => {
    const c = readFileSync('app/(dashboard)/clientes/page.jsx', 'utf8')
    expect(c).toContain("...(esOwner ? [{ valor: SIN_RUTA, nombre: 'Sin ruta' }] : []),")
    expect(c).toMatch(/if \(rutaId === SIN_RUTA\) params\.set\('sinRuta', '1'\)\n\s+else if \(rutaId\) params\.set\('rutaId', rutaId\)/)
  })
  it('Préstamos: opción y parámetro', () => {
    const p = readFileSync('app/(dashboard)/prestamos/page.jsx', 'utf8')
    expect(p).toContain("...(esOwner ? [{ valor: 'sin', nombre: 'Sin ruta' }] : []),")
    expect(p).toMatch(/if \(ruta === 'sin'\) params\.set\('sinRuta', '1'\)\n\s+else if \(ruta\) params\.set\('rutaId', ruta\)/)
  })
  it('la API de préstamos filtra por cliente sin ruta, nunca para el cobrador', () => {
    const a = readFileSync('app/api/prestamos/route.js', 'utf8')
    expect(a).toContain("...(sinRuta && rol !== 'cobrador' && { rutaId: null }),")
  })
})
