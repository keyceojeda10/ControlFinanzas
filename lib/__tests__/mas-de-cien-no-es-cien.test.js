/* «Más de 100» es un SUELO, no un techo.
 *
 * `planRecomendado` sacaba el número del texto ANTES de mirar el «más de», así
 * que `mas_de_100` se trataba como exactamente 100 y caía en el plan que corta
 * JUSTO en 100. El lead pagaba el plan de entrada, llegaba al tope el primer
 * día y no podía registrar más clientes.
 *
 * Es el mismo fallo que `_planPorCantidad` dice haber corregido ya una vez
 * —«el bot llevaba meses vendiendo un tope que la aplicación no daba»—: se
 * arregló el umbral numérico y se dejó el «más de».
 *
 * MEDIDO EN PRODUCCIÓN el 28 ago 2026: 329 leads han declarado «más de 100
 * clientes» desde marzo, 75 de ellos en agosto. Es el rango que declara el 17%
 * de los leads del mes.
 *
 * ⚠ Salió verificando otra cosa: el cambio de formulario de Meta del 11 de
 * agosto. Ese cambio NO rompió nada —las dos formas de escribir el rango dan
 * la misma respuesta—, pero al probar los dos vocabularios apareció esto. */
import { describe, it, expect } from 'vitest'
import { planRecomendado, PLANES } from '@/lib/bot-v2/producto'

const tope = (p) => p.clientes

describe('«más de 100» no es 100', () => {
  it('⚠ no se recomienda el plan que corta justo donde el lead ya está', () => {
    const plan = planRecomendado('mas_de_100')
    expect(tope(plan)).toBeGreaterThan(100)
  })

  it('el rango cerrado sí cabe en su plan', () => {
    // «50 a 100» sí es un techo: el plan que llega a 100 le sirve.
    expect(tope(planRecomendado('50_a_100'))).toBeGreaterThanOrEqual(100)
    expect(tope(planRecomendado('menos_de_20'))).toBeGreaterThanOrEqual(20)
  })

  it('⚠ los dos vocabularios de Meta dan la misma respuesta', () => {
    /* El formulario del 11 de agosto cambió `20_a_50` por `20_50` y `50_a_100`
       por `50_100`. Si esto se rompe, el bot recomienda distinto según qué
       formulario llenó el lead, y nadie se entera. */
    for (const [viejo, nuevo] of [['20_a_50', '20_50'], ['50_a_100', '50_100']]) {
      expect(planRecomendado(viejo).key).toBe(planRecomendado(nuevo).key)
    }
  })

  it('se deriva de los planes, no de un número escrito a mano', () => {
    // Si mañana se mueve un cupo, la recomendación se mueve sola.
    const conTopeMayor = PLANES.filter((p) => p.clientes > 100)
    expect(conTopeMayor.length).toBeGreaterThan(0)
    expect(planRecomendado('mas_de_100').key).toBe(conTopeMayor[0].key)
  })

  it('«más de» en texto libre también es un suelo', () => {
    // El bot recibe texto escrito por la persona, no solo códigos de Meta.
    for (const dicho of ['mas de 100', 'más de 100 clientes', 'tengo mas de 100']) {
      expect(tope(planRecomendado(dicho))).toBeGreaterThan(100)
    }
  })

  it('sin dato, el plan de entrada', () => {
    expect(planRecomendado(null).key).toBe(PLANES[0].key)
    expect(planRecomendado('').key).toBe(PLANES[0].key)
  })
})
