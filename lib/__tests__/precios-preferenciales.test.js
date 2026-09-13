// lib/__tests__/precios-preferenciales.test.js
//
// La lista de «quién paga distinto de la lista» del inicio del panel. Si falta
// alguien aquí, el dueño no se entera de que se le está cobrando otra cosa.

import { describe, it, expect } from 'vitest'
import { clasificarPreferenciales, wherePreferenciales } from '@/lib/admin/precios-preferenciales'

const DIA = 86400000
const AHORA = new Date('2026-09-12T18:00:00.000Z')
const en = (dias) => new Date(AHORA.getTime() + dias * DIA)

let n = 0
const org = (extra = {}, subs = []) => ({
  id: `o${++n}`, nombre: `Negocio ${n}`, plan: 'basic', planOriginal: null, telefono: '',
  cobroAutomatico: false, wompiFuentePagoId: null, country: 'co',
  precioPreferencial: null, precioPreferencialPlan: null, precioPreferencialHasta: null,
  precioPreferencialNota: null, precioPagoRevisado: null,
  suscripciones: subs, users: [{ telefono: '3000000000', email: `dueno${n}@ejemplo.test` }],
  ...extra,
})
const pago = (montoCOP, dias, extra = {}) => ({ plan: 'basic', estado: 'activa', montoCOP, fechaVencimiento: en(dias), mpStatus: null, ...extra })
const pref = (monto, hasta = null, plan = 'basic') => ({ precioPreferencial: monto, precioPreferencialPlan: plan, precioPreferencialHasta: hasta })

const clasificar = (orgs, emailsInternos = []) => clasificarPreferenciales(orgs, { ahora: AHORA, emailsInternos })
const grupoDe = (r, o) => r.filas.find(f => f.id === o.id)?.grupo ?? null

describe('quién sale y en qué grupo', () => {
  it('definitivo, temporal y terminado hace poco', () => {
    const def = org(pref(40000), [pago(40000, 10)])
    const tmp = org(pref(40000, en(60)), [pago(40000, 10)])
    const fin = org(pref(40000, en(-5)), [pago(59000, 10)])
    const r = clasificar([def, tmp, fin])
    expect(grupoDe(r, def)).toBe('definitivo')
    expect(grupoDe(r, tmp)).toBe('temporal')
    expect(grupoDe(r, fin)).toBe('terminado')
  })

  it('un preferencial que terminó hace más de un mes ya no se enseña', () => {
    const viejo = org(pref(40000, en(-40)), [pago(59000, 10)])
    expect(clasificar([viejo]).filas).toHaveLength(0)
  })

  it('⚠ sin preferencial, un pago raro sin revisar sale «por revisar»', () => {
    const raro = org({}, [pago(45000, 10)])
    const r = clasificar([raro])
    expect(grupoDe(r, raro)).toBe('porRevisar')
    expect(r.filas[0].proximoCobro).toMatchObject({ monto: 45000, lista: 59000 })
  })

  it('revisado, a lista o de hace más de 72 h: no sale', () => {
    const revisado = org({ precioPagoRevisado: 45000 }, [pago(45000, 10)])
    const lista = org({}, [pago(59000, 10)])
    const trimestre = org({}, [pago(159300, 10)])
    const viejo = org({}, [pago(45000, -4)])
    expect(clasificar([revisado, lista, trimestre, viejo]).filas).toHaveLength(0)
  })

  it('un pago por debajo del preferencial manda: primero hay que revisarlo', () => {
    const o = org(pref(40000), [pago(30000, 10)])
    expect(grupoDe(clasificar([o]), o)).toBe('porRevisar')
    /* por encima no: el cobro ya es el preferencial, que es menos */
    const encima = org(pref(40000), [pago(45000, 10)])
    expect(grupoDe(clasificar([encima]), encima)).toBe('definitivo')
  })

  it('⚠ pagar de más o un trimestre redondeado no llenan «por revisar»', () => {
    const viejo = org({}, [pago(60000, 10)])
    const trimestre = org({ plan: 'starter' }, [pago(105000, 10, { plan: 'starter' })])
    expect(clasificar([viejo, trimestre]).filas).toHaveLength(0)
  })

  it('un checkout pendiente no es «la última» suscripción', () => {
    const o = org(pref(40000, en(5)), [
      { plan: 'basic', estado: 'activa', montoCOP: 0, fechaVencimiento: en(40), mpStatus: 'pending' },
      pago(40000, 10),
    ])
    const fila = clasificar([o]).filas[0]
    /* el cobro empieza al vencer la pagada (día 10), no la pendiente (día 40): ya va a lista */
    expect(fila.proximoCobro.fecha).toEqual(en(10))
    expect(fila.proximoCobro.monto).toBe(59000)
  })
})

