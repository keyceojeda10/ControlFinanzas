// lib/__tests__/precio-plan.test.js
//
// Cuánto se le cobra a un negocio. Estas cuentas deciden el monto del cobro
// automático, así que se ejecutan, no se anclan.
//
// «que en la plataforma de superadmin se pudiera gestionar y que avisara qué
//  clientes tienen precio preferencial, y si es por algún tiempo limitado, para
//  que el ajuste se haga automático al pasar el tiempo, o el valor que se le dio
//  fue definitivo»                                   — el dueño, 12 sep 2026

import { describe, it, expect } from 'vitest'
import {
  ofertaPublica, inicioDelPeriodo, finDelDiaBogota, diaBogota,
  preferencialVigente, estadoPreferencial, precioMensual, precioPeriodo,
  pagoCuadra, precioPorRevisar, montoDelCobro, proximosCobros, hastaPorCobros,
  resumenPrecio, leerPreferencial, describirPreferencial,
} from '@/lib/precio-plan'

const DIA = 86400000
const AHORA = new Date('2026-09-12T18:00:00.000Z') // 13:00 en Bogotá
const en = (dias) => new Date(AHORA.getTime() + dias * DIA)

/* Basic: lista $59.000 en CO. */
const orgLista = (extra = {}) => ({
  country: 'co', plan: 'basic', planOriginal: null,
  precioPreferencial: null, precioPreferencialPlan: null,
  precioPreferencialHasta: null, precioPreferencialNota: null,
  precioPagoRevisado: null, ...extra,
})
const conPref = (monto, hasta = null, plan = 'basic', extra = {}) =>
  orgLista({ precioPreferencial: monto, precioPreferencialPlan: plan, precioPreferencialHasta: hasta, ...extra })

describe('las piezas', () => {
  it('oferta pública: −10 % el trimestre, 2 meses gratis el año', () => {
    expect(ofertaPublica('basic', 'mensual')).toBe(59000)
    expect(ofertaPublica('basic', 'trimestral')).toBe(159300)
    expect(ofertaPublica('basic', 'anual')).toBe(590000)
  })

  it('el periodo empieza al vencer si sigue activa; si no, ya', () => {
    expect(inicioDelPeriodo({ estado: 'activa', fechaVencimiento: en(5) }, AHORA)).toEqual(en(5))
    expect(inicioDelPeriodo({ estado: 'vencida', fechaVencimiento: en(5) }, AHORA)).toEqual(AHORA)
    expect(inicioDelPeriodo({ estado: 'activa', fechaVencimiento: en(-1) }, AHORA)).toEqual(AHORA)
    expect(inicioDelPeriodo(null, AHORA)).toEqual(AHORA)
  })

  it('«hasta el 30 de septiembre» incluye todo el 30 en Bogotá', () => {
    const fin = finDelDiaBogota('2026-09-30')
    expect(fin.toISOString()).toBe('2026-10-01T04:59:59.999Z')
    expect(diaBogota(fin)).toBe('2026-09-30')
    expect(diaBogota(new Date(fin.getTime() + 1))).toBe('2026-10-01')
    expect(finDelDiaBogota('30/09/2026')).toBeNull()
    expect(finDelDiaBogota(null)).toBeNull()
  })

  it('el día de Bogotá, no el de UTC: las 22:00 del 19 siguen siendo el 19', () => {
    expect(diaBogota(new Date('2026-09-20T03:00:00.000Z'))).toBe('2026-09-19')
  })
})

describe('el estado del preferencial', () => {
  it('ninguno, definitivo, temporal, terminado', () => {
    expect(estadoPreferencial(orgLista(), AHORA)).toBe('ninguno')
    expect(estadoPreferencial(conPref(40000), AHORA)).toBe('definitivo')
    expect(estadoPreferencial(conPref(40000, en(10)), AHORA)).toBe('temporal')
    expect(estadoPreferencial(conPref(40000, en(-1)), AHORA)).toBe('terminado')
  })

  it('un precio sin plan no es un preferencial', () => {
    expect(estadoPreferencial(conPref(40000, null, null), AHORA)).toBe('ninguno')
  })

  it('solo aplica al plan para el que se dio: si sube de plan, paga la lista del nuevo', () => {
    const org = conPref(40000)
    expect(preferencialVigente(org, 'basic', AHORA)).toBe(true)
    expect(preferencialVigente(org, 'growth', AHORA)).toBe(false)
    expect(precioMensual(org, 'growth', AHORA)).toMatchObject({ monto: 79000, preferencial: false })
  })
})

