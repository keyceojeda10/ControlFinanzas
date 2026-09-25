// lib/__tests__/adicionales.test.js
//
// Cobradores y rutas adicionales: lo que cuestan, cuánto se cobra al
// agregarlos a mitad de mes, cómo viajan en la referencia de Wompi y qué pasa
// en la base al comprarlos o quitarlos.
//
// «¿cómo haría una persona que quiere comprar el plan de crecimiento pero
//  añadirle un cobrador extra?» — el dueño, 24 sep 2026

import { describe, it, expect, vi, beforeEach } from 'vitest'

let org
let subs
let usuarios
let rutas
let libro
let logs

vi.mock('@/lib/prisma', () => {
  const organization = {
    findUnique: vi.fn(async ({ where, select }) => {
      if (!org || where.id !== org.id) return null
      if (!select) return { ...org }
      return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, org[k]]))
    }),
    update: vi.fn(async ({ data }) => {
      for (const [k, v] of Object.entries(data)) {
        org[k] = v && typeof v === 'object' && 'increment' in v ? (org[k] ?? 0) + v.increment : v
      }
      return { ...org }
    }),
    /* Con su condición de verdad (`gte` / `lte`), como MariaDB. */
    updateMany: vi.fn(async ({ where, data }) => {
      const cumple = Object.entries(where).every(([k, v]) => {
        if (k === 'id') return org.id === v
        if (v && typeof v === 'object' && 'gte' in v) return (org[k] ?? 0) >= v.gte
        if (v && typeof v === 'object' && 'lte' in v) return (org[k] ?? 0) <= v.lte
        return org[k] === v
      })
      if (!cumple) return { count: 0 }
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && 'increment' in v) org[k] = (org[k] ?? 0) + v.increment
        else if (v && typeof v === 'object' && 'decrement' in v) org[k] = (org[k] ?? 0) - v.decrement
        else org[k] = v
      }
      return { count: 1 }
    }),
  }
  const pagoSuscripcion = {
    findUnique: vi.fn(async ({ where }) => libro.find((p) => p.gatewayId === where.gatewayId) ?? null),
    create: vi.fn(async ({ data }) => {
      if (libro.some((p) => p.gatewayId === data.gatewayId)) throw Object.assign(new Error('unique'), { code: 'P2002' })
      libro.push(data)
      return data
    }),
  }
  const cliente = {
    organization,
    pagoSuscripcion,
    suscripcion: {
      findFirst: vi.fn(async ({ where }) => {
        const lista = where?.estado ? subs.filter((s) => where.estado.in.includes(s.estado) && s.montoCOP > 0) : subs
        return [...lista].sort((a, b) => b.fechaVencimiento - a.fechaVencimiento)[0] ?? null
      }),
    },
    user: {
      count: vi.fn(async () => usuarios),
      findFirst: vi.fn(async () => ({ id: 'owner1' })),
    },
    ruta: { count: vi.fn(async () => rutas) },
    actividadLog: { create: vi.fn(async ({ data }) => { logs.push(data); return data }) },
  }
  cliente.$transaction = vi.fn(async (fn) => fn(cliente))
  return { prisma: cliente }
})

const {
  precioAdicionales, adicionalesMensual, prorrateoAdicionales, precioCheckout,
  montoDelCobro, pagoCuadra, resumenPrecio, MINIMO_WOMPI, adicionalesDelMonto,
} = await import('@/lib/precio-plan')
const { cuposDe, admiteAdicionales } = await import('@/lib/planes')
const { referenciaDeAdicionales, referenciaDeCobro, leerReferencia } = await import('@/lib/wompi')
const {
  planVigente, leerCantidad, estadoAdicionales, cambiarAdicionales, aplicarCompraAdicionales,
} = await import('@/lib/adicionales')

