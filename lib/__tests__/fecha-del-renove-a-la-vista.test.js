/* «El renove lo dejé ayer, se me olvidó entrar al sistema»: la fecha existía
 * pero escondida en «Más opciones». Ahora va encima del botón de entregar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('la fecha del renove se ve sin buscarla', () => {
  const r = readFileSync('components/prestamos/RenovarPrestamo.jsx', 'utf8')
  it('va en el cuerpo, como sección, antes de «Más opciones» y fuera del pie (17 oct 2026)', () => {
    // En el pie quedaba pegada a los botones fijos: «no creo que esa sea la
    // posición correcta». Ahora es una sección más, en teléfono y en PC.
    const usos = r.match(/<FechaALaVista rotulo="Fecha del renove" mostrarRotulo=\{false\} valor=\{fechaInicio\} hoy=\{hoyISO\(\)\} onCambiar=\{setFechaInicio\} \/>/g)
    expect(usos).toHaveLength(1)
    const fecha = r.indexOf('<FechaALaVista rotulo="Fecha del renove"')
    expect(fecha).toBeGreaterThan(r.indexOf('>\n            Frecuencia de cobro'))
    expect(fecha).toBeLessThan(r.indexOf('{/* Mas opciones colapsable */}'))
    const pie = r.slice(r.indexOf('footer={'), r.indexOf('<div className="space-y-4">'))
    expect(pie).not.toMatch(/FechaALaVista/)
    expect(r).not.toMatch(/label="Fecha de inicio"/)
  })
  it('el selector % / $ ya no va pegado al campo: rótulos de 28 px en las dos columnas', () => {
    const p = readFileSync('components/prestamos/InteresEnPesos.jsx', 'utf8')
    expect(p).not.toMatch(/-my-1\.5'/)
    expect(p).toMatch(/className="h-7 mb-1\.5 flex items-center justify-between gap-2"/)
    for (const f of ['components/prestamos/RenovarPrestamo.jsx', 'components/prestamos/EditarPrestamo.jsx', 'components/onboarding/wizard/WizardPrestamo.jsx']) {
      expect(readFileSync(f, 'utf8').match(/<FilaRotulo[ >]/g), f).toHaveLength(2)
    }
  })
  it('«Hoy», «Ayer» y «Otra fecha», sin fechas futuras', () => {
    const f = readFileSync('components/cf/FechaALaVista.jsx', 'utf8')
    expect(f).toMatch(/>Hoy<\/button>/)
    expect(f).toMatch(/>Ayer<\/button>/)
    expect(f).toMatch(/max=\{hoy\}/)
  })
})
