// La plata sin cuenta (capital inicial, préstamos del cuaderno, cobros de antes de
// las cuentas) puede estar en cualquier cuenta: el aviso no afirma que falte.
import { describe, it, expect } from 'vitest'
import { avisoDeCuenta } from '@/lib/dinero/aviso-de-cuenta'

const BANCO = 'cta-banco'
// Crediya, 6 nov 2026, al prestar $350.000 por Bancolombia.
const CREDIYA = [
  { key: 'efectivo', nombre: 'Efectivo', tipoCuenta: 'efectivo', neto: -22_136_826 },
  { key: BANCO, nombre: 'Bancolombia', tipoCuenta: 'transferencia', neto: -28_745_471 },
  { key: 'cta-nequi', nombre: 'Nequi', tipoCuenta: 'transferencia', neto: -12_645_517 },
  { key: 'cta-davi', nombre: 'Daviplata', tipoCuenta: 'transferencia', neto: 86_700 },
  { key: 'sin_registrar', nombre: 'Sin registrar', tipoCuenta: 'sin_registrar', neto: 42_427_177 },
  { key: 'sin_cuenta', nombre: 'Ajustes sin cuenta', tipoCuenta: 'ajuste', neto: 26_947_435 },
]

describe('el aviso de la cuenta de la que sale el préstamo', () => {
  it('⚠ Crediya: con $69M sin cuenta no dice «faltan $29M»: invita a cuadrar', () => {
    expect(avisoDeCuenta(CREDIYA, BANCO, 350_000)).toMatchObject({ tipo: 'sin_repartir', nombre: 'Bancolombia', sePuedePasar: false })
  })
  it('el formulario no pinta en rojo el caso sin repartir y ofrece cuadrar', async () => {
    const { readFileSync } = await import('node:fs')
    const form = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')
    expect(form).toMatch(/if \(aviso\.tipo === 'sin_repartir'\) return \(/)
    expect(form).toContain('onClick={() => setCuadrarAbierto(true)}')
    expect(form).toContain('<CuadrarCuentas')
  })
  it('si la cuenta alcanza, lo dice', () => {
    const c = [{ key: BANCO, nombre: 'Bancolombia', tipoCuenta: 'transferencia', neto: 500_000 }]
    expect(avisoDeCuenta(c, BANCO, 350_000)).toMatchObject({ tipo: 'alcanza', hay: 500_000 })
  })
  it('sin plata sin cuenta, los saldos se conocen: dice lo que falta y si otra cuenta lo cubre', () => {
    const c = [
      { key: BANCO, nombre: 'Bancolombia', tipoCuenta: 'transferencia', neto: 400_000 },
      { key: 'cta-nequi', nombre: 'Nequi', tipoCuenta: 'transferencia', neto: 600_000 },
    ]
    expect(avisoDeCuenta(c, BANCO, 500_000)).toMatchObject({ tipo: 'falta', falta: 100_000, enOtras: 600_000, sePuedePasar: true })
  })
  it('si lo sin cuenta no alcanza a explicar lo que falta, sí avisa', () => {
    const c = [
      { key: BANCO, nombre: 'Bancolombia', tipoCuenta: 'transferencia', neto: 0 },
      { key: 'sin_registrar', nombre: 'Sin registrar', tipoCuenta: 'sin_registrar', neto: 50_000 },
    ]
    expect(avisoDeCuenta(c, BANCO, 500_000)).toMatchObject({ tipo: 'falta', falta: 500_000, sePuedePasar: false })
  })
  it('lo sin cuenta en negativo no tapa nada', () => {
    const c = [
      { key: BANCO, nombre: 'Bancolombia', tipoCuenta: 'transferencia', neto: 0 },
      { key: 'sin_cuenta', nombre: 'Ajustes sin cuenta', tipoCuenta: 'ajuste', neto: -900_000 },
    ]
    expect(avisoDeCuenta(c, BANCO, 100_000)).toMatchObject({ tipo: 'falta', falta: 100_000 })
  })
  it('sin monto o sin la cuenta en la lista, no dice nada', () => {
    expect(avisoDeCuenta(CREDIYA, BANCO, 0)).toBeNull()
    expect(avisoDeCuenta(CREDIYA, 'otra', 100)).toBeNull()
    expect(avisoDeCuenta(null, BANCO, 100)).toBeNull()
  })
})
