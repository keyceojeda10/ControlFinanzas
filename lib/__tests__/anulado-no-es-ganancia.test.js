// lib/__tests__/anulado-no-es-ganancia.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Me equivoqué en registrar un pago. Era menos de lo que registré. A pesar de
//  que cancelé el crédito, me sigue mostrando el movimiento y me alteró las
//  utilidades. Quise colocar 100.000 y coloqué 1 millón.»
//   — Crediya (ycabarcas86@gmail.com), 16 ago 2026.
//
// Reconstruido contra su base: escribió $1.000.001 en el préstamo de Nelson
// Cantillo a las 21:13, lo anuló a las 21:14, y el millón siguió contando como
// interés ganado del mes.
//
// ⚠ NO ERA UN OLVIDO SUELTO, ERA UNA INCONSISTENCIA DENTRO DE LA MISMA PANTALLA.
//   La consulta de rentabilidad por ruta —diez líneas más abajo, en el mismo
//   `Promise.all`— ya filtraba `pr.estado = 'activo'`. Y `dashboard/resumen`,
//   `reportes/resumen`, `reportes/scorecard` y `mis-estadisticas` ya excluían
//   los anulados, cada uno por su lado. Solo analíticas y su PDF contaban.
//
// Medido en producción ese día: **110 préstamos anulados conservan 194 pagos
// por $43.760.053**, en 34 negocios. En agosto solo, $1.919.101.
//
// Lo que estas pruebas cuidan:
//
//   1. Que vuelva a colarse un pago de un préstamo anulado en la ganancia.
//   2. Que la PANTALLA y su PDF midan distinto. Son la misma cifra, y dos
//      criterios dan dos ganancias del mismo mes.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

const PANTALLA = 'app/api/dashboard/analiticas/route.js'
const PDF = 'app/api/dashboard/analiticas/reporte-pdf/route.js'

/* Cada consulta que suma `Pago` para decir cuánto se ganó o se recaudó tiene que
   dejar fuera los préstamos anulados. Se comprueba por bloque, no por archivo:
   con `toContain` a secas basta con que UNA de las cuatro lo tenga. */
function bloquesDePagos(src) {
  const bloques = []
  // Los `prisma.pago.aggregate({ ... })`
  const re = /prisma\.pago\.aggregate\(\{[\s\S]*?\n\s*\}\),/g
  let m
  while ((m = re.exec(src))) bloques.push(m[0])
  // Y las consultas crudas que unen Pago con Prestamo
  const reRaw = /SELECT[\s\S]*?FROM Pago[\s\S]*?(?=`,)/g
  while ((m = reRaw.exec(src))) bloques.push(m[0])
  return bloques
}

for (const [nombre, ruta] of [['la pantalla', PANTALLA], ['el PDF', PDF]]) {
  describe(`⚠ ${nombre} de analíticas no cuenta los préstamos anulados`, () => {
    const src = leer(ruta)
    const bloques = bloquesDePagos(src)

    it('encuentra las consultas de pagos', () => {
      // Si esto falla, el fichero cambió de forma y la prueba dejó de mirar nada.
      expect(bloques.length).toBeGreaterThanOrEqual(3)
    })

    it('todas dejan fuera los anulados', () => {
      const sinFiltro = bloques.filter((b) =>
        !/estado:\s*\{\s*not:\s*'cancelado'\s*\}/.test(b) &&
        !/estado\s*<>\s*'cancelado'/.test(b))
      expect(sinFiltro, `quedan ${sinFiltro.length} consultas contando anulados:\n${sinFiltro.map(b => b.slice(0, 120)).join('\n---\n')}`)
        .toHaveLength(0)
    })
  })
}

describe('los demás informes ya lo hacían, y siguen', () => {
  const otros = [
    'app/api/dashboard/resumen/route.js',
    'app/api/reportes/resumen/route.js',
    'app/api/reportes/scorecard/route.js',
    'app/api/mis-estadisticas/route.js',
  ]
  for (const r of otros) {
    it(`${r.split('/').slice(-2)[0]} sigue excluyéndolos`, () => {
      expect(leer(r)).toMatch(/estado:\s*\{\s*not:\s*'cancelado'\s*\}/)
    })
  }
})
