/* «En la calle» de la app y «Capital restante» del Excel decían cifras
 * distintas (soporte de Crediya, 14 oct 2026: $65.880 en 4 préstamos; en todo
 * producción 70 préstamos y $5.262.993). La función estaba bien: a cada
 * pantalla le llegaba una parte de los pagos —solo los de capital, los 10
 * últimos, los de 90 días o ninguno— y repartía el pago de SOLO INTERÉS como
 * capital devuelto. Toda vía que calcule el capital pide los pagos con la regla
 * común `PAGOS_DEL_CALCULO`. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcularCapitalRestante } from '@/lib/calculos'
import { capitalEnCalle } from '@/lib/dinero/reparto'

const leer = (f) => readFileSync(f, 'utf8')

describe('el capital se calcula con todos los pagos que lo mueven', () => {
  it('el Excel pide los pagos y los devengos del cálculo', () => {
    const s = leer('lib/reportes/cuenta-completa.js')
    expect(s).toMatch(/where: \{ organizationId: orgId, \.\.\.PAGOS_DEL_CALCULO\.where \}/)
    expect(s).not.toMatch(/where: \{ organizationId: orgId, tipo: 'capital' \}/)
    expect(s).toMatch(/p\.devengos = devengosDe\.get\(p\.id\) \?\? \[\]/)
  })
  it('la lista de préstamos no calcula con los 10 últimos', () => {
    expect(leer('app/api/prestamos/route.js')).toMatch(/calcularCapitalRestante\(\{ \.\.\.p, pagos: pagosCalculoDe\.get\(p\.id\) \?\? \[\] \}\)/)
  })
  it('la lista de clientes y el modo sin señal piden los pagos del cálculo', () => {
    expect(leer('app/api/clientes/route.js')).toMatch(/pagos: PAGOS_DEL_CALCULO,/)
    expect(leer('app/api/offline/sync/route.js')).toMatch(/\.\.\.PAGOS_DEL_CALCULO\.where\.OR/)
  })
  it('el caso del soporte: $100.000, pagó $10.000 de interés y $40.000 a capital → $60.000 afuera', () => {
    const p = { montoPrestado: 100000, totalAPagar: 117067, totalPagado: 50000, modoInteres: 'fijo', estado: 'activo',
      pagos: [{ tipo: 'intereses', montoPagado: 10000 }, { tipo: 'capital', montoPagado: 40000 }] }
    expect(Math.round(calcularCapitalRestante(p))).toBe(60000)
    expect(Math.round(capitalEnCalle(p))).toBe(60000)
  })
})
