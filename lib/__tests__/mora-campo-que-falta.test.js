// lib/__tests__/mora-campo-que-falta.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Dos reportes del MISMO negocio y el MISMO día decían cosas distintas:
// «Cómo me fue» contaba **851 clientes en mora de 984**, y «Cómo va el negocio»
// decía **0**.
//
// La causa no estaba en ninguna fórmula: `calcularDiasMora` empezaba con
//
//     if (prestamo.estado !== 'activo') return 0
//
// y la consulta de Analíticas filtraba `where: { estado: 'activo' }` **sin
// pedir `estado` en el `select`**. Un campo que no se selecciona no da error:
// vale `undefined`. Y `undefined !== 'activo'` es cierto, así que devolvía cero
// días de mora en todos los préstamos, en todos los negocios, siempre.
//
// ⚠ Cero en mora es la respuesta más tranquilizadora que puede dar el sistema.
// Nadie la mira dos veces. Solo saltó al poner las dos cifras una al lado de la
// otra.
//
// Ahora sólo se sale cuando el estado VIENE y no es activo. Si no viene, se
// calcula: quien no lo pide es porque ya lo filtró en la consulta.

import { describe, it, expect } from 'vitest'
import { calcularDiasMora } from '../calculos.js'

/** Un préstamo diario, empezado hace 30 días y sin un solo pago. */
function prestamoVencido(extra = {}) {
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return {
    estado: 'activo',
    cuotaDiaria: 10000,
    totalAPagar: 300000,
    totalPagado: 0,
    montoPrestado: 250000,
    frecuencia: 'diario',
    fechaInicio: hace30,
    diasPlazo: 30,
    modoInteres: 'fijo',
    pagos: [],
    ...extra,
  }
}

describe('la mora y el campo que no se pidió', () => {
  it('un préstamo vencido tiene mora', () => {
    expect(calcularDiasMora(prestamoVencido())).toBeGreaterThan(0)
  })

  it('⚠ SIN el campo `estado` sigue contando, no devuelve cero', () => {
    /* Esta es la prueba que faltaba. Antes, quitar `estado` del objeto —que es
       exactamente lo que hace un `select` de Prisma incompleto— pasaba de una
       mora de 29 días a 0 sin un solo error. */
    const { estado, ...sinEstado } = prestamoVencido()
    expect(estado).toBe('activo')
    expect(calcularDiasMora(sinEstado)).toBe(calcularDiasMora(prestamoVencido()))
    expect(calcularDiasMora(sinEstado)).toBeGreaterThan(0)
  })

  it('un estado que SÍ viene y no es activo sigue sin contar', () => {
    // La guardia tiene que seguir sirviendo para lo que se puso.
    expect(calcularDiasMora(prestamoVencido({ estado: 'completado' }))).toBe(0)
    expect(calcularDiasMora(prestamoVencido({ estado: 'cancelado' }))).toBe(0)
  })

  it('los días sin cobro se pasan como NÚMEROS, no como el JSON en crudo', () => {
    /* El otro idioma que había en Analíticas: `diasSinCobro` se guarda como el
       texto `"[0]"` y se pasaba tal cual donde se espera `[0]`. No falla:
       `"[0]".length` es 3, así que contaba tres días excluidos por semana en
       vez de uno, y la mora salía más baja de lo que es. */
    const p = prestamoVencido()
    const conArray = calcularDiasMora(p, [0], [])
    const conTexto = calcularDiasMora(p, '[0]', [])
    expect(conArray).toBeGreaterThan(0)
    expect(conTexto).not.toBe(conArray)
  })

  it('excluir días baja la mora, no la sube', () => {
    const p = prestamoVencido()
    const todos = calcularDiasMora(p, [], [])
    const sinDomingos = calcularDiasMora(p, [0], [])
    expect(sinDomingos).toBeLessThan(todos)
    expect(sinDomingos).toBeGreaterThan(0)
  })
})
