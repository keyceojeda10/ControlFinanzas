import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── UN PRÉSTAMO ANULADO SEGUÍA CONTANDO COMO PLATA ENTREGADA ────────────────
//
// Reportado con dos capturas del mismo día y el mismo cobrador:
//
//   caja del ADMINISTRADOR:  «Prestó en efectivo  $150.000»   ← la correcta
//   caja del COBRADOR:       «Lo que prestaste   −$748.000»
//
// El dueño lo dijo claro: «la caja del administrador está calculando bien, la
// que da mal los números es la del cobrador».
//
// Reconstruido al peso contra producción — JULIAN #7, ruta 7:
//
//   16:49  cancelado  150.000  MIRANDA GOMEZ
//   18:40  cancelado  142.000  MIRANDA GOMEZ (renovación)
//   18:47  cancelado  150.000  MIRANDA GOMEZ
//   22:33  ACTIVO     150.000  MIRANDA GOMEZ   ← el único de verdad
//   22:37  cancelado   96.000  DIEGO VEGA (renovación)
//   22:39  cancelado   60.000  EMMANUEL DAVILA (renovación)
//
//   contando solo los vivos      = 150.000  (lo que decía el administrador)
//   contando también cancelados  = 748.000  (lo que decía el cobrador)
//
// `calcularDesembolsadoDia` tiene TRES caminos en la rama por cobrador. Los dos
// primeros —préstamos de la ruta y préstamos creados por él— ya excluían los
// cancelados. El tercero —movimientos de capital sueltos— no miraba el estado,
// y ahí caían justo los anulados: al no estar en las otras dos listas, llegaban
// al último bucle y se sumaban.
//
// Un préstamo anulado NO sacó plata de la caja. Si salió y se devolvió, el
// reverso tiene su propio movimiento.

const src = readFileSync(resolve(process.cwd(), 'lib/dinero/desembolsado.js'), 'utf8')

describe('los movimientos sueltos comprueban que el préstamo siga vivo', () => {
  it('se consultan los que siguen sin cancelar', () => {
    expect(src).toMatch(/const idsSueltos = movimientosDesembolso/)
    expect(src).toMatch(/estado: \{ not: 'cancelado' \} \},\s*\n\s*select: \{ id: true \}/)
  })

  it('y el bucle salta los que no lo están', () => {
    expect(src, 'volvió a sumar movimientos de préstamos anulados')
      .toMatch(/if \(!sigueVivo\.has\(mov\.referenciaId\)\) continue/)
  })

  it('los otros dos caminos siguen excluyendo cancelados', () => {
    // Si alguno dejara de hacerlo, sus préstamos anulados pasarían a contarse
    // por el camino de siempre y esta corrección no los vería.
    expect((src.match(/estado: \{ not: 'cancelado' \}/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
})

describe('la caja del administrador tenía razón', () => {
  it('la rama global también excluye cancelados', () => {
    // Es la que alimenta la pantalla del dueño, la que él dijo que estaba bien.
    const global = src.slice(src.indexOf('const baseWherePrestamos'), src.indexOf('if (!cobradorId)'))
    expect(global).toMatch(/estado: \{ not: 'cancelado' \}/)
  })
})