const DIA = 86400000
const AHORA = new Date('2026-09-24T15:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  org = {
    id: 'org1', nombre: 'Negocio', plan: 'growth', planOriginal: null, country: 'co',
    precioPreferencial: null, precioPreferencialPlan: null, precioPreferencialHasta: null,
    precioPreferencialNota: null, precioPagoRevisado: null, planDemoHasta: null, cobroRefPendiente: null,
    cobradoresExtra: 0, rutasExtra: 0, clientesExtra: 0,
    cobradoresAdicionales: 0, rutasAdicionales: 0,
  }
  subs = [{ plan: 'growth', estado: 'activa', montoCOP: 79000, fechaVencimiento: new Date(AHORA.getTime() + 16 * DIA) }]
  usuarios = 2
  rutas = 1
  libro = []
  logs = []
})

describe('el precio de los adicionales', () => {
  it('Crecimiento: $19.000 el cobrador y $29.000 la ruta, al mes', () => {
    expect(precioAdicionales({ cobradores: 1, rutas: 1 }, 'growth', 'co')).toBe(48000)
    expect(precioAdicionales({ cobradores: 3 }, 'professional', 'co')).toBe(57000)
  })

  it('Inicial y Básico no los admiten: cuestan 0 y no suman cupo', () => {
    expect(admiteAdicionales('starter')).toBe(false)
    expect(precioAdicionales({ cobradores: 2, rutas: 1 }, 'basic', 'co')).toBe(0)
    expect(cuposDe({ plan: 'basic', cobradoresAdicionales: 2, rutasAdicionales: 1 }).usuarios).toBe(1)
  })

  it('en otro país, el precio de su tabla', () => {
    expect(precioAdicionales({ cobradores: 1, rutas: 1 }, 'growth', 'mx')).toBe(99 + 139)
  })

  it('el cupo es plan + regalados + adicionales pagados', () => {
    const c = cuposDe({ plan: 'growth', cobradoresExtra: 1, rutasExtra: 0, cobradoresAdicionales: 2, rutasAdicionales: 1, clientesExtra: 5 })
    expect(c).toEqual({ usuarios: 2 + 1 + 2, rutas: 3 + 0 + 1, clientes: 1000 + 5 })
  })
})

describe('agregar a mitad de mes: los días que faltan', () => {
  it('16 días de un cobrador: $19.000 × 16/30 = $10.133 → $10.100', () => {
    const p = prorrateoAdicionales({ cobradores: 1 }, 'growth', 'co', new Date(AHORA.getTime() + 16 * DIA), AHORA)
    expect(p).toEqual({ dias: 16, mensual: 19000, monto: 10100 })
  })

  it('⚠ al día más cercano: 6 días y una hora son 6 días, no 7', () => {
    const p = prorrateoAdicionales({ cobradores: 1 }, 'growth', 'co', new Date(AHORA.getTime() + 6 * DIA + 3600000), AHORA)
    expect(p.dias).toBe(6)
    expect(p.monto).toBe(3800)
  })

  it('un día de una ruta sale por debajo de lo que Wompi deja cobrar: el mínimo', () => {
    const p = prorrateoAdicionales({ rutas: 1 }, 'growth', 'co', new Date(AHORA.getTime() + 20 * 3600000), AHORA)
    expect(p.dias).toBe(1)
    expect(p.monto).toBe(MINIMO_WOMPI)
  })

  it('un año pagado por adelantado: los meses que faltan, sin descuento', () => {
    const p = prorrateoAdicionales({ cobradores: 1 }, 'growth', 'co', new Date(AHORA.getTime() + 300 * DIA), AHORA)
    expect(p.monto).toBe(190000)
  })

  it('ya vencido: no hay días que cobrar aparte, van con la renovación', () => {
    const p = prorrateoAdicionales({ cobradores: 1 }, 'growth', 'co', new Date(AHORA.getTime() - DIA), AHORA)
    expect(p.monto).toBe(0)
  })
})