describe('⚠ el ajuste al pasar el tiempo', () => {
  it('temporal: el mes que empieza antes del fin va a preferencial; el de después, a lista', () => {
    const org = conPref(40000, en(10))
    expect(precioMensual(org, 'basic', en(9))).toMatchObject({ monto: 40000, lista: 59000, preferencial: true })
    expect(precioMensual(org, 'basic', en(11))).toMatchObject({ monto: 59000, preferencial: false, hasta: null })
  })

  it('el mes que empieza justo en el último instante del «hasta» todavía entra', () => {
    const hasta = finDelDiaBogota('2026-09-30')
    const org = conPref(40000, hasta)
    expect(precioMensual(org, 'basic', hasta).monto).toBe(40000)
    expect(precioMensual(org, 'basic', new Date(hasta.getTime() + 1)).monto).toBe(59000)
  })

  it('definitivo: dentro de dos años sigue igual', () => {
    expect(precioMensual(conPref(40000), 'basic', en(730)).monto).toBe(40000)
  })

  it('un «preferencial» por encima de la lista no cobra más que la lista', () => {
    expect(precioMensual(conPref(70000), 'basic', AHORA).monto).toBe(59000)
  })

  it('un trimestre que cruza el fin paga cada mes a lo suyo', () => {
    const org = conPref(40000, en(35))
    const p = precioPeriodo(org, 'basic', 'trimestral', AHORA)
    /* día 0 y día 30 preferencial, día 60 lista */
    expect(p).toMatchObject({ total: 139000, meses: 3, mesesPreferencial: 2, ahorro: 38000 })
  })

  it('los descuentos no se suman: un año preferencial cuesta lo menor de las dos cuentas', () => {
    expect(precioPeriodo(conPref(40000), 'basic', 'anual', AHORA).total).toBe(480000)
    expect(precioPeriodo(conPref(55000), 'basic', 'anual', AHORA).total).toBe(590000)
  })

  it('sin preferencial, el periodo cuesta la oferta pública', () => {
    expect(precioPeriodo(orgLista(), 'basic', 'trimestral', AHORA)).toMatchObject({ total: 159300, mesesPreferencial: 0 })
  })

  it('«los próximos 3 cobros»: tres a preferencial y el cuarto a lista', () => {
    const inicio = new Date('2026-09-20T18:00:00.000Z')
    expect(hastaPorCobros(inicio, 3)).toBe('2026-11-19')
    const org = conPref(40000, finDelDiaBogota(hastaPorCobros(inicio, 3)))
    expect(proximosCobros(org, 'basic', inicio, 4).map(c => c.monto)).toEqual([40000, 40000, 40000, 59000])
  })

  it('«los próximos 3 cobros» con un inicio de noche en Bogotá tampoco se come uno', () => {
    const inicio = new Date('2026-09-20T03:30:00.000Z') // 22:30 del 19
    const org = conPref(40000, finDelDiaBogota(hastaPorCobros(inicio, 3)))
    expect(proximosCobros(org, 'basic', inicio, 4).map(c => c.monto)).toEqual([40000, 40000, 40000, 59000])
  })

  it('un solo cobro: el primero y ya', () => {
    const org = conPref(40000, finDelDiaBogota(hastaPorCobros(AHORA, 1)))
    expect(proximosCobros(org, 'basic', AHORA, 2).map(c => c.monto)).toEqual([40000, 59000])
  })
})

describe('¿el pago cuadra con algún precio?', () => {
  it('la lista de cualquier periodo, con un 1 % de redondeo', () => {
    const org = orgLista()
    expect(pagoCuadra(org, 'basic', 59000)).toBe(true)
    expect(pagoCuadra(org, 'basic', 159300)).toBe(true)
    expect(pagoCuadra(org, 'basic', 590000)).toBe(true)
    expect(pagoCuadra(org, 'basic', 59001)).toBe(true)
    expect(pagoCuadra(org, 'basic', 45000)).toBe(false)
    expect(pagoCuadra(org, 'basic', 0)).toBe(false)
    /* el trimestre de Inicial ($105.300) apuntado a mano como $105.000 */
    expect(pagoCuadra(org, 'starter', 105000)).toBe(true)
    /* 1 % de $59.000 son $590 */
    expect(pagoCuadra(org, 'basic', 58410)).toBe(true)
    expect(pagoCuadra(org, 'basic', 58400)).toBe(false)
    expect(pagoCuadra(org, 'basic', 157000)).toBe(false)
  })

  it('el preferencial de ese plan, en cualquier periodo', () => {
    const org = conPref(40000)
    expect(pagoCuadra(org, 'basic', 40000)).toBe(true)
    expect(pagoCuadra(org, 'basic', 120000)).toBe(true)
    expect(pagoCuadra(org, 'basic', 480000)).toBe(true)
    expect(pagoCuadra(org, 'growth', 40000)).toBe(false)
  })

  it('un preferencial ya terminado también cuadra: fue un precio decidido', () => {
    expect(pagoCuadra(conPref(40000, en(-60)), 'basic', 40000)).toBe(true)
  })
})

