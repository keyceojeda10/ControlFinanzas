/* Editar el monto de una renovación mueve BILLETES, no la deuda absorbida; y
 * borrar un préstamo editado devuelve lo que de verdad salió. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parejaDeLaEdicion } from '@/lib/dinero/editar-monto'
import { capitalYaDevuelto } from '@/lib/dinero/revertir-renovacion'

const RUTA = readFileSync('app/api/prestamos/[id]/route.js', 'utf8')

describe('la pareja de una edición', () => {
  it('en un préstamo nuevo, el monto es lo que salió', () => {
    expect(parejaDeLaEdicion({ montoAnterior: 100_000, montoNuevo: 50_000 })).toEqual({ devuelve: 100_000, sale: 50_000, absorbido: 0 })
  })

  it('subir una renovación: sale la diferencia en billetes, como antes', () => {
    // Renovó $150.000 con $54.000 en mano (96.000 absorbidos) y lo subió a $200.000.
    const r = parejaDeLaEdicion({ montoAnterior: 150_000, montoNuevo: 200_000, efectivoAnterior: 54_000, esRenovacion: true })
    expect(r).toEqual({ devuelve: 54_000, sale: 104_000, absorbido: 96_000 })
    expect(r.devuelve - r.sale).toBe(-50_000)
  })

  it('⚠ bajar una renovación sin efectivo por debajo de lo absorbido NO inventa plata', () => {
    // PRESTA MIL, 10 sep: $1.100.000 sin un peso en mano, bajado a $1.000.000.
    // Antes el capital subía $100.000 que no existían.
    const r = parejaDeLaEdicion({ montoAnterior: 1_100_000, montoNuevo: 1_000_000, efectivoAnterior: 0, esRenovacion: true })
    expect(r.devuelve - r.sale).toBe(0)
  })

  it('⚠ bajarla y luego subirla: lo absorbido sale del préstamo viejo', () => {
    // La prueba del espejo: deuda $1.350.000 sin efectivo, bajada a $1.250.000
    // (sin asiento) y subida a $1.400.000. Salen 50.000, no 150.000.
    const r = parejaDeLaEdicion({ montoAnterior: 1_250_000, montoNuevo: 1_400_000, efectivoAnterior: 0, esRenovacion: true, absorbidoDelViejo: 1_350_000 })
    expect(r.sale).toBe(50_000)
    // Sin el dato del viejo, nunca menos que el monto actual.
    expect(parejaDeLaEdicion({ montoAnterior: 1_250_000, montoNuevo: 1_400_000, efectivoAnterior: 0, esRenovacion: true }).sale).toBe(150_000)
  })

  it('bajar una renovación con efectivo: vuelve solo hasta lo que salió', () => {
    // $200.000 con $80.000 en mano (120.000 absorbidos), bajado a $50.000.
    const r = parejaDeLaEdicion({ montoAnterior: 200_000, montoNuevo: 50_000, efectivoAnterior: 80_000, esRenovacion: true })
    expect(r).toEqual({ devuelve: 80_000, sale: 0, absorbido: 120_000 })
  })

  it('sin desembolso en el libro, se queda como estaba', () => {
    expect(parejaDeLaEdicion({ montoAnterior: 200_000, montoNuevo: 300_000, efectivoAnterior: null, esRenovacion: true }).sale).toBe(300_000)
  })

  it('la ruta de editar la usa, y no escribe asientos si los billetes no cambian', () => {
    expect(RUTA).toMatch(/const pareja = parejaDeLaEdicion\(\{/)
    expect(RUTA).toMatch(/const parejaMueve = montoCambia && Math\.round\(pareja\.devuelve\) !== Math\.round\(pareja\.sale\)/)
    expect(RUTA).toMatch(/if \(parejaMueve\) \{/)
    expect(RUTA).toMatch(/monto: pareja\.devuelve,/)
    expect(RUTA).toMatch(/monto: pareja\.sale,/)
    // La reserva de ruta no es lo que salió.
    expect(RUTA).toMatch(/tipo: 'desembolso', ajusteArranqueRuta: false \},\n\s+orderBy: \{ createdAt: 'desc' \}/)
  })
})

describe('borrar un préstamo editado', () => {
  it('el reverso de la edición no cuenta como capital ya devuelto', async () => {
    const tx = { movimientoCapital: { findMany: async () => [
      { monto: 300_000, saldoAnterior: 0, saldoNuevo: 300_000, descripcion: 'Reverso desembolso - edición préstamo (anterior $300.000)' },
      { monto: 40_000, saldoAnterior: 0, saldoNuevo: 40_000, descripcion: 'Devolución por cancelación' },
    ] } }
    expect(await capitalYaDevuelto(tx, { id: 'p', organizationId: 'o' })).toBe(40_000)
  })
})
