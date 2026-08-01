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
  it('monta el Armazon nuevo y le pasa el nombre desde el servidor', () => {
    expect(layout).toContain("@/components/armazon/Armazon")
    expect(layout).toMatch(/<Armazon[\s>]/)
    // El nombre baja del servidor: derivarlo de useSession() en cliente hacia
    // que el avatar pintara "·" en el HTML y "CA" tras hidratar.
    expect(layout).toContain('nombre={nombre}')
  })

  it('usa la barra lateral nueva, que nunca se oculta', () => {
    expect(layout).toContain("@/components/armazon/BarraLateral")
    expect(layout).toContain('<BarraLateral')
  })

  it('le pasa quién es el usuario, no la monta vacía', () => {
    // ESTA PRUEBA EXIGÍA `<BarraLateral />` LITERAL, o sea la versión sin
    // cablear: nombre, rol e iniciales tienen valor por defecto vacío, así que
    // en escritorio el pie de la barra pintaba un círculo azul sin letras y dos
    // líneas de texto en blanco. La prueba pasaba en verde tapando el fallo.
    //
    // Es el mismo patrón del FAB muerto: el componente correcto, nadie que lo
    // conecte, y una prueba que comprueba la forma del tag en vez del contrato.
    expect(layout).toMatch(/<BarraLateral\s+[^>]*nombre=\{nombre\}/s)
    expect(layout).toMatch(/<BarraLateral\s+[^>]*rol=\{/s)
    expect(layout).toMatch(/<BarraLateral\s+[^>]*iniciales=\{iniciales\(nombre\)\}/s)
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
