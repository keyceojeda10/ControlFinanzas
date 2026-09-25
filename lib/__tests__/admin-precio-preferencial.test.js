// lib/__tests__/admin-precio-preferencial.test.js
//
// Lo que el panel ESCRIBE. Se ejecuta la ruta de verdad contra una base de
// mentira, porque lo que importa es qué queda guardado:
//
//   · «Asignar plan» por debajo del precio no se deja sin decidir qué pasa con
//     los cobros que vienen: así nacieron los 10 precios que nadie sabía;
//   · un preferencial mal puesto no deja un pago a medias;
//   · decidir el precio es revisar el pago: deja de salir «por revisar».

import { describe, it, expect, vi, beforeEach } from 'vitest'

const DIA = 86400000
let org
let escrito

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'adm1', rol: 'superadmin' } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('bcryptjs', () => ({ default: {} }))
vi.mock('@/lib/email', () => ({
  enviarEmail: vi.fn(async () => {}),
  emailPagoAprobado: vi.fn(() => ({ subject: 's', html: 'h' })),
}))
vi.mock('@/lib/libro-pagos', () => ({ registrarPagoSuscripcion: vi.fn(async () => {}) }))
vi.mock('@/lib/cobro-intento', () => ({ ultimoPago: vi.fn(), ultimaSuscripcion: vi.fn() }))

vi.mock('@/lib/prisma', () => {
  const p = {
    organization: {
      findUnique: vi.fn(async () => ({ ...org })),
      update: vi.fn(async ({ data }) => { escrito.org.push(data); Object.assign(org, data); return org }),
    },
    suscripcion: {
      findFirst: vi.fn(async () => null),
      update: vi.fn(async ({ data }) => { escrito.sub.push(data) }),
      create: vi.fn(async ({ data }) => { escrito.sub.push(data) }),
      count: vi.fn(async () => 1),
    },
    /* Como MariaDB: `detalle` es VARCHAR(191) y un texto más largo no se guarda. */
    adminLog: {
      create: vi.fn(async ({ data }) => {
        if (data.detalle?.length > 191) throw Object.assign(new Error('value too long: detalle'), { code: 'P2000' })
        escrito.log.push(data.detalle)
      }),
    },
    user: { findFirst: vi.fn(async () => null) },
  }
  p.$transaction = vi.fn(async (fn) => fn(p))
  return { prisma: p }
})

const { PATCH } = await import('@/app/api/admin/organizaciones/[id]/route')
const { ultimoPago, ultimaSuscripcion } = await import('@/lib/cobro-intento')
const { registrarPagoSuscripcion } = await import('@/lib/libro-pagos')

const patch = async (body) => {
  const res = await PATCH(
    new Request('http://localhost/api/admin/organizaciones/org1', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: 'org1' }) },
  )
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  escrito = { org: [], sub: [], log: [] }
  org = {
    id: 'org1', nombre: 'Negocio', plan: 'basic', planOriginal: null, country: 'co', referidoPorId: null,
    precioPreferencial: null, precioPreferencialPlan: null, precioPreferencialHasta: null,
    precioPreferencialNota: null, precioPagoRevisado: null,
  }
  ultimoPago.mockResolvedValue(null)
  ultimaSuscripcion.mockResolvedValue(null)
})

