import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'

// El modo abreviado se perdio EN SILENCIO en las pantallas del rediseño: cada
// una puso su propio `<input>` en vez de `MoneyInput`, y con el se fue la
// conversion. El interruptor seguia encendido sin hacer nada.
//
// De los 13 candidatos que salieron del grep, solo CUATRO eran de verdad:
// los demas son tasas (%), numeros de cuotas, o componentes que solo viven en
// el catalogo de estilos.
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const ARREGLADOS = {
  'ficha del préstamo (recargo, descuento y liquidación)': 'app/(dashboard)/prestamos/[id]/page.jsx',
  'cuadre de caja': 'components/caja/CuadreDia.jsx',
  'renovación': 'components/prestamos/RenovarPrestamo.jsx',
  'simulador': 'app/(dashboard)/prestamos/simulador/page.jsx',
}

describe('el modo abreviado llega a las pantallas que mueven plata', () => {
  for (const [nombre, ruta] of Object.entries(ARREGLADOS)) {
    it(`${nombre} lo aplica`, () => {
      const src = leer(ruta)
      expect(src, 'no lee `modoAbreviado` de la sesion').toMatch(/modoAbreviado/)
      expect(src, 'no convierte lo tecleado a pesos').toMatch(/montoCrudoConModo/)
      expect(src, 'no pinta el valor convertido').toMatch(/montoParaMostrarConModo/)
    })
  }

  it('el cuadre lo aplica donde se cuenta el efectivo', () => {
    // Es el campo mas delicado: el dinero que una persona entrega a otra.
    const src = leer('components/caja/CuadreDia.jsx')
    expect(src).toMatch(/setMontoRecibido\(montoCrudoConModo\(crudo, modoAbreviado\)\)/)
  })
})

describe('lo que NO se toca, y por qué', () => {
  it('las tasas de interés siguen sin conversión', () => {
    // Con el modo abreviado, un 20% se volveria 20.000%. Estas tres son
    // porcentajes, no dinero.
    for (const ruta of [
      'components/pantallas/config/ComoPrestas.jsx',
      'components/pantallas/config/movil.jsx',
    ]) {
      expect(leer(ruta), `${ruta} es una TASA: no lleva modo abreviado`).not.toMatch(/montoCrudoConModo/)
    }
  })

  it('el simulador NO convierte el interés ni el número de cobros', () => {
    const src = leer('app/(dashboard)/prestamos/simulador/page.jsx')
    // Los dos siguen usando `soloDecimal`, que solo limpia.
    expect(src).toMatch(/onInteres=\{\(v\) => setTasa\(soloDecimal\(v\)\)\}/)
    expect(src).toMatch(/onCobros=\{\(v\) => setPlazoUnidades\(soloDecimal\(v\)\)\}/)
  })
})

describe('la aritmética de la conversión', () => {
  it('en abreviado, «40» son $40.000', () => {
    expect(montoCrudoConModo('40', true)).toBe('40000')
    expect(montoParaMostrarConModo('40000', true, 'CO')).toBe('40')
  })

  it('sin abreviado, «40» son $40', () => {
    expect(montoCrudoConModo('40', false)).toBe('40')
  })

  it('lo que no es múltiplo de mil NO se abrevia al mostrarlo', () => {
    // 40.500 en abreviado se veria «41» y al guardar volveria 41.000: se le
    // cambiaria la plata a espaldas de quien la escribio.
    expect(montoParaMostrarConModo('40500', true, 'CO')).toBe('40.500')
  })

  it('el vacío se queda vacío', () => {
    expect(montoCrudoConModo('', true)).toBe('')
    expect(montoParaMostrarConModo('', true, 'CO')).toBe('')
  })
})
