import { describe, it, expect } from 'vitest'
import { cuentaDelDia } from '@/lib/dinero/conciliacion'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── LA RESTA QUE SE VE NO DABA EL RESULTADO QUE SE MARCA ────────────────────
//
// El bloque «ENTRA» sumaba el cobro por transferencia —el dueño lo pidió como
// renglón— pero nada lo sacaba. Así que la cuenta que él sigue con el dedo daba
// $179.000 de más que la cifra de abajo:
//
//   lo que él suma:  346.000 + 154.000 + 179.000 − 506.452 − 12.000 = 160.548
//   lo que vale:     346.000 + 154.000           − 506.452 − 12.000 = −18.452
//
// Las dos cifras estaban BIEN calculadas y las dos salían en pantalla. Pero
// ninguna era la resta visible, y por eso desconfiaba de toda la pantalla.
//
// Sus palabras: «está molestando cuando los muchachos ponen una transferencia
// que le dan a la aplicación... si no, sería por unos días ponerla solamente
// por efectivo mientras usted puede cuadrar bien».
//
// Y por qué esa plata no es suya: «cuando el cliente transfiere, ellos colocan
// por transferencia; cuando llegan a entregar en la noche saben que ese dinero
// llegó a la cuenta de la oficina y el resto lo traen en efectivo».
//
// Cifras reales de la ruta #5 de PRESTA MIL, 4 ago 2026.

const RUTA5 = {
  apertura: 346000,
  cobradoEfectivo: 154000,
  cobradoDigital: 179000,
  prestadoEfectivo: 506452,
  gastos: 12000,
}

const cuenta = (d = RUTA5) => cuentaDelDia({
  apertura: d.apertura,
  entradas: [
    { id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: d.cobradoEfectivo },
    { id: 'recaudoDigital', rotulo: 'Cobró por transferencia', monto: d.cobradoDigital },
  ],
  salidas: [
    { id: 'desembolsos', rotulo: 'Prestó en efectivo', monto: d.prestadoEfectivo },
    { id: 'gastos', rotulo: 'Gastó', monto: d.gastos },
    { id: 'aLaCuenta', rotulo: 'Entró a la cuenta de la oficina', monto: d.cobradoDigital },
  ],
})

describe('la cuenta del día con transferencias', () => {
  it('el subtotal de arriba menos el de abajo da lo que hay que entregar', () => {
    // ESTO es lo que el usuario hace con el dedo. Si no cuadra, la pantalla
    // miente aunque cada cifra suelta esté bien.
    const c = cuenta()
    expect(c.entro - c.salio, 'la resta visible no da el resultado').toBe(c.suma)
  })

  it('da los −$18.452 de la ruta #5, no los $160.548', () => {
    const c = cuenta()
    expect(c.suma).toBe(-18452)
    expect(c.entro).toBe(679000)   // 346.000 + 154.000 + 179.000
    expect(c.salio).toBe(697452)   // 506.452 + 12.000 + 179.000
  })

  it('la transferencia aparece a los DOS lados', () => {
    const c = cuenta()
    const entra = c.lineas.find((l) => l.id === 'recaudoDigital')
    const sale = c.lineas.find((l) => l.id === 'aLaCuenta')
    expect(entra, 'no está el cobro por transferencia').toBeTruthy()
    expect(sale, 'falta el contrapeso: la resta daría $179.000 de más').toBeTruthy()
    expect(entra.monto).toBe(sale.monto)
    expect(entra.signo).toBe(1)
    expect(sale.signo).toBe(-1)
  })

  it('sin transferencias la cuenta no cambia', () => {
    // La mayoría de rutas son 100% efectivo: ahí no debe aparecer ningún
    // renglón nuevo ni moverse una cifra.
    const c = cuenta({ ...RUTA5, cobradoDigital: 0 })
    expect(c.lineas.some((l) => l.id === 'aLaCuenta'), 'sale un renglón en cero').toBe(false)
    expect(c.lineas.some((l) => l.id === 'recaudoDigital')).toBe(false)
    expect(c.suma).toBe(346000 + 154000 - 506452 - 12000)
    expect(c.entro - c.salio).toBe(c.suma)
  })

  it('cuando todo se cobra por transferencia, no entrega nada de lo cobrado', () => {
    // Caso límite: el cobrador sale con $100.000, cobra $500.000 TODO por Nequi
    // y no presta. Entrega los $100.000 con los que salió, ni un peso más.
    const c = cuenta({ apertura: 100000, cobradoEfectivo: 0, cobradoDigital: 500000, prestadoEfectivo: 0, gastos: 0 })
    expect(c.suma).toBe(100000)
    expect(c.entro - c.salio).toBe(c.suma)
  })
})

describe('la pantalla no rearma los subtotales', () => {
  const src = readFileSync(resolve(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')

  it('«Total que entra» viene del API', () => {
    // Se calculaba a mano con el cobro TOTAL mientras «Total que sale» venía del
    // API sin la transferencia: dos bloques hablando de plata distinta.
    expect(src, '`entraTotal` vuelve a calcularse a mano').toContain('const entraTotal = data?.cuentaEntro ??')
  })

  it('el renglón de la cuenta de la oficina está', () => {
    expect(src).toContain('Entró a la cuenta de la oficina')
  })

  it('solo sale si hubo transferencias', () => {
    const i = src.indexOf('Entró a la cuenta de la oficina')
    const antes = src.slice(Math.max(0, i - 200), i)
    expect(antes, 'el renglón saldría en cero en rutas de solo efectivo')
      .toContain('(cr.cobradoDigital ?? 0) > 0')
  })
})

describe('el API manda las dos líneas', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

  it('la transferencia entra y sale con el mismo monto', () => {
    const i = src.indexOf('const { lineas: cuenta, suma: cuentaSuma')
    expect(i, 'ya no se arma así la cuenta: revisa esta prueba').toBeGreaterThan(-1)
    const bloque = src.slice(i, src.indexOf('})', src.indexOf('aLaCuenta', i)))
    expect(bloque).toContain("id: 'recaudoDigital'")
    expect(bloque).toContain("id: 'aLaCuenta'")
    // Las dos con la MISMA variable: si una usa otra cifra, deja de cancelarse.
    expect(bloque.match(/cobradoDigitalNeto/g)?.length, 'entran y salen cifras distintas').toBe(2)
  })
})
