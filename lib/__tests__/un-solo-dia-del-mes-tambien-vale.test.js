/* Basta con uno de los dos días de cobro, venga en el campo que venga.
 *
 * ══ LO QUE PASÓ ════════════════════════════════════════════════════════════
 *
 * El 27 de agosto se arregló que el quincenal con días del mes iba corrido un
 * cobro. Al día siguiente el mismo prestamista seguía reportando lo mismo:
 *
 *   «Yo le digo al sistema la primer cuota es tal día y él asigna otra.»
 *
 * No era caché. La pantalla deja rellenar «Segundo cobro» y dejar «Primer
 * cobro» vacío, y así se guardaba: `diaCobroMes: null, diaCobroMes2: 15`. El
 * calendario exigía el PRIMERO, así que ignoraba el 15 y el préstamo volvía al
 * cálculo viejo de «entrega + 15 días» — asignando otra fecha.
 *
 * MEDIDO EN PRODUCCIÓN el 28 ago 2026: 5 préstamos vivos en 2 negocios
 * guardados con esa forma, uno de ellos el que él reportó. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fechaDePeriodo } from '@/lib/dinero/calendario'
import { calcularProximoCobro } from '@/lib/calculos'

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const INICIO = new Date('2026-08-06T05:00:00.000Z')

const calendario = (diaCobroMes, diaCobroMes2, n = 3) =>
  [...Array(n)].map((_, i) => dia(fechaDePeriodo(i + 1, {
    fechaInicio: INICIO, freq: 'quincenal', diasPeriodo: 15, diaCobroMes, diaCobroMes2,
  })))

const prestamo = (diaCobroMes, diaCobroMes2) => ({
  montoPrestado: 600000, totalAPagar: 840000, cuotaDiaria: 210000, totalPagado: 0,
  estado: 'activo', frecuencia: 'quincenal', modoInteres: 'fijo', diasPlazo: 60,
  fechaInicio: INICIO, diaCobroMes, diaCobroMes2, pagos: [], cuotasAmortizacion: [],
})

describe('basta con uno de los dos días de cobro', () => {
  it('⚠ solo el SEGUNDO campo relleno vale igual que solo el primero', () => {
    // Es la forma en que quedó guardado el préstamo que él reportó.
    expect(calendario(null, 15)).toEqual(calendario(15, null))
  })

  it('y el próximo cobro también', () => {
    expect(dia(calcularProximoCobro(prestamo(null, 15))))
      .toBe(dia(calcularProximoCobro(prestamo(15, null))))
  })

  it('⚠ con solo el segundo, NO vuelve al calendario viejo', () => {
    /* El viejo era «entrega + 15 días»: prestando el 6 de agosto daba el 21.
       Con el día 15 puesto, la primera tiene que ser el 15. */
    expect(calendario(null, 15)[0]).toBe('2026-08-15')
    expect(calendario(null, 15)[0]).not.toBe('2026-08-21')
  })

  it('el orden de los dos días da igual', () => {
    // «Cobro el 30 y el 15» es el mismo calendario que «el 15 y el 30».
    expect(calendario(30, 15)).toEqual(calendario(15, 30))
  })

  it('con los dos días, cobra dos veces al mes', () => {
    expect(calendario(15, 30)).toEqual(['2026-08-15', '2026-08-30', '2026-09-15'])
  })

  it('⚠ con un solo día, un quincenal cobra UNA VEZ AL MES', () => {
    /* No es un fallo: es lo que significa poner un solo día. Se fija aquí para
       que quede escrito, y por eso la pantalla ahora enseña las fechas también
       cuando solo hay un campo relleno — verlo es lo que evita crearlo mal. */
    expect(calendario(15, null)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15'])
  })

  it('el API guarda un solo día SIEMPRE en el primero', () => {
    // Para que no vuelva a entrar torcido: un segundo sin primero no significa nada.
    const ruta = readFileSync('app/api/prestamos/route.js', 'utf8')
    expect(ruta).toMatch(/diaCobroMesDb = dias\[0\] \?\? null/)
    expect(ruta).toMatch(/diaCobroMes2Db = dias\[1\] \?\? null/)
  })
})