describe('⚠ asignar plan por debajo del precio', () => {
  it('sin decir qué pasa con los próximos cobros, no escribe NADA', async () => {
    const r = await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000 })
    expect(r.status).toBe(400)
    expect(r.json).toMatchObject({ requiereDecision: true, oferta: 59000 })
    expect(escrito).toEqual({ org: [], sub: [], log: [] })
    expect(registrarPagoSuscripcion).not.toHaveBeenCalled()
  })

  it('«a lista»: queda revisado y los cobros siguen a lista', async () => {
    const r = await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000, proximosCobros: 'lista' })
    expect(r.status).toBe(200)
    expect(escrito.org[0]).toMatchObject({ plan: 'basic', precioPagoRevisado: 45000 })
    expect(escrito.org[0]).not.toHaveProperty('precioPreferencial')
    expect(escrito.log[0]).toMatch(/Próximos cobros: a lista \(\$59\.000\/mes\)/)
  })

  it('«a lista» con un preferencial de ese plan: se lo quita', async () => {
    Object.assign(org, { precioPreferencial: 50000, precioPreferencialPlan: 'basic' })
    await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000, proximosCobros: 'lista' })
    expect(escrito.org[0]).toMatchObject({ precioPreferencial: null, precioPreferencialPlan: null, precioPagoRevisado: 45000 })
  })

  it('«preferencial» por 3 cobros: se guarda con su fecha, contada desde el vencimiento nuevo', async () => {
    const r = await patch({
      accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000,
      proximosCobros: 'preferencial', precioPreferencial: 45000, cobrosPreferencial: 3, notaPreferencial: 'amigo',
    })
    expect(r.status).toBe(200)
    const data = escrito.org[0]
    expect(data).toMatchObject({ precioPreferencial: 45000, precioPreferencialPlan: 'basic', precioPreferencialNota: 'amigo', precioPagoRevisado: 45000 })
    /* vence en 30 días; el tercer cobro empieza 60 días después de eso */
    const dias = (new Date(data.precioPreferencialHasta) - Date.now()) / DIA
    expect(dias).toBeGreaterThan(89)
    expect(dias).toBeLessThan(92)
    expect(escrito.log[0]).toMatch(/Próximos cobros: precio preferencial, Básico a \$45\.000\/mes/)
  })

  it('«preferencial» sin precio: toma lo cobrado por mes', async () => {
    await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'trimestral', monto: 120000, proximosCobros: 'preferencial' })
    expect(escrito.org[0]).toMatchObject({ precioPreferencial: 40000, precioPreferencialHasta: null })
  })

  it('⚠ un preferencial mal puesto no deja el pago a medias', async () => {
    const r = await patch({
      accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000,
      proximosCobros: 'preferencial', precioPreferencial: 45000, hastaPreferencial: '2020-01-01',
    })
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/antes del próximo cobro/)
    expect(escrito).toEqual({ org: [], sub: [], log: [] })
  })
})

describe('asignar plan que no necesita decisión', () => {
  it('a precio de lista: nada de precio', async () => {
    await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'trimestral', monto: 159300 })
    expect(escrito.org[0]).toEqual({ plan: 'basic', activo: true, cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })

  it('cortesía ($0): no pide decisión', async () => {
    const r = await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 0 })
    expect(r.status).toBe(200)
    expect(escrito.org[0]).toEqual({ plan: 'basic', activo: true, cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })

  it('su preferencial de siempre: cuadra, no pide nada', async () => {
    Object.assign(org, { precioPreferencial: 40000, precioPreferencialPlan: 'basic' })
    const r = await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 40000 })
    expect(r.status).toBe(200)
    expect(escrito.org[0]).toEqual({ plan: 'basic', activo: true, cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })

  it('por encima de la lista: no pide decisión pero queda revisado', async () => {
    await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 70000 })
    expect(escrito.org[0]).toEqual({ plan: 'basic', activo: true, precioPagoRevisado: 70000, cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })
})

describe('poner y quitar el preferencial desde la ficha', () => {
  it('guardar marca revisado el último pago y lo apunta con el antes', async () => {
    ultimoPago.mockResolvedValue({ plan: 'basic', montoCOP: 45000 })
    ultimaSuscripcion.mockResolvedValue({ plan: 'basic', estado: 'activa', fechaVencimiento: new Date(Date.now() + 5 * DIA) })
    const r = await patch({ accion: 'precioPreferencial', plan: 'basic', precio: 45000 })
    expect(r.status).toBe(200)
    expect(escrito.org[0]).toMatchObject({ precioPreferencial: 45000, precioPreferencialHasta: null, precioPagoRevisado: 45000 })
    expect(escrito.log[0]).toMatch(/Básico a \$45\.000\/mes \(lista \$59\.000\), definitivo\. Antes: sin precio preferencial/)
  })

  it('una fecha antes del próximo cobro se rechaza sin escribir', async () => {
    ultimaSuscripcion.mockResolvedValue({ plan: 'basic', estado: 'activa', fechaVencimiento: new Date(Date.now() + 20 * DIA) })
    const r = await patch({ accion: 'precioPreferencial', plan: 'basic', precio: 45000, hasta: new Date(Date.now() + 5 * DIA).toISOString().slice(0, 10) })
    expect(r.status).toBe(400)
    expect(escrito.org).toEqual([])
  })

  it('el precio de lista no es preferencial', async () => {
    const r = await patch({ accion: 'precioPreferencial', plan: 'basic', precio: 59000 })
    expect(r.status).toBe(400)
    expect(escrito.org).toEqual([])
  })

  it('quitar: vacía los cuatro campos y marca revisado el pago', async () => {
    Object.assign(org, { precioPreferencial: 40000, precioPreferencialPlan: 'basic' })
    ultimoPago.mockResolvedValue({ plan: 'basic', montoCOP: 40000 })
    await patch({ accion: 'quitarPrecioPreferencial' })
    expect(escrito.org[0]).toEqual({
      precioPreferencial: null, precioPreferencialPlan: null, precioPreferencialHasta: null,
      precioPreferencialNota: null, precioPagoRevisado: 40000,
    })
    expect(escrito.log[0]).toMatch(/Precio preferencial quitado/)
  })

  it('«cobrar lista» a un pago por revisar sin preferencial', async () => {
    ultimoPago.mockResolvedValue({ plan: 'basic', montoCOP: 45000 })
    await patch({ accion: 'quitarPrecioPreferencial' })
    expect(escrito.org[0].precioPagoRevisado).toBe(45000)
    expect(escrito.log[0]).toMatch(/Pago de \$45\.000 .* revisado: próximos cobros a lista/)
  })
})

