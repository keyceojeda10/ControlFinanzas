/**
 * EL ABIERTO QUINCENAL «AL MES» CON LA REGLA DE CRÉDITOS PETE (10 nov 2026).
 *
 * Tres tarjetas suyas, al peso:
 *  · Álvaro: $300.000 el 2 oct, primer cobro el 31 oct. Ese día pagó $15.000 de
 *    interés y $160.000 de capital. Debe $140.000; el 15 nov paga $15.000; si
 *    paga todo hoy, $155.000.
 *  · Jhon: $600.000 el 16 oct. El 31 oct, $30.000 de interés y $100.000 de
 *    capital. El 15 nov, $30.000 (la otra mitad del mes); el 30 nov ya sobre $500.000.
 *  · Andrés: $3.500.000 el 2 oct, cobra el 20 y el 5, el primero el 20. El 19 oct
 *    abonó $150.000 de capital; pagó el interés del 20 y del 5. Debe $3.350.000, al día.
 *
 * La regla: el interés es del MES, sobre el capital al empezar el mes, en dos
 * mitades. Sin `interesPorMes`, cada quincena va sobre su propio capital, como siempre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fechaDePeriodo } from '@/lib/dinero/calendario'
import { devengosPendientes, periodoEnCursoAbierto, calcularSaldoPendiente, calcularLiquidacionAnticipada, capitalAlEmpezarElPeriodo } from '@/lib/calculos'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const iso = (d) => new Date(d).toISOString().slice(0, 10)
const T = (d) => `${d}T05:00:00.000Z`
const el10 = new Date('2026-11-10T20:00:00.000Z').getTime()
const base = (extra) => ({
  modoInteres: 'solo_interes', sinPlazo: true, estado: 'activo', interesMesCompleto: true, interesPorMes: true,
  frecuencia: 'quincenal', tasaInteres: 5, devengos: [], cuotasAmortizacion: [], diaCobroMes: null, diaCobroMes2: null, ...extra,
})
// Asienta lo que corrió hasta `ahora`, como el servidor al crear.
const conDevengos = (p, ahora = el10) => {
  const nuevos = devengosPendientes(p, ahora).map((x) => ({ periodo: x.periodo, capitalBase: x.capitalBase, interes: x.interes }))
  const devengos = [...(p.devengos ?? []), ...nuevos]
  return { ...p, devengos, totalAPagar: p.montoPrestado + devengos.reduce((a, x) => a + x.interes, 0) }
}

const alvaro = conDevengos(base({
  montoPrestado: 300000, fechaInicio: T('2026-10-02'), primerCobro: T('2026-10-31'),
  pagos: [
    { tipo: 'intereses', montoPagado: 15000, fechaPago: T('2026-10-02') },
    { tipo: 'capital', montoPagado: 160000, fechaPago: T('2026-10-31') },
  ],
}))
const jhon = conDevengos(base({
  montoPrestado: 600000, fechaInicio: T('2026-10-16'),
  pagos: [
    { tipo: 'intereses', montoPagado: 30000, fechaPago: T('2026-10-16') },
    { tipo: 'capital', montoPagado: 100000, fechaPago: T('2026-10-31') },
  ],
}))
const andres = conDevengos(base({
  montoPrestado: 3500000, fechaInicio: T('2026-10-02'), primerCobro: T('2026-10-20'), diaCobroMes: 5, diaCobroMes2: 20,
  pagos: [
    { tipo: 'intereses', montoPagado: 350000, fechaPago: T('2026-10-02') },
    { tipo: 'capital', montoPagado: 150000, fechaPago: T('2026-10-19') },
  ],
}))

describe('el primer cobro que él elige', () => {
  it('Andrés: cobra el 20 y el 5, y el primero es el 20 de octubre, no el 5', () => {
    const a = { fechaInicio: new Date(T('2026-10-02')), freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 5, diaCobroMes2: 20, primerCobro: new Date(T('2026-10-20')) }
    expect([1, 2, 3, 4].map((n) => iso(fechaDePeriodo(n, a)))).toEqual(['2026-10-20', '2026-11-05', '2026-11-20', '2026-12-05'])
  })
  it('Álvaro, sin días: el 31 de octubre y luego cada 15 días', () => {
    const a = { fechaInicio: new Date(T('2026-10-02')), freq: 'quincenal', diasPeriodo: 15, primerCobro: new Date(T('2026-10-31')) }
    expect([1, 2, 3].map((n) => iso(fechaDePeriodo(n, a)))).toEqual(['2026-10-31', '2026-11-15', '2026-11-30'])
  })
  it('la semana por medio sigue por su rama', () => {
    const a = { fechaInicio: new Date(T('2026-11-02')), freq: 'quincenal', diasPeriodo: 15, diaCobroSemana: 6, primerCobro: new Date(T('2026-11-07')) }
    expect(iso(fechaDePeriodo(2, a))).toBe('2026-11-21')
  })
})

describe('Álvaro, al peso', () => {
  it('el 31 oct cierra la primera mitad: $15.000', () => {
    expect(alvaro.devengos.map((d) => [iso(d.periodo), d.interes])).toEqual([['2026-10-31', 15000]])
  })
  it('debe $140.000 de capital', () => {
    expect(calcularSaldoPendiente(alvaro)).toBe(140000)
  })
  it('el 15 nov paga la otra mitad del mes: $15.000 sobre los $300.000', () => {
    const e = periodoEnCursoAbierto(alvaro, el10)
    expect([e.periodo, e.capitalBase, e.interesPeriodo]).toEqual(['2026-11-15', 300000, 15000])
  })
  it('si paga todo hoy: $155.000', () => {
    expect(calcularLiquidacionAnticipada(alvaro, new Date(el10)).restanteHoy).toBe(155000)
  })
  it('el mes siguiente ya va sobre $140.000: $7.000 cada quincena', () => {
    const despues = conDevengos(alvaro, new Date('2026-12-16T12:00:00Z').getTime())
    expect(despues.devengos.map((d) => [iso(d.periodo), d.capitalBase, d.interes])).toEqual([
      ['2026-10-31', 300000, 15000], ['2026-11-15', 300000, 15000],
      ['2026-11-30', 140000, 7000], ['2026-12-15', 140000, 7000],
    ])
  })
})

describe('Jhon, al peso', () => {
  it('debe $500.000; el 15 nov, $30.000; el 30 nov y el 15 dic, $25.000', () => {
    expect(calcularSaldoPendiente(jhon)).toBe(500000)
    const despues = conDevengos(jhon, new Date('2026-12-16T12:00:00Z').getTime())
    expect(despues.devengos.map((d) => [iso(d.periodo), d.interes])).toEqual([
      ['2026-10-31', 30000], ['2026-11-15', 30000], ['2026-11-30', 25000], ['2026-12-15', 25000],
    ])
  })
})

describe('Andrés, al peso', () => {
  it('el 20 oct y el 5 nov, $175.000 cada uno: el mes sobre $3.500.000', () => {
    expect(andres.devengos.map((d) => [iso(d.periodo), d.capitalBase, d.interes])).toEqual([
      ['2026-10-20', 3500000, 175000], ['2026-11-05', 3500000, 175000],
    ])
  })
  it('debe $3.350.000 y está al día', () => {
    expect(calcularSaldoPendiente(andres)).toBe(3350000)
  })
  it('el mes que empieza el 5 nov va sobre $3.350.000: $167.500 el 20 nov', () => {
    const e = periodoEnCursoAbierto(andres, el10)
    expect([e.periodo, e.capitalBase, e.interesPeriodo]).toEqual(['2026-11-20', 3350000, 167500])
  })
})

describe('sin la regla del mes, cada quincena sobre su capital, como siempre', () => {
  it('el mismo Álvaro sin `interesPorMes`: la segunda quincena ya va sobre $140.000', () => {
    const sin = { ...alvaro, interesPorMes: false }
    expect(capitalAlEmpezarElPeriodo(sin, new Date(T('2026-10-31')))).toBe(140000)
    expect(capitalAlEmpezarElPeriodo(alvaro, new Date(T('2026-10-31')))).toBe(300000)
  })
})

describe('el servidor y el formulario', () => {
  const post = leer('app/api/prestamos/route.js')
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
  it('«Al mes» en el abierto quincenal guarda la regla del mes', () => {
    expect(post).toMatch(/const interesPorMesDb = interesPorMes === true && freq === 'quincenal' && \(modoValido === 'lineal' \|\| esAbierto\)/)
    expect(form).toMatch(/\.\.\.\(\(interesPorMesActivo \|\| pctAlMesActivo\) && \{ interesPorMes: true \}\),/)
  })
  it('el abono «Ambos» se guarda en dos pagos: interés y capital con su fecha', () => {
    expect(post).toMatch(/\{ monto: abonoInteres, tipo: 'intereses', fecha: fechaInicio \},\n\s+\{ monto: abonoCapital, tipo: 'capital', fecha: diaCapital \},/)
    expect(post).toMatch(/if \(abonoInteres \+ abonoCapital !== Math\.round\(abono\)\)|abonoInteres \+ abonoCapital !== Math\.round\(abono\)/)
  })
  it('el primer cobro elegido llega y se guarda', () => {
    expect(form).toMatch(/\{ primerCobro: primerCobroElegidoAb \}/)
    expect(post).toMatch(/\.\.\.\(primerCobroAbierto \? \{ primerCobro: primerCobroAbierto \} : \{\}\),/)
  })
  it('⚠ los estados nuevos se declaran antes de usarse', () => {
    expect(form.indexOf('const [primerCobroElegidoAb')).toBeLessThan(form.indexOf('const dosPrimerosCobros'))
    expect(form.indexOf('const [abonoDeInteres')).toBeLessThan(form.indexOf('const cuerpoDelPrestamo'))
  })
})

describe('⚠ ninguna consulta se queda ciega a la regla del mes', () => {
  /* Cazado en el espejo: `SELECT_PARA_DEVENGAR` pedía `primerCobro` pero no
     `interesPorMes`, así que el interés asentado al crear y la cuota salían como
     si la regla no existiera — sin un error. Toda consulta que pide el
     calendario (`primerCobro`) pide también la regla. */
  const archivos = [
    'app/api/clientes/route.js', 'app/api/cobros-hoy/route.js', 'app/api/cron/mora-alertas/route.js',
    'app/api/dashboard/resumen/route.js', 'app/api/mis-estadisticas/route.js', 'app/api/reportes/cobros-mes/route.js',
    'app/api/rutas/route.js', 'app/api/rutas/[id]/route.js', 'app/api/calendario/route.js',
    'lib/asistente-cifras.js', 'lib/dinero/esperado.js', 'lib/dinero/devengar.js', 'app/api/prestamos/ultimo-cliente/route.js',
  ]
  for (const a of archivos) {
    it(a, () => {
      const src = leer(a)
      const conCalendario = src.split('\n').filter((l) => /primerCobro: true/.test(l)).length
      expect(conCalendario).toBeGreaterThan(0)
      expect(src.split('\n').filter((l) => /interesPorMes: true/.test(l)).length).toBeGreaterThanOrEqual(conCalendario)
    })
  }
})

describe('«Ambos» no deja avanzar sin la fecha del capital (10 nov 2026)', () => {
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
  it('las condiciones no quedan listas si falta la fecha', () => {
    expect(form).toMatch(/if \(faltaFechaDelCapital\) return false/)
    expect(form.indexOf('const faltaFechaDelCapital')).toBeLessThan(form.indexOf('const condicionesListas'))
  })
  it('el cuadro vacío dice qué hacer', () => {
    expect(form).toMatch(/aviso="Toca y elige el día" falta=\{faltaFechaDelCapital\}/)
  })
})
