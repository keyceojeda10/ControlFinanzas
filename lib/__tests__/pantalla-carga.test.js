import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El dueño miró la pantalla de carga y señaló tres cosas:
//   «la de arriba se ve del ancho correcto, pero la de abajo ya se ve de otro
//    ancho y se ve fea» · «repite el logo, con un logo que no es el nuestro, un
//    poco más feo» · «no tiene ninguna animación, algo que sea bonito».
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const cargando = leer('components/pantallas/Cargando.jsx')
const css = leer('app/globals.css')

describe('la pantalla de carga', () => {
  it('usa el logo OFICIAL, no un «$» dibujado a mano', () => {
    // El mismo error que ya se corrigió en la cabecera —su comentario lo dice
    // con esas palabras— pero esta pantalla se quedó con la versión vieja.
    expect(cargando).toContain('/logo-icon.svg')
    // El cuadrado dorado con el símbolo dentro, fuera.
    expect(cargando, 'el «$» a mano no es la marca de nadie')
      .not.toMatch(/fontWeight: 700, color: 'var\(--cf-gold-ink\)',\s*\}\}>\$</)
  })

  it('el margen de abajo sigue al de arriba', () => {
    // Iba `padding: '0 20px'` FIJO mientras arriba respeta `sinMargen`: con
    // `sinMargen` —como lo monta el dashboard— el bloque grande llegaba al
    // borde y las tarjetas quedaban 20px metidas. Dos anchos en una pantalla.
    expect(cargando).toMatch(/padding: sinMargen \? '0' : '0 20px'/)
    expect(cargando, 'el relleno de abajo no puede ser fijo')
      .not.toMatch(/overflow: 'hidden', padding: '0 20px'/)
  })

  it('se anima, y las piezas la llevan', () => {
    expect(css).toContain('.cf-brillo')
    expect(css).toContain('@keyframes cfBrillo')
    // Las dos piezas que se repiten en toda la pantalla.
    const bloques = cargando.match(/className="cf-brillo"/g) ?? []
    expect(bloques.length, 'la animación tiene que estar en Hueco y HuecoBloque').toBeGreaterThanOrEqual(2)
  })

  it('respeta a quien pide menos movimiento', () => {
    // Era la mitad buena del argumento viejo para no animar: en un teléfono de
    // gama baja el brillo cuesta cuadros justo cuando el hilo pide datos.
    const i = css.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(i, 'falta la guarda de movimiento reducido').toBeGreaterThan(0)
    expect(css.slice(i, i + 220)).toMatch(/\.cf-brillo\s*\{\s*animation: none;/)
  })

  it('anima solo `background-position`: es lo barato', () => {
    // Compuesto en la GPU, sin recalcular la disposición. Un `box-shadow` o un
    // `filter` recorriendo tarjetas sí costaría cuadros.
    const i = css.indexOf('@keyframes cfBrillo')
    const bloque = css.slice(i, i + 160)
    expect(bloque).toMatch(/background-position/)
    expect(bloque, 'animar tamaño o sombras cuesta cuadros').not.toMatch(/box-shadow|filter:|width:|height:/)
  })
})
