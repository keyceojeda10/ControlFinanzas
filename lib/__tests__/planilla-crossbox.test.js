import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { leerPlanillaCrossbox, fechaCrossbox } from '@/lib/importar/planilla-crossbox'

const paginas = JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8'))

describe('las fechas de la planilla', () => {
  it('«22 Sep 26», «24 Sep 2026», meses en español y en inglés', () => {
    expect(fechaCrossbox('22 Sep 26')).toBe('2026-09-22')
    expect(fechaCrossbox('24 Sep 2026')).toBe('2026-09-24')
    expect(fechaCrossbox('31 Ago 26')).toBe('2026-08-31')
    expect(fechaCrossbox('05 Dic 26')).toBe('2026-12-05')
    expect(fechaCrossbox('05 Dec 26')).toBe('2026-12-05')
    expect(fechaCrossbox('Nunca')).toBeNull()
  })
})

describe('la planilla real (anonimizada)', () => {
  const r = leerPlanillaCrossbox(paginas)
  it('lee las 49 filas, la fecha de corte y la ruta, y cuadra al peso con «Totales»', () => {
    expect(r.formato).toBe('crossbox-planilla')
    expect(r.fechaCorte).toBe('2026-09-24')
    expect(r.ruta).toBe('RUTA 1')
    expect(r.filas).toHaveLength(49)
    expect(r.totales).toEqual({ credito: 39606000, saldo: 44503400, cuota: 2869668 })
    expect(r.suma).toEqual({ credito: 39606000, saldo: 44503400 })
    expect(r.cuadraConTotales).toBe(true)
  })
  it('cada fila con sus campos', () => {
    expect(r.filas[0]).toEqual({
      filaPlanilla: 1, nombre: 'Cliente 1', telefono: '3000000001', fechaInicio: '2026-09-22',
      ultimoAbono: null, sinAbonos: true, montoPrestado: 150000, saldoActual: 180000, valorCuota: 180000,
      atrasadas: 0, vencidos: 0, fechaCorte: '2026-09-24',
    })
    expect(r.filas[1]).toMatchObject({ filaPlanilla: 2, ultimoAbono: '2026-09-23', sinAbonos: false, valorCuota: 20000 })
    expect(r.filas.find((f) => f.filaPlanilla === 15).nombre).toBe('Cliente 15 Semanal')
    expect(r.filas.find((f) => f.filaPlanilla === 37).atrasadas).toBe(-48)
  })
  it('si falta una fila (una página que no se leyó), NO cuadra', () => {
    // Se quita la fila 7 ENTERA (todas las piezas a su altura), como si no se hubiera leído.
    const sinUna = paginas.map((pg) => {
      const nombre = pg.find((pz) => pz.str === 'Cliente 7')
      return nombre ? pg.filter((pz) => Math.abs(pz.y - nombre.y) > 3) : pg
    })
    const incompleta = leerPlanillaCrossbox(sinUna)
    expect(incompleta.filas).toHaveLength(48)
    expect(incompleta.cuadraConTotales).toBe(false)
  })
})

describe('lo que no es la planilla', () => {
  it('otro PDF da null', () => {
    expect(leerPlanillaCrossbox([[{ str: 'Factura de venta', x: 40, y: 700 }, { str: 'Total $10.000', x: 40, y: 680 }]])).toBeNull()
    expect(leerPlanillaCrossbox([])).toBeNull()
  })
  it('nombre partido en dos piezas y fila sin teléfono', () => {
    const cab = [
      { str: 'Planilla Recaudador', x: 44, y: 458 }, { str: 'Fecha:', x: 640, y: 460 }, { str: '24 Sep 2026', x: 671, y: 460 },
      { str: 'Ruta:', x: 742, y: 460 }, { str: 'RUTA 2', x: 766, y: 460 },
      { str: 'Crédito', x: 494, y: 395 }, { str: 'Saldo', x: 590, y: 395 }, { str: 'Cuota', x: 673, y: 395 }, { str: 'Atrasadas', x: 707, y: 395 },
      { str: 'Totales', x: 66, y: 378 }, { str: '$500,000.00', x: 455, y: 378 }, { str: '$600,000.00', x: 544, y: 378 }, { str: '$40,000.00', x: 632, y: 378 },
    ]
    const fila = (y, piezas) => piezas.map(([str, x]) => ({ str, x, y }))
    const pg = [
      ...cab,
      ...fila(357, [['1', 45], ['01 Sep 26', 66], ['Nunca', 126], ['Ana María', 185], ['de la Hoz', 230], ['300 111 2233', 374], ['$300,000.00', 470], ['$360,000.00', 559], ['$15,000.00', 647], ['3', 743], ['0', 793]]),
      ...fila(336, [['2', 45], ['02 Sep 26', 66], ['20 Sep 26', 126], ['Pedro', 185], ['$200,000.00', 470], ['$240,000.00', 559], ['$25,000.00', 647], ['0', 743], ['0', 793]]),
    ]
    const r = leerPlanillaCrossbox([pg])
    expect(r.ruta).toBe('RUTA 2')
    expect(r.filas[0]).toMatchObject({ nombre: 'Ana María de la Hoz', telefono: '3001112233', sinAbonos: true })
    expect(r.filas[1]).toMatchObject({ nombre: 'Pedro', telefono: '', ultimoAbono: '2026-09-20' })
    expect(r.cuadraConTotales).toBe(true)
  })
})
