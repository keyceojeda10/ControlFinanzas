// lib/__tests__/reverso-del-dia.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «El saldo general está malo, está sumando algo que no debe sumar. El valor de
//  lo que debe entregar es totalmente correcto, que son 589 mil pesos.»
//  — el dueño de PRESTA MIL sobre su ruta 8, 21 ago 2026.
//
// La ruta decía $775.000. La diferencia, $186.000, era el reverso del desembolso
// de un préstamo entregado el 24 de JUNIO y borrado esa noche: plata que salió
// hace dos meses y que el reverso devolvía al capital de hoy.
//
// Lo que estas pruebas cuidan:
//
//   1. Que el corte del día siga siendo el de Bogotá (05:00Z), no el de UTC. En
//      local los dos coinciden y el fallo es invisible; producción corre en UTC.
//   2. Que la regla se aplique a los TRES reversos del borrado y no a uno solo.
//      Ya pasó con el comprobante: mismo fallo reportado dos días seguidos por
//      arreglar una vía y dejar la otra.
//   3. Que borrar el préstamo recién tecleado —el 55% de los borrados medidos—
//      siga devolviendo todo. Ese caso NO se toca.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { esDelDiaAbierto, partirPorDia } from '@/lib/dinero/reverso-del-dia'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// El 21 de agosto de 2026 a las 8 de la noche en Bogotá: la hora a la que el
// dueño borró el préstamo y vio subir el capital de la ruta.
const ESA_NOCHE = Date.parse('2026-08-22T01:00:00.000Z')

describe('el caso de la ruta 8, al peso', () => {
  it('el desembolso del 24 de junio NO es del día abierto', () => {
    expect(esDelDiaAbierto('2026-06-24T14:30:00.000Z', 'co', ESA_NOCHE)).toBe(false)
  })

  it('lo desembolsado esa misma tarde sí lo es', () => {
    expect(esDelDiaAbierto('2026-08-21T19:00:00.000Z', 'co', ESA_NOCHE)).toBe(true)
  })

  it('$775.000 − $186.000 = $589.000, que es lo que el cobrador entregó', () => {
    /* No es aritmética de adorno: es la comprobación de que el único movimiento
       sobrante es ese, y no un descuadre repartido entre varios. */
    const capitalQueDecia = 775000
    const reversoDeJunio = 186000
    expect(capitalQueDecia - reversoDeJunio).toBe(589000)
  })
})

describe('⚠ el día se corta en Bogotá, no en UTC', () => {
  /* En local los dos coinciden y este fallo no se ve; producción corre en UTC.
     Ver [[fechas_un_solo_calendario]]. */
  it('las 11 de la noche, que en UTC ya es mañana, sigue siendo del día abierto', () => {
    /* 04:00Z del 22 son las 23:00 del 21 en Bogotá: el cobrador sigue cuadrando
       el mismo día. Con el corte en UTC este movimiento caería en «día cerrado»
       y su reverso dejaría de devolverse. */
    expect(esDelDiaAbierto('2026-08-22T04:00:00.000Z', 'co', ESA_NOCHE)).toBe(true)
  })

  it('y las 11 de la noche de AYER ya no', () => {
    expect(esDelDiaAbierto('2026-08-21T04:00:00.000Z', 'co', ESA_NOCHE)).toBe(false)
  })

  it('las 00:30 de hoy en Bogotá (05:30Z) sí lo es', () => {
    const madrugada = Date.parse('2026-08-22T06:00:00.000Z')
    expect(esDelDiaAbierto('2026-08-22T05:30:00.000Z', 'co', madrugada)).toBe(true)
  })

  it('el primer instante del día entra (los pagos se guardan a T05:00Z)', () => {
    /* El convenio de guardado escribe `fechaPago` como T05:00Z, que es
       exactamente el borde: si el rango lo dejara fuera, TODO pago del día
       quedaría sin reversar. */
    expect(esDelDiaAbierto('2026-08-21T05:00:00.000Z', 'co', ESA_NOCHE)).toBe(true)
  })

  it('sin fecha no se inventa un día', () => {
    expect(esDelDiaAbierto(null, 'co', ESA_NOCHE)).toBe(false)
  })
})

