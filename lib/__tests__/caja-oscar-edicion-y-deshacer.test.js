/* La caja de Oscar Oyola, 14 oct 2026, con sus asientos (montos y orden reales).
 * Mostraba «Lo que prestaste −1.400.000», «Plata que sacaste −1.400.000»,
 * «Correcciones +2.400.000» y «Hoy la cuenta no cierra: $1.100.000». */
import { describe, it, expect } from 'vitest'
import { resumirLibro, conciliar } from '@/lib/dinero/conciliacion'

const D = (monto, desc, ref) => ({ tipo: 'desembolso', monto, saldoAnterior: 0, saldoNuevo: -monto, descripcion: desc, referenciaTipo: 'prestamo', referenciaId: ref })
const LIBRO = [
  D(50_000, 'Desembolso préstamo a un cliente', 'palomino'),
  D(50_000, 'Desembolso préstamo a un cliente', 'ospina'),
  D(200_000, 'Desembolso préstamo a un cliente', 'llanos'),
  { tipo: 'ajuste', monto: 1_000_000, saldoAnterior: 0, saldoNuevo: 1_000_000, descripcion: 'Reverso desembolso - edición préstamo (anterior $1.000.000)', referenciaTipo: 'prestamo', referenciaId: 'gutierres' },
  D(1_100_000, 'Desembolso actualizado - edición préstamo ($1.100.000)', 'gutierres'),
  { id: 'r1', tipo: 'retiro', monto: 1_400_000, saldoAnterior: 8_600_000, saldoNuevo: 7_200_000, descripcion: 'Retiro manual desde caja', referenciaTipo: 'caja_capital_manual' },
  { tipo: 'ajuste', monto: 1_400_000, saldoAnterior: 7_200_000, saldoNuevo: 8_600_000, descripcion: 'Deshecho: Retiro manual desde caja', referenciaTipo: 'caja_ajuste_reverso', referenciaId: 'r1' },
].map((m, i) => ({ createdAt: new Date(2026, 9, 14, 9, i), ...m }))

describe('la caja de Oscar dice lo que pasó', () => {
  const r = resumirLibro(LIBRO)
  it('prestó lo que salió hoy, y la subida de un préstamo del 12 es corrección', () => {
    expect(r.desembolsos).toBe(300_000)
    expect(r.ajustes).toBe(-100_000)
  })
  it('el retiro deshecho no aparece ni como retiro ni como corrección', () => {
    expect(r.retiros).toBe(0)
  })
  it('el saldo del día no cambia ni un peso', () => {
    expect(r.recaudo - r.desembolsos - r.gastos - r.retiros + r.inyecciones + r.ajustes).toBe(-400_000)
  })
  it('y la alarma se apaga: libro y préstamos de hoy coinciden', () => {
    const c = conciliar({ alcance: 'organizacion', libro: r, operaciones: { pagos: 0, pagosEfectivo: 0, pagosDigital: 0, gastos: 0, desembolsos: 300_000 } })
    expect(c.diferencias.desembolsos).toBe(0)
  })
})
