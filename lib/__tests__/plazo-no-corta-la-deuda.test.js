import { describe, it, expect } from 'vitest'
import { calcularPrestamo, calcularProximoCobro, tieneCobroPendienteHoy } from '@/lib/calculos'

// El plazo dejo de ser un TOPE: un prestamo se cobra hasta que se paga la deuda.
//
// Antes, `totalPeriodos = porPlazo || porMonto` hacia que al cumplirse el plazo
// el prestamo desapareciera de los cobros aunque quedara saldo. Medido en
// produccion: 252 prestamos activos, $47M; 11 ya habian pasado el corte.
// La causa principal (190 de 252) es el RECARGO, que sube totalAPagar sin tocar
// el plazo ni la cuota.

const haceDias = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Date(`${d.toISOString().slice(0, 10)}T05:00:00.000Z`)
}

describe('para un prestamo sano no cambia nada', () => {
  // La garantia mas importante: si la cuota sale de repartir el total entre los
  // periodos del plazo, los dos numeros coinciden y el comportamiento es identico.
  for (const freq of ['diario', 'semanal', 'quincenal', 'mensual']) {
    for (const modo of ['fijo', 'unico']) {
      it(`${modo} / ${freq}: el plazo y el dinero dan los mismos cobros`, () => {
        const r = calcularPrestamo({
          montoPrestado: 1000000, tasaInteres: 10, diasPlazo: 180,
          fechaInicio: '2026-01-05', frecuencia: freq, modoInteres: modo,
        })
        const porPlazo = r.numPeriodos
        const porMonto = Math.ceil(r.totalAPagar / r.cuotaDiaria)
        expect(porMonto, `${modo}/${freq}`).toBe(porPlazo)
      })
    }
  }
})

describe('con recargo, el prestamo sigue cobrandose hasta saldar', () => {
  // Prestamo diario de 30 cobros de $4.000 ($120.000). Se le suma un recargo de
  // $20.000: ahora debe $140.000, o sea 35 cobros. El plazo sigue diciendo 30.
  const conRecargo = {
    estado: 'activo',
    frecuencia: 'diario',
    fechaInicio: haceDias(60),
    cuotaDiaria: 4000,
    diasPlazo: 30,
    totalAPagar: 140000,   // 120.000 + recargo de 20.000
  }

  it('al cubrir los 30 cobros del plazo NO se apaga: aun debe $20.000', () => {
    const pagados30 = { ...conRecargo, totalPagado: 120000 }
    expect(calcularProximoCobro(pagados30, [], [])).not.toBeNull()
    expect(tieneCobroPendienteHoy(pagados30, [], [])).toBe(true)
  })

  it('se apaga recien cuando la deuda queda en cero', () => {
    const saldado = { ...conRecargo, totalPagado: 140000 }
    expect(tieneCobroPendienteHoy(saldado, [], [])).toBe(false)
  })

  it('sin recargo, el mismo prestamo se comporta igual que siempre', () => {
    const sinRecargo = { ...conRecargo, totalAPagar: 120000, totalPagado: 120000 }
    expect(tieneCobroPendienteHoy(sinRecargo, [], [])).toBe(false)
  })
})

describe('no cobra de mas', () => {
  it('un descuento que baja el total no alarga el prestamo', () => {
    // plazo de 30 cobros, pero tras un descuento solo debe 20 cuotas
    const conDescuento = {
      estado: 'activo', frecuencia: 'diario', fechaInicio: haceDias(60),
      cuotaDiaria: 4000, diasPlazo: 30, totalAPagar: 80000, totalPagado: 80000,
    }
    // Lo que manda en la ruta y en los cobros del dia: no queda nada pendiente.
    expect(tieneCobroPendienteHoy(conDescuento, [], [])).toBe(false)
    // Nota: calcularProximoCobro no mira el saldo, solo los periodos cubiertos
    // contra el total de periodos. Con el plazo (30) mayor a los cobros que exige
    // el dinero (20), devuelve una fecha aunque ya este saldado. Es asi desde
    // antes de este cambio (`porPlazo || porMonto` tambien daba 30) y no lo
    // altera: en la practica el prestamo pasa a 'completado' al llegar a saldo
    // cero y ahi si devuelve null. Se deja fijado para que se note si cambia.
    expect(calcularProximoCobro(conDescuento, [], [])).not.toBeNull()
    expect(calcularProximoCobro({ ...conDescuento, estado: 'completado' }, [], [])).toBeNull()
  })

  it('un prestamo ya completado no pide cobros', () => {
    const completado = {
      estado: 'completado', frecuencia: 'diario', fechaInicio: haceDias(60),
      cuotaDiaria: 4000, diasPlazo: 30, totalAPagar: 140000, totalPagado: 140000,
    }
    expect(calcularProximoCobro(completado, [], [])).toBeNull()
    expect(tieneCobroPendienteHoy(completado, [], [])).toBe(false)
  })
})
