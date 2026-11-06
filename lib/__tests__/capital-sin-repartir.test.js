// El capital sin cuenta: una fila, y el dueño lo reparte diciendo lo que tiene.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { juntarSinRepartir, capitalSinRepartir, cuadreDeCuentas, SIN_REPARTIR } from '@/lib/dinero/sin-repartir'
import { adaptarCuentas, cuentasElegibles } from '@/lib/adaptadores/cuentas'
import { columnasDeCuenta } from '@/lib/capital'

const fila = (key, nombre, tipoCuenta, neto, extra = {}) => ({ key, nombre, tipoCuenta, neto, entradas: Math.max(neto, 0), salidas: Math.max(-neto, 0), ...extra })
// Crediya, 6 nov 2026 (espejo).
const CREDIYA = [
  fila('efectivo', 'Efectivo', 'efectivo', -21_941_698),
  fila('nequi', 'Nequi', 'transferencia', -13_025_517),
  fila('banco', 'Bancolombia', 'transferencia', -29_025_471),
  fila('davi', 'Daviplata', 'transferencia', 86_700),
  fila('sin_registrar', 'Sin registrar', 'sin_registrar', 60_708_913),
  fila('sin_cuenta', 'Ajustes sin cuenta', 'ajuste', 8_665_699),
]
const capital = CREDIYA.reduce((a, c) => a + c.neto, 0)

describe('el capital sin repartir', () => {
  it('junta los cajones sin cuenta en una fila, al final, sin cambiar el total', () => {
    const j = juntarSinRepartir(CREDIYA)
    expect(j.map((c) => c.key)).toEqual(['efectivo', 'nequi', 'banco', 'davi', SIN_REPARTIR])
    expect(j.at(-1)).toMatchObject({ nombre: 'Capital sin repartir', neto: 69_374_612 })
    expect(j.reduce((a, c) => a + c.neto, 0)).toBe(capital)
    expect(capitalSinRepartir(j)).toBe(69_374_612)
    expect(capitalSinRepartir(CREDIYA)).toBe(69_374_612)
  })
  it('la transferencia sin cuenta también es sin repartir', () => {
    expect(capitalSinRepartir([fila('transferencia', 'Transferencia (sin cuenta)', 'transferencia', 500)])).toBe(500)
  })
  it('no se ofrece como cuenta para pasar ni para cuadrar', () => {
    expect(cuentasElegibles(juntarSinRepartir(CREDIYA)).map((c) => c.key)).toEqual(['efectivo', 'nequi', 'banco', 'davi'])
  })
  it('en la pantalla sale al final, con su texto y la acción de repartir; en cero no sale', () => {
    const v = adaptarCuentas(juntarSinRepartir(CREDIYA), String)
    expect(v.cuentas.at(-1)).toMatchObject({ id: SIN_REPARTIR, accion: 'Repartir en mis cuentas' })
    const cero = adaptarCuentas([fila('efectivo', 'Efectivo', 'efectivo', 0), { ...fila(SIN_REPARTIR, 'Capital sin repartir', SIN_REPARTIR, 0), entradas: 5, salidas: 5 }], String)
    expect(cero.cuentas.map((c) => c.id)).toEqual(['efectivo'])
  })
  it('sale y entra sin columnas de cuenta', () => {
    expect(columnasDeCuenta(SIN_REPARTIR)).toEqual({ metodoPago: null, metodoPagoId: null })
  })
})

describe('cuadrar con lo que tengo', () => {
  it('cada cuenta queda en lo que el dueño dice; la diferencia sale de lo sin repartir', () => {
    const c = cuadreDeCuentas(CREDIYA, [{ key: 'banco', tiene: 3_000_000 }, { key: 'efectivo', tiene: 800_000 }])
    expect(c).toEqual([
      { key: 'banco', nombre: 'Bancolombia', antes: -29_025_471, ahora: 3_000_000, diferencia: 32_025_471 },
      { key: 'efectivo', nombre: 'Efectivo', antes: -21_941_698, ahora: 800_000, diferencia: 22_741_698 },
    ])
  })
  it('no toca la que ya está bien, ni lo sin repartir, ni cifras raras', () => {
    expect(cuadreDeCuentas(CREDIYA, [
      { key: 'davi', tiene: 86_700 }, { key: 'sin_registrar', tiene: 0 }, { key: 'nequi', tiene: -5 },
      { key: 'nequi', tiene: 'abc' }, { key: 'otra', tiene: 10 },
    ])).toEqual([])
  })
  it('el servidor calcula la diferencia con los saldos de ese momento, en una transacción', () => {
    const api = readFileSync('app/api/caja/cuentas/cuadrar/route.js', 'utf8')
    expect(api).toContain("if (session.user.rol !== 'owner')")
    expect(api).toMatch(/prisma\.\$transaction\(async \(tx\) => \{\n\s+const cuentas = await getSaldosPorCuenta\(tx, organizationId\)/)
    expect(api).toContain('desde: entra ? SIN_REPARTIR : c.key')
  })
})
