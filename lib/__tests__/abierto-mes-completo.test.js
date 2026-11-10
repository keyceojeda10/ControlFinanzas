/**
 * EL ABIERTO «MES COMPLETO» (10 nov 2026, Créditos pete).
 *
 * «Si le presto un 20, el 30 le estoy cobrando los intereses […] Si el cliente
 *  vino y prestó la plata hoy, y mañana quiere devolverla, tiene que pagar los
 *  60 mil pesos.»
 *
 * Es una OPCIÓN del préstamo (`interesMesCompleto`), apagada por defecto. Lo
 * que se fija aquí es lo que hace con ella Y que sin ella todo sigue igual.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { primerCorteMesCompleto, primerCobroMensual } from '@/lib/dinero/calendario'
import { calcularLiquidacionAnticipada, devengosPendientes, periodoEnCursoAbierto } from '@/lib/calculos'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const dia = (s) => new Date(`${s}T05:00:00.000Z`)
const iso = (d) => d.toISOString().slice(0, 10)

const abierto = (extra = {}) => ({
  modoInteres: 'solo_interes', sinPlazo: true, estado: 'activo',
  montoPrestado: 500000, totalAPagar: 500000, tasaInteres: 12,
  frecuencia: 'mensual', fechaInicio: '2026-11-09T05:00:00.000Z',
  pagos: [], devengos: [], cuotasAmortizacion: [],
  ...extra,
})

describe('el primer corte del «mes completo»', () => {
  it('es el PRÓXIMO día de corte, aunque falten pocos días', () => {
    expect(iso(primerCorteMesCompleto(dia('2026-10-24'), 30))).toBe('2026-10-30')
    expect(iso(primerCorteMesCompleto(dia('2026-10-20'), 30))).toBe('2026-10-30')
    expect(iso(primerCorteMesCompleto(dia('2026-10-29'), 30))).toBe('2026-10-30')
  })
  it('prestar el mismo día de corte no cobra ese día: el primero es el del mes siguiente', () => {
    expect(iso(primerCorteMesCompleto(dia('2026-10-30'), 30))).toBe('2026-11-30')
  })
  it('febrero corta el último día', () => {
    expect(iso(primerCorteMesCompleto(dia('2026-02-10'), 30))).toBe('2026-02-28')
  })
  it('la regla de siempre (sin la opción) no cambia: medio período mínimo', () => {
    expect(iso(primerCobroMensual(dia('2026-10-24'), 30))).toBe('2026-11-30')
  })
})

describe('el interés que corre con ese primer corte', () => {
  // El caso de su audio: $2.000.000 al 10 %, prestado el 24 oct, corte los 30.
  const suyo = abierto({
    montoPrestado: 2000000, totalAPagar: 2000000, tasaInteres: 10,
    fechaInicio: '2026-10-24T05:00:00.000Z', diaCobroMes: 30, primerCobro: '2026-10-30T05:00:00.000Z',
    interesMesCompleto: true,
  })
  const ahora = dia('2026-11-10').getTime()

  it('el 30 de octubre cierra el mes entero: $200.000', () => {
    const d = devengosPendientes(suyo, ahora)
    expect(d.map((x) => [String(x.periodo).slice(0, 10), Math.round(x.interes)])).toEqual([['2026-10-30', 200000]])
  })
  it('el siguiente es el 30 de noviembre, otra vez el mes entero', () => {
    const p = periodoEnCursoAbierto(suyo, ahora)
    expect(p.periodo).toBe('2026-11-30')
    expect(p.interesPeriodo).toBe(200000)
  })
  it('sin la opción (sin primer cobro guardado) hoy no ha corrido nada: es lo de siempre', () => {
    const deSiempre = abierto({ montoPrestado: 2000000, totalAPagar: 2000000, tasaInteres: 10, fechaInicio: '2026-10-24T05:00:00.000Z' })
    expect(devengosPendientes(deSiempre, ahora)).toEqual([])
  })
})

describe('«si paga todo hoy» en el abierto', () => {
  // $500.000 al 12 %, prestado ayer: el mes son $60.000.
  const manana = dia('2026-11-10')

  it('sin la opción: la prorrateada, como siempre', () => {
    const liq = calcularLiquidacionAnticipada(abierto(), manana)
    expect(liq.porDefecto).toBe(liq.proporcional)
    expect(liq.restanteHoy).toBe(liq.proporcional.restanteHoy)
    expect(liq.restanteHoy).toBe(502000)
    expect(liq.interesPerdonado).toBe(58000)
  })
  it('con la opción: el mes completo y no se «ahorra» nada', () => {
    const liq = calcularLiquidacionAnticipada(abierto({ interesMesCompleto: true }), manana)
    expect(liq.porDefecto).toBe(liq.mesCompleto)
    expect(liq.restanteHoy).toBe(560000)
    expect(liq.interesPerdonado).toBe(0)
    // Las dos siguen ahí para escoger en la hoja de liquidación.
    expect(liq.proporcional.restanteHoy).toBe(502000)
  })
})

describe('el hilo, de punta a punta', () => {
  const post = leer('app/api/prestamos/route.js')
  const patch = leer('app/api/prestamos/[id]/route.js')
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
  const ficha = leer('app/(dashboard)/prestamos/[id]/page.jsx')

  it('el servidor guarda la opción solo en el abierto', () => {
    expect(post).toMatch(/const mesCompletoDb = esAbierto && interesMesCompleto === true/)
    expect(post).toMatch(/interesMesCompleto: mesCompletoDb,/)
  })
  it('sin la opción el abierto sigue sin admitir día de corte', () => {
    expect(post).toMatch(/if \(esAbierto && \(diaCobroMes \|\| diaCobroMes2\) && !corteMesCompleto\)/)
  })
  it('el techo del abono previo «Interés» usa el mismo primer corte que se guarda', () => {
    // (10 nov 2026) `primerCobroAbierto` = el corte mensual o el primer cobro quincenal elegido.
    expect(post).toMatch(/const primerCobroAbierto = primerCorteAbierto \?\? primerCobroQuincenalMC/)
    expect(post).toMatch(/primerCobro: primerCobroAbierto \?\? calc\.primerCobro \?\? null,/)
    expect(post).toMatch(/\.\.\.\(primerCobroAbierto \? \{ primerCobro: primerCobroAbierto \} : \{\}\),/)
  })
  it('cambiar el día de cobro respeta la opción', () => {
    expect(patch).toMatch(/primerCorteMesCompleto\(new Date\(p\.fechaInicio\), dataUpdate\.diaCobroMes\)/)
  })
  it('el formulario la manda con señal y sin señal (un solo cuerpo, `cuerpoDelPrestamo`)', () => {
    const cuerpo = form.slice(form.indexOf('const cuerpoDelPrestamo = () => ({'), form.indexOf('const crearPrestamoRequest'))
    expect(cuerpo).toMatch(/\.\.\.\(esAbierto && interesMesCompleto && \{ interesMesCompleto: true \}\),/)
    expect(form).toMatch(/const payloadOffline = cuerpoDelPrestamo\(\)/)
  })
  it('la ficha y la hoja de liquidación abren con la del préstamo', () => {
    expect(ficha).toMatch(/const cierre = cierreHoy\?\.porDefecto \?\? cierreHoy\?\.proporcional/)
    expect(ficha).toMatch(/const inicial = data\.porDefecto\?\.modalidad \?\?/)
  })
  it('en el «mes completo» la ficha dice cuánto cuesta cerrar hoy aunque no se ahorre nada', () => {
    expect(ficha).toMatch(/const hayCierre = cierre && \(cierre\.interesPerdonado > 0 \|\| cierreConMesCompleto\)/)
    expect(ficha).toMatch(/: 'con el mes completo'\)/)
  })
})