describe('⚠ un pago raro que nadie revisó', () => {
  const pagada = (montoCOP, plan = 'basic') => ({ plan, montoCOP, estado: 'activa', fechaVencimiento: en(1) })

  it('queda por revisar hasta que un admin lo decide', () => {
    expect(precioPorRevisar(orgLista(), pagada(45000))).toBe(true)
    expect(precioPorRevisar(orgLista({ precioPagoRevisado: 45000 }), pagada(45000))).toBe(false)
    /* revisado OTRO monto: éste sigue sin revisar */
    expect(precioPorRevisar(orgLista({ precioPagoRevisado: 30000 }), pagada(45000))).toBe(true)
    expect(precioPorRevisar(orgLista(), pagada(59000))).toBe(false)
    expect(precioPorRevisar(orgLista(), null)).toBe(false)
  })

  it('⚠ pagar de más no se revisa: $60.000 de un precio viejo de Básico', () => {
    expect(precioPorRevisar(orgLista(), pagada(60000))).toBe(false)
    expect(precioPorRevisar(orgLista(), pagada(40000, 'starter'))).toBe(false)
    /* entre la lista y el trimestre, más cerca de la lista: pagó de más un mes */
    expect(precioPorRevisar(orgLista(), pagada(100000))).toBe(false)
  })

  it('pagó menos: se le sigue cobrando lo que pagó, no la lista', () => {
    const p = montoDelCobro({ org: orgLista(), plan: 'basic', pagada: pagada(45000), ultima: pagada(45000), ahora: AHORA })
    expect(p).toMatchObject({ monto: 45000, lista: 59000, porRevisar: true })
  })

  it('pagó más que la lista: se cobra la lista, nunca más, y no hay nada que revisar', () => {
    const p = montoDelCobro({ org: orgLista(), plan: 'basic', pagada: pagada(70000), ultima: pagada(70000), ahora: AHORA })
    expect(p).toMatchObject({ monto: 59000, porRevisar: false })
  })

  it('⚠ un trimestre por debajo de su oferta: se cobra lo que pagó AL MES', () => {
    /* $120.000 se parece más al trimestre ($159.300) que al mes: $40.000 al mes */
    const p = montoDelCobro({ org: orgLista(), plan: 'basic', pagada: pagada(120000), ultima: pagada(120000), ahora: AHORA })
    expect(p).toMatchObject({ monto: 40000, lista: 59000, porRevisar: true })
    /* un año de $480.000: $40.000 al mes */
    const a = montoDelCobro({ org: orgLista(), plan: 'basic', pagada: pagada(480000), ultima: pagada(480000), ahora: AHORA })
    expect(a).toMatchObject({ monto: 40000, porRevisar: true })
  })

  it('un trimestre redondeado a mano cuadra: el mes a lista', () => {
    const p = montoDelCobro({ org: orgLista(), plan: 'starter', pagada: pagada(105000, 'starter'), ultima: pagada(105000, 'starter'), ahora: AHORA })
    expect(p).toMatchObject({ monto: 39000, porRevisar: false })
  })

  it('con preferencial: un pago por encima de él no se revisa, uno por debajo sí', () => {
    const encima = montoDelCobro({ org: conPref(40000), plan: 'basic', pagada: pagada(50000), ultima: pagada(50000), ahora: AHORA })
    expect(encima).toMatchObject({ monto: 40000, preferencial: true, porRevisar: false })
    const debajo = montoDelCobro({ org: conPref(40000), plan: 'basic', pagada: pagada(30000), ultima: pagada(30000), ahora: AHORA })
    expect(debajo).toMatchObject({ monto: 30000, porRevisar: true })
  })

  it('revisado y dejado a lista: cobra la lista', () => {
    const org = orgLista({ precioPagoRevisado: 45000 })
    const p = montoDelCobro({ org, plan: 'basic', pagada: pagada(45000), ultima: pagada(45000), ahora: AHORA })
    expect(p).toMatchObject({ monto: 59000, porRevisar: false })
  })

  it('el pago raro era de otro plan: el plan que se cobra va a su precio', () => {
    const p = montoDelCobro({ org: orgLista(), plan: 'growth', pagada: pagada(20000), ultima: pagada(20000), ahora: AHORA })
    expect(p.monto).toBe(79000)
  })

  it('⚠ pagó un trimestre: el cobro automático es UN mes, no el trimestre', () => {
    const p = montoDelCobro({ org: orgLista(), plan: 'basic', pagada: pagada(159300), ultima: pagada(159300), ahora: AHORA })
    expect(p).toMatchObject({ monto: 59000, porRevisar: false })
  })
})