describe('partirPorDia separa para poder DECIRLO', () => {
  it('deja los de días cerrados aparte, no los tira', () => {
    const { deHoy, deAntes } = partirPorDia([
      { createdAt: '2026-08-21T19:00:00.000Z', monto: 50000 },
      { createdAt: '2026-06-24T14:30:00.000Z', monto: 186000 },
      { fechaPago: '2026-08-21T05:00:00.000Z', monto: 20000 },
    ], 'co', ESA_NOCHE)

    expect(deHoy.map((m) => m.monto)).toEqual([50000, 20000])
    expect(deAntes.map((m) => m.monto)).toEqual([186000])
  })
})

describe('⚠ la regla se aplica a los TRES reversos del borrado', () => {
  const src = leer('app/api/prestamos/[id]/route.js')
  const del = src.slice(src.indexOf('export async function DELETE'))

  it('el desembolso solo se devuelve si salió hoy', () => {
    expect(del).toMatch(/const salioHoy = esDelDiaAbierto\(/)
    expect(del).toMatch(/salioHoy \? Math\.max\(0, Math\.round\(salio - yaDevuelto\)\) : 0/)
  })

  it('los pagos que se quitan son los de hoy', () => {
    const bloque = del.slice(del.indexOf('const pagosReales'), del.indexOf('const descuentos'))
    expect(bloque).toMatch(/esDelDiaAbierto\(pg\.createdAt \?\? pg\.fechaPago, pais\)/)
  })

  it('los descuentos también', () => {
    const bloque = del.slice(del.indexOf('const descuentos'))
    expect(bloque.slice(0, 400)).toMatch(/esDelDiaAbierto\(pg\.createdAt \?\? pg\.fechaPago, pais\)/)
  })

  it('el país sale de la sesión, no de una organización que no se pidió', () => {
    /* `obtenerPrestamo` no incluye `organization`: leerlo de ahí daría
       `undefined` y dejaría el corte en Colombia para todo el mundo, en
       silencio. Ver [[feedback_verificar_prisma_select]]. */
    expect(del).toMatch(/const pais = session\.user\.country \|\| 'co'/)
  })

  it('y se le dice al prestamista por qué su capital no subió', () => {
    expect(del).toMatch(/noSeDevolvio/)
    expect(del).toMatch(/capitalNoDevuelto/)
  })
})

describe('⚠ y a las DOS vías de quitar el préstamo, no solo a borrar', () => {
  /* Arreglar una y dejar la otra es el error que ya costó dos días con el
     comprobante. Anular devolvía al capital de hoy un desembolso de hace
     semanas exactamente igual que borrar. */
  const src = leer('app/api/prestamos/[id]/route.js')
  const cancelar = src.slice(src.indexOf('export async function PATCH'), src.indexOf('export async function DELETE'))

  it('anular tampoco devuelve lo que salió un día cerrado', () => {
    expect(cancelar).toMatch(/const salioHoy = esDelDiaAbierto\(/)
    expect(cancelar).toMatch(/montoReversion = salioHoy \? devolveria : 0/)
  })

  it('y lo dice, en vez de dejar al prestamista buscando su plata', () => {
    expect(cancelar).toMatch(/capitalNoDevuelto/)
  })
})

describe('⚠ la pantalla no promete lo que el API ya no hace', () => {
  /* «Vuelven a caja $X» y «la caja queda como si el préstamo nunca hubiera
     existido» eran ciertas cuando el reverso devolvía todo. Dejarlas puestas
     sería la misma mentira que infló la ruta 8, ahora en la pantalla. */
  const src = leer('app/(dashboard)/prestamos/[id]/page.jsx')

  it('la ficha sabe si el préstamo salió otro día', () => {
    expect(src).toMatch(/const salioOtroDia = !!entregadoEl && !esDelDiaAbierto\(entregadoEl, country\)/)
  })

  it('«Vuelven a caja» solo se enseña cuando de verdad vuelven', () => {
    expect(src).toMatch(/\{hayCobrosRegistrados && !salioOtroDia && \(/)
  })

  it('y se avisa en los dos modales, no en uno', () => {
    expect((src.match(/\{salioOtroDia && \(/g) || []).length).toBe(2)
  })
})