describe('cada pago del plan los suma', () => {
  it('el cobro mensual: plan + adicionales, con el desglose', () => {
    org.cobradoresAdicionales = 1
    const c = montoDelCobro({ org, plan: 'growth', ultima: subs[0], ahora: AHORA })
    expect(c).toMatchObject({ monto: 98000, montoPlan: 79000, adicionales: 19000, porRevisar: false })
  })

  it('el trimestre: el plan con su 10 % y los adicionales a precio de lista', () => {
    org.cobradoresAdicionales = 1
    const p = precioCheckout(org, 'growth', 'trimestral', AHORA)
    expect(p.total).toBe(Math.round(79000 * 3 * 0.9) + 19000 * 3)
    expect(p.adicionales).toBe(57000)
  })

  it('un pago con el cobrador incluido cuadra; uno sin él también (el panel puede apuntar solo el plan)', () => {
    org.cobradoresAdicionales = 1
    expect(pagoCuadra(org, 'growth', 98000)).toBe(true)
    expect(pagoCuadra(org, 'growth', 79000)).toBe(true)
    expect(pagoCuadra(org, 'growth', 90000)).toBe(false)
  })

  it('el panel enseña el cobro con adicionales y el pago a mano igual', () => {
    org.rutasAdicionales = 1
    const r = resumenPrecio(org, { pagada: subs[0], ultima: subs[0], ahora: AHORA })
    expect(r.proximoCobro).toMatchObject({ monto: 108000, adicionales: 29000, aMano: 108000 })
  })

  it('⚠ pagó con 2 cobradores y compró un tercero: el cobro trae los TRES ($136.000)', () => {
    /* El fallo de la revisión del 24 sep 2026: comparado con los adicionales de
       HOY, el pago de $117.000 parecía «por debajo» y el cobro se quedaba ahí. */
    org.cobradoresAdicionales = 3
    const pagada = { plan: 'growth', estado: 'activa', montoCOP: 117000, montoAdicionales: 38000, fechaVencimiento: subs[0].fechaVencimiento }
    const c = montoDelCobro({ org, plan: 'growth', pagada, ultima: pagada, ahora: AHORA })
    expect(c).toMatchObject({ monto: 136000, montoPlan: 79000, adicionales: 57000, porRevisar: false })
  })

  it('⚠ un precio viejo «por revisar» ($60.000) no se come los adicionales que compre', () => {
    org.cobradoresAdicionales = 1
    const pagada = { plan: 'growth', estado: 'activa', montoCOP: 60000, montoAdicionales: 0, fechaVencimiento: subs[0].fechaVencimiento }
    const c = montoDelCobro({ org, plan: 'growth', pagada, ultima: pagada, ahora: AHORA })
    expect(c).toMatchObject({ porRevisar: true, montoPlan: 60000, monto: 79000 })
  })

  it('un mes con muchos adicionales no se confunde con un trimestre del plan', () => {
    /* $212.000 = Crecimiento + 7 cobradores; parecido al trimestre ($213.300). */
    org.cobradoresAdicionales = 7
    const pagada = { plan: 'growth', estado: 'activa', montoCOP: 212000, montoAdicionales: 133000, fechaVencimiento: subs[0].fechaVencimiento }
    const c = montoDelCobro({ org, plan: 'growth', pagada, ultima: pagada, ahora: AHORA })
    expect(c).toMatchObject({ monto: 212000, porRevisar: false })
  })

  it('un pago a mano: separa los adicionales solo si el resto es un precio del plan', () => {
    org.cobradoresAdicionales = 2
    expect(adicionalesDelMonto(org, 'growth', 'trimestral', 327300)).toBe(114000)
    expect(adicionalesDelMonto(org, 'growth', 'mensual', 79000)).toBe(0)
    expect(adicionalesDelMonto(org, 'growth', 'mensual', 90000)).toBe(0)
    expect(adicionalesDelMonto({ ...org, cobradoresAdicionales: 0 }, 'growth', 'mensual', 98000)).toBe(0)
  })

  it('adicionalesMensual lee las columnas del negocio', () => {
    expect(adicionalesMensual({ ...org, cobradoresAdicionales: 2, rutasAdicionales: 1 }, 'growth')).toBe(67000)
  })
})

