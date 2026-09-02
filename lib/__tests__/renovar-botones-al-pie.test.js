/* «Cambiar el modo de cobro» y «Renovar el préstamo» tenían los botones al
   final del cuerpo desplazable; los demás modales de gestión los llevan fijos
   abajo. El dueño (2 sep 2026): «los botones estáticos abajo son lo bueno». */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const RP = readFileSync('components/prestamos/RenovarPrestamo.jsx', 'utf8')
const R  = readFileSync('components/pantallas/Renovar.jsx', 'utf8')

describe('renovar y cambiar de modo llevan los botones en el pie fijo', () => {
  it('el modal recibe `footer` con Cancelar y el botón principal', () => {
    const i = RP.indexOf('<Modal')
    const props = RP.slice(i, RP.indexOf('<div className="space-y-4">', i))
    expect(props).toMatch(/footer=\{/)
    expect(props).toMatch(/>Cancelar<\/Button>/)
    expect(props).toMatch(/loading=\{loading\}/)
  })

  it('el formulario ya no pinta su propio botón dentro del cuerpo', () => {
    expect(RP).toMatch(/\n\s+sinBoton\n/)
    expect(R).toMatch(/\{!sinBoton && \(/)
    const tras = RP.slice(RP.indexOf('</Renovar>'))
    expect(tras, 'volvió el «Cancelar» dentro del cuerpo desplazable').not.toMatch(/>Cancelar<\/button>/)
  })

  it('el botón sigue repitiendo la cifra que se entrega', () => {
    expect(RP).toMatch(/`Renovar y entregar \$\{formatMoney\(enMano\)\}`/)
  })
})
