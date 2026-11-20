// El segundo interés compra el período SIGUIENTE, no el mismo (19 nov 2026).
// Vladimir (quincenal, vencía el 30 oct) pagó el interés el 3 nov → aplazado al
// 14 nov. Pagó otra vez el 19 nov → el sistema lo aplazó… al 14 nov, y seguía en
// «Cobros de hoy» con 5 días de atraso. 36 préstamos en 11 negocios.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { desdeDondeSeAplaza, siguientePeriodo } from '@/lib/dinero/calendario'
import { calcularMontoEnMora, calcularMontoParaPonerseAlDia, calcularDiasMora } from '@/lib/calculos'

const d = (s) => new Date(`${s}T05:00:00.000Z`)
const d10 = (x) => x.toISOString().slice(0, 10)
const calendario = d('2026-10-30') // lo que da el calendario original tras borrar la fecha comprada

describe('de qué fecha parte el aplazo', () => {
  it('primer interés: del calendario (30 oct → 14 nov)', () => {
    const desde = desdeDondeSeAplaza({ proximoCobroManual: null, proximoCobroPorInteres: false }, calendario)
    expect(d10(siguientePeriodo(desde, 'quincenal'))).toBe('2026-11-14')
  })

  it('⚠ segundo interés: de la fecha que ya compró (14 nov → 29 nov)', () => {
    const desde = desdeDondeSeAplaza({ proximoCobroManual: d('2026-11-14'), proximoCobroPorInteres: true }, calendario)
    expect(d10(siguientePeriodo(desde, 'quincenal'))).toBe('2026-11-29')
  })

  it('un aplazo SIN plata no compra tiempo: parte del calendario', () => {
    const desde = desdeDondeSeAplaza({ proximoCobroManual: d('2026-11-20'), proximoCobroPorInteres: false }, calendario)
    expect(d10(desde)).toBe('2026-10-30')
  })

  it('si el calendario ya va más adelante, gana el calendario', () => {
    const desde = desdeDondeSeAplaza({ proximoCobroManual: d('2026-10-01'), proximoCobroPorInteres: true }, calendario)
    expect(d10(desde)).toBe('2026-10-30')
  })

  it('mensual: del mes comprado al siguiente', () => {
    const desde = desdeDondeSeAplaza({ proximoCobroManual: d('2026-12-05'), proximoCobroPorInteres: true }, d('2026-11-05'))
    expect(d10(siguientePeriodo(desde, 'mensual', 5))).toBe('2027-01-05')
  })

  it('la ruta del pago usa el préstamo de ANTES del pago', () => {
    const src = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
    expect(src).toMatch(/const desde = desdeDondeSeAplaza\(prestamo, proximoCobroFinal\)/)
    expect(src).toMatch(/siguientePeriodo\(desde, prestamoFinal\.frecuencia/)
  })
})

// Su préstamo, como está en producción tras el arreglo: $150.000 «De una vez»,
// vencía el 30 oct, dos intereses de $85.100 y la quincena comprada hasta el 29 nov.
const vladimir = (comprado, porInteres = true) => ({
  estado: 'activo', modoInteres: 'unico', frecuencia: 'quincenal',
  montoPrestado: 150000, tasaInteres: 56.7, totalAPagar: 405300, cuotaDiaria: 235100, diasPlazo: 15,
  fechaInicio: d('2026-10-15'), fechaFin: d('2026-10-30'),
  proximoCobroManual: comprado ? d(comprado) : null, proximoCobroPorInteres: porInteres,
  pagos: [
    { tipo: 'intereses', montoPagado: 85100, fechaPago: d('2026-11-03') },
    { tipo: 'intereses', montoPagado: 85100, fechaPago: d('2026-11-19') },
  ],
})

describe('⚠ con la quincena comprada no hay nada atrasado', () => {
  afterEach(() => vi.useRealTimers())
  const el = (s) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${s}T23:00:00Z`)) }

  it('el 19 nov, comprado hasta el 29: 0 días, $0 en mora, $0 para ponerse al día', () => {
    el('2026-11-19')
    const p = vladimir('2026-11-29')
    expect(calcularDiasMora(p)).toBe(0)
    expect(calcularMontoEnMora(p)).toBe(0)
    expect(calcularMontoParaPonerseAlDia(p)).toBe(0)
  })

  it('pasada la fecha comprada vuelve a deber la cuota', () => {
    el('2026-12-01')
    const p = vladimir('2026-11-29')
    expect(calcularDiasMora(p)).toBeGreaterThan(0)
    expect(calcularMontoEnMora(p)).toBe(235100)
    expect(calcularMontoParaPonerseAlDia(p)).toBe(235100)
  })

  it('un aplazo SIN plata no perdona: sigue en mora', () => {
    el('2026-11-19')
    const p = vladimir('2026-11-29', false)
    expect(calcularMontoEnMora(p)).toBe(235100)
  })
})
