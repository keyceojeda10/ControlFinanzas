import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { LIMITES_PLAN } from '@/lib/calculos'
import { getServerSession } from 'next-auth'

// La carga del dueño no duplica si la red se corta (Task 9). Se llama a los
// handlers DE VERDAD (`POST /api/clientes`, `POST /api/prestamos`) contra una
// base de mentira en memoria: lo que se mide es cuántas filas y cuántos
// movimientos de capital quedan después de repetir la misma petición.

const db = vi.hoisted(() => ({ clientes: [], prestamos: [], movimientos: [], seq: 0, plan: 'pro', usuario: null }))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({ user: { organizationId: 'org1', id: 'u1', rol: 'owner', country: 'co', plan: 'pro' } })),
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/suscripcion', () => ({ bloquearSiSuscripcionVencida: vi.fn(async () => null) }))
vi.mock('@/lib/limites-plan', () => ({ rutaPermitida: vi.fn(async () => true) }))
vi.mock('@/lib/activity-log', () => ({ logActividad: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/notificar', () => ({ notificar: vi.fn(), plata: (n) => String(n) }))
vi.mock('@/lib/capi-activacion', () => ({ dispararTrasCrear: vi.fn() }))
vi.mock('@/lib/geocoding', () => ({ geocodeAddress: vi.fn(async () => null) }))
vi.mock('@/lib/dinero/cliente-en-perdidos', () => ({ perdidosDelCliente: vi.fn(async () => null), textoClienteEnPerdidos: () => '' }))
vi.mock('@/lib/capital', () => ({
  asegurarCapital: vi.fn(async () => {}),
  registrarMovimientoCapital: vi.fn(async (_tx, mov) => { db.movimientos.push(mov) }),
}))

vi.mock('@/lib/prisma', () => {
  const nuevoId = (p) => `${p}${++db.seq}`
  const coincide = (row, where = {}) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('not' in v) return row[k] !== v.not
      if ('notIn' in v) return !v.notIn.includes(row[k])
      if ('gte' in v) return row[k] >= v.gte
      return true
    }
    return row[k] === v
  })
  const cliente = {
    findFirst: async ({ where }) => db.clientes.find((c) => coincide(c, where)) ?? null,
    findMany: async ({ where }) => db.clientes.filter((c) => coincide(c, where)).map((c) => ({ ...c, ruta: null })),
    count: async ({ where }) => db.clientes.filter((c) => coincide(c, where)).length,
    aggregate: async () => ({ _max: { ordenRuta: null } }),
    create: async ({ data }) => { const c = { id: nuevoId('cli'), estado: 'activo', createdAt: new Date(), ...data }; db.clientes.push(c); return c },
    update: async ({ where, data }) => { const c = db.clientes.find((x) => x.id === where.id); Object.assign(c, data); return c },
  }
  const prestamo = {
    findFirst: async ({ where }) => db.prestamos.find((p) => coincide(p, where)) ?? null,
    findMany: async ({ where }) => db.prestamos.filter((p) => coincide(p, where)),
    findUnique: async ({ where }) => db.prestamos.find((p) => p.id === where.id) ?? null,
    create: async ({ data }) => { const p = { id: nuevoId('pre'), estado: 'activo', createdAt: new Date(), ...data }; db.prestamos.push(p); return { ...p } },
    update: async ({ where, data }) => { const p = db.prestamos.find((x) => x.id === where.id); Object.assign(p, data); return p },
  }
  const tx = {
    cliente, prestamo,
    $queryRaw: async () => [{ id: 'cap1', saldo: 1e12 }],
    cuotaAmortizacion: { createMany: async () => ({ count: 0 }) },
    pago: { create: async () => ({}), findMany: async () => [], aggregate: async () => ({ _sum: { monto: 0, montoCapital: 0, montoInteres: 0 } }) },
    permisoPrestamo: { updateMany: async () => ({ count: 1 }) },
  }
  return {
    prisma: {
      ...tx,
      organization: { findUnique: async () => ({ plan: db.plan, clientesExtra: 0, capitalEstricto: false, requiereAprobacionPrestamos: false }) },
      user: { findUnique: async () => db.usuario },
      ruta: { findFirst: async () => null, findMany: async () => [] },
      socio: { findFirst: async () => null },
      $transaction: async (fn) => fn(tx),
    },
  }
})

