import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calcularSaldoPendiente, calcularCapitalRestante, tieneTablaAmortizacion } from '@/lib/calculos'

// ── AL RENOVAR SE ENTREGABA DE MÁS ──────────────────────────────────────────
//
// Reportado por el dueño de PRESTA MIL con dos casos del mismo día:
//
//   «acabo de hacer una renovación de cien mil, pero el cliente me debía
//    cincuenta mil. Acá me está mostrando cincuenta y ocho cuatrocientos,
//    cuando en realidad debería decir cincuenta»
//
// El sistema decidía cuánto entregar con `calcularCapitalRestante`, que reparte
// lo pagado PROPORCIONALMENTE entre capital e interés. Esa cifra es correcta
// para «cuánta plata mía sigue en la calle», pero al renovar se liquida otra
// cosa: LA DEUDA — lo que el cliente pactó devolver y aún no ha devuelto.
//
// Con tabla sí manda el capital: ahí el interés futuro no está devengado.

const src = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/renovar/route.js'), 'utf8')

/* MARIA GÓMEZ, reconstruido de producción: le prestaron $150.000 a devolver
   $180.000 (cuota $6.000 × 30 días) y pagó $130.000. */
const MARIA = {
  montoPrestado: 150000,
  totalAPagar: 180000,
  totalPagado: 130000,
  cuotaDiaria: 6000,
  diasPlazo: 30,
  frecuencia: 'diario',
  modoInteres: 'fijo',
  pagos: [{ montoPagado: 130000, tipo: 'parcial' }],
  cuotasAmortizacion: [],
}

describe('cuánto se liquida al renovar', () => {
  it('sin tabla: lo que el cliente DEBE, no el capital proporcional', () => {
    // 180.000 pactados − 130.000 pagados = 50.000, que es lo que el cobrador
    // tiene en la cartulina y en la cabeza.
    expect(calcularSaldoPendiente(MARIA)).toBe(50000)
  })

  it('el capital proporcional dice otra cosa, y por eso entregaba de más', () => {
    // 16,67% de los 130.000 se reparte a interés → capital devuelto 108.333 →
    // «aún debe» 41.667. Con eso, renovar por 100.000 entregaba 58.333.
    const capital = calcularCapitalRestante(MARIA)
    expect(capital).toBe(41667)
    expect(100000 - capital, 'este era el número que salía en pantalla').toBe(58333)
    expect(100000 - calcularSaldoPendiente(MARIA), 'y este es el correcto').toBe(50000)
  })

  it('la diferencia salía del bolsillo del cobrador', () => {
    // $8.333 de más POR CADA renovación, en efectivo.
    const deMas = calcularCapitalRestante(MARIA) === null
      ? 0
      : calcularSaldoPendiente(MARIA) - calcularCapitalRestante(MARIA)
    expect(deMas).toBe(8333)
  })

  it('este préstamo NO tiene tabla, que es el 93% de la cartera', () => {
    expect(tieneTablaAmortizacion(MARIA)).toBe(false)
  })
})

describe('con tabla de amortización manda el capital', () => {
  // Ahí el interés futuro no está devengado: cobrarlo al renovar sería cobrar
  // un interés que nunca corrió.
  const CON_TABLA = {
    montoPrestado: 1000000,
    totalAPagar: 1200000,
    totalPagado: 400000,
    cuotaDiaria: 100000,
    diasPlazo: 360,
    frecuencia: 'mensual',
    modoInteres: 'lineal',
    pagos: [{ montoPagado: 400000, tipo: 'parcial' }],
    cuotasAmortizacion: [
      { numeroPeriodo: 1, capital: 80000, interes: 20000, cuotaTotal: 100000, pagado: 100000, interesPagado: 20000 },
      { numeroPeriodo: 2, capital: 82000, interes: 18000, cuotaTotal: 100000, pagado: 100000, interesPagado: 18000 },
      { numeroPeriodo: 3, capital: 84000, interes: 16000, cuotaTotal: 100000, pagado: 100000, interesPagado: 16000 },
      { numeroPeriodo: 4, capital: 86000, interes: 14000, cuotaTotal: 100000, pagado: 100000, interesPagado: 14000 },
      { numeroPeriodo: 5, capital: 88000, interes: 12000, cuotaTotal: 100000, pagado: 0, interesPagado: 0 },
    ],
  }

  it('se reconoce que tiene tabla', () => {
    expect(tieneTablaAmortizacion(CON_TABLA)).toBe(true)
  })

  it('el capital pendiente es menor que el saldo, y ese es el que manda', () => {
    const capital = calcularCapitalRestante(CON_TABLA)
    expect(capital).toBeLessThan(calcularSaldoPendiente(CON_TABLA))
    expect(capital).toBeGreaterThan(0)
  })
})

describe('el código', () => {
  it('elige según tenga tabla o no', () => {
    expect(src, 'vuelve a usar el capital para todos')
      .toContain('const minimoRenovacion = tieneTablaAmortizacion(original) && capitalRestante != null')
    expect(src).toMatch(/\?\s*capitalRestante\s*\n\s*:\s*saldoPendiente/)
  })

  it('importa lo que usa', () => {
    // Una función sin importar pasa build y revienta al ejecutarse: ya pasó en
    // este proyecto con `formatFechaCalendario`.
    expect(src).toMatch(/tieneTablaAmortizacion,/)
  })

  it('el préstamo llega con su tabla', () => {
    // Sin `cuotasAmortizacion` en el `include`, `tieneTablaAmortizacion` diría
    // que no la tiene y se aplicaría la rama equivocada a TODOS.
    expect(src).toMatch(/cuotasAmortizacion: \{ select:/)
  })
})
