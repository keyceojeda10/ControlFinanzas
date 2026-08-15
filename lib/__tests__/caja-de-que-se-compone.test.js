// lib/__tests__/caja-de-que-se-compone.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Hice tres renovaciones pero de esas tres una no iba […] la de 600 que me
//  quedó mal yo la corregí allá en el cliente, sí se corrigió bien, pero acá en
//  caja quedó sumando 5.600, debería sumar solamente 5.»
//   — el dueño de PRESTA MIL, 14 ago 2026.
//
// Reconstruido contra su base: la caja tenía razón al peso. Los $5.600.000 eran
// OMAR $3.000.000 + TATIANA SERPA $600.000 + FOR. RANGER $2.000.000. Lo que no
// tenía era forma de comprobarlo, así que la única salida fue escribir.
//
// Lo que estas pruebas cuidan son las dos formas de que esto vuelva a pasar:
//
//   1. Que la cifra y la lista que la explica se calculen por SEPARADO. Ese es
//      el camino conocido a que enseñen cosas distintas — ya pasó con las tres
//      funciones de la ruta y con las dos del desembolsado.
//   2. Que la fila cobrada de la ruta vuelva a callarse el saldo. Es el otro
//      reporte del mismo día: renovó a Juan Archila y en la ruta no aparecía
//      nada, «uno queda como con la duda, será que se renovó, será que no».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('⚠ la cifra y su desglose salen del mismo sitio', () => {
  const src = leer('lib/dinero/desembolsado.js')

  it('calcularDesembolsadoDia devuelve la SUMA del detalle, no su propia cuenta', () => {
    /* Si alguien vuelve a escribirle un acumulador propio, la lista que el
       dueño abre puede no sumar el número que tiene encima. */
    expect(src).toMatch(/detalleDesembolsadoDia\(organizationId, inicio, fin, cobradorId\)/)
    const cuerpo = src.slice(
      src.indexOf('export async function calcularDesembolsadoDia'),
      src.indexOf('export async function detalleDesembolsadoDia'),
    )
    expect(cuerpo).toMatch(/return total/)
    expect(cuerpo, 'volvió a contar por su cuenta').not.toMatch(/prisma\./)
  })

  it('las dos ramas devuelven filas y su total, nunca un número suelto', () => {
    const detalle = src.slice(src.indexOf('export async function detalleDesembolsadoDia'))
    // Global y por cobrador: las dos salidas con forma { total, filas }
    const salidas = detalle.match(/return \{ total: sumar\(filas\), filas: ordenar\(filas\) \}/g) ?? []
    expect(salidas.length, 'alguna rama dejó de devolver el detalle').toBe(2)
    expect(detalle).toMatch(/return \{ total: 0, filas: \[\] \}/)
  })

  it('cada fila lleva el nombre del cliente', () => {
    /* Una lista de cifras sin nombre no explica nada: es el mismo número
       repartido en varias líneas. */
    expect(src).toMatch(/cliente: \{ select: \{ nombre: true \} \}/)
    expect(src).toMatch(/cliente: p\.cliente\?\.nombre/)
  })

  it('⚠ ninguna consulta se quedó con el select viejo', () => {
    /* El select corto no trae el nombre, así que la fila saldría vacía. Como no
       da error, solo se ve abriendo la pantalla. */
    const detalle = src.slice(src.indexOf('export async function detalleDesembolsadoDia'))
    expect(detalle, 'quedó un select sin el nombre del cliente')
      .not.toMatch(/select: \{ id: true, montoPrestado: true, renovadoDeId: true \}/)
  })
})

describe('el API de caja manda el desglose', () => {
  const src = leer('app/api/caja/route.js')

  it('la cifra y las filas salen de la misma llamada', () => {
    expect(src).toMatch(/const \{ total: desembolsadoDia, filas: desembolsosDia \}/)
    expect(src).toMatch(/^\s*desembolsosDia,$/m)
  })
})

describe('la pantalla deja abrir «lo que prestaste»', () => {
  const src = leer('app/(dashboard)/caja/page.jsx')

  it('el renglón es un botón y pinta las filas', () => {
    expect(src).toMatch(/setVerPrestados/)
    expect(src).toMatch(/const desembolsosDia = stats\.desembolsosDia \?\? \[\]/)
    expect(src).toMatch(/desembolsosDia\.map/)
  })

  it('⚠ dice cuáles son renovaciones, con el valor de la cartulina', () => {
    /* En una renovación lo entregado y la cartulina no son lo mismo, y esa es
       justo la resta que nadie puede hacer de cabeza mirando un total. */
    expect(src).toMatch(/d\.esRenovacion/)
    expect(src).toMatch(/formatMoney\(d\.montoPrestado\)/)
  })

  it('sin filas no se convierte en un botón que no hace nada', () => {
    expect(src).toMatch(/desembolsosDia\.length > 0/)
  })
})

describe('⚠ la fila ya cobrada dice lo que el cliente sigue debiendo', () => {
  const src = leer('components/cf/ParadaDeCobro.jsx')

  it('pinta `debe` también en el estado cobrado', () => {
    /* «Le renové la cartulina, quedó en un monto de 620 […] no aparece nada.»
       La renovación estaba bien registrada; lo que faltaba era enseñarla. */
    const cobrado = src.slice(src.indexOf('{cobrada ? ('), src.indexOf("contexto?.monto === 'ninguno'"))
    expect(cobrado).toMatch(/montoCobrado/)
    expect(cobrado, 'la fila cobrada volvió a callarse el saldo').toMatch(/\{debe && \(/)
  })

  it('el adaptador sigue mandando `debe` con el saldo del cliente', () => {
    expect(leer('lib/adaptadores/cobros.js')).toMatch(/debe: Number\(c\.saldoTotal \?\? 0\) > 0/)
  })
})