describe('⚠ el registro no tumba lo ya guardado', () => {
  const larga = 'x'.repeat(191)

  it('una nota larga con su «antes» cabe en los 191 caracteres del registro', async () => {
    Object.assign(org, { precioPreferencial: 50000, precioPreferencialPlan: 'basic', precioPreferencialNota: larga })
    ultimaSuscripcion.mockResolvedValue({ plan: 'basic', estado: 'activa', fechaVencimiento: new Date(Date.now() + 5 * DIA) })
    const r = await patch({ accion: 'precioPreferencial', plan: 'basic', precio: 45000, cobros: 3, nota: larga })
    expect(r.status).toBe(200)
    expect(escrito.log).toHaveLength(1)
    expect(escrito.log[0].length).toBeLessThanOrEqual(191)
    expect(escrito.log[0]).toMatch(/^Precio preferencial de "Negocio": Básico a \$45\.000\/mes/)
  })

  it('asignar un plan con preferencial y nota larga responde 200: el pago ya está apuntado', async () => {
    const r = await patch({
      accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000,
      proximosCobros: 'preferencial', cobrosPreferencial: 3, notaPreferencial: larga,
    })
    expect(r.status).toBe(200)
    expect(registrarPagoSuscripcion).toHaveBeenCalledTimes(1)
    expect(escrito.log[0].length).toBeLessThanOrEqual(191)
  })

  it('si el registro falla del todo, el pago asignado no responde 500', async () => {
    const { prisma } = await import('@/lib/prisma')
    prisma.adminLog.create.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'P2003' }))
    const r = await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 45000, proximosCobros: 'lista' })
    expect(r.status).toBe(200)
    expect(registrarPagoSuscripcion).toHaveBeenCalledTimes(1)
  })
})

/* ⚠ Un pago apuntado a mano con adicionales guarda cuánto fue de ellos: si no,
   «por revisar» lo tomaba entero por plan y el cobro automático salía en
   $92.550 en vez de $117.000 (revisión del 24 sep 2026). */
describe('asignar plan con adicionales', () => {
  beforeEach(() => { Object.assign(org, { plan: 'growth', cobradoresAdicionales: 2, rutasAdicionales: 0 }) })

  it('trimestre + 2 cobradores ($327.300): guarda $114.000 de adicionales', async () => {
    const r = await patch({ accion: 'asignarPlan', plan: 'growth', periodo: 'trimestral', monto: 213300 + 2 * 19000 * 3 })
    expect(r.status).toBe(200)
    expect(escrito.sub[0].montoAdicionales).toBe(114000)
  })

  it('solo el plan ($79.000): nada de adicionales', async () => {
    await patch({ accion: 'asignarPlan', plan: 'growth', periodo: 'mensual', monto: 79000 })
    expect(escrito.sub[0].montoAdicionales).toBe(0)
  })

  it('a Básico: los adicionales se van y el pago no lleva', async () => {
    await patch({ accion: 'asignarPlan', plan: 'basic', periodo: 'mensual', monto: 59000 })
    expect(escrito.sub[0].montoAdicionales).toBe(0)
    expect(escrito.org[0]).toMatchObject({ cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })
})
