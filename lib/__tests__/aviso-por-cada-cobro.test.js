import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { calcularPrestamo } from '@/lib/calculos'

/* ══ POR QUÉ EXISTE ═══════════════════════════════════════════════════════
 *
 * `solo_interes`, `lineal` y `lineal_dinamico` cobran el porcentaje ENTERO en
 * cada cobro. No es un fallo de cálculo: la pantalla lo dice y la cuenta
 * obedece. Pero en frecuencia diaria un 20% se cobra 30 veces, y eso nadie lo
 * lee en la línea «El % es por cada cobro».
 *
 * En producción: un préstamo de $300.000 pedía siete veces esa plata y lleva
 * desde el 6 de agosto sin un pago; a otro cliente le han cobrado $596.674
 * sobre $200.000.
 *
 * La prueba EJECUTA la regla del aviso sacada del componente, para que fije
 * cuándo salta y no cómo está escrita. */

const FUENTE = readFileSync(join(process.cwd(), 'components/prestamos/ModoInteresSelector.jsx'), 'utf8')

function reglaReal() {
  const i = FUENTE.indexOf('function avisoDelPorcentaje(')
  expect(i, 'ya no existe `avisoDelPorcentaje`').toBeGreaterThan(-1)
  const fin = FUENTE.indexOf('\n}\n', i)
  const cuerpo = FUENTE.slice(i, fin + 2)
  // MODOS y formatMoney no hacen falta: se le pasa la tabla de bases mínima.
  const MODOS = [
    { key: 'fijo', base: 'mes' }, { key: 'unico', base: 'total' },
    { key: 'solo_interes', base: 'periodo' }, { key: 'lineal', base: 'periodo' },
    { key: 'lineal_dinamico', base: 'periodo' }, { key: 'saldo', base: 'mes' },
  ]
  return new Function('MODOS', `${cuerpo}\nreturn avisoDelPorcentaje`)(MODOS)
}

const ejemplo = (modo, frecuencia, diasPlazo, monto = 400000, tasa = 20) =>
  calcularPrestamo({ montoPrestado: monto, tasaInteres: tasa, diasPlazo,
    fechaInicio: new Date('2026-08-22T05:00:00Z'), frecuencia, modoInteres: modo })

describe('el aviso de «% por cada cobro»', () => {
  const saltó = (modo, frecuencia, dias, monto = 400000, tasa = 20) =>
    reglaReal()(modo, ejemplo(modo, frecuencia, dias, monto, tasa), { monto, tasa })

  it('⚠ salta en globo diario, que es donde duele', () => {
    // $400.000 al 20% con 30 cobros diarios: $2.400.000 de interés.
    const a = saltó('solo_interes', 'diario', 30)
    expect(a).toBeTruthy()
    expect(a.cobros).toBe(30)
    expect(a.veces).toBeGreaterThanOrEqual(5)
  })

  it('y en «cuota que va bajando» diario, que es el otro caso real', () => {
    expect(saltó('lineal', 'diario', 30)).toBeTruthy()
  })

  it('⚠ NO salta en globo mensual, que es un uso legítimo', () => {
    /* Tres cobros mensuales al 20% son $240.000 sobre $400.000: caro, pero es
       exactamente lo que el prestamista quiso. Un aviso ahí se vuelve ruido y
       deja de leerse — que es peor que no ponerlo. */
    expect(saltó('solo_interes', 'mensual', 90)).toBeNull()
  })

  it('no salta en los modos donde el % NO es por cobro', () => {
    expect(saltó('fijo', 'diario', 30)).toBeNull()
    expect(saltó('unico', 'diario', 30)).toBeNull()
  })

  it('no salta con un solo cobro', () => {
    // Globo semanal de un cobro, 1,2× — el caso legítimo que hay en producción.
    expect(saltó('solo_interes', 'semanal', 7)).toBeNull()
  })

  it('el corte es «el interés iguala a lo prestado», no un número de cobros', () => {
    const a = saltó('solo_interes', 'diario', 30)
    expect(a.interes).toBeGreaterThanOrEqual(a.prestado)
  })
})
