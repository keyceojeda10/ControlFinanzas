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
  /* ⚠ Estas dos fijaban la FORMA exacta del código —`select: { id: true }` y
     `sigueVivo.has(...)`— y se pusieron en rojo cuando el detalle de «lo que
     prestaste» hizo que la consulta trajera también el nombre del cliente y que
     el mapa guardara el préstamo entero. La conducta no cambió: el anulado
     sigue sin sumarse. Reescritas sobre lo que tienen que garantizar, no sobre
     cómo está escrito hoy. */
  it('se consultan los que siguen sin cancelar', () => {
    expect(src).toMatch(/const idsSueltos = movimientosDesembolso/)
    const consulta = src.slice(src.indexOf('const idsSueltos'))
    expect(consulta, 'la consulta de los sueltos dejó de excluir cancelados')
      .toMatch(/id: \{ in: \[\.\.\.new Set\(idsSueltos\)\] \}, estado: \{ not: 'cancelado' \}/)
  })

  it('y el bucle salta los que no lo están', () => {
    const bucle = src.slice(src.indexOf('const sigueVivo'))
    // Sea `has` o `get`, lo que importa es que haya una salida antes de sumar.
    expect(bucle, 'volvió a sumar movimientos de préstamos anulados')
      .toMatch(/sigueVivo\.(has|get)\(mov\.referenciaId\)[\s\S]{0,60}continue/)
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
