import { describe, it, expect } from 'vitest'
import { validarFila } from '@/lib/carga-masiva'

/* 24 sep 2026. El «Reporte general de créditos activos» de la otra app pone en
   «Valor cuota» LO QUE FALTA cuando al préstamo le queda menos de una cuota. Las
   cifras son las de las 4 filas reales del archivo de ese negocio (nombres
   inventados). En las 81 restantes, cuota × cuotas = capital con el interés. */
const fila = (x) => ({
  nombre: 'Cliente de prueba', cedula: String(x.id), fechaInicio: x.fecha,
  montoPrestado: x.capital, tasaInteres: 20, valorCuota: x.cuota,
  frecuencia: x.frec, numeroCuotas: x.cuotas, saldoActual: x.saldo,
})

describe('la «cuota» que en realidad es lo que falta por pagar', () => {
  it('Leandro: 30 diarias de $16.000, no 40 de $12.000 (el plazo y el vencimiento son los del archivo)', () => {
    const r = validarFila(fila({ id: 419, fecha: '2026-08-01', capital: '400.000', cuota: 12000, frec: 'diario', cuotas: 30, saldo: '12.000' }), 0, new Map())
    expect(r.estado).toBe('advertencia')
    expect(r.errores).toEqual([])
    expect(r.datos.valorCuota).toBe(16000)
    expect(r.calculado.totalAPagar).toBe(480000)
    expect(r.datos.abonadoHasta).toBe(468000)
    expect(r.correccion).toBeNull()
    expect(r.advertencias.join(' ')).toMatch(/30 cuotas de \$16\.000/)
  })

  it('Breiner: 4 semanales de $90.000', () => {
    const r = validarFila(fila({ id: 469, fecha: '2026-08-28', capital: '300.000', cuota: 60000, frec: 'semanal', cuotas: 4, saldo: '60.000' }), 0, new Map())
    expect(r.errores).toEqual([])
    expect(r.datos.valorCuota).toBe(90000)
    expect(r.calculado.totalAPagar).toBe(360000)
    expect(r.datos.abonadoHasta).toBe(300000)
  })

  it('la que entraba CALLADA con $60.000 de menos (cuota × cuotas = el capital justo)', () => {
    const r = validarFila(fila({ id: 420, fecha: '2026-08-01', capital: '300.000', cuota: 10000, frec: 'diario', cuotas: 30, saldo: '10.000' }), 0, new Map())
    expect(r.datos.valorCuota).toBe(12000)
    expect(r.calculado.totalAPagar).toBe(360000)
    expect(r.datos.abonadoHasta).toBe(350000)
  })

  it('la de una sola cuota que entraba con $30.000 de menos', () => {
    const r = validarFila(fila({ id: 501, fecha: '2026-09-20', capital: '1.000.000', cuota: 1170000, frec: 'diario', cuotas: 1, saldo: '1.170.000' }), 0, new Map())
    expect(r.datos.valorCuota).toBe(1200000)
    expect(r.calculado.totalAPagar).toBe(1200000)
    expect(r.datos.abonadoHasta).toBe(30000)
  })

  it('una fila que cuadra NO se toca, aunque le quede justo una cuota', () => {
    const r = validarFila(fila({ id: 1, fecha: '2026-08-01', capital: '400.000', cuota: 16000, frec: 'diario', cuotas: 30, saldo: '16.000' }), 0, new Map())
    expect(r.datos.valorCuota).toBe(16000)
    expect(r.advertencias.join(' ')).not.toMatch(/Valor cuota/)
  })

  it('si el saldo es una cuota ENTERA de otra tasa (interés mensual), no se inventa una cuota menor', () => {
    // 1.000.000, cuota real 100.000 × 13 = 1.300.000 en su app; con «10 %» plano saldrían 84.616.
    const r = validarFila({ ...fila({ id: 2, fecha: '2026-08-01', capital: '1.000.000', cuota: 100000, frec: 'semanal', cuotas: 13, saldo: '100.000' }), tasaInteres: 10 }, 0, new Map())
    expect(r.datos.valorCuota).toBe(100000)
  })

  it('sin saldo en el archivo no hay de dónde saberlo: se queda la regla de antes', () => {
    const r = validarFila({ ...fila({ id: 419, fecha: '2026-08-01', capital: '400.000', cuota: 12000, frec: 'diario', cuotas: 30, saldo: '' }) }, 0, new Map())
    expect(r.estado).toBe('error')
  })
})
