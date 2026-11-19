import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { tieneCabeceraPropia } from '@/lib/franja'

// La ruta por dentro lleva la franja negra (18 nov 2026): «dentro de la ruta se
// pierde mucho el look». Sin estar en la lista, el armazón pintaba encima la
// cabecera vieja y el teléfono la barra del sistema en claro.

describe('qué pantallas llevan la franja negra', () => {
  it('las secciones y la ruta por dentro', () => {
    expect(tieneCabeceraPropia('/rutas')).toBe(true)
    expect(tieneCabeceraPropia('/rutas/abc123')).toBe(true)
    expect(tieneCabeceraPropia('/rutas/abc123/')).toBe(true)
    expect(tieneCabeceraPropia('/caja')).toBe(true)
  })
  it('las fichas del préstamo y del cliente también (19 nov 2026)', () => {
    expect(tieneCabeceraPropia('/clientes/abc')).toBe(true)
    expect(tieneCabeceraPropia('/prestamos/abc')).toBe(true)
  })
  it('los demás detalles no: nuevo, simulador, moratorio y las subpantallas', () => {
    expect(tieneCabeceraPropia('/rutas/abc/editar')).toBe(false)
    expect(tieneCabeceraPropia('/prestamos/nuevo')).toBe(false)
    expect(tieneCabeceraPropia('/prestamos/simulador')).toBe(false)
    expect(tieneCabeceraPropia('/prestamos/moratorio')).toBe(false)
    expect(tieneCabeceraPropia('/prestamos/abc/tabla')).toBe(false)
    expect(tieneCabeceraPropia('/clientes/nuevo')).toBe(false)
    expect(tieneCabeceraPropia('/clientes/abc/editar')).toBe(false)
    expect(tieneCabeceraPropia('/clientes/abc/historial')).toBe(false)
    expect(tieneCabeceraPropia(null)).toBe(false)
  })
  it('las dos fichas pintan la cabecera también cargando y si falla', () => {
    for (const f of ['app/(dashboard)/prestamos/[id]/page.jsx', 'app/(dashboard)/clientes/[id]/page.jsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src).toMatch(/return <><CabeceraDetalle titulo="(Préstamo|Cliente)"/)
      expect(src).toMatch(/<>\n\s*<CabeceraDetalle titulo="(Préstamo|Cliente)" profe=\{<PastillaProfe \/>\} \/>/)
    }
  })
  it('el armazón y el script de antes del primer pintado usan la misma regla', () => {
    expect(readFileSync('components/armazon/Armazon.jsx', 'utf8')).toMatch(/const cabeceraPropia = tieneCabeceraPropia\(pathname\)/)
    expect(readFileSync('app/layout.js', 'utf8')).toMatch(/new RegExp\(\$\{JSON\.stringify\(DETALLES_CON_CABECERA_PROPIA\)\}\)\.test\(pa\)/)
  })
  it('la ruta pinta la cabecera también cargando y si falla', () => {
    const ruta = readFileSync('app/(dashboard)/rutas/[id]/page.jsx', 'utf8')
    expect(ruta).toMatch(/if \(loading\) return <><CabeceraDetalle/)
    expect(ruta).toMatch(/if \(error \|\| !ruta\) return \(\n\s*<>\n\s*<CabeceraDetalle/)
  })
})
