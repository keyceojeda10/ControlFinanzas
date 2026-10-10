/* El interés en pesos de un préstamo sin vencimiento sale AL PESO en la cuota y
 * en cada devengo. Hector Cano: $1.500.000 que pagan $170.000 al mes. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { tasaParaInteres, interesDelPeriodo } from '@/lib/dinero/interes-en-pesos'
import { calcularPrestamo, devengosPendientes } from '@/lib/calculos'
import { formatearTasa } from '@/lib/adaptadores/prestamos'

const FORM = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

const abierto = (monto, tasa, frecuencia = 'mensual') => calcularPrestamo({
  montoPrestado: monto, tasaInteres: tasa, diasPlazo: 30, fechaInicio: new Date('2026-10-09T05:00:00Z'),
  frecuencia, modoInteres: 'solo_interes', sinPlazo: true,
})

describe('el interés en pesos', () => {
  it('el caso de Hector: $170.000 exactos, no $169.500', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    expect(abierto(1_500_000, tasa).cuotaDiaria).toBe(170_000)
    // Con el porcentaje que podía escribir no había forma:
    expect(abierto(1_500_000, 11.3).cuotaDiaria).toBe(169_500)
    expect(abierto(1_500_000, 11.33).cuotaDiaria).toBe(169_950)
    // Y se enseña redondeada, sin la cola de decimales.
    expect(formatearTasa(tasa)).toBe('11,33')
  })

  it('sale al peso en 5.000 combinaciones de monto e interés', () => {
    let mal = 0
    for (let k = 0; k < 5000; k++) {
      const monto = 50_000 + Math.floor(Math.random() * 20_000_000)
      const interes = 1_000 + Math.floor(Math.random() * monto * 0.5)
      if (abierto(monto, tasaParaInteres(monto, interes)).cuotaDiaria !== interes) mal++
    }
    expect(mal).toBe(0)
  })

  it('el devengo de cada mes da lo mismo', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    const p = {
      sinPlazo: true, modoInteres: 'solo_interes', frecuencia: 'mensual', tasaInteres: tasa,
      montoPrestado: 1_500_000, fechaInicio: new Date('2026-07-09T05:00:00Z'), pagos: [], devengos: [],
    }
    const ds = devengosPendientes(p, new Date('2026-10-10T17:00:00Z').getTime())
    expect(ds.length).toBeGreaterThan(0)
    for (const d of ds) expect(d.interes).toBe(170_000)
  })

  it('si abona a capital, baja en proporción (como con un porcentaje)', () => {
    const tasa = tasaParaInteres(1_500_000, 170_000)
    expect(interesDelPeriodo(1_000_000, tasa)).toBe(113_333)
  })

  it('sin monto o sin interés no inventa una tasa', () => {
    expect(tasaParaInteres(0, 170_000)).toBeNull()
    expect(tasaParaInteres(1_500_000, '')).toBeNull()
  })

  it('el formulario lo ofrece solo en el préstamo sin vencimiento', () => {
    expect(FORM).toMatch(/const t = tasaParaInteres\(monto, interesPesos\)/)
    expect(FORM).toMatch(/\{esAbierto && interesEnPesos \? \(/)
  })
})
