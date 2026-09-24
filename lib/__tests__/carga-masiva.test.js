import { describe, it, expect } from 'vitest'
import { parsearNumero, detectarColumnas, validarFila, corregirMapeoConDatos, aplicarMapeo } from '../carga-masiva'

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

// El flujo ENTERO, como lo hace la pantalla: detectar columnas, corregirlas con
// los datos, aplicar el mapeo y validar. Las pruebas de arriba llaman a
// validarFila con `numeroCuotas` ya puesto y por eso pasaban en verde mientras
// aplicarMapeo tiraba esa columna a la basura: desde el 21 jul, TODO archivo con
// cuotas en vez de dias fallaba entero con "Plazo en dias (o numero de cuotas)
// debe ser mayor a 0". Un cliente lo reporto el 23 sep con 85 de 85 filas en error.
describe('archivo exportado de otra app de prestamos (cabeceras reales, datos inventados)', () => {
  const headers = [
    'ID crédito', 'ID cliente', 'Nombre', 'Telefono', 'Dirección', 'Fecha', 'Capital',
    'Interés', 'Valor cuota', 'Plazo', 'Cantidad cuotas', 'Vencimiento',
    'Cuotas pagadas', 'Cuotas pendientes', 'Saldo actual', 'Manejo',
  ]
  const fila = (id, capital, cuota, saldo) => ({
    'ID crédito': id + 100, 'ID cliente': id, 'Nombre': `Cliente ${id}`, 'Telefono': '3000000000',
    'Dirección': 'Barrio de prueba', 'Fecha': '2026-02-13', 'Capital': capital, 'Interés': 20,
    'Valor cuota': cuota, 'Plazo': 'diario', 'Cantidad cuotas': 30, 'Vencimiento': '19 de Marzo de 2026',
    'Cuotas pagadas': '0.00', 'Cuotas pendientes': '30.00', 'Saldo actual': saldo, 'Manejo': 'vencido',
  })
  const filas = [fila(50, '1.070.000', 42800, '1.284.000'), fila(119, '300.000', 12000, '50.000')]

  const mapear = () => corregirMapeoConDatos(detectarColumnas(headers).mapeo, filas)

  it('la cantidad de cuotas va a cuotas y el valor de la cuota a su propio campo', () => {
    const mapeo = mapear()
    expect(mapeo['Cantidad cuotas']).toBe('numeroCuotas')
    expect(mapeo['Plazo']).toBe('frecuencia')
    // "Valor cuota" es plata (42.800), no un numero de cuotas.
    expect(mapeo['Valor cuota']).toBe('valorCuota')
    expect(Object.values(mapeo).filter(c => c === 'numeroCuotas')).toHaveLength(1)
    // Los conteos parciales no son ni el plazo ni la cuota.
    expect(mapeo['Cuotas pagadas']).toBeUndefined()
    expect(mapeo['Cuotas pendientes']).toBeUndefined()
  })

  it('aplicarMapeo conserva las cuotas', () => {
    const [primera] = aplicarMapeo(filas, mapear())
    expect(primera.numeroCuotas).toBe(30)
  })

  it('las filas salen validas, con 30 dias y el abono previo desde el saldo', () => {
    const [a, b] = aplicarMapeo(filas, mapear()).map((f, i) => validarFila(f, i, new Map()))
    expect(a.errores).toEqual([])
    expect(a.datos.diasPlazo).toBe(30)
    expect(a.datos.frecuencia).toBe('diario')
    expect(a.datos.montoPrestado).toBe(1070000)
    // 1.070.000 al 20 % = 1.284.000; debe 1.284.000 -> no ha abonado nada.
    expect(a.datos.abonadoHasta).toBe(0)
    expect(b.errores).toEqual([])
    // 300.000 al 20 % = 360.000; debe 50.000 -> ya abono 310.000.
    expect(b.datos.abonadoHasta).toBe(310000)
  })

  // Lo que pidio el dueño el 23 sep: el total, al peso el de la app de donde
  // viene. En 'fijo' el 20 % se alarga con el plazo: 40 cuotas = 26,7 %.
  it('con valor de cuota manda la cuota: 1.000.000 en 40 cuotas de 30.000 son 1.200.000', () => {
    const f = { ...fila(7, '1.000.000', 30000, '1.200.000'), 'Cantidad cuotas': 40 }
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.errores).toEqual([])
    expect(r.calculado.cuotaDiaria).toBe(30000)
    expect(r.calculado.numPeriodos).toBe(40)
    expect(r.calculado.totalAPagar).toBe(1200000)
    expect(r.calculado.modoInteres).toBe('manual')
  })

  it('la cuota no se redondea: 30 cuotas de 21.333 son 639.990, no 642.000', () => {
    const f = { ...fila(9, '500.000', 21333, '639.990'), 'Interés': 28 }
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.calculado.totalAPagar).toBe(639990)
  })

  // Alargar el plazo inflaria el abono previo (total - saldo), que entra a la
  // caja como recaudo. 400.000 prestados y 30 cuotas de 12.000 = 360.000: la
  // fila se para para que el prestamista la mire.
  it('si cuota x cuotas no cubre el capital, la fila se para', () => {
    const f = fila(24, '400.000', 12000, '100.000')
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.estado).toBe('error')
    expect(r.errores[0]).toContain('cobraria menos de lo prestado')
    expect(r.calculado).toBeNull()
  })

  it('con «Valor cuota» igual al saldo (le queda menos de una cuota) se usa la cuota real', () => {
    const f = fila(24, '400.000', 12000, '12.000')
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.errores).toEqual([])
    expect(r.datos.valorCuota).toBe(16000)
    expect(r.calculado.totalAPagar).toBe(480000)
  })

  it('un redondeo de la otra app (menos de 1 peso por cuota) sube la cuota 1 peso', () => {
    const f = { ...fila(81, '400.000', 11764, '364.000'), 'Cantidad cuotas': 34 }
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.errores).toEqual([])
    expect(r.calculado.numPeriodos).toBe(34)
    expect(r.calculado.cuotaDiaria).toBe(11765)
    expect(r.datos.valorCuota).toBe(11765)
    expect(r.advertencias.some(a => a.includes('por redondeo'))).toBe(true)
  })

  it('una cuota absurda frente al capital para la fila (columna mal asignada)', () => {
    const f = fila(1, '1.000.000', 3, '1.000.000')
    const [r] = aplicarMapeo([f], mapear()).map((x, i) => validarFila(x, i, new Map()))
    expect(r.estado).toBe('error')
    expect(r.errores[0]).toContain('no cuadra con el capital')
  })

  it('sin valor de cuota sigue el interes fijo de siempre', () => {
    const r = validarFila({
      nombre: 'Cliente', cedula: '1', montoPrestado: '1.000.000', tasaInteres: '20',
      numeroCuotas: '40', frecuencia: 'diario', fechaInicio: '2026-02-13',
    }, 0, new Map())
    expect(r.calculado.modoInteres).toBe('fijo')
    expect(r.calculado.totalAPagar).toBe(1268000)
  })

  it('una columna asignada a mano a cuotas tambien llega', () => {
    const [f] = aplicarMapeo([{ 'Nombre': 'Cliente 1', 'Cuotas': '24' }], { 'Nombre': 'nombre', 'Cuotas': 'numeroCuotas' })
    expect(f.numeroCuotas).toBe('24')
  })
})
