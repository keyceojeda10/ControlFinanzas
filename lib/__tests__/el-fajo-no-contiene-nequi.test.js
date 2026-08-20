// lib/__tests__/el-fajo-no-contiene-nequi.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Mire la caja del administrador, la ruta 9 […] la caja del cobrador sí está
//  sumando bien, pero la caja del administrador, mire, aparecen unos números
//  ahí que no tienen lógica. Debería decir "tienes que entregar" 119, pero
//  aparece 66.» — PRESTA MIL, 20 ago 2026.
//
// ⚠ ERA AL REVÉS, Y ESO ES LO QUE ESTA PRUEBA FIJA.
//
// Reconstruido contra su base a la hora exacta de su captura, la RUTA #9 tenía:
//
//     08:03  OLGA LUCIA          $5.000   transferencia
//     08:12  DANIEL BOTIAS      $34.000   transferencia
//     09:28  CINDY FERNANDA     $40.000   EFECTIVO
//     10:05  OSCAR RAMIRES      $40.000   transferencia
//                               ────────
//     cobrado $119.000  ·  en billetes solo $40.000
//
// Con la apertura de $26.000, el cobrador llevaba encima **$66.000**. Los
// $79.000 restantes entraron por Nequi y nunca pasaron por su bolsillo.
//
// Así que el administrador acertaba y la caja del PROPIO COBRADOR era la que
// mentía: decía «Te queda en la mano $119.000» y le ofrecía entregar $119.000,
// $79.000 de los cuales tendría que haber puesto de su bolsillo.
//
// ⚠ Y EL DATO YA EXISTÍA. `recogidaEfectivo` / `recogidaDigital` se separaron
//   cuando se arregló la tarjeta del administrador, con este comentario en
//   `caja/route.js`: «una caja física no contiene Nequi […] el fajo de la noche
//   no puede cuadrar nunca». Se arregló una vista y se dejó la otra.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const PANTALLA = 'app/(dashboard)/caja/page.jsx'

/* La cuenta, tal como la hace la pantalla. Si esto cambia, cambia el fajo que
   un cobrador entrega cada noche. */
const enLaMano = ({ efectivo, prestadoEfectivo = 0, gastos = 0 }) =>
  efectivo - prestadoEfectivo - gastos

describe('⚠ el caso de la RUTA #9, al peso', () => {
  const RUTA9 = { cobrado: 119_000, efectivo: 40_000, digital: 79_000, apertura: 26_000 }

  it('lo que lleva en billetes son $40.000, no $119.000', () => {
    expect(enLaMano({ efectivo: RUTA9.efectivo })).toBe(40_000)
  })

  it('con la apertura, los $66.000 que decía el administrador', () => {
    expect(RUTA9.apertura + enLaMano({ efectivo: RUTA9.efectivo })).toBe(66_000)
  })

  it('el efectivo y lo digital suman lo cobrado', () => {
    expect(RUTA9.efectivo + RUTA9.digital).toBe(RUTA9.cobrado)
  })
})

describe('la cuenta del fajo', () => {
  it('descuenta lo prestado en billetes y los gastos', () => {
    expect(enLaMano({ efectivo: 200_000, prestadoEfectivo: 50_000, gastos: 10_000 })).toBe(140_000)
  })

  it('⚠ un desembolso por transferencia NO baja el fajo', () => {
    // Sale de la cuenta de la oficina, no del bolsillo del cobrador.
    expect(enLaMano({ efectivo: 200_000, prestadoEfectivo: 0 })).toBe(200_000)
  })

  it('sin nada cobrado en billetes queda en cero, no en el total', () => {
    expect(enLaMano({ efectivo: 0 })).toBe(0)
  })
})

describe('⚠ la pantalla del cobrador usa el efectivo, no el total', () => {
  const src = leer(PANTALLA)

  it('«Te queda en la mano» sale del efectivo', () => {
    expect(src).toMatch(/const enLaMano = cobradoEfectivoHoy - prestadoEfectivoHoy - gastosHoy/)
    /* ⚠ Anclado en el JSX, no en el texto: `indexOf('Te queda en la mano')` a
       secas caía en MI PROPIO COMENTARIO de arriba, que cita la frase. La
       prueba pasaba mirando prosa. */
    const i = src.indexOf('>Te queda en la mano</span>')
    expect(i, 'no encuentro el renglón en el JSX').toBeGreaterThan(0)
    const bloque = src.slice(i, i + 320)
    expect(bloque).toMatch(/formatMoney\(enLaMano\)/)
    expect(bloque, 'volvió a contar las transferencias como billetes')
      .not.toMatch(/cobradoHoy - prestadoHoy - gastosHoy/)
  })

  it('⚠ el botón «Usar $X» rellena un campo de BILLETES', () => {
    /* El aviso de encima dice «solo reportas cuánto dinero físico tienes».
       Ofrecer el total con transferencias contradecía su propio rótulo. */
    expect(src).toMatch(/const recaudadoRegistrado = enLaMano/)
  })

  it('se ve cuánto entró por transferencia, y sin signo', () => {
    // Ya está DENTRO de lo cobrado: con signo se restaría dos veces.
    expect(src).toMatch(/id: 'digital'[\s\S]{0,140}signo: 0/)
  })

  it('⚠ `enLaMano` se declara DESPUÉS de `gastosHoy`', () => {
    /* Lo escribí antes y la caja entera se caía con «Cannot access before
       initialization». Es la tercera vez que este archivo me lo hace, y la
       pantalla en blanco no la caza ninguna prueba de cifras. */
    expect(src.indexOf('const gastosHoy')).toBeLessThan(src.indexOf('const enLaMano'))
  })
})

describe('el reparto por medio de pago viene del API', () => {
  const api = leer('app/api/caja/route.js')

  it('devuelve el efectivo, lo digital y lo prestado en billetes', () => {
    for (const campo of ['recogidaEfectivo', 'recogidaDigital', 'efectivoPrestadoDia']) {
      expect(api, `falta ${campo}`).toMatch(new RegExp(`${campo}`))
    }
  })

  it('lo prestado en billetes excluye las transferencias', () => {
    expect(api).toMatch(/filter\(\(d\) => d\.metodoPago !== 'transferencia'\)/)
  })
})
