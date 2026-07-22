import { describe, it, expect } from 'vitest'
import { parsearNumero, detectarColumnas, validarFila } from '../carga-masiva'

describe('parsearNumero — separadores de miles', () => {
  // El bug que motivo estos tests: replace(',', '.') convertia "500,000" en
  // "500.000" -> 500. El prestamista subia su cartera y veia montos mil veces
  // mas chicos. Sale asi al exportar de Google Sheets o de apps en locale US.
  it('coma como separador de miles (formato US)', () => {
    expect(parsearNumero('500,000')).toBe(500000)
    expect(parsearNumero('1,500,000')).toBe(1500000)
    expect(parsearNumero('12,000')).toBe(12000)
  })

  it('punto como separador de miles (formato colombiano)', () => {
    expect(parsearNumero('500.000')).toBe(500000)
    expect(parsearNumero('1.500.000')).toBe(1500000)
  })

  it('los dos separadores: el ultimo es el decimal', () => {
    expect(parsearNumero('1.500,50')).toBe(1500.5)
    expect(parsearNumero('1,500.50')).toBe(1500.5)
  })

  it('decimal solo, sin miles', () => {
    expect(parsearNumero('1.5')).toBe(1.5)
    expect(parsearNumero('1,5')).toBe(1.5)
    expect(parsearNumero('0,75')).toBe(0.75)
  })

  it('limpia simbolos de moneda y espacios', () => {
    expect(parsearNumero('$ 500.000')).toBe(500000)
    expect(parsearNumero('COP 1,200,000')).toBe(1200000)
  })

  it('negativos, incluida la notacion contable', () => {
    expect(parsearNumero('-500.000')).toBe(-500000)
    expect(parsearNumero('(1.200)')).toBe(-1200)
  })

  it('vacios y basura dan 0', () => {
    expect(parsearNumero('')).toBe(0)
    expect(parsearNumero(null)).toBe(0)
    expect(parsearNumero(undefined)).toBe(0)
    expect(parsearNumero('abc')).toBe(0)
  })

  it('numeros nativos pasan tal cual', () => {
    expect(parsearNumero(500000)).toBe(500000)
    expect(parsearNumero(0)).toBe(0)
  })
})

describe('cuotas vs dias de plazo', () => {
  it('separa las columnas de cuotas de las de dias', () => {
    const { mapeo } = detectarColumnas(['Nombre', 'Cuotas', 'Monto'])
    expect(mapeo['Cuotas']).toBe('numeroCuotas')

    const otro = detectarColumnas(['Nombre', 'Dias plazo', 'Monto'])
    expect(otro.mapeo['Dias plazo']).toBe('diasPlazo')
  })

  it('convierte cuotas a dias segun la frecuencia', () => {
    // 20 cuotas semanales son 140 dias. Antes se pasaban 20 dias directo y
    // calcularPrestamo hacia ceil(20/7) = 3 cuotas.
    const fila = {
      nombre: 'Juan Perez', cedula: '123456789',
      montoPrestado: '1.000.000', tasaInteres: '20',
      numeroCuotas: '20', frecuencia: 'semanal',
      fechaInicio: '01/07/2026',
    }
    const r = validarFila(fila, 0, new Map())
    expect(r.datos.diasPlazo).toBe(140)
  })

  it('para cobro diario cuotas y dias coinciden', () => {
    const fila = {
      nombre: 'Ana Gomez', cedula: '987654321',
      montoPrestado: '500.000', tasaInteres: '20',
      numeroCuotas: '30', frecuencia: 'diario',
      fechaInicio: '01/07/2026',
    }
    expect(validarFila(fila, 0, new Map()).datos.diasPlazo).toBe(30)
  })

  it('si vienen dias explicitos, mandan sobre las cuotas', () => {
    const fila = {
      nombre: 'Luis Diaz', cedula: '111222333',
      montoPrestado: '800.000', tasaInteres: '15',
      diasPlazo: '90', numeroCuotas: '12', frecuencia: 'mensual',
      fechaInicio: '01/07/2026',
    }
    expect(validarFila(fila, 0, new Map()).datos.diasPlazo).toBe(90)
  })
})
