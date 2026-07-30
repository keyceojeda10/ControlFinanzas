import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { diferenciaDeCuadre, causasDeDescuadre } from '../adaptadores/cuadre.js'

const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`
const cuadre = readFileSync(join(process.cwd(), 'components/caja/CuadreDia.jsx'), 'utf8')

describe('la diferencia del cuadre', () => {
  it('sin diferencia no se enseña nada', () => {
    expect(diferenciaDeCuadre({ sistema: 100000, contado: 100000 }, fmt)).toBeNull()
  })

  it('faltar es rojo y sobrar es ámbar', () => {
    // Las dos hay que explicarlas, pero pintar un sobrante en rojo hace que se
    // registre a la ligera para quitarlo de en medio — y ese cobro sin anotar
    // nunca aparece.
    expect(diferenciaDeCuadre({ sistema: 100000, contado: 95000 }, fmt).tono).toBe('falta')
    expect(diferenciaDeCuadre({ sistema: 100000, contado: 105000 }, fmt).tono).toBe('sobra')
  })

  it('el monto va sin signo: la etiqueta ya dice de qué lado está', () => {
    const d = diferenciaDeCuadre({ sistema: 100000, contado: 95000 }, fmt)
    expect(d.etiqueta).toBe('Falta')
    expect(d.monto).toBe('$5.000')
    expect(d.monto).not.toMatch(/[-−]/)
  })

  it('trae la proporción, que es lo que dice dónde buscar', () => {
    // «4% de lo recaudado» distingue un error de conteo de un billete perdido.
    expect(diferenciaDeCuadre({ sistema: 100000, contado: 96000 }, fmt).proporcion)
      .toBe('4% de lo recaudado')
  })

  it('sin nada esperado no se divide por cero', () => {
    expect(diferenciaDeCuadre({ sistema: 0, contado: 5000 }, fmt).proporcion).toBeNull()
  })
})

describe('las causas cambian de lado', () => {
  it('faltar y sobrar no se explican igual', () => {
    const falta = causasDeDescuadre('falta').map((c) => c.id)
    const sobra = causasDeDescuadre('sobra').map((c) => c.id)
    expect(falta).toContain('gasto')
    expect(sobra).toContain('sin_anotar')
    expect(falta).not.toContain('sin_anotar')
  })

  it('las dos siempre dejan salida', () => {
    for (const tono of ['falta', 'sobra']) {
      expect(causasDeDescuadre(tono).map((c) => c.id)).toContain('otro')
    }
  })
})

describe('el efectivo recibido llega limpio al endpoint', () => {
  it('la entrada se reduce a dígitos', () => {
    // `confirmar` hace `Number(montoRecibido)`. Si alguien teclea «1.200.000»
    // —que es como se escribe aquí— sin limpiar da NaN, y eso viaja como el
    // efectivo que el administrador dice haber recibido.
    expect(cuadre).toContain(String.raw`replace(/\D/g, '')`)
  })

  it('y el guardado sigue mandando un número', () => {
    expect(cuadre).toMatch(/efectivoRecibido: Number\(montoRecibido\)/)
  })
})
