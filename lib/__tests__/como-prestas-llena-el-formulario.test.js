// «Cómo prestas por defecto» (Configuración) llena Nuevo préstamo (19 nov 2026).
// Antes solo llegaba el «mes completo». Quién manda: URL > lo que se toca >
// «usar siempre» del teléfono > el negocio > lo de siempre.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const src = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')
const efecto = src.slice(src.indexOf('const defaultsNegocio = useRef'), src.indexOf("}, [])", src.indexOf('const defaultsNegocio = useRef')))

describe('lo del negocio llega al formulario', () => {
  it('lee los tres campos y el mes completo', () => {
    for (const c of ['org.frecuenciaDefault', 'org.tasaDefault', 'org.modoInteresDefault', 'org.interesMesCompletoDefault']) expect(efecto).toContain(c)
  })
  it('la URL manda en cada campo', () => {
    for (const k of ["enUrl('frecuencia')", "enUrl('tasa')", "enUrl('modo')", "enUrl('plazo')"]) expect(efecto).toContain(`!${k}`)
  })
  it('solo llena lo que nadie tocó (el valor de arranque)', () => {
    expect(efecto).toMatch(/a\.frecuencia === 'diario'/)
    expect(efecto).toMatch(/a\.tasa === '20'/)
    expect(efecto).toMatch(/a\.modo === 'fijo'/)
    expect(efecto).toMatch(/a\.plazo === '30'/)
  })
  it('el «usar siempre» de este teléfono gana al del negocio', () => {
    expect(efecto).toMatch(/!leerModoPreferido\(\)/)
  })
  it('sin señal usa lo último traído; corregir y cartulina no se tocan', () => {
    expect(efecto).toMatch(/localStorage\.getItem\('cf-como-prestas'\)/)
    expect(efecto).toMatch(/if \(corrigeParam \|\| searchParams\.get\('fromCartulina'\)\) return/)
  })
  it('el modo del teléfono ya no pisa el de la URL', () => {
    expect(src).toMatch(/if \(pref\) \{ setModoPreferido\(pref\); if \(!searchParams\.get\('modo'\)\) setModoInteres\(pref\) \}/)
  })
})
