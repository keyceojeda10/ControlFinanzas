// Los 12 meses del cliente (T15-01 · C10).
//
// Se prueba el CONTRATO con la barra que lo consume: doce entradas, en orden,
// con `cumplio` de 0 a 100 o `null`, y su estado. Y sobre todo las decisiones
// que pueden mentirle a un prestamista: el mes sin préstamo, el que pagó de
// más, y el descuento de los días sin cobro.

import { describe, it, expect } from 'vitest'
import {
  mesesDe, diasCobrablesEnMes, esperadoDelMes,
  estadoDe, comportamiento12Meses, lecturaDe,
} from '../comportamiento'

const HASTA = new Date(Date.UTC(2026, 7, 15)) // 15 ago 2026

describe('mesesDe', () => {
  it('devuelve doce, del más viejo al más nuevo, acabando en el mes pedido', () => {
    const m = mesesDe(HASTA)
    expect(m).toHaveLength(12)
    expect(m[11].mes).toBe(7)          // agosto
    expect(m[11].anio).toBe(2026)
    expect(m[0].mes).toBe(8)           // septiembre del año anterior
    expect(m[0].anio).toBe(2025)
  })

  it('el mes EN CURSO se corta hoy: lo que no ha vencido no puede contar como fallado', () => {
    // Medido con datos reales: el 1 de agosto la barra pedia el mes entero y el
    // cliente salia «cumpliendo el 1%» por llevar un dia.
    const [ago] = mesesDe(new Date(Date.UTC(2026, 7, 3, 12))).slice(-1)
    expect(ago.hasta.getUTCDate()).toBe(3)
    expect(ago.hasta.getUTCMonth()).toBe(7)
  })

  it('un mes YA PASADO llega a su último día, y febrero no se confunde', () => {
    // Referencia en abril, así febrero es pasado y sí debe llegar al 28. Con la
    // referencia dentro de febrero se cortaría hoy, que es lo correcto para el
    // mes en curso y lo comprueba la prueba de arriba.
    const meses = mesesDe(new Date(Date.UTC(2026, 3, 10)))
    const feb = meses.find((m) => m.mes === 1 && m.anio === 2026)
    expect(feb.hasta.getUTCDate()).toBe(28)
  })
})

describe('diasCobrablesEnMes', () => {
  const mes = { desde: new Date(Date.UTC(2026, 6, 1)), hasta: new Date(Date.UTC(2026, 6, 31, 23, 59, 59)) }
  const prestamo = { fechaInicio: new Date(Date.UTC(2026, 0, 1)) }

  it('cuenta el mes entero cuando el préstamo lleva tiempo abierto', () => {
    expect(diasCobrablesEnMes(mes, prestamo)).toBe(31)
  })

  it('descuenta los domingos cuando la organización no cobra ese día', () => {
    // Julio de 2026 tiene 4 domingos.
    expect(diasCobrablesEnMes(mes, prestamo, ['domingo'])).toBe(27)
  })

  it('no cuenta los días anteriores al préstamo', () => {
    const nuevo = { fechaInicio: new Date(Date.UTC(2026, 6, 20)) }
    expect(diasCobrablesEnMes(mes, nuevo)).toBe(12)  // del 20 al 31
  })

  it('no cuenta los días posteriores al cierre', () => {
    const cerrado = { fechaInicio: new Date(Date.UTC(2026, 0, 1)), fechaCierre: new Date(Date.UTC(2026, 6, 10)) }
    expect(diasCobrablesEnMes(mes, cerrado)).toBe(10)
  })

  it('un préstamo que no existía ese mes no aporta días', () => {
    const futuro = { fechaInicio: new Date(Date.UTC(2026, 9, 1)) }
    expect(diasCobrablesEnMes(mes, futuro)).toBe(0)
  })
})

describe('esperadoDelMes', () => {
  const mes = { desde: new Date(Date.UTC(2026, 6, 1)), hasta: new Date(Date.UTC(2026, 6, 31, 23, 59, 59)) }

  it('diario: cuota por día cobrable', () => {
    const p = { fechaInicio: new Date(Date.UTC(2026, 0, 1)), cuotaDiaria: 10_000, frecuencia: 'diario' }
    expect(esperadoDelMes(mes, p, ['domingo'])).toBe(270_000)  // 27 × 10.000
  })

  it('semanal: los días sin cobro NO cambian la cuota semanal', () => {
    const p = { fechaInicio: new Date(Date.UTC(2026, 0, 1)), cuotaDiaria: 70_000, frecuencia: 'semanal' }
    // 31 días ÷ 7 = 4 cobros, con o sin domingos marcados.
    expect(esperadoDelMes(mes, p, [])).toBe(280_000)
    expect(esperadoDelMes(mes, p, ['domingo'])).toBe(280_000)
  })

  it('sin cuota no se puede esperar nada', () => {
    const p = { fechaInicio: new Date(Date.UTC(2026, 0, 1)), cuotaDiaria: 0, frecuencia: 'diario' }
    expect(esperadoDelMes(mes, p)).toBe(0)
  })
})

