/* «El renove lo dejé ayer, se me olvidó entrar al sistema»: la fecha existía
 * pero escondida en «Más opciones». Ahora va encima del botón de entregar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('la fecha del renove se ve sin buscarla', () => {
  const r = readFileSync('components/prestamos/RenovarPrestamo.jsx', 'utf8')
  it('va en el pie, en el teléfono y en PC', () => {
    expect(r.match(/<FechaALaVista rotulo="Fecha del renove" valor=\{fechaInicio\} hoy=\{hoyISO\(\)\} onCambiar=\{setFechaInicio\} \/>/g)).toHaveLength(2)
    expect(r).not.toMatch(/label="Fecha de inicio"/)
  })
  it('«Hoy», «Ayer» y «Otra fecha», sin fechas futuras', () => {
    const f = readFileSync('components/cf/FechaALaVista.jsx', 'utf8')
    expect(f).toMatch(/>Hoy<\/button>/)
    expect(f).toMatch(/>Ayer<\/button>/)
    expect(f).toMatch(/max=\{hoy\}/)
  })
})
