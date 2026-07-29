import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// El layout es el único sitio donde el armazón se monta. Si alguien vuelve a
// añadir el Header viejo "por si acaso", el resultado son DOS cabeceras: la de
// 60px del sistema anterior y la de 56px del nuevo. Y no se ve como un error de
// código — se ve como una app con una barra de más.
//
// Este test no reemplaza mirar la pantalla. Fija lo que se puede romper sin que
// nadie lo note al pasar por encima.
const layout = fs.readFileSync(
  path.join(process.cwd(), 'app/(dashboard)/layout.jsx'), 'utf8')

describe('layout del dashboard · el armazón 2026', () => {
  it('monta el Armazon nuevo', () => {
    expect(layout).toContain("@/components/armazon/Armazon")
    expect(layout).toContain('<Armazon>')
  })

  it('usa la barra lateral nueva, que nunca se oculta', () => {
    expect(layout).toContain("@/components/armazon/BarraLateral")
    expect(layout).toContain('<BarraLateral />')
  })

  it('ya no monta la cabecera ni la barra inferior del sistema anterior', () => {
    expect(layout).not.toContain("@/components/layout/Header")
    expect(layout).not.toContain("@/components/layout/MobileNavGroup")
    expect(layout).not.toContain("@/components/layout/Sidebar")
  })

  it('no reserva padding inferior para la pastilla', () => {
    // El contenido pasa POR DEBAJO de la pastilla a propósito (02-ARMAZON §B).
    // Un pb-24 en el main deja una franja muerta bajo la última tarjeta.
    expect(layout).not.toMatch(/pb-24/)
  })
})
