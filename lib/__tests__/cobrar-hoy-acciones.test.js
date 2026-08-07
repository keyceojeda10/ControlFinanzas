import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// Dos fuentes desde la mudanza: la TARJETA vive en el modulo compartido —la
// pintan /cobros-hoy y /rutas/[id] igual— y la PANTALLA (agrupar, la barra de
// «Empezar ruta») sigue en CobrarHoy.jsx. Cada prueba mira la que le toca.
const tarjeta  = leer('components', 'cf', 'ParadaDeCobro.jsx')
const cobrarHoy = leer('components', 'pantallas', 'CobrarHoy.jsx')
const codigo   = sinComentarios(tarjeta)
const codigoPantalla = sinComentarios(cobrarHoy)

// El glifo oficial de WhatsApp empieza por esta curva. Está duplicado a mano en
// varios sitios del proyecto; lo que importa aquí es que sea ESTE y no una
// burbuja dibujada a ojo.
const GLIFO_WA = 'M17.472 14.382'

describe('el botón de WhatsApp de la parada', () => {
  it('usa el logo de verdad, no una burbuja dibujada a mano', () => {
    expect(codigo).toContain(GLIFO_WA)
    // La burbuja inventada: un solo trazo con la colita. Si vuelve, vuelve el
    // icono que no es el de la marca.
    expect(codigo).not.toContain('M20.5 3.5A11.5 11.5 0')
  })

  it('lo pinta RELLENO, que es como está hecho ese dibujo', () => {
    // Con `stroke` salía como un contorno raro y además RECORTADO: el dibujo
    // llega justo al borde de su viewBox, así que el grosor de línea se sale
    // del lienzo y lo de fuera se corta. Reportado en la captura.
    /* Se ancla en el `aria-label`, no en `texto=`: con el carril de E08 la
       tarjeta perdió 46px y los botones pasaron a solo icono —el texto se
       salía y pisaba al de al lado—. Lo que se comprueba aquí es cómo se
       PINTA el dibujo, que no cambió. */
    const boton = codigo.match(/<AccionParada[^>]*aria-label="WhatsApp"[^>]*>/)
    expect(boton, 'no encuentro el botón de WhatsApp').toBeTruthy()
    expect(boton[0]).toMatch(/\brelleno\b/)
  })

  it('el modo relleno de verdad quita el trazo', () => {
    // Si `relleno` solo añadiera `fill` sin apagar `stroke`, el icono seguiría
    // saliendo con contorno y recortado igual.
    const pincel = codigo.match(/const pincel = relleno[\s\S]{0,260}/)[0]
    expect(pincel).toContain("fill: 'currentColor'")
    expect(pincel).toContain("stroke: 'none'")
  })

  it('el mapa y los tres puntos siguen siendo trazo', () => {
    // No llevan `relleno`: son iconos de línea. Si se rellenaran, el pin del
    // mapa saldría como una mancha negra.
    /* Por `aria-label`, no por `texto=`: con el carril de E08 la tarjeta perdió
       46px de ancho y los botones pasaron a solo icono —«WhatsApp» se salía y
       pisaba al de al lado—. Lo que se comprueba aquí es cómo se PINTA el
       dibujo, que no ha cambiado. */
    for (const etiqueta of ['Ver en el mapa']) {
      const b = codigo.match(new RegExp(`<AccionParada[^>]*aria-label="${etiqueta}"[^>]*>`))
      expect(b, `no encuentro el botón «${etiqueta}»`).toBeTruthy()
      expect(b[0], `${etiqueta} no debería ir relleno`).not.toMatch(/\brelleno\b/)
    }
  })
})

describe('la barra de «Empezar ruta»', () => {
  it('no ocupa todo el ancho en escritorio', () => {
    // En un teléfono de 393px ocupar el ancho es correcto —el pulgar tiene que
    // alcanzarla sin mirar—. En un monitor de 1900 eso es un botón de metro y
    // medio, metido además bajo el menú lateral: «sale a todo lo ancho
    // reventando todo el diseño».
    const barra = codigoPantalla.match(/className="fixed left-4[^"]*"/)
    expect(barra, 'no encuentro la barra de acción').toBeTruthy()
    expect(barra[0]).toContain('lg:left-auto')
    expect(barra[0]).toMatch(/lg:w-\[\d+px\]/)
  })

  it('el borde izquierdo NO va en un style en línea', () => {
    // Un `left` inline gana siempre a la clase, así que `lg:left-auto` no
    // haría nada y la barra seguiría estirándose. Se vería idéntico al fallo.
    const bloque = codigoPantalla.match(/className="fixed left-4[\s\S]{0,200}?>/)[0]
    expect(bloque).not.toMatch(/style=\{\{[^}]*\bleft:/)
  })
})
