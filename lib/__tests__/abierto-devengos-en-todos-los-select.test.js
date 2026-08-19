// lib/__tests__/abierto-devengos-en-todos-los-select.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «En mora deberían salir el valor de los intereses.» — Rhoders (FACIL),
// 19 ago 2026, con la captura de la LISTA de préstamos: la deuda ya decía
// $759.000 —el interés se había devengado bien— y al lado «EN MORA $0 · Al día».
//
// El detalle del préstamo sí lo decía. La lista no. Y la razón es la de siempre
// en este proyecto:
//
//   ⚠ UN CAMPO QUE NO SE PIDE VALE `undefined`, NO DA ERROR, Y DECIDE EN
//     SILENCIO. La mora de un préstamo abierto es su interés devengado sin
//     pagar —`prestamo.devengos`—. Sin el `include`, `interesesSinPagar` lee
//     `?? []` y contesta CERO. Cero mora es la respuesta más tranquilizadora
//     que puede dar el sistema, así que nadie la mira dos veces.
//
// Medido ese día: de los **28** endpoints que hacen cuentas de préstamo, solo
// DOS pedían los devengos. Los otros 26 daban «al día» sobre un préstamo que
// debía $69.000 desde hacía 18 días.
//
// La regla que esta prueba fija: **quien pida `cuotasAmortizacion` está
// haciendo cuentas de préstamo, y tiene que pedir también `devengos`.** No es
// una convención bonita: es lo que impide que el endpoint número 27 nazca
// mintiendo.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

function rutasDeApi(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) rutasDeApi(p, acc)
    else if (e === 'route.js') acc.push(p)
  }
  return acc
}

const API = resolve(process.cwd(), 'app/api')
const rutas = rutasDeApi(API)

describe('⚠ quien hace cuentas de préstamo carga los devengos', () => {
  it('encuentra los endpoints', () => {
    // Si esto se cae, la prueba dejó de mirar nada.
    expect(rutas.length).toBeGreaterThan(50)
  })

  it('ninguno pide `cuotasAmortizacion` sin pedir `devengos`', () => {
    const culpables = rutas.filter((f) => {
      const src = readFileSync(f, 'utf8')
      return /cuotasAmortizacion\s*:/.test(src) && !/devengos\s*:/.test(src)
    }).map((f) => f.replace(process.cwd() + '/', ''))

    expect(culpables, `estos harían cuentas sin los devengos y dirían «al día» sobre un abierto en mora:\n  ${culpables.join('\n  ')}`)
      .toHaveLength(0)
  })
})