describe('el monto del cobro, con el preferencial', () => {
  it('el preferencial se mide en la fecha en que empieza el periodo, no hoy', () => {
    const ultima = { plan: 'basic', montoCOP: 40000, estado: 'activa', fechaVencimiento: en(1) }
    /* termina hoy+2: el periodo que empieza mañana va a preferencial */
    expect(montoDelCobro({ org: conPref(40000, en(2)), plan: 'basic', pagada: ultima, ultima, ahora: AHORA }).monto).toBe(40000)
    /* terminó hace nada, entre hoy y el vencimiento: ya va a lista */
    const org = conPref(40000, new Date(en(1).getTime() - 60000))
    expect(montoDelCobro({ org, plan: 'basic', pagada: ultima, ultima, ahora: AHORA })).toMatchObject({ monto: 59000, porRevisar: false })
  })

  it('vencida: el periodo empieza ya', () => {
    const ultima = { plan: 'basic', montoCOP: 40000, estado: 'vencida', fechaVencimiento: en(-1) }
    const org = conPref(40000, en(0.5))
    expect(montoDelCobro({ org, plan: 'basic', pagada: ultima, ultima, ahora: AHORA })).toMatchObject({ monto: 40000, inicio: AHORA })
  })
})

describe('el resumen para el panel', () => {
  it('sin plan de pago conocido no promete ningún cobro', () => {
    const r = resumenPrecio(orgLista({ plan: 'nada' }), { ahora: AHORA })
    expect(r).toMatchObject({ estado: 'ninguno', plan: null, proximoCobro: null, porRevisar: false })
  })

  it('con preferencial temporal: estado, plan, próximo cobro y hasta cuándo', () => {
    const ultima = { plan: 'basic', montoCOP: 40000, estado: 'activa', fechaVencimiento: en(1) }
    const r = resumenPrecio(conPref(40000, en(40), 'basic', { precioPreferencialNota: 'amigo' }), { pagada: ultima, ultima, ahora: AHORA })
    expect(r.estado).toBe('temporal')
    expect(r.preferencial).toMatchObject({ plan: 'basic', monto: 40000, nota: 'amigo' })
    expect(r.plan).toBe('basic')
    expect(r.ultimoPago).toEqual({ plan: 'basic', montoCOP: 40000 })
    expect(r.proximoCobro).toMatchObject({ monto: 40000, lista: 59000, preferencial: true, aMano: 40000 })
    expect(r.proximoCobro.fecha).toEqual(en(1))
  })

  it('⚠ por revisar: el cobro automático cobra lo pagado; a mano, lo del checkout', () => {
    const ultima = { plan: 'basic', montoCOP: 45000, estado: 'activa', fechaVencimiento: en(1) }
    const r = resumenPrecio(orgLista(), { pagada: ultima, ultima, ahora: AHORA })
    expect(r.porRevisar).toBe(true)
    expect(r.proximoCobro).toMatchObject({ monto: 45000, lista: 59000, aMano: 59000 })
    expect(r.proximoCobro.aMano).toBe(precioPeriodo(orgLista(), 'basic', 'mensual', en(1)).total)
    /* con un preferencial vigente y un pago por debajo de él: a mano paga el preferencial, no la lista */
    const p = { ...ultima, montoCOP: 30000 }
    const conP = resumenPrecio(conPref(40000), { pagada: p, ultima: p, ahora: AHORA })
    expect(conP.proximoCobro).toMatchObject({ monto: 30000, lista: 59000, aMano: 40000 })
  })

  it('el plan sale del último pago antes que del de la cuenta (una demo lo cambia)', () => {
    const ultima = { plan: 'basic', montoCOP: 59000, estado: 'activa', fechaVencimiento: en(1) }
    expect(resumenPrecio(orgLista({ plan: 'professional' }), { pagada: ultima, ultima, ahora: AHORA }).plan).toBe('basic')
    expect(resumenPrecio(orgLista({ plan: 'professional', planOriginal: 'starter' }), { ahora: AHORA }).plan).toBe('starter')
  })
})