describe('la referencia de Wompi', () => {
  it('la compra de adicionales dice cuántos y NO parece un periodo del plan', () => {
    const ref = referenciaDeAdicionales('cmm7iigyr00011t2rwyg9luph', 'growth', { cobradores: 2, rutas: 1 })
    expect(leerReferencia(ref)).toMatchObject({
      orgId: 'cmm7iigyr00011t2rwyg9luph', plan: 'growth', periodo: 'adicionales',
      adicionales: { cobradores: 2, rutas: 1 },
    })
  })

  it('las del plan se leen como siempre', () => {
    const ref = referenciaDeCobro('org1', 'standard', 'trimestral')
    const p = leerReferencia(ref)
    expect(p).toMatchObject({ orgId: 'org1', plan: 'standard', periodo: 'trimestral' })
    expect(p.adicionales).toBeUndefined()
  })

  it('la del plan dice con cuántos adicionales se cobró, y el periodo sale limpio', () => {
    const ref = referenciaDeCobro('org1', 'growth', 'trimestral', { cobradores: 2, rutas: 1 })
    expect(ref).toMatch(/-trimestralc2r1-/)
    expect(leerReferencia(ref)).toMatchObject({ orgId: 'org1', plan: 'growth', periodo: 'trimestral', conAdicionales: { cobradores: 2, rutas: 1 } })
  })

  it('la del cobro automático lleva su marca', () => {
    const ref = referenciaDeCobro('org1', 'growth', 'mensual', { cobradores: 1, rutas: 0 }, { automatico: true })
    expect(leerReferencia(ref)).toMatchObject({ periodo: 'mensual', conAdicionales: { cobradores: 1, rutas: 0, automatico: true } })
    expect(leerReferencia(referenciaDeCobro('org1', 'growth', 'mensual', { cobradores: 1, rutas: 0 })).conAdicionales.automatico).toBe(false)
  })

  it('una de adicionales mal formada no se lee (no activa nada por error)', () => {
    expect(leerReferencia('cf-org1-growth-adicXx1-123')).toBeNull()
  })
})

describe('cuándo agregar se paga aparte', () => {
  it('con el plan vigente, aunque sea una cortesía de $0', () => {
    expect(planVigente(subs[0], org, AHORA)).toBe(true)
    expect(planVigente({ ...subs[0], montoCOP: 0 }, org, AHORA)).toBe(true)
    expect(planVigente({ ...subs[0], fechaVencimiento: new Date(AHORA.getTime() - 1) }, org, AHORA)).toBe(false)
    expect(planVigente(null, org, AHORA)).toBe(false)
  })

  it('en la prueba no: ahí se eligen para pagarlos con el plan', () => {
    const demoDelPanel = { ...org, planOriginal: 'growth', planDemoHasta: new Date(AHORA.getTime() + 5 * DIA) }
    expect(planVigente({ ...subs[0], montoCOP: 0 }, demoDelPanel, AHORA)).toBe(false)
  })

  it('⚠ la prueba del REGISTRO (sin planOriginal) también es prueba', () => {
    const registro = { ...org, planOriginal: null, planDemoHasta: new Date(AHORA.getTime() + 10 * DIA) }
    expect(planVigente({ ...subs[0], montoCOP: 0 }, registro, AHORA)).toBe(false)
  })

  it('⚠ un cliente que PAGA con un demo del panel encima: se paga aparte', () => {
    const pagaConDemo = { ...org, planOriginal: 'growth', planDemoHasta: new Date(AHORA.getTime() + 5 * DIA) }
    expect(planVigente(subs[0], pagaConDemo, AHORA)).toBe(true)
  })

  it('las cantidades: enteros de 0 a 50', () => {
    expect(leerCantidad(3)).toBe(3)
    expect(leerCantidad('2')).toBe(2)
    expect(leerCantidad(-1)).toBeNull()
    expect(leerCantidad(1.5)).toBeNull()
    expect(leerCantidad(51)).toBeNull()
    expect(leerCantidad(undefined)).toBeNull()
  })
})

