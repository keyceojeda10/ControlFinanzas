import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ACCEPT_CARTERA, ACCEPT_TABLA, esPdf } from '@/lib/archivos-tabla'
const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('subir el PDF', () => {
  it('el importador acepta PDF además de todo lo de siempre', () => {
    for (const t of ACCEPT_TABLA.split(',')) expect(ACCEPT_CARTERA).toContain(t)
    expect(ACCEPT_CARTERA).toContain('.pdf')
    expect(ACCEPT_CARTERA).toContain('application/pdf')
    expect(esPdf({ type: 'application/pdf', name: 'x' })).toBe(true)
    expect(esPdf({ type: 'application/octet-stream', name: 'Planilla.PDF' })).toBe(true)
    expect(esPdf({ type: 'text/csv', name: 'a.csv' })).toBe(false)
  })
  it('PasoSubir manda el PDF al servidor y no a SheetJS', () => {
    const s = src('components/carga-masiva/PasoSubir.jsx')
    expect(s).toMatch(/accept=\{ACCEPT_CARTERA\}/)
    expect(s).toMatch(/if \(esPdf\(file\)\) \{/)
    expect(s).toMatch(/form\.append\('archivo', file\)/)
    expect(s).toMatch(/fetch\('\/api\/carga-masiva\/leer-pdf', \{ method: 'POST', body: form \}\)/)
    expect(s).toMatch(/onPlanilla\(data\.planilla\)/)
  })
})

describe('la planilla se salta el mapeo y va a la revisión', () => {
  it('la página valida las filas de la planilla y pasa al paso 3', () => {
    const p = src('app/(dashboard)/carga-masiva/page.jsx')
    expect(p).toMatch(/const handlePlanilla = async \(pl\) => \{/)
    expect(p).toMatch(/<PasoSubir onDatos=\{handleDatosCrudos\} onPlanilla=\{handlePlanilla\} \/>/)
    expect(p).toMatch(/planilla=\{planilla\}/)
  })
  it('la revisión: el recuadro, la casilla de domingos y la ruta de la planilla', () => {
    const r = src('components/carga-masiva/PasoRevisar.jsx')
    expect(r).toMatch(/Leímos tu planilla de Crossbox/)
    expect(r).toMatch(/label="Tu planilla cuenta sin domingos: no cobro los domingos"/)
    expect(r).toMatch(/noCobrarDomingos: mostrarDomingos && noCobrarDomingos,/)
    // I7 (24 sep): al volver desde «Importar», `inicial` manda sobre el valor
    // por defecto de la planilla — ver el comentario de `inicial` en PasoRevisar.
    expect(r).toMatch(/useState\(\(\) => \(inicial \? !!inicial\.crearRuta : \(!!planilla\?\.ruta && !rutaDePlanilla\)\)\)/)
  })
  it('confirmar manda la casilla', () => {
    expect(src('components/carga-masiva/PasoConfirmar.jsx')).toMatch(/body: JSON\.stringify\(\{ filas, rutaId, crearRuta, noCobrarDomingos \}\)/)
  })
})
