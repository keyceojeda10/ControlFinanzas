import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── LA PANTALLA DE LUCAS EN MÓVIL ───────────────────────────────────────────
//
// Reportado: «la barra donde se escribe sale tapada, se tapa con el borde de la
// pantalla y no se logra ver… no es estática, da mucha vuelta… y el contenido
// sale muy angosto».
//
// Los TRES síntomas eran una sola causa. La pantalla se dimensionaba con
// `100dvh` como si ocupara la ventana, pero vive dentro del `<main>` del layout,
// que le añade `px-5 py-5` y arranca en y=56 con un padre `min-h-screen`.
// Medido a 393×852 antes de tocar nada:
//
//     documento 908px en una ventana de 852   ← 56 de más
//     aviso del pie   y=846 → 860             ← fuera de la pantalla
//     barra           x=36, ancho 321 de 393  ← los 40 del px-5
//
// Y después:
//
//     documento 852 = ventana · scrollTo(0,5000) deja scrollY en 0
//     pie  y=826 → 840   dentro
//     barra x=16, ancho 361
//
// ⚠ DOS INTENTOS FALLIDOS, los dos descartados MIDIENDO y no razonando:
//   1 · márgenes negativos: quitan el relleno pero no los 56px del
//       `min-h-screen`. El documento seguía en 908.
//   2 · `overflow: hidden` a secas: oculta la barra pero `window.scrollTo`
//       seguía moviendo el documento 56px. Hace falta fijar la ALTURA.

const src = readFileSync(
  resolve(process.cwd(), 'app/(dashboard)/asistente/page.jsx'), 'utf8')

describe('el chat se ancla a la ventana en móvil', () => {
  it('`fixed` en móvil y vuelve a fluir en escritorio', () => {
    // En PC el dueño dice que ya se veía bien: allí no se toca nada.
    expect(src).toMatch(/className="fixed inset-x-0 bottom-0 lg:static/)
  })

  it('la altura descuenta la cabecera y el área segura', () => {
    expect(src).toMatch(/height: 'calc\(100dvh - var\(--cf-h-header, 56px\) - env\(safe-area-inset-bottom, 0px\)\)'/)
  })

  it('`100dvh` y no `100vh`: con el teclado abierto el campo se iría debajo', () => {
    /* Sin comentarios: el propio comentario que explica por qué NO se usa
       `100vh` contiene la cadena, y la prueba se cazaba a sí misma. Ya me ha
       pasado tres veces con este mismo patrón. */
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(codigo, 'volvió el 100vh').not.toMatch(/100vh/)
  })
})

describe('el scroll fantasma de 56px', () => {
  it('se apaga con overflow Y altura, no solo overflow', () => {
    /* `overflow: hidden` a secas NO basta: medido, `window.scrollTo(0, 5000)`
       seguía dejando `scrollY = 56`. Oculta la barra pero el documento se
       sigue pudiendo mover —con el dedo también—, que es el «da mucha vuelta».
       Lo que lo fija es la altura. */
    expect(src).toMatch(/html\.style\.overflow = 'hidden'/)
    expect(src).toMatch(/html\.style\.height = '100%'/)
    expect(src).toMatch(/body\.style\.height = '100%'/)
  })

  it('y se deshace al salir de la pantalla', () => {
    // Sin esto, el resto de la app se queda sin scroll. Comprobado navegando
    // a /dashboard después: vuelve a rodar sus 2.826px.
    expect(src).toMatch(/return \(\) => \{/)
    expect(src).toMatch(/html\.style\.overflow = antes\.hOverflow/)
    expect(src).toMatch(/body\.style\.height = antes\.bAlto/)
  })

  it('solo en móvil', () => {
    // En escritorio la pantalla fluye con el resto y el documento ya cuadra.
    expect(src).toMatch(/window\.innerWidth >= 1024\) return/)
  })

  it('⚠ por `useEffect`, no por un `<style>` en el JSX', () => {
    /* Mi primera versión metía un `<style>` con la consulta de medios: lo
       pintaba el servidor, el cliente lo volvía a montar y React se quejaba con
       el error #418 (desajuste de hidratación). Salió en la medición de
       escritorio, no en el build ni en las pruebas. */
    expect(src, 'volvió el <style> que rompía la hidratación')
      .not.toMatch(/<style>\{`/)
  })
})