describe('estadoDe', () => {
  it('reparte los tres estados por sus cortes', () => {
    expect(estadoDe(100)).toBe('bien')
    expect(estadoDe(90)).toBe('bien')
    expect(estadoDe(89)).toBe('tarde')
    expect(estadoDe(60)).toBe('tarde')
    expect(estadoDe(59)).toBe('mal')
    expect(estadoDe(null)).toBe('sin')
  })
})

describe('comportamiento12Meses', () => {
  const prestamo = {
    fechaInicio: new Date(Date.UTC(2026, 6, 1)),
    cuotaDiaria: 10_000,
    frecuencia: 'diario',
  }

  it('un mes SIN préstamo da null, no 0% — o pintaría de moroso a quien no debía nada', () => {
    const r = comportamiento12Meses({ prestamos: [prestamo], pagos: [], hasta: HASTA })
    const enero = r[4]   // enero 2026, antes del préstamo
    expect(enero.esperado).toBe(0)
    expect(enero.cumplio).toBeNull()
    expect(enero.estado).toBe('sin')
  })

  it('pagando todo lo del mes sale 100', () => {
    const pagos = [{ fechaPago: new Date(Date.UTC(2026, 6, 15)), montoPagado: 310_000 }]
    const r = comportamiento12Meses({ prestamos: [prestamo], pagos, hasta: HASTA })
    const julio = r[10]
    expect(julio.esperado).toBe(310_000)   // 31 días × 10.000
    expect(julio.cumplio).toBe(100)
    expect(julio.estado).toBe('bien')
  })

  it('pagar DE MÁS se recorta a 100: adelantarse no es cumplir el 200%', () => {
    const pagos = [{ fechaPago: new Date(Date.UTC(2026, 6, 15)), montoPagado: 620_000 }]
    const r = comportamiento12Meses({ prestamos: [prestamo], pagos, hasta: HASTA })
    expect(r[10].cumplio).toBe(100)
  })

  it('pagando la mitad sale 50 y queda en mal', () => {
    const pagos = [{ fechaPago: new Date(Date.UTC(2026, 6, 10)), montoPagado: 155_000 }]
    const r = comportamiento12Meses({ prestamos: [prestamo], pagos, hasta: HASTA })
    expect(r[10].cumplio).toBe(50)
    expect(r[10].estado).toBe('mal')
  })

  it('los pagos de OTRO mes no cuentan en éste', () => {
    const pagos = [{ fechaPago: new Date(Date.UTC(2026, 5, 20)), montoPagado: 310_000 }]
    const r = comportamiento12Meses({ prestamos: [prestamo], pagos, hasta: HASTA })
    expect(r[10].pagado).toBe(0)
  })

  it('devuelve siempre doce', () => {
    expect(comportamiento12Meses({ hasta: HASTA })).toHaveLength(12)
  })
})

describe('lecturaDe', () => {
  const mes = (cumplio, etiqueta = 'J') => ({ cumplio, etiqueta, estado: estadoDe(cumplio) })

  it('sin historial suficiente lo dice, en vez de inventar una tendencia', () => {
    expect(lecturaDe([mes(100), mes(null)])).toContain('Todavía no hay historial')
  })

  it('caída marcada: avisa de que venía cumpliendo', () => {
    const meses = [...Array(6).fill(mes(100)), mes(40), mes(30), mes(20)]
    expect(lecturaDe(meses)).toContain('viene fallando')
  })

  it('recuperación: lo dice al revés', () => {
    const meses = [...Array(6).fill(mes(30)), mes(95), mes(98), mes(100)]
    expect(lecturaDe(meses)).toContain('al día')
  })

  it('estable y bueno', () => {
    expect(lecturaDe(Array(9).fill(mes(97)))).toBe('Cumple mes a mes.')
  })
})