describe('cambiar sin pagar aparte', () => {
  it('⚠ con el plan vigente NO se sube gratis: hay que pagar los días', async () => {
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    expect(r).toMatchObject({ status: 409, requierePago: true })
    expect(org.cobradoresAdicionales).toBe(0)
  })

  it('⚠ una cortesía ($0) tampoco los sube gratis', async () => {
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 0, fechaVencimiento: new Date(AHORA.getTime() + 10 * DIA) }]
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    expect(r).toMatchObject({ status: 409, requierePago: true })
  })

  it('en la prueba se eligen libres: van con el pago del plan', async () => {
    Object.assign(org, { planOriginal: 'growth', planDemoHasta: new Date(AHORA.getTime() + 5 * DIA) })
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 0, fechaVencimiento: new Date(AHORA.getTime() + 5 * DIA) }]
    await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    expect(r.error).toBeUndefined()
    expect(org.cobradoresAdicionales).toBe(2)
  })

  it('con el cobro del plan en vuelo no se sube gratis (al aprobarse no recorta)', async () => {
    Object.assign(org, { planDemoHasta: new Date(AHORA.getTime() + 5 * DIA), cobroRefPendiente: 'cf-org1-growth-mensualc0r0a-1' })
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 0, fechaVencimiento: new Date(AHORA.getTime() + 5 * DIA) }]
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    expect(r.status).toBe(409)
    expect(org.cobradoresAdicionales).toBe(0)
  })

  it('quitar con el plan vigente es al instante', async () => {
    org.cobradoresAdicionales = 1
    usuarios = 2
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: -1, ahora: AHORA })
    expect(r.error).toBeUndefined()
    expect(org.cobradoresAdicionales).toBe(0)
  })

  it('⚠ quitar resta sobre la BASE: el recién pagado no se va con la cifra vieja de la pantalla', async () => {
    org.cobradoresAdicionales = 3   // el webhook acaba de sumar el tercero; la pantalla aún dice 2
    usuarios = 2
    await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: -1, ahora: AHORA })
    expect(org.cobradoresAdicionales).toBe(2)
  })

  it('no baja de cero', async () => {
    usuarios = 1
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'rutas', delta: -1, ahora: AHORA })
    expect(r.status).toBe(409)
    expect(org.rutasAdicionales).toBe(0)
  })

  it('⚠ no se quita el cupo de un cobrador que está trabajando', async () => {
    org.cobradoresAdicionales = 1
    usuarios = 3
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: -1, ahora: AHORA })
    expect(r.status).toBe(409)
    expect(r.error).toMatch(/3 usuarios activos/)
    expect(org.cobradoresAdicionales).toBe(1)
  })

  it('en un plan que no los admite, no', async () => {
    org.plan = 'basic'
    subs = [{ plan: 'basic', estado: 'activa', montoCOP: 59000, fechaVencimiento: new Date(AHORA.getTime() + 10 * DIA) }]
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: 1, ahora: AHORA })
    expect(r.status).toBe(400)
  })

  it('fuera de Wompi se piden por WhatsApp', async () => {
    org.country = 'mx'
    const r = await cambiarAdicionales({ organizationId: 'org1', tipo: 'cobradores', delta: -1, ahora: AHORA })
    expect(r.status).toBe(403)
  })

  it('un tipo o un cambio raro no pasa', async () => {
    expect((await cambiarAdicionales({ organizationId: 'org1', tipo: 'clientes', delta: 1, ahora: AHORA })).status).toBe(400)
    expect((await cambiarAdicionales({ organizationId: 'org1', tipo: 'rutas', delta: 1.5, ahora: AHORA })).status).toBe(400)
  })

  it('el estado para la pantalla: cupo, uso, vencimiento y lo que suman', async () => {
    org.cobradoresAdicionales = 1
    org.cobradoresExtra = 1
    const e = await estadoAdicionales('org1', AHORA)
    expect(e).toMatchObject({
      plan: 'growth', admite: true, gateway: 'wompi', pagado: true,
      incluidos: { usuarios: 2, rutas: 3 },
      regalados: { cobradores: 1, rutas: 0 },
      adicionales: { cobradores: 1, rutas: 0 },
      cupo: { usuarios: 4, rutas: 3 },
      mensual: 19000,
    })
  })
})