describe('lo que dice cada fila', () => {
  it('días para terminar, y los que terminan dentro de un mes se cuentan', () => {
    const pronto = org(pref(40000, en(10)), [pago(40000, 3)])
    const lejos = org(pref(40000, en(60)), [pago(40000, 3)])
    const r = clasificar([pronto, lejos])
    expect(r.filas.find(f => f.id === pronto.id).diasParaTerminar).toBe(10)
    expect(r.filas.find(f => f.id === lejos.id).diasParaTerminar).toBe(60)
    expect(r.conteo).toMatchObject({ temporal: 2, terminaPronto: 1 })
  })

  it('un preferencial de otro plan se avisa', () => {
    const o = org(pref(20000, null, 'starter'), [pago(59000, 10)])
    const fila = clasificar([o]).filas[0]
    expect(fila).toMatchObject({ grupo: 'definitivo', deOtroPlan: true, plan: 'basic' })
    expect(fila.proximoCobro.monto).toBe(59000)
    /* uno que ya terminó no tiene nada que avisar */
    const terminado = org(pref(20000, en(-3), 'starter'), [pago(59000, 10)])
    expect(clasificar([terminado]).filas[0]).toMatchObject({ grupo: 'terminado', deOtroPlan: false })
  })

  it('cobro automático solo con el medio guardado', () => {
    const conMedio = org({ ...pref(40000), cobroAutomatico: true, wompiFuentePagoId: 7 }, [pago(40000, 10)])
    const sinMedio = org({ ...pref(40000), cobroAutomatico: true }, [pago(40000, 10)])
    const r = clasificar([conMedio, sinMedio])
    expect(r.filas.find(f => f.id === conMedio.id).cobroAutomatico).toBe(true)
    expect(r.filas.find(f => f.id === sinMedio.id).cobroAutomatico).toBe(false)
  })

  it('la cuenta interna sale, marcada', () => {
    const propia = org({ ...pref(1500, null, 'professional'), plan: 'professional' }, [pago(1500, 10, { plan: 'professional' })])
    const fila = clasificar([propia], [propia.users[0].email]).filas[0]
    expect(fila).toMatchObject({ grupo: 'definitivo', interna: true })
  })
})

describe('el orden: lo urgente arriba', () => {
  it('por revisar con cobro automático, por revisar a mano, temporal que acaba antes, definitivo, terminado', () => {
    const def = org({ ...pref(40000), nombre: 'Zeta' }, [pago(40000, 10)])
    const fin = org(pref(40000, en(-2)), [pago(59000, 10)])
    const tmpLejos = org(pref(40000, en(90)), [pago(40000, 10)])
    const tmpPronto = org(pref(40000, en(8)), [pago(40000, 10)])
    const raroMano = org({}, [pago(45000, 1)])
    const raroAuto = org({ cobroAutomatico: true, wompiFuentePagoId: 7 }, [pago(45000, 20)])
    const r = clasificar([def, fin, tmpLejos, tmpPronto, raroMano, raroAuto])
    expect(r.filas.map(f => f.id)).toEqual([raroAuto.id, raroMano.id, tmpPronto.id, tmpLejos.id, def.id, fin.id])
    expect(r.conteo).toEqual({ porRevisar: 2, temporal: 2, definitivo: 1, terminado: 1, terminaPronto: 1 })
  })
})

describe('el where trae a los candidatos', () => {
  it('con preferencial, o con un pago de las últimas 72 h en adelante', () => {
    const w = wherePreferenciales(AHORA)
    expect(w.OR[0]).toEqual({ precioPreferencial: { not: null } })
    expect(w.OR[1].suscripciones.some.fechaVencimiento.gte).toEqual(new Date(AHORA.getTime() - 72 * 3600000))
  })
})
