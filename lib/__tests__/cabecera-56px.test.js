import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// La cabecera mide 56px SIEMPRE, en las tres variantes. La de tarea es la que
// se rompe sin avisar: `height:56` la fuerza igual, así que el desbordamiento
// no se ve como desbordamiento — se ve como una cabecera apretada y fea, que es
// mucho más difícil de atribuir a su causa.
//
// La cuenta: 8 (arriba) + 36 (botón) + 9 (hueco) + 3 (espina) = 56.
const fuente = fs.readFileSync(
  path.join(process.cwd(), 'components/armazon/CabeceraMovil.jsx'), 'utf8')

describe('CabeceraMovil · los 56px', () => {
  it('la variante de tarea no suma padding-bottom sobre el hueco de la espina', () => {
    // '8px 20px 12px' + marginTop:9 + espina:3 = 68px de contenido en 56.
    expect(fuente).not.toMatch(/padding: '8px 20px 12px'/)
    expect(fuente).toMatch(/padding: '8px 20px 0'/)
  })

  it('mantiene el hueco de 9px entre el botón y la espina', () => {
    expect(fuente).toMatch(/marginTop: 9/)
  })

  it('reserva el mismo hueco cuando no hay espina', () => {
    expect(fuente).toMatch(/height: 12, flex: 'none'/)
  })

  it('la altura sigue fijada por el token, no por el contenido', () => {
    expect(fuente).toMatch(/height: ALTO, minHeight: ALTO/)
    expect(fuente).toMatch(/const ALTO = 56/)
  })
})