let postCliente, postPrestamo
beforeAll(async () => {
  ;({ POST: postCliente } = await import('@/app/api/clientes/route.js'))
  ;({ POST: postPrestamo } = await import('@/app/api/prestamos/route.js'))
})
beforeEach(() => { db.clientes.length = 0; db.prestamos.length = 0; db.movimientos.length = 0; db.plan = 'pro'; db.usuario = null })

const pedir = (url, body) => new Request(`http://localhost${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const crearCliente = async (body) => {
  const res = await postCliente(pedir('/api/clientes', body))
  return { status: res.status, data: await res.json() }
}
const crearPrestamo = async (body) => {
  const res = await postPrestamo(pedir('/api/prestamos', body))
  return { status: res.status, data: await res.json() }
}

describe('POST /api/clientes con el marcador de la fila', () => {
  const marcador = 'SIN-C_cmi9x8q2a0001ab12cd34ef56_1-3'

  it('el segundo POST con el mismo SIN-C… es 409 con el existingId del primero', async () => {
    const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(a.status).toBe(201)
    const b = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(b.status).toBe(409)
    expect(b.data).toMatchObject({ error: 'Ya existe un cliente con esa cédula', existingId: a.data.id })
    expect(b.data.bloqueada).toBeUndefined()
    expect(db.clientes).toHaveLength(1)
  })

  it('aunque el reintento vaya a otra ruta: es el mismo cliente de la misma carga', async () => {
    const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    const b = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador, rutaId: 'otra' })
    expect(b.status).toBe(409)
    expect(b.data.existingId).toBe(a.data.id)
  })

  it('el de otro negocio no cuenta', async () => {
    db.clientes.push({ id: 'ajeno', organizationId: 'org2', cedula: marcador, estado: 'activo' })
    const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(a.status).toBe(201)
    expect(a.data.id).not.toBe('ajeno')
  })

  it('el eliminado con ese marcador se reactiva, como cualquier cédula', async () => {
    const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    db.clientes[0].estado = 'eliminado'
    const b = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(b.status).toBe(201)
    expect(b.data.id).toBe(a.data.id)
    expect(b.data.estado).toBe('activo')
    expect(db.clientes).toHaveLength(1)
  })

  it('un SIN- normal sigue creando siempre (como hoy)', async () => {
    for (const cedula of ['SIN-m3k9x2ab', 'SIN-CARLOS-PEREZ']) {
      const a = await crearCliente({ nombre: 'Carlos Pérez', cedula })
      const b = await crearCliente({ nombre: 'Carlos Pérez', cedula })
      expect(a.status).toBe(201)
      expect(b.status).toBe(201)
      expect(b.data.id).not.toBe(a.data.id)
    }
    expect(db.clientes).toHaveLength(4)
  })

  it('sin cédula sigue poniendo un marcador nuevo cada vez', async () => {
    const a = await crearCliente({ nombre: 'Luis' })
    const b = await crearCliente({ nombre: 'Luis' })
    expect([a.status, b.status]).toEqual([201, 201])
    expect(a.data.cedula).toMatch(/^SIN-/)
    expect(a.data.cedula).not.toBe(b.data.cedula)
  })
})

describe('POST /api/clientes: el atajo SIN-C_ es solo del dueño', () => {
  const marcador = 'SIN-C_cmi9x8q2a0001ab12cd34ef56_9-9'
  const comoCobrador = () => {
    db.usuario = { puedeCrearClientes: true }
    getServerSession.mockResolvedValue({ user: { organizationId: 'org1', id: 'u2', rol: 'cobrador', country: 'co', plan: 'pro', rutaIds: [] } })
  }
  const comoDueno = () => getServerSession.mockResolvedValue({ user: { organizationId: 'org1', id: 'u1', rol: 'owner', country: 'co', plan: 'pro' } })

  it('un cobrador con SIN-C_ repetido crea siempre, como cualquier SIN-', async () => {
    comoCobrador()
    try {
      const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
      const b = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
      expect([a.status, b.status]).toEqual([201, 201])
      expect(b.data.id).not.toBe(a.data.id)
    } finally { comoDueno() }
  })

  it('con el cupo lleno, al cobrador el SIN-C_ que ya existe le da 403, no 409', async () => {
    db.plan = 'test'
    db.clientes.push({ id: 'cli-ultimo', organizationId: 'org1', cedula: marcador, estado: 'activo' })
    for (let i = 1; i < LIMITES_PLAN.test; i++) db.clientes.push({ id: `rel${i}`, organizationId: 'org1', cedula: `100${i}`, estado: 'activo' })
    comoCobrador()
    try {
      const r = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
      expect(r.status).toBe(403)
    } finally { comoDueno() }
  })

  it('el dueño sí lo reconoce', async () => {
    const a = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    const b = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(b.status).toBe(409)
    expect(b.data.existingId).toBe(a.data.id)
  })
})

describe('POST /api/clientes: el reintento del último cliente del cupo', () => {
  const marcador = 'SIN-C_cmi9x8q2a0001ab12cd34ef56_7-0'
  /* El plan `test` tiene tope; se llena hasta él con el cliente de la fila dentro. */
  const llenarHastaElTope = (deLaFila) => {
    db.plan = 'test'
    const tope = LIMITES_PLAN.test
    expect(Number.isFinite(tope)).toBe(true)
    db.clientes.push(deLaFila)
    for (let i = 1; i < tope; i++) db.clientes.push({ id: `rel${i}`, organizationId: 'org1', cedula: `100${i}`, estado: 'activo' })
  }

  it('⚠ con el cupo lleno, el SIN-C_ que ya existe da 409 con existingId, no 403', async () => {
    llenarHastaElTope({ id: 'cli-ultimo', organizationId: 'org1', cedula: marcador, estado: 'activo' })
    const r = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(r.status).toBe(409)
    expect(r.data).toMatchObject({ error: 'Ya existe un cliente con esa cédula', existingId: 'cli-ultimo' })
  })

  it('con el cupo lleno, una cédula nueva sigue dando 403 (como hoy)', async () => {
    llenarHastaElTope({ id: 'cli-ultimo', organizationId: 'org1', cedula: marcador, estado: 'activo' })
    for (const cedula of ['SIN-C_otra_1-1', 'SIN-m3k9x2ab', undefined]) {
      const r = await crearCliente({ nombre: 'Luis', cedula })
      expect(r.status).toBe(403)
      expect(r.data.limite).toBe('clientes')
    }
  })

  it('con el cupo lleno, el SIN-C_ eliminado no se reactiva saltándose el tope', async () => {
    llenarHastaElTope({ id: 'rel0', organizationId: 'org1', cedula: '1000', estado: 'activo' })
    db.clientes.push({ id: 'cli-borrado', organizationId: 'org1', cedula: marcador, estado: 'eliminado' })
    const r = await crearCliente({ nombre: 'Ana Pérez', cedula: marcador })
    expect(r.status).toBe(403)
  })
})

describe('POST /api/prestamos con idempotente', () => {
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  const cuerpo = (extra = {}) => ({
    clienteId: 'cli-ana', montoPrestado: 500000, tasaInteres: 20, diasPlazo: 30,
    fechaInicio: hoy, frecuencia: 'diario', modoInteres: 'fijo', yaEstabaEnLaCalle: true, ...extra,
  })
  beforeEach(() => {
    db.clientes.push({ id: 'cli-ana', organizationId: 'org1', nombre: 'Ana', cedula: 'SIN-C_x_1', rutaId: null, estado: 'activo', montoMaximoPrestamo: null })
  })
  const desembolsos = () => db.movimientos.filter((m) => m.tipo === 'desembolso')

  it('el segundo POST igual en menos de 15 min: 200, yaExistia, un solo préstamo y un solo desembolso', async () => {
    const a = await crearPrestamo(cuerpo({ idempotente: true }))
    expect(a.status).toBe(201)
    const b = await crearPrestamo(cuerpo({ idempotente: true }))
    expect(b.status).toBe(200)
    expect(b.data).toMatchObject({ id: a.data.id, yaExistia: true, montoPrestado: 500000, clienteId: 'cli-ana' })
    expect(db.prestamos).toHaveLength(1)
    expect(desembolsos()).toHaveLength(1)
    expect(db.movimientos).toHaveLength(1)
  })

  it('el reintento no vuelve a meter el abono previo', async () => {
    await crearPrestamo(cuerpo({ idempotente: true, yaAbonado: 100000 }))
    const movs = db.movimientos.length
    const b = await crearPrestamo(cuerpo({ idempotente: true, yaAbonado: 100000 }))
    expect(b.status).toBe(200)
    expect(db.movimientos.length).toBe(movs)
    expect(db.prestamos).toHaveLength(1)
  })

  it('sin idempotente crea dos, como hoy', async () => {
    const a = await crearPrestamo(cuerpo())
    const b = await crearPrestamo(cuerpo())
    expect([a.status, b.status]).toEqual([201, 201])
    expect(b.data.yaExistia).toBeUndefined()
    expect(db.prestamos).toHaveLength(2)
    expect(desembolsos()).toHaveLength(2)
  })

  it('con huella distinta crea: otro monto, otra fecha u otra frecuencia', async () => {
    await crearPrestamo(cuerpo({ idempotente: true }))
    const ayer = new Date(Date.now() - 29 * 3600 * 1000).toISOString().slice(0, 10)
    for (const extra of [{ montoPrestado: 600000 }, { fechaInicio: ayer }, { frecuencia: 'semanal', diasPlazo: 28 }]) {
      const r = await crearPrestamo(cuerpo({ idempotente: true, ...extra }))
      expect(r.status).toBe(201)
      expect(r.data.yaExistia).toBeUndefined()
    }
    expect(db.prestamos).toHaveLength(4)
    expect(desembolsos()).toHaveLength(4)
  })

  it('pasados 15 minutos, crea', async () => {
    await crearPrestamo(cuerpo({ idempotente: true }))
    db.prestamos[0].createdAt = new Date(Date.now() - 16 * 60 * 1000)
    const b = await crearPrestamo(cuerpo({ idempotente: true }))
    expect(b.status).toBe(201)
    expect(db.prestamos).toHaveLength(2)
  })

  it('el cancelado no cuenta', async () => {
    await crearPrestamo(cuerpo({ idempotente: true }))
    db.prestamos[0].estado = 'cancelado'
    const b = await crearPrestamo(cuerpo({ idempotente: true }))
    expect(b.status).toBe(201)
    expect(db.prestamos).toHaveLength(2)
  })

  it('el de otro cliente no cuenta', async () => {
    db.clientes.push({ id: 'cli-otro', organizationId: 'org1', nombre: 'Otro', cedula: 'SIN-C_x_2', rutaId: null, estado: 'activo', montoMaximoPrestamo: null })
    await crearPrestamo(cuerpo({ idempotente: true }))
    const b = await crearPrestamo(cuerpo({ idempotente: true, clienteId: 'cli-otro' }))
    expect(b.status).toBe(201)
    expect(db.prestamos).toHaveLength(2)
  })

  it('solo `idempotente: true` lo activa (no «true» de texto ni 1)', async () => {
    await crearPrestamo(cuerpo({ idempotente: true }))
    const b = await crearPrestamo(cuerpo({ idempotente: 'true' }))
    expect(b.status).toBe(201)
    expect(db.prestamos).toHaveLength(2)
  })
})
