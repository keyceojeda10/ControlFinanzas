// El cobro que mezcla interés y abono justo después del corte: dos pagos, un capital.
// Medido en el espejo el 8 nov 2026: $700.000 sobre $2.000.000 al 10 %.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  abonoBajaElPeriodoQueEmpieza, interesDeUnCobroAbierto, calcularCapitalRestante,
  capitalAlEmpezarElPeriodo, calcularSaldoPendiente,
} from '@/lib/calculos'

const COL = (dia, hora = 12) => new Date(`${dia}T${String(hora + 5).padStart(2, '0')}:00:00.000Z`)
const prestamo = (extra = {}) => ({
  id: 'p', sinPlazo: true, modoInteres: 'solo_interes', frecuencia: 'mensual', estado: 'activo',
  montoPrestado: 2_000_000, tasaInteres: 10, fechaInicio: COL('2026-10-08'), diasPlazo: 30,
  totalAPagar: 2_200_000, cuotaDiaria: 200_000, cuotasAmortizacion: [],
  devengos: [{ periodo: '2026-11-08', interes: 200_000, capitalBase: 2_000_000 }],
  pagos: [],
  ...extra,
})
const pago = (tipo, montoPagado, dia = '2026-11-08') => ({ tipo, montoPagado, fechaPago: COL(dia) })

afterEach(() => vi.useRealTimers())

describe('la ventana es la misma de capitalAlEmpezarElPeriodo', () => {
  it.each([
    ['2026-11-07', false],
    ['2026-11-08', true],
    ['2026-11-11', true],
    ['2026-11-12', false],
  ])('mensual, %s → %s', (dia, esperado) => {
    expect(abonoBajaElPeriodoQueEmpieza(prestamo(), COL(dia).getTime())).toBe(esperado)
  })
  it('coincide con lo que de verdad baja la base del mes', () => {
    const inicio = COL('2026-11-08', 0)
    const base = (dia) => capitalAlEmpezarElPeriodo(prestamo({ pagos: [pago('capital', 500_000, dia)] }), inicio)
    expect(base('2026-11-11')).toBe(1_500_000)
    expect(base('2026-11-12')).toBe(2_000_000)
  })
  it('el primer período no: la fecha de inicio no es un corte', () => {
    expect(abonoBajaElPeriodoQueEmpieza(prestamo({ devengos: [], totalAPagar: 2_000_000 }), COL('2026-10-09').getTime())).toBe(false)
  })
  it('semanal: solo el día del corte', () => {
    const p = prestamo({ frecuencia: 'semanal', fechaInicio: COL('2026-10-05') })
    expect(abonoBajaElPeriodoQueEmpieza(p, COL('2026-10-12').getTime())).toBe(true)
    expect(abonoBajaElPeriodoQueEmpieza(p, COL('2026-10-13').getTime())).toBe(false)
  })
})

describe('cuánto puede ser interés', () => {
  it('⚠ el día del corte, solo lo que se debe: $200.000 y no los dos meses', () => {
    vi.useFakeTimers(); vi.setSystemTime(COL('2026-11-08'))
    expect(interesDeUnCobroAbierto(prestamo())).toEqual({ tope: 200_000, separar: true })
  })
  it('ya pagó el interés de hoy: lo que traiga va a capital', () => {
    vi.useFakeTimers(); vi.setSystemTime(COL('2026-11-08'))
    expect(interesDeUnCobroAbierto(prestamo({ pagos: [pago('completo', 200_000)] }))).toEqual({ tope: 0, separar: true })
  })
  it('atrasado dos meses: los dos meses vencidos', () => {
    vi.useFakeTimers(); vi.setSystemTime(COL('2026-12-08'))
    const p = prestamo({ totalAPagar: 2_400_000, devengos: [
      { periodo: '2026-11-08', interes: 200_000, capitalBase: 2_000_000 },
      { periodo: '2026-12-08', interes: 200_000, capitalBase: 2_000_000 },
    ] })
    expect(interesDeUnCobroAbierto(p)).toEqual({ tope: 400_000, separar: true })
  })
  it('⚠ a mitad de mes no cambia nada: se puede pagar el mes que corre entero', () => {
    vi.useFakeTimers(); vi.setSystemTime(COL('2026-11-20'))
    expect(interesDeUnCobroAbierto(prestamo())).toEqual({ tope: 400_000, separar: false })
  })
})

describe('⚠ separado, un solo capital', () => {
  it('$200.000 a interés y $500.000 a capital: todas las cuentas dicen $1.500.000', () => {
    const p = prestamo({ pagos: [pago('intereses', 200_000), pago('capital', 500_000)] })
    expect(calcularCapitalRestante(p)).toBe(1_500_000)
    expect(calcularSaldoPendiente(p)).toBe(1_500_000)
    expect(capitalAlEmpezarElPeriodo(p, COL('2026-11-08', 0))).toBe(1_500_000)
  })
})

describe('la hoja de cobro', () => {
  const s = readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')
  it('toma el tope de la regla y guarda dos pagos', () => {
    expect(s).toContain('const { tope: topeDeInteres, separar } = interesDeUnCobroAbierto(prestamo)')
    expect(s).toContain('if (repartoAbierto?.aMano || separarAlCorte) {')
  })
  it('⚠ sin señal, a la cola con la clave de cada parte: no se cuenta dos veces', () => {
    expect(s).toContain('await encolarOffline(partes.slice(guardados.length).map((x) => ({ claveCobro: x.clave, montoPagado: x.monto, tipo: x.tipo })))')
    expect(s).toContain('body: JSON.stringify({ claveCobro: parte.clave,')
  })
  it('no pierde la pregunta de la cifra rara', () => {
    expect(s).toContain('if (separarAlCorte && !repartoAbierto.aMano && !respuestaMonto) {')
  })
})
