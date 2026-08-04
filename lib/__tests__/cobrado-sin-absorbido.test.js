import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// «Cobró hoy» ENSEÑABA PLATA QUE NADIE ENTREGÓ.
//
// Lo puse yo para que el cobrador viera el total que reporta por teléfono, y
// use `cobradoDia`, que lleva dentro el saldo absorbido de las renovaciones
// (`ajusteBruto`). Resultado, medido contra produccion:
//
//   JHOAN #5: cobro $428.000 -> la pantalla decia $817.785 ($389.785 de mas)
//   DIEGO #8: cobro $824.000 -> la pantalla decia $878.167  ($54.167 de mas)
//
// El absorbido NO es plata que entro: es deuda vieja que quedo dentro del
// prestamo nuevo. Tiene su sitio en «Lo que presto hoy», no en lo cobrado.
const api = readFileSync(resolve(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')

describe('«Cobró hoy» solo cuenta plata que entró', () => {
  it('usa la cifra NETA, sin el ajuste bruto', () => {
    expect(api).toMatch(/total: cobradoEfectivoNeto \+ cobradoDigital/)
    expect(api).toMatch(/efectivo: cobradoEfectivoNeto/)
    expect(api).toMatch(/digital: cobradoDigital/)
  })

  it('NO usa `cobradoDia` ni `cobradoEfectivo` crudos', () => {
    // Las dos llevan el absorbido dentro. Es el fallo exacto que se corrige.
    const bloque = /const cobradoTotalHoy = \{[^}]*\}/s.exec(api)
    expect(bloque, 'no se encontró el bloque').toBeTruthy()
    expect(bloque[0], '`cobradoDia` incluye el absorbido').not.toMatch(/total: cobradoDia/)
    expect(bloque[0], '`cobradoEfectivo` incluye el absorbido').not.toMatch(/efectivo: cobradoEfectivo,/)
  })

  it('reutiliza la MISMA cifra que la resta de la cuenta del día', () => {
    // La resta usa `cobradoEfectivoNeto`. Si la tarjeta calculara la suya por
    // separado, las dos podrían separarse sin que nada avise — y en la misma
    // pantalla saldrían dos «efectivo de hoy» distintos.
    expect(api).toMatch(/const cobradoEfectivoNeto = cobradoEfectivo - ajusteBruto/)
    expect(api).toMatch(/rotulo: 'Cobró en efectivo', monto: cobradoEfectivoNeto/)
  })

  it('la aritmética del caso real cuadra', () => {
    // JHOAN: efectivo 270.000, digital 158.000, absorbido 389.785
    const efe = 270000, dig = 158000, abs = 389785
    const cobradoDia = efe + dig + abs
    const cobradoEfectivo = cobradoDia - dig
    const neto = cobradoEfectivo - abs
    expect(neto).toBe(efe)                 // el efectivo real
    expect(neto + dig).toBe(428000)        // lo que el cobrador reporto
    expect(cobradoDia).toBe(817785)        // lo que ensenaba antes
  })
})