describe('la compra que aprueba Wompi', () => {
  /* La compra mira el reloj de verdad (los días que faltan AHORA). */
  beforeEach(() => {
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 79000, fechaVencimiento: new Date(Date.now() + 16 * DIA) }]
  })
  const compra = () => aplicarCompraAdicionales({
    organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 1, rutas: 1 },
    montoCOP: 25600, gatewayId: 'tx-77', referencia: 'cf-org1-growth-adic1x1-1',
  })

  it('suma el cupo, lo apunta en el libro y deja rastro', async () => {
    const r = await compra()
    expect(r).toEqual({ ok: true })
    expect(org).toMatchObject({ cobradoresAdicionales: 1, rutasAdicionales: 1 })
    expect(libro).toHaveLength(1)
    expect(libro[0]).toMatchObject({ periodo: 'adicionales', montoCOP: 25600, gatewayId: 'tx-77' })
    expect(logs[0]).toMatchObject({ accion: 'adicionales_comprados', userId: 'owner1' })
  })

  it('⚠ el webhook repetido NO suma otra vez', async () => {
    await compra()
    const r = await compra()
    expect(r.yaProcesado).toBe(true)
    expect(org).toMatchObject({ cobradoresAdicionales: 1, rutasAdicionales: 1 })
    expect(libro).toHaveLength(1)
  })

  it('⚠ lo pagado no alcanza para lo que dice la referencia: no se abre nada', async () => {
    const r = await aplicarCompraAdicionales({
      organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 50, rutas: 50 },
      montoCOP: 1500, gatewayId: 'tx-trampa', referencia: 'cf-org1-growth-adic50x50-1',
    })
    expect(r.ok).toBe(false)
    expect(org).toMatchObject({ cobradoresAdicionales: 0, rutasAdicionales: 0 })
    expect(libro).toHaveLength(0)
  })

  it('⚠ un checkout viejo pagado DESPUÉS de renovar no da un mes entero por lo de un día', async () => {
    /* Armado con 1 día para vencer: 5 cobradores por $3.200. Pagado cuando el
       plan ya renovó (vence en 31 días). */
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 79000, fechaVencimiento: new Date(Date.now() + 31 * DIA) }]
    const r = await aplicarCompraAdicionales({
      organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 5, rutas: 0 },
      montoCOP: 3200, gatewayId: 'tx-viejo', referencia: 'cf-org1-growth-adic5x0-1',
    })
    expect(r.ok).toBe(false)
    expect(org.cobradoresAdicionales).toBe(0)
  })

  it('pagado a los minutos de cotizar, alcanza', async () => {
    subs = [{ plan: 'growth', estado: 'activa', montoCOP: 79000, fechaVencimiento: new Date(Date.now() + 16 * DIA) }]
    const r = await aplicarCompraAdicionales({
      organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 1, rutas: 0 },
      montoCOP: 10100, gatewayId: 'tx-ya', referencia: 'cf-org1-growth-adic1x0-1',
    })
    expect(r).toEqual({ ok: true })
    expect(org.cobradoresAdicionales).toBe(1)
  })

  it('no pasa del tope de 50 aunque entren dos compras', async () => {
    org.cobradoresAdicionales = 50
    const r = await compra()
    expect(r.ok).toBe(false)
    expect(org.cobradoresAdicionales).toBe(50)
  })

  it('si el plan ya no los admite, no se suman', async () => {
    org.plan = 'basic'
    subs = [{ plan: 'basic', estado: 'activa', montoCOP: 59000, fechaVencimiento: new Date(Date.now() + 16 * DIA) }]
    const r = await compra()
    expect(r.ok).toBe(false)
  })

  it('dos webhooks a la vez: el segundo choca con el id único y cuenta como ya aplicado', async () => {
    const primero = compra()
    const segundo = compra()
    const r = await Promise.all([primero, segundo])
    expect(r.filter((x) => x.yaProcesado)).toHaveLength(1)
    expect(org.cobradoresAdicionales).toBe(1)
    expect(libro).toHaveLength(1)
  })

  it('una compra sin cantidad es un error, no un +0 callado', async () => {
    await expect(aplicarCompraAdicionales({ organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 0, rutas: 0 }, montoCOP: 1500, gatewayId: 'tx-0' }))
      .rejects.toThrow()
  })
})
