import { describe, it, expect, vi } from 'vitest'
import * as XLSX from 'xlsx'

vi.mock('@/lib/cartulina', () => ({ PROMPT_LOTE: '', procesarImagen: vi.fn(), normalizarCliente: (c) => c, escalaDeLaHoja: () => null }))

const { filaDeCartulina, marcarDudas, limpiarFila, conValidacion, resumenDe, enLaCalle } = await import('@/lib/carga-asesor/filas')
const { tipoDeArchivo, leerHojaDeCalculo } = await import('@/lib/carga-asesor/lector')

const libro = (hojas) => {
  const wb = XLSX.utils.book_new()
  for (const [nombre, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('filaDeCartulina', () => {
  it('saca el capital del total y la tasa, y «8 x 150» son 8 cuotas, no 8 días', () => {
    const f = filaDeCartulina({ nombre: 'Ana', totalAPagar: 1200000, numeroCuotas: 8, valorCuota: 150000, diasPlazo: 8, frecuencia: 'semanal' }, { archivo: 2, tasaPorDefecto: 20 })
    expect(f.montoPrestado).toBe(1000000)
    expect(f.numeroCuotas).toBe(8)
    expect(f.diasPlazo).toBe('')
    expect(f._archivo).toBe(2)
  })
  it('lo abonado y el saldo van a los campos del importador', () => {
    const f = filaDeCartulina({ nombre: 'Ana', montoPrestado: 500000, montoPagadoHasta: 100000, saldoPendiente: 500000 }, { archivo: 1 })
    expect(f.abonadoHasta).toBe(100000)
    expect(f.saldoActual).toBe(500000)
  })
  it('las dudas del lector de fotos se guardan como frase con lo que dice el papel', () => {
    const f = filaDeCartulina({ nombre: 'Ana', _dudas: [{ campo: 'monto', texto: '¿Son 14.500 o 14.500.000?', dato: '14500' }] }, { archivo: 1 })
    expect(f._dudas[0]).toContain('14.500')
    expect(f._dudas[0]).toContain('«14500»')
  })
})

describe('marcarDudas', () => {
  it('marca la misma cartulina fotografiada dos veces', () => {
    const r = marcarDudas([
      { nombre: 'Ana Ruiz', montoPrestado: 300000 },
      { nombre: 'Pedro', montoPrestado: 200000 },
      { nombre: 'Ana Ruiz', montoPrestado: 300000 },
    ])
    expect(r[2]._dudas).toContain('Repetida con la fila 1')
    expect(r[0]._dudas).toEqual([])
  })
  it('el mismo cliente con OTRO préstamo no es repetido', () => {
    const r = marcarDudas([{ nombre: 'Ana', cedula: '123', montoPrestado: 300000 }, { nombre: 'Ana', cedula: '123', montoPrestado: 500000 }])
    expect(r[1]._dudas).toEqual([])
  })
  it('montos raros y faltantes', () => {
    const r = marcarDudas([{ nombre: 'Ana', montoPrestado: 300 }, { nombre: '', montoPrestado: '' }])
    expect(r[0]._dudas.join()).toMatch(/faltan ceros/)
    expect(r[1]._dudas).toEqual(expect.arrayContaining(['Sin nombre', 'Sin monto']))
  })
})

describe('limpiarFila', () => {
  it('al importador no le llega ninguna marca', () => {
    expect(limpiarFila({ nombre: 'Ana', montoPrestado: 1, _archivo: 1, _dudas: ['x'], _estado: 'valido', vacio: '' })).toEqual({ nombre: 'Ana', montoPrestado: 1 })
  })
})

describe('resumen', () => {
  it('cuenta lo que se va a crear y lo que queda en la calle', () => {
    const filas = conValidacion(
      [{ nombre: 'A', montoPrestado: 100000 }, { nombre: 'B', montoPrestado: 200000 }, { nombre: 'C', montoPrestado: 50000 }],
      [{ estado: 'valido' }, { estado: 'advertencia', advertencias: ['x'] }, { estado: 'error', errores: ['y'] }],
    )
    const r = resumenDe(filas, { resumen: { clientesNuevos: 2, excedePlan: false } })
    expect(r).toMatchObject({ filas: 3, aCrear: 2, prestado: 300000, conError: 1, clientes: 2 })
    expect(enLaCalle([
      { estado: 'valido', datos: { tienePrestamo: true, montoPrestado: 100000, abonadoHasta: 20000 }, calculado: { totalAPagar: 120000 } },
      { estado: 'error', datos: { tienePrestamo: true, montoPrestado: 999999 } },
    ])).toBe(100000)
  })
})

describe('tipoDeArchivo', () => {
  it('por los bytes, no por la extensión', () => {
    expect(tipoDeArchivo(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), 'x.pdf').tipo).toBe('imagen')
    expect(tipoDeArchivo(Buffer.from('%PDF-1.4 xx'), 'foto.jpg').tipo).toBe('pdf')
    expect(tipoDeArchivo(libro({ H: [['a']] }), 'cartera').tipo).toBe('excel')
    expect(tipoDeArchivo(Buffer.from('nombre,monto\nAna,1'), 'cartera.csv').tipo).toBe('excel')
    expect(tipoDeArchivo(Buffer.from('hola mundo'), 'nota.docx')).toBeNull()
  })
})

describe('leerHojaDeCalculo', () => {
  it('lee TODAS las hojas, con el encabezado aunque no esté en la primera fila', () => {
    const buf = libro({
      'Ruta 1': [['CARTERA DE DON PEDRO'], ['Nombre', 'Cédula', 'Monto', 'Interés', 'Cuotas', 'Frecuencia', 'Fecha'], ['Ana', '123', '300000', '20', '24', 'diario', '2026-10-01']],
      'Ruta 2': [['Nombre', 'Cédula', 'Monto', 'Interés', 'Cuotas', 'Frecuencia', 'Fecha'], ['Luis', '456', '500000', '20', '4', 'semanal', '2026-10-02']],
    })
    const r = leerHojaDeCalculo(buf, { archivo: 3 })
    expect(r.filas.map((f) => f.nombre)).toEqual(['Ana', 'Luis'])
    expect(r.filas[0]).toMatchObject({ cedula: '123', _archivo: 3, _hoja: 'Ruta 1' })
    expect(r.filas[1]._hoja).toBe('Ruta 2')
  })
  it('la hoja que no entiende queda en fallos, sin inventar filas', () => {
    const r = leerHojaDeCalculo(libro({ Notas: [['Lo que me deben'], ['Ana me debe 300']] }), { archivo: 1 })
    expect(r.filas).toEqual([])
    expect(r.fallos[0]).toMatch(/Notas/)
  })
})