describe('lo que manda el panel', () => {
  const inicio = new Date('2026-09-20T18:00:00.000Z')

  it('valida plan y precio', () => {
    expect(leerPreferencial({ plan: 'nada', precio: 1 }, { inicio })).toHaveProperty('error')
    expect(leerPreferencial({ plan: 'basic', precio: '' }, { inicio }).error).toMatch(/precio/)
    expect(leerPreferencial({ plan: 'basic', precio: 59000 }, { inicio }).error).toMatch(/no es un precio preferencial/)
    expect(leerPreferencial({ plan: 'basic', precio: 60000 }, { inicio })).toHaveProperty('error')
  })

  it('sin fecha ni cobros es definitivo', () => {
    expect(leerPreferencial({ plan: 'basic', precio: '40000', nota: '  amigo  ' }, { inicio })).toEqual({
      data: { precioPreferencial: 40000, precioPreferencialPlan: 'basic', precioPreferencialHasta: null, precioPreferencialNota: 'amigo' },
    })
  })

  it('por cobros: la fecha la saca el sistema', () => {
    const { data } = leerPreferencial({ plan: 'basic', precio: 40000, cobros: '3' }, { inicio })
    expect(data.precioPreferencialHasta).toEqual(finDelDiaBogota('2026-11-19'))
    expect(leerPreferencial({ plan: 'basic', precio: 40000, cobros: 0 }, { inicio }).error).toMatch(/Entre 1 y 36/)
    expect(leerPreferencial({ plan: 'basic', precio: 40000, cobros: 37 }, { inicio }).error).toMatch(/Entre 1 y 36/)
  })

  it('por fecha: una fecha antes del próximo cobro no le aplicaría a ninguno', () => {
    expect(leerPreferencial({ plan: 'basic', precio: 40000, hasta: '2026-09-19' }, { inicio }).error).toMatch(/antes del próximo cobro/)
    expect(leerPreferencial({ plan: 'basic', precio: 40000, hasta: 'mañana' }, { inicio }).error).toMatch(/Fecha no válida/)
    /* el mismo día del próximo cobro sí vale */
    expect(leerPreferencial({ plan: 'basic', precio: 40000, hasta: '2026-09-20' }, { inicio }).data.precioPreferencialHasta)
      .toEqual(finDelDiaBogota('2026-09-20'))
  })

  it('la lista es la del país: 150 pesos mexicanos sí es preferencial de un Básico', () => {
    expect(leerPreferencial({ plan: 'basic', precio: 150 }, { inicio, country: 'mx' })).toHaveProperty('data')
    expect(leerPreferencial({ plan: 'basic', precio: 300 }, { inicio, country: 'mx' })).toHaveProperty('error')
  })

  it('la nota cabe en la columna y vacía es null', () => {
    expect(leerPreferencial({ plan: 'basic', precio: 40000, nota: 'x'.repeat(300) }, { inicio }).data.precioPreferencialNota).toHaveLength(191)
    expect(leerPreferencial({ plan: 'basic', precio: 40000, nota: '   ' }, { inicio }).data.precioPreferencialNota).toBeNull()
  })

  it('el historial dice cuánto, contra qué lista y hasta cuándo', () => {
    const base = { precioPreferencial: 40000, precioPreferencialPlan: 'basic', precioPreferencialNota: null }
    expect(describirPreferencial({ ...base, precioPreferencialHasta: null })).toBe('Básico a $40.000/mes (lista $59.000), definitivo')
    expect(describirPreferencial({ ...base, precioPreferencialHasta: finDelDiaBogota('2026-11-19') }))
      .toBe('Básico a $40.000/mes (lista $59.000), hasta el 2026-11-19, después lista')
  })
})
