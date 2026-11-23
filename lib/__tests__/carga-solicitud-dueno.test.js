// lib/__tests__/carga-solicitud-dueno.test.js
//
// Plan «La carga de cartera la revisa y la carga el dueño» (22 nov 2026), tarea 2:
// la vida de la solicitud. Cada fila lleva su `_id`, el dueño apunta lo que crea,
// termina él, y a Carlos solo le llega la solicitud si el dueño pide ayuda.
//
// ⚠ Lo que está en juego es plata: un préstamo creado dos veces (la fila que el
// dueño ya creó y Carlos vuelve a importar, o lo ya creado que una relectura
// olvida) o un paso de «lo de después» que se salta o se repite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const m = vi.hoisted(() => {
  const db = {}
  const coincide = (sol, where = {}) => {
    if (!sol) return false
    if (where.id != null && sol.id !== where.id) return false
    if (where.estado != null) {
      const ok = typeof where.estado === 'string' ? sol.estado === where.estado : where.estado.in.includes(sol.estado)
      if (!ok) return false
    }
    if ('recordatorioAt' in where && where.recordatorioAt === null && sol.recordatorioAt != null) return false
    return true
  }
  const aplicar = (data) => { for (const [k, v] of Object.entries(data)) if (v !== undefined) db.sol[k] = v }
  const solicitudCarga = {
    findUnique: vi.fn(async ({ where, include }) => (db.sol && db.sol.id === where.id ? { ...db.sol, ...(include?.organization ? { organization: db.org } : {}) } : null)),
    update: vi.fn(async ({ data }) => { aplicar(data); return { ...db.sol } }),
    updateMany: vi.fn(async ({ where, data }) => { if (!coincide(db.sol, where)) return { count: 0 }; aplicar(data); return { count: 1 } }),
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async ({ where }) => (coincide(db.sol, { estado: where.estado }) && db.sol?.organizationId === where.organizationId ? { ...db.sol } : null)),
  }
  const tx = {
    $queryRaw: vi.fn(async () => []),
    solicitudCarga,
    prestamo: {
      findMany: vi.fn(async ({ where }) => db.prestamos.filter((p) => where.id.in.includes(p.id) && p.organizationId === where.organizationId
        && !(where.estado?.notIn ?? []).includes(p.estado ?? 'activo'))),
    },
    pago: {
      findMany: vi.fn(async ({ where }) => db.pagos.filter((p) => where.prestamoId.in.includes(p.prestamoId) && p.organizationId === where.organizationId && !where.tipo.notIn.includes(p.tipo))),
    },
  }
  const prisma = {
    $transaction: vi.fn(async (fn) => fn(tx)),
    solicitudCarga,
    prestamo: {
      findFirst: vi.fn(async ({ where }) => db.prestamos.find((p) => p.id === where.id && p.organizationId === where.organizationId && p.clienteId === where.clienteId) ?? null),
      findMany: tx.prestamo.findMany,
    },
    pago: { findMany: tx.pago.findMany },
    user: { findFirst: vi.fn(async () => db.dueno) },
    organization: { findUnique: vi.fn(async () => db.org) },
    ruta: { findFirst: vi.fn(async () => null) },
    actividadLog: { create: vi.fn(async ({ data }) => { db.actividad.push(data); return data }) },
  }
  return {
    db, prisma,
    sendMessage: vi.fn(async () => ({ ok: true })),
    notificar: vi.fn(async () => ({ avisados: 1 })),
    enviarPaso: vi.fn(async () => ({ enviado: true })),
    reiniciarPrueba: vi.fn(async () => new Date('2026-12-01T00:00:00Z')),
    validarCartera: vi.fn(),
    importarCartera: vi.fn(),
    leerArchivo: vi.fn(),
    tipoDeArchivo: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))
vi.mock('@/lib/almacen', () => ({ directorioAlmacen: () => '/tmp/almacen-prueba', rutaSegura: (partes) => `/tmp/almacen-prueba/${partes.join('/')}` }))
vi.mock('fs/promises', () => ({ mkdir: vi.fn(async () => {}), writeFile: vi.fn(async () => {}), readFile: vi.fn(async () => Buffer.from('x')) }))
vi.mock('@/lib/importar-cartera', () => ({ validarCartera: m.validarCartera, importarCartera: m.importarCartera }))
vi.mock('@/lib/telegram', () => ({ sendMessage: m.sendMessage, escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }))
vi.mock('@/lib/notificar', () => ({ notificar: m.notificar }))
vi.mock('@/lib/seguimiento/enviar', () => ({ enviarPaso: m.enviarPaso }))
vi.mock('@/lib/seguimiento/prueba', () => ({ reiniciarPrueba: m.reiniciarPrueba }))
vi.mock('@/lib/carga-asesor/lector', () => ({ tipoDeArchivo: m.tipoDeArchivo, leerArchivo: m.leerArchivo }))

const S = await import('@/lib/carga-asesor/solicitud')
const {
  conIds, filasDe, creadasDe, filasPendientes, apuntarCreada, terminarCarga, despuesDeCargar, pedirAyuda, devolverAlDueno,
  avisarListaParaRevisar, confirmarRecibida, guardarFilas, aprobarSolicitud, procesarSolicitud, vueltaDeCargas, resumenDeSolicitud,
  guardarArchivos, ESTADOS_ABIERTOS, ESTADOS_POR_ATENDER, ESTADOS_EDITABLES,
} = S

const raiz = path.resolve(__dirname, '..', '..')
const leer = (f) => readFileSync(path.join(raiz, f), 'utf8')
// Los comentarios de este repo citan a los clientes: se busca solo en el código.
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const fila = (n, k, extra = {}) => ({ _id: `${n}-${k}`, nombre: `Cliente ${n}-${k}`, montoPrestado: 100000, _archivo: n, _dudas: [], ...extra })
const solicitud = (over = {}) => ({
  id: 's1', organizationId: 'o1', estado: 'en_revision', origen: 'web', archivos: '[]', filas: JSON.stringify([fila(1, 0), fila(1, 1), fila(1, 2)]),
  resumen: JSON.stringify({}), nota: null, errorLectura: null, recordatorioAt: null, aprobadaAt: null, revisadaPorId: null,
  createdAt: new Date('2026-11-20T10:00:00Z'), updatedAt: new Date('2026-11-20T10:00:00Z'), ...over,
})
const poner = (over = {}) => { m.db.sol = solicitud(over) }
const resumenActual = () => JSON.parse(m.db.sol.resumen)

// Lo que dice el importador de cada fila: todo bien salvo los «Luis».
const validacionEco = async ({ filas }) => ({
  filas: filas.map((f) => ({
    estado: String(f.nombre).startsWith('Luis') ? 'error' : 'valido',
    errores: String(f.nombre).startsWith('Luis') ? ['Falta la cédula'] : [],
    datos: { tienePrestamo: true, montoPrestado: Number(f.montoPrestado) || 0 },
    calculado: { totalAPagar: Number(f.montoPrestado) || 0 },
  })),
  resumen: { filasConError: filas.filter((f) => String(f.nombre).startsWith('Luis')).length, excedePlan: false, clientesNuevos: filas.length, espacioDisponible: 100 },
})
const validacionLimpia = async ({ filas }) => ({
  filas: filas.map((f) => ({ estado: 'valido', datos: { tienePrestamo: true, montoPrestado: Number(f.montoPrestado) || 0 }, calculado: { totalAPagar: Number(f.montoPrestado) || 0 } })),
  resumen: { filasConError: 0, excedePlan: false, clientesNuevos: filas.length, espacioDisponible: 100 },
})

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.WA_PLANTILLA_CARTERA_POR_REVISAR
  delete process.env.WA_PLANTILLA_CARTERA_RECIBIDA
  m.db.dueno = { id: 'u1', nombre: 'Pedro Pérez', telefono: '3001234567', email: 'p@x.co' }
  m.db.org = { nombre: 'Negocio Uno', plan: 'growth' }
  m.db.prestamos = []
  m.db.pagos = []
  m.db.actividad = []
  poner()
  m.validarCartera.mockImplementation(validacionLimpia)
  m.importarCartera.mockResolvedValue({ resultado: { clientesCreados: 2, prestamosCreados: 2 } })
  m.leerArchivo.mockResolvedValue({ filas: [], fallos: [] })
  m.tipoDeArchivo.mockReturnValue({ tipo: 'excel', mime: 'application/vnd.ms-excel' })
})

describe('las constantes de estado', () => {
  it('«ayuda» es abierta y editable; solo ella espera a Carlos', () => {
    expect(ESTADOS_ABIERTOS).toEqual(['esperando', 'recibida', 'leyendo', 'en_revision', 'ayuda'])
    expect(ESTADOS_POR_ATENDER).toEqual(['ayuda'])
    expect(ESTADOS_EDITABLES).toEqual(['en_revision', 'ayuda'])
  })
})

describe('el _id de cada fila', () => {
  const archivo = (n, extra = {}) => ({ n, ruta: `cargas/o1/s1/a${n}`, nombre: `a${n}.xlsx`, ...extra })
  const lee = (porArchivo) => m.leerArchivo.mockImplementation(async (_buf, { archivo: n }) => ({ filas: porArchivo[n].map((nombre) => ({ nombre, montoPrestado: 100000, _archivo: n })), fallos: [] }))

  it('procesarSolicitud da _id estable a cada fila y no lo cambia al releer', async () => {
    poner({ estado: 'recibida', archivos: JSON.stringify([archivo(1), archivo(2)]), filas: null })
    lee({ 1: ['Ana', 'Beto'], 2: ['Eva'] })
    await procesarSolicitud('s1')
    const primera = filasDe(m.db.sol)
    expect(primera.map((f) => f._id)).toEqual(['1-0', '1-1', '2-0'])
    // La regla literal: `${f._archivo}-${posición dentro de su archivo}`.
    expect(primera.map((f) => f._id)).toEqual(primera.map((f, i, todas) => `${f._archivo}-${todas.slice(0, i).filter((g) => g._archivo === f._archivo).length}`))

    // Llega un archivo nuevo: se leen solo los nuevos y los ids de antes no se mueven.
    m.db.sol.estado = 'recibida'
    m.db.sol.archivos = JSON.stringify([...JSON.parse(m.db.sol.archivos), archivo(3)])
    lee({ 3: ['Gina', 'Hugo'] })
    await procesarSolicitud('s1')
    const segunda = filasDe(m.db.sol)
    expect(segunda.map((f) => f._id)).toEqual(['1-0', '1-1', '2-0', '3-0', '3-1'])
    expect(m.leerArchivo).toHaveBeenCalledTimes(3)
  })

  it('un archivo nuevo cuenta SOLO sus filas: nunca renumera las de otro archivo', async () => {
    poner({ estado: 'recibida', archivos: JSON.stringify([archivo(1, { leidoAt: 'x' }), archivo(2)]), filas: JSON.stringify([fila(1, 0), fila(1, 1)]) })
    lee({ 2: ['Eva', 'Fido'] })
    await procesarSolicitud('s1')
    expect(filasDe(m.db.sol).map((f) => f._id)).toEqual(['1-0', '1-1', '2-0', '2-1'])
  })

  it('las solicitudes de antes (sin _id) lo reciben por posición dentro de su archivo', () => {
    const viejas = JSON.stringify([{ nombre: 'A', _archivo: 1 }, { nombre: 'B', _archivo: 1 }, { nombre: 'C', _archivo: 2 }])
    expect(filasDe({ filas: viejas }).map((f) => f._id)).toEqual(['1-0', '1-1', '2-0'])
  })

  it('conIds no toca el que ya lo tiene y sube hasta uno libre si el candidato está tomado', () => {
    const r = conIds([{ _id: '1-0', _archivo: 1 }, { nombre: 'sin id', _archivo: 1 }, { _id: '1-2', _archivo: 1 }, { nombre: 'otra', _archivo: 1 }])
    expect(r.map((f) => f._id)).toEqual(['1-0', '1-1', '1-2', '1-3'])
    expect(r[0]).toBe(conIds([r[0]])[0])
  })

  it('⚠ conIds reserva lo creado y lo quitado aunque su fila ya no figure: la fila nueva no hereda ese id', () => {
    const nueva = [{ _id: '1-0', _archivo: 1 }, { nombre: 'nueva', _archivo: 1 }, { nombre: 'otra', _archivo: 1 }]
    // Sin reservar: la nueva se queda con «1-1», que es de una fila creada que ya no está.
    expect(conIds(nueva).map((f) => f._id)).toEqual(['1-0', '1-1', '1-2'])
    // Reservando las de creadas y quitadas: sigue por el siguiente libre.
    expect(conIds(nueva, ['1-1', '1-2']).map((f) => f._id)).toEqual(['1-0', '1-3', '1-4'])
    expect(conIds(nueva, new Set(['1-1'])).map((f) => f._id)).toEqual(['1-0', '1-2', '1-3'])
  })

  it('⚠ guardarFilas: una fila nueva NO recibe el id de una creada o quitada que ya no está, y se ve como pendiente', async () => {
    poner({
      filas: JSON.stringify([fila(1, 0)]),
      resumen: JSON.stringify({ creadas: { '1-1': { clienteId: 'c1', prestamoId: 'p1' } }, quitadas: ['1-2'] }),
    })
    await guardarFilas('s1', [fila(1, 0), { nombre: 'Nueva', montoPrestado: 7, _archivo: 1 }])
    const ids = filasDe(m.db.sol).map((f) => f._id)
    expect(ids).toEqual(['1-0', '1-3'])
    // «Nueva» es una fila pendiente: no se esconde detrás de lo creado.
    expect(filasPendientes(m.db.sol).map((f) => f.nombre)).toEqual(['Cliente 1-0', 'Nueva'])
    expect(JSON.parse(m.db.sol.filas).map((f) => f._id)).toEqual(['1-0', '1-3'])
  })

  it('⚠ procesarSolicitud: lo que lee de un archivo nuevo tampoco hereda un id creado o quitado', async () => {
    poner({
      estado: 'recibida', archivos: JSON.stringify([archivo(1, { leidoAt: 'x' }), archivo(2)]),
      filas: JSON.stringify([fila(1, 0)]),
      resumen: JSON.stringify({ creadas: { '2-0': { clienteId: 'c1', prestamoId: 'p1' } }, quitadas: ['2-1'] }),
    })
    lee({ 2: ['Eva', 'Fido'] })
    await procesarSolicitud('s1')
    expect(filasDe(m.db.sol).map((f) => f._id)).toEqual(['1-0', '2-2', '2-3'])
    expect(filasPendientes(m.db.sol).map((f) => f.nombre)).toEqual(['Cliente 1-0', 'Eva', 'Fido'])
  })

  it('filasDe sigue dando por posición a las viejas aunque tengan creadas (esos ids salieron de la misma cuenta)', () => {
    const sol = {
      filas: JSON.stringify([{ nombre: 'A', _archivo: 1 }, { nombre: 'B', _archivo: 1 }]),
      resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c', prestamoId: 'p' } } }),
    }
    expect(filasDe(sol).map((f) => f._id)).toEqual(['1-0', '1-1'])
    expect(filasPendientes(sol).map((f) => f.nombre)).toEqual(['B'])
  })

  it('⚠ releer NO borra lo que el dueño ya creó ni lo que quitó (se cargaría dos veces)', async () => {
    const creadas = { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }
    poner({
      estado: 'recibida', archivos: JSON.stringify([archivo(1, { leidoAt: 'x' }), archivo(2)]),
      filas: JSON.stringify([fila(1, 0), fila(1, 1)]), resumen: JSON.stringify({ creadas, quitadas: ['1-1'] }),
    })
    lee({ 2: ['Eva'] })
    await procesarSolicitud('s1')
    expect(resumenActual().creadas).toEqual(creadas)
    expect(resumenActual().quitadas).toEqual(['1-1'])
    expect(filasPendientes(m.db.sol).map((f) => f._id)).toEqual(['2-0'])
  })

  it('⚠ con creadas = { «1-0» } llega un archivo nuevo ⇒ creadas sigue igual y filasPendientes no trae «1-0»', async () => {
    const creadas = { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }
    poner({
      estado: 'recibida', archivos: JSON.stringify([archivo(1, { leidoAt: 'x' }), archivo(2)]),
      filas: JSON.stringify([fila(1, 0), fila(1, 1)]), resumen: JSON.stringify({ creadas }),
    })
    lee({ 2: ['Eva'] })
    await procesarSolicitud('s1')
    expect(resumenActual().creadas).toEqual(creadas)
    expect(filasPendientes(m.db.sol).map((f) => f._id)).toEqual(['1-1', '2-0'])
    expect(filasPendientes(m.db.sol).map((f) => f._id)).not.toContain('1-0')
  })
})

describe('filasPendientes', () => {
  it('no devuelve las ya creadas', () => {
    const sol = solicitud({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    expect(creadasDe(sol)).toEqual({ '1-0': { clienteId: 'c1', prestamoId: 'p1' } })
    expect(filasPendientes(sol).map((f) => f._id)).toEqual(['1-1', '1-2'])
  })
  it('tampoco las que el dueño quitó sin crear', () => {
    const sol = solicitud({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }, quitadas: ['1-2'] }) })
    expect(filasPendientes(sol).map((f) => f._id)).toEqual(['1-1'])
  })
  it('sin nada creado devuelve todas, y un resumen roto no la tumba', () => {
    expect(filasPendientes(solicitud()).length).toBe(3)
    expect(filasPendientes(solicitud({ resumen: 'no es json' })).length).toBe(3)
    expect(filasPendientes(solicitud({ resumen: JSON.stringify({ creadas: ['x'] }) })).length).toBe(3)
  })
})

describe('apuntarCreada', () => {
  const buenos = { id: 's1', organizationId: 'o1', filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' }
  beforeEach(() => { m.db.prestamos = [{ id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 120000 }] })

  it('rechaza un préstamo de otra organización', async () => {
    m.db.prestamos = [{ id: 'p1', clienteId: 'c1', organizationId: 'OTRA', totalAPagar: 1 }]
    const r = await apuntarCreada(buenos)
    expect(r).toEqual({ error: 'Ese préstamo no es de este negocio', status: 404 })
    expect(m.prisma.prestamo.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', organizationId: 'o1', clienteId: 'c1' } }))
    expect(creadasDe(m.db.sol)).toEqual({})
  })

  it('rechaza un préstamo que es de otro cliente', async () => {
    const r = await apuntarCreada({ ...buenos, clienteId: 'c9' })
    expect(r.status).toBe(404)
  })

  it('apunta la fila y dice cuántas quedan', async () => {
    const r = await apuntarCreada(buenos)
    expect(r).toEqual({ ok: true, quedan: 2 })
    expect(creadasDe(m.db.sol)).toEqual({ '1-0': { clienteId: 'c1', prestamoId: 'p1' } })
    expect(m.prisma.$transaction).toHaveBeenCalled()
  })

  it('dos veces con el mismo filaId no duplica', async () => {
    await apuntarCreada(buenos)
    const segunda = await apuntarCreada(buenos)
    expect(segunda).toEqual({ ok: true, yaEstaba: true, quedan: 2 })
    expect(Object.keys(creadasDe(m.db.sol))).toEqual(['1-0'])
  })

  it('⚠ un préstamo que YA existe se apunta en cualquier estado abierto: ayuda, leyendo, recibida, importando…', async () => {
    for (const estado of ['esperando', 'recibida', 'leyendo', 'en_revision', 'ayuda', 'importando']) {
      poner({ estado })
      const r = await apuntarCreada(buenos)
      expect(r, estado).toMatchObject({ ok: true })
      expect(creadasDe(m.db.sol), estado).toEqual({ '1-0': { clienteId: 'c1', prestamoId: 'p1' } })
      expect(m.db.sol.estado, 'apuntar no cambia el estado').toBe(estado)
    }
  })

  it('cerrada («aprobada» o «rechazada»): 409 y no escribe', async () => {
    for (const estado of ['aprobada', 'rechazada']) {
      poner({ estado })
      expect((await apuntarCreada(buenos)).status).toBe(409)
      expect(creadasDe(m.db.sol)).toEqual({})
    }
  })

  it('una solicitud de otro negocio no existe para este', async () => {
    poner({ organizationId: 'OTRA' })
    expect((await apuntarCreada(buenos)).status).toBe(404)
  })

  it('faltando el cliente o el préstamo, 400 y sin tocar nada', async () => {
    expect((await apuntarCreada({ ...buenos, prestamoId: '' })).status).toBe(400)
    expect(m.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('⚠ una cartera grande no se corta: 1.452 filas creadas caben (el resumen ya no es TEXT de 64 KB)', async () => {
    const creadas = Object.fromEntries(Array.from({ length: 1451 }, (_, i) => [`1-${i + 10}`, { clienteId: 'c'.repeat(25), prestamoId: 'p'.repeat(25) }]))
    poner({ resumen: JSON.stringify({ creadas }) })
    expect(Buffer.byteLength(m.db.sol.resumen)).toBeGreaterThan(65535)
    const r = await apuntarCreada(buenos)
    expect(r).toMatchObject({ ok: true })
    expect(Object.keys(creadasDe(m.db.sol))).toHaveLength(1452)
  })

  it('solo se corta si el JSON pasa de 50 MB: 413 y no escribe', async () => {
    poner({ resumen: JSON.stringify({ fallos: ['x'.repeat(51 * 1024 * 1024)] }) })
    const antes = m.db.sol.resumen
    const r = await apuntarCreada(buenos)
    expect(r.status).toBe(413)
    expect(m.db.sol.resumen).toBe(antes)
  })

  it('el esquema ya lo dice: SolicitudCarga.resumen es LongText', () => {
    const schema = leer('prisma/schema.prisma')
    const modelo = schema.slice(schema.indexOf('model SolicitudCarga {'))
    expect(modelo.slice(0, modelo.indexOf('\n}'))).toMatch(/\n\s+resumen\s+String\?\s+@db\.LongText\n/)
  })
})

describe('terminarCarga', () => {
  const dosCreadas = () => {
    poner({
      filas: JSON.stringify([fila(1, 0), fila(1, 1)]),
      resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' }, '1-1': { clienteId: 'c2', prestamoId: 'p2' } } }),
    })
    m.db.prestamos = [
      { id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 120000 },
      { id: 'p2', clienteId: 'c2', organizationId: 'o1', totalAPagar: 150000 },
    ]
    m.db.pagos = [
      { prestamoId: 'p1', organizationId: 'o1', tipo: 'completo', montoPagado: 20000 },
      { prestamoId: 'p1', organizationId: 'o1', tipo: 'recargo', montoPagado: 5000 },
      { prestamoId: 'p2', organizationId: 'o1', tipo: 'parcial', montoPagado: 50000 },
      { prestamoId: 'p2', organizationId: 'o1', tipo: 'descuento', montoPagado: 10000 },
    ]
  }

  it('hace lo de después UNA vez: dos llamadas ⇒ enviarPaso 1, reiniciarPrueba 1', async () => {
    dosCreadas()
    const ahora = new Date('2026-11-22T15:00:00Z')
    const primera = await terminarCarga({ id: 's1', organizationId: 'o1', ahora })
    expect(primera).toMatchObject({ ok: true, clientes: 2, prestamos: 2, enLaCalle: 200000 })
    const segunda = await terminarCarga({ id: 's1', organizationId: 'o1', ahora })
    expect(segunda).toEqual({ ok: true, yaTerminada: true })

    expect(m.enviarPaso).toHaveBeenCalledTimes(1)
    expect(m.reiniciarPrueba).toHaveBeenCalledTimes(1)
    expect(m.reiniciarPrueba).toHaveBeenCalledWith('o1', { ahora })
    expect(m.notificar).toHaveBeenCalledTimes(1)
    expect(m.db.actividad).toHaveLength(1)
  })

  it('cierra la solicitud con lo importado: clientes distintos, préstamos y lo que queda en la calle SIN recargos ni descuentos', async () => {
    dosCreadas()
    const ahora = new Date('2026-11-22T15:00:00Z')
    await terminarCarga({ id: 's1', organizationId: 'o1', ahora })
    expect(m.db.sol.estado).toBe('aprobada')
    expect(m.db.sol.aprobadaAt).toEqual(ahora)
    // (120.000 − 20.000) + (150.000 − 50.000): el recargo y el descuento no son plata que entró.
    expect(resumenActual().importado).toEqual({ clientesCreados: 2, prestamosCreados: 2, enLaCalle: 200000 })
    expect(resumenActual().creadas).toBeTruthy()
  })

  it('⚠ los cancelados y los que esperan aprobación no cuentan: ni clientes, ni préstamos, ni «en la calle»', async () => {
    poner({
      filas: JSON.stringify([fila(1, 0), fila(1, 1), fila(1, 2), fila(1, 3)]),
      resumen: JSON.stringify({ creadas: {
        '1-0': { clienteId: 'c1', prestamoId: 'p1' }, '1-1': { clienteId: 'c2', prestamoId: 'p2' },
        '1-2': { clienteId: 'c3', prestamoId: 'p3' }, '1-3': { clienteId: 'c1', prestamoId: 'p4' },
      } }),
    })
    m.db.prestamos = [
      { id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 120000, estado: 'activo' },
      { id: 'p2', clienteId: 'c2', organizationId: 'o1', totalAPagar: 999000, estado: 'cancelado' },
      { id: 'p3', clienteId: 'c3', organizationId: 'o1', totalAPagar: 888000, estado: 'pendiente_aprobacion' },
      { id: 'p4', clienteId: 'c1', organizationId: 'o1', totalAPagar: 50000, estado: 'completado' },
    ]
    m.db.pagos = [{ prestamoId: 'p1', organizationId: 'o1', tipo: 'completo', montoPagado: 20000 }, { prestamoId: 'p4', organizationId: 'o1', tipo: 'completo', montoPagado: 50000 }]
    const r = await terminarCarga({ id: 's1', organizationId: 'o1' })
    // p1 activo (debe 100.000) y p4 completado (saldado): 1 cliente (c1), 2 préstamos.
    expect(r).toMatchObject({ ok: true, clientes: 1, prestamos: 2, enLaCalle: 100000 })
    expect(m.prisma.prestamo.findMany.mock.calls[0][0].where.estado).toEqual({ notIn: ['cancelado', 'pendiente_aprobacion'] })
    expect(resumenActual().importado).toEqual({ clientesCreados: 1, prestamosCreados: 2, enLaCalle: 100000 })
    expect(m.notificar.mock.calls[0][0].mensaje).toMatch(/^1 clientes y \$100\.000 en la calle/)
    expect(m.enviarPaso.mock.calls[0][0].datos).toEqual({ nombre: 'Pedro', clientes: '1', monto: '$100.000' })
  })

  it('si TODO lo creado está cancelado o pendiente, no hay cartera que celebrar: 400, sin WhatsApp ni reinicio de la prueba', async () => {
    dosCreadas()
    m.db.prestamos = m.db.prestamos.map((p, i) => ({ ...p, estado: i ? 'pendiente_aprobacion' : 'cancelado' }))
    const r = await terminarCarga({ id: 's1', organizationId: 'o1' })
    expect(r.status).toBe(400)
    expect(m.db.sol.estado).toBe('en_revision')
    expect(m.reiniciarPrueba).not.toHaveBeenCalled()
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('lo consulta por préstamos de ESTA organización', async () => {
    dosCreadas()
    await terminarCarga({ id: 's1', organizationId: 'o1' })
    expect(m.prisma.$transaction.mock.calls.length).toBe(1)
    const consulta = m.prisma.prestamo.findMany.mock.calls[0][0]
    expect(consulta.where).toEqual({ id: { in: ['p1', 'p2'] }, organizationId: 'o1', estado: { notIn: ['cancelado', 'pendiente_aprobacion'] } })
    expect(m.prisma.pago.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: 'o1', tipo: { notIn: ['recargo', 'descuento'] } })
  })

  it('reproduce todo lo que hacía aprobarSolicitud: registro, prueba, campana y WhatsApp con su clave', async () => {
    dosCreadas()
    await terminarCarga({ id: 's1', organizationId: 'o1' })
    expect(m.db.actividad[0]).toMatchObject({ organizationId: 'o1', userId: 'u1', accion: 'carga_masiva', entidadTipo: 'cliente' })
    expect(m.notificar).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'o1', tipo: 'carga', titulo: 'Tu cartera quedó cargada', href: '/cobros-hoy' }))
    expect(m.notificar.mock.calls[0][0].mensaje).toMatch(/^2 clientes y \$200\.000 en la calle\. Ya puedes cobrar desde la app\.$/)
    expect(m.enviarPaso).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'o1', telefono: '3001234567', caso: 'carga', claveCaso: 'carga:s1', paso: 'cargada', plantilla: 'cartera_cargada_v3',
      datos: { nombre: 'Pedro', clientes: '2', monto: '$200.000' }, ignorarLimiteDiario: true,
    }))
  })

  it('si lo de después falla, la carga sigue cerrada y contesta ok', async () => {
    dosCreadas()
    m.reiniciarPrueba.mockRejectedValueOnce(new Error('boom'))
    m.notificar.mockRejectedValueOnce(new Error('boom'))
    m.enviarPaso.mockRejectedValueOnce(new Error('boom'))
    const r = await terminarCarga({ id: 's1', organizationId: 'o1' })
    expect(r.ok).toBe(true)
    expect(m.db.sol.estado).toBe('aprobada')
  })

  it('si quedan filas: { ok: false, quedan } y NADA más (ni estado ni lo de después)', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    const r = await terminarCarga({ id: 's1', organizationId: 'o1' })
    expect(r).toEqual({ ok: false, quedan: 2 })
    expect(m.db.sol.estado).toBe('en_revision')
    expect(m.enviarPaso).not.toHaveBeenCalled()
    expect(m.reiniciarPrueba).not.toHaveBeenCalled()
    expect(m.notificar).not.toHaveBeenCalled()
  })

  it('con las que quitó, termina: se guardan en resumen.quitadas', async () => {
    dosCreadas()
    poner({
      resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }),
    })
    m.db.prestamos = [{ id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 100000 }]
    m.db.pagos = []
    const r = await terminarCarga({ id: 's1', organizationId: 'o1', quitadas: ['1-1', '1-2'] })
    expect(r).toMatchObject({ ok: true, clientes: 1, prestamos: 1, enLaCalle: 100000 })
    expect(resumenActual().quitadas).toEqual(['1-1', '1-2'])
    expect(m.db.sol.estado).toBe('aprobada')
  })

  it('lo quitado se guarda aunque todavía queden filas (fue decisión suya)', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    const r = await terminarCarga({ id: 's1', organizationId: 'o1', quitadas: ['1-1'] })
    expect(r).toEqual({ ok: false, quedan: 1 })
    expect(resumenActual().quitadas).toEqual(['1-1'])
    expect(m.db.sol.estado).toBe('en_revision')
  })

  it('no se «quita» una fila ya creada ni un id que no es de esta carga', async () => {
    dosCreadas()
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    const r = await terminarCarga({ id: 's1', organizationId: 'o1', quitadas: ['1-0', 'no-existe', 7, null] })
    expect(r).toEqual({ ok: false, quedan: 2 })
    expect(resumenActual().quitadas).toBeUndefined()
  })

  it('⚠ sin ningún cliente cargado no hay «cartera cargada»: ni WhatsApp ni reinicio de la prueba', async () => {
    const r = await terminarCarga({ id: 's1', organizationId: 'o1', quitadas: ['1-0', '1-1', '1-2'] })
    expect(r.status).toBe(400)
    expect(m.db.sol.estado).toBe('en_revision')
    expect(m.reiniciarPrueba).not.toHaveBeenCalled()
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('con Carlos mirándola, 409; de otro negocio, 404', async () => {
    poner({ estado: 'ayuda' })
    expect((await terminarCarga({ id: 's1', organizationId: 'o1' })).status).toBe(409)
    poner({ organizationId: 'OTRA' })
    expect((await terminarCarga({ id: 's1', organizationId: 'o1' })).status).toBe(404)
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('una carga que apenas se está leyendo no se puede terminar', async () => {
    poner({ estado: 'leyendo' })
    expect((await terminarCarga({ id: 's1', organizationId: 'o1' })).status).toBe(409)
  })
})

describe('aprobarSolicitud (Carlos)', () => {
  const unaCreada = () => {
    poner({ estado: 'ayuda', resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    m.db.prestamos = [{ id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 100000 }]
    m.importarCartera.mockResolvedValue({ resultado: { clientesCreados: 2, prestamosCreados: 2 } })
  }

  it('⚠ salta las filas que el dueño ya creó: importarCartera recibe solo las no creadas', async () => {
    unaCreada()
    const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(r.error).toBeUndefined()
    expect(m.validarCartera.mock.calls[0][0].filas.map((f) => f.nombre)).toEqual(['Cliente 1-1', 'Cliente 1-2'])
    const importadas = m.importarCartera.mock.calls[0][0].filas
    expect(importadas).toHaveLength(2)
    expect(JSON.stringify(importadas)).not.toContain('Cliente 1-0')
  })

  it('lo que el dueño creó se SUMA a lo importado, y lo de después ve el total', async () => {
    unaCreada()
    await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(m.db.sol.estado).toBe('aprobada')
    expect(m.db.sol.revisadaPorId).toBe('admin1')
    expect(resumenActual().importado).toMatchObject({ clientesCreados: 3, prestamosCreados: 3, enLaCalle: 300000 })
    expect(resumenActual().creadas).toBeTruthy()
    expect(m.enviarPaso.mock.calls[0][0].datos).toEqual({ nombre: 'Pedro', clientes: '3', monto: '$300.000' })
    expect(m.enviarPaso).toHaveBeenCalledTimes(1)
    expect(m.reiniciarPrueba).toHaveBeenCalledTimes(1)
  })

  it('lo que el dueño creó y luego se canceló no se suma a lo importado', async () => {
    unaCreada()
    m.db.prestamos[0].estado = 'cancelado'
    await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(resumenActual().importado).toMatchObject({ clientesCreados: 2, prestamosCreados: 2, enLaCalle: 200000 })
  })

  it('sin filas creadas por el dueño se comporta como siempre', async () => {
    poner({ estado: 'en_revision' })
    const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(r.resultado).toEqual({ clientesCreados: 2, prestamosCreados: 2 })
    expect(r.enLaCalle).toBe(300000)
    expect(resumenActual().importado).toEqual({ clientesCreados: 2, prestamosCreados: 2, enLaCalle: 300000, ruta: null })
    expect(m.db.actividad[0].detalle).toBe('Carga de cartera con asesor: 2 clientes, 2 préstamos')
    expect(m.prisma.prestamo.findMany).not.toHaveBeenCalled()
  })

  it('toma la solicitud ANTES de leer las filas: lo que el dueño alcanzó a apuntar no se importa otra vez', async () => {
    unaCreada()
    await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    const tomar = m.prisma.solicitudCarga.updateMany.mock.invocationCallOrder[0]
    const lecturas = m.prisma.solicitudCarga.findUnique.mock.invocationCallOrder
    expect(lecturas.filter((o) => o > tomar).length).toBeGreaterThanOrEqual(1)
    expect(m.prisma.solicitudCarga.updateMany.mock.calls[0][0].data).toEqual({ estado: 'importando' })
  })

  it('⚠ un apunte que llega MIENTRAS se importa no se pierde ni se pisa con el resumen viejo', async () => {
    unaCreada()
    m.db.prestamos.push({ id: 'p2', clienteId: 'c2', organizationId: 'o1', totalAPagar: 50000 })
    m.importarCartera.mockImplementation(async () => {
      // El dueño sigue cargando: otra fila queda apuntada en pleno importar.
      const r = JSON.parse(m.db.sol.resumen)
      m.db.sol.resumen = JSON.stringify({ ...r, creadas: { ...r.creadas, '1-2': { clienteId: 'c2', prestamoId: 'p2' } } })
      return { resultado: { clientesCreados: 2, prestamosCreados: 2 } }
    })
    await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(Object.keys(resumenActual().creadas).sort()).toEqual(['1-0', '1-2'])
    expect(resumenActual().importado).toMatchObject({ clientesCreados: 4, prestamosCreados: 4, enLaCalle: 350000 })
  })

  describe('⚠ si falla DESPUÉS de importar, nunca se suelta (se crearía todo dos veces)', () => {
    let errores
    beforeEach(() => { errores = vi.spyOn(console, 'error').mockImplementation(() => {}) })
    afterEach(() => { errores.mockRestore() })
    const estadosEscritos = () => m.prisma.solicitudCarga.update.mock.calls.map((c) => c[0].data.estado).filter(Boolean)

    it('el cierre con candado lanza ⇒ queda «aprobada» con importado, importarCartera 1 vez y soltar NO', async () => {
      unaCreada()
      m.prisma.$transaction.mockImplementationOnce(async () => { throw new Error('tx boom') })
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
      expect(r.error).toBeUndefined()
      expect(r.resultado).toEqual({ clientesCreados: 2, prestamosCreados: 2 })
      expect(m.db.sol.estado).toBe('aprobada')
      expect(m.db.sol.revisadaPorId).toBe('admin1')
      expect(resumenActual().importado).toMatchObject({ clientesCreados: 2, prestamosCreados: 2, ruta: null })
      expect(resumenActual().creadas).toBeTruthy()
      expect(m.importarCartera).toHaveBeenCalledTimes(1)
      // Nunca volvió a «ayuda» ni a «en_revision».
      expect(estadosEscritos()).toEqual(['aprobada'])
      expect(errores).toHaveBeenCalled()
      // Los efectos de después siguen.
      expect(m.enviarPaso).toHaveBeenCalledTimes(1)
      expect(m.reiniciarPrueba).toHaveBeenCalledTimes(1)
      // Y una segunda aprobación ya no pasa.
      expect((await aprobarSolicitud({ id: 's1', adminId: 'admin1' })).status).toBe(409)
      expect(m.importarCartera).toHaveBeenCalledTimes(1)
    })

    it('si ni el respaldo puede escribir, queda «importando» (tampoco se aprueba de nuevo) y lo de después corre', async () => {
      unaCreada()
      m.prisma.$transaction.mockImplementationOnce(async () => { throw new Error('tx boom') })
      m.prisma.solicitudCarga.update.mockRejectedValueOnce(new Error('db caída'))
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
      expect(r.error).toBeUndefined()
      expect(m.db.sol.estado).toBe('importando')
      expect(m.enviarPaso).toHaveBeenCalledTimes(1)
      expect((await aprobarSolicitud({ id: 's1', adminId: 'admin1' })).status).toBe(409)
      expect(m.importarCartera).toHaveBeenCalledTimes(1)
    })

    it('si falla lo de después (no solo el cierre) tampoco se suelta: responde lo importado', async () => {
      unaCreada()
      m.prisma.actividadLog.create.mockImplementationOnce(() => { throw new Error('sincrono') })
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
      expect(r.error).toBeUndefined()
      expect(r.resultado).toEqual({ clientesCreados: 2, prestamosCreados: 2 })
      expect(m.db.sol.estado).toBe('aprobada')
      expect(estadosEscritos()).not.toContain('ayuda')
    })

    it('un fallo ANTES de importar sí la suelta (nada entró)', async () => {
      unaCreada()
      m.importarCartera.mockRejectedValue(new Error('antes de tocar nada'))
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
      expect(r.status).toBe(500)
      expect(m.db.sol.estado).toBe('ayuda')
    })
  })

  it('si falla viene de «ayuda» y VUELVE a «ayuda», no se le entrega al dueño en silencio', async () => {
    unaCreada()
    m.importarCartera.mockResolvedValue({ error: 'no cupo', status: 400 })
    const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(r.error).toBe('no cupo')
    expect(m.db.sol.estado).toBe('ayuda')
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('con errores en las filas pendientes no carga nada y la devuelve a donde estaba', async () => {
    unaCreada()
    m.validarCartera.mockImplementation(async ({ filas }) => ({ filas: [], resumen: { filasConError: 1, excedePlan: false } }))
    const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(r.status).toBe(400)
    expect(m.importarCartera).not.toHaveBeenCalled()
    expect(m.db.sol.estado).toBe('ayuda')
  })

  it('si el dueño ya creó TODAS no hay nada que importar', async () => {
    poner({ filas: JSON.stringify([fila(1, 0)]), resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1' })
    expect(r).toEqual({ error: 'No hay filas para importar', status: 400 })
    expect(m.importarCartera).not.toHaveBeenCalled()
    expect(m.db.sol.estado).toBe('en_revision')
  })

  it('una carga ya aprobada o en lectura no se aprueba', async () => {
    for (const estado of ['aprobada', 'leyendo', 'importando', 'rechazada']) {
      poner({ estado })
      expect((await aprobarSolicitud({ id: 's1', adminId: 'a' })).status).toBe(409)
    }
    expect(m.importarCartera).not.toHaveBeenCalled()
  })
})

describe('al terminar la lectura', () => {
  const lee3 = () => m.leerArchivo.mockResolvedValue({
    filas: [
      { nombre: 'Ana', montoPrestado: 100000, _archivo: 1 },
      { nombre: 'Luis', montoPrestado: 100000, _archivo: 1 },
      { nombre: 'Eva', montoPrestado: '', _archivo: 1 },
    ],
    fallos: [],
  })
  const recibida = (extra = {}) => poner({ estado: 'recibida', archivos: JSON.stringify([{ n: 1, ruta: 'cargas/o1/s1/a', nombre: 'a.xlsx' }]), filas: null, resumen: null, ...extra })

  it('avisa al DUEÑO y no a Carlos', async () => {
    m.validarCartera.mockImplementation(validacionEco)
    recibida(); lee3()
    await procesarSolicitud('s1')
    expect(m.notificar).toHaveBeenCalledTimes(1)
    expect(m.notificar).toHaveBeenCalledWith({
      organizationId: 'o1', tipo: 'carga', titulo: 'Ya leímos tu cartera',
      mensaje: '1 clientes listos y 2 por revisar. Entra a terminar de cargarlos.', href: '/cargar-cartera',
    })
    expect(m.sendMessage).not.toHaveBeenCalled()
  })

  it('el aviso sale solo la PRIMERA vez que llega a revisión', async () => {
    recibida(); lee3()
    await procesarSolicitud('s1')
    expect(m.notificar).toHaveBeenCalledTimes(1)
    m.db.sol.estado = 'recibida'
    m.db.sol.archivos = JSON.stringify([...JSON.parse(m.db.sol.archivos), { n: 2, ruta: 'cargas/o1/s1/b', nombre: 'b.xlsx' }])
    await procesarSolicitud('s1')
    expect(m.notificar).toHaveBeenCalledTimes(1)
  })

  it('sin WA_PLANTILLA_CARTERA_POR_REVISAR no manda WhatsApp', async () => {
    recibida(); lee3()
    await procesarSolicitud('s1')
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('con la plantilla manda WhatsApp con nombre, listos y por revisar', async () => {
    process.env.WA_PLANTILLA_CARTERA_POR_REVISAR = 'cartera_por_revisar_v1'
    m.validarCartera.mockImplementation(validacionEco)
    recibida(); lee3()
    await procesarSolicitud('s1')
    expect(m.enviarPaso).toHaveBeenCalledTimes(1)
    expect(m.enviarPaso).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'o1', telefono: '3001234567', caso: 'carga', claveCaso: 'carga:s1', plantilla: 'cartera_por_revisar_v1',
      datos: { nombre: 'Pedro', listos: '1', revisar: '2' },
    }))
    expect(m.sendMessage).not.toHaveBeenCalled()
  })

  it('si no salió ni una fila lo dice, y no manda una plantilla de «0 listos y 0 por revisar»', async () => {
    process.env.WA_PLANTILLA_CARTERA_POR_REVISAR = 'cartera_por_revisar_v1'
    recibida()
    m.leerArchivo.mockResolvedValue({ filas: [], fallos: ['No encontré columnas'] })
    await procesarSolicitud('s1')
    expect(m.notificar.mock.calls[0][0]).toMatchObject({ titulo: 'Ya leímos tu cartera', mensaje: 'No pudimos sacar clientes de tus archivos. Entra para ver por qué.' })
    expect(m.enviarPaso).not.toHaveBeenCalled()
  })

  it('avisarListaParaRevisar cuenta solo las pendientes', async () => {
    const sol = solicitud({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c', prestamoId: 'p' } } }), filas: JSON.stringify([fila(1, 0), fila(1, 1), fila(1, 2, { _errores: ['x'] })]) })
    await avisarListaParaRevisar(sol)
    expect(m.notificar.mock.calls[0][0].mensaje).toBe('1 clientes listos y 1 por revisar. Entra a terminar de cargarlos.')
  })
})

describe('confirmarRecibida', () => {
  it('ya no promete 24 horas', () => {
    const src = sinNotas(leer('lib/carga-asesor/solicitud.js'))
    expect(src).not.toMatch(/máximo 24 horas/)
    expect(src).not.toMatch(/en máximo 24/)
    expect(src).not.toMatch(/prometió/)
    expect(src).toContain("mensaje: 'Los estamos leyendo. En unos minutos te enseñamos lo que encontramos para que lo revises y lo cargues.'")
  })

  it('campana siempre; sin plantilla nueva no hay WhatsApp', async () => {
    const r = await confirmarRecibida(solicitud({ archivos: JSON.stringify([{ n: 1 }, { n: 2 }]) }))
    expect(m.notificar).toHaveBeenCalledWith({
      organizationId: 'o1', tipo: 'carga', titulo: 'Recibimos tus archivos',
      mensaje: 'Los estamos leyendo. En unos minutos te enseñamos lo que encontramos para que lo revises y lo cargues.', href: '/cargar-cartera',
    })
    expect(m.enviarPaso).not.toHaveBeenCalled()
    expect(r).toBeNull()
  })

  it('con WA_PLANTILLA_CARTERA_RECIBIDA manda esa plantilla, no la de antes', async () => {
    process.env.WA_PLANTILLA_CARTERA_RECIBIDA = 'cartera_recibida_v2'
    await confirmarRecibida(solicitud({ archivos: JSON.stringify([{ n: 1 }, { n: 2 }]) }))
    expect(m.enviarPaso).toHaveBeenCalledWith(expect.objectContaining({
      plantilla: 'cartera_recibida_v2', paso: 'recibida', claveCaso: 'carga:s1', datos: { nombre: 'Pedro', archivos: '2' },
    }))
    expect(JSON.stringify(m.enviarPaso.mock.calls[0][0])).not.toContain('cartera_recibida"')
  })

  it('el texto del bot de WhatsApp y la lista «para atender» van con la regla nueva', () => {
    const wa = sinNotas(leer('lib/carga-asesor/whatsapp.js'))
    expect(wa).toContain("'Recibido. Lo estamos leyendo y en unos minutos le dejamos en la app lo que encontramos, para que lo revise y lo cargue.'")
    expect(wa).not.toContain('le avisamos cuando quede lista')
    expect(sinNotas(leer('lib/seguimiento/para-atender.js'))).toContain("estado: { in: ['recibida', 'en_revision', 'esperando', 'ayuda'] }")
  })
})

describe('pedirAyuda y devolverAlDueno', () => {
  it('pasa a «ayuda» y avisa a Carlos con el enlace, el conteo y la nota', async () => {
    const r = await pedirAyuda({ id: 's1', organizationId: 'o1', nota: 'No entiendo la columna de cuotas <b>' })
    expect(r).toEqual({ ok: true })
    expect(m.db.sol.estado).toBe('ayuda')
    expect(m.sendMessage).toHaveBeenCalledTimes(1)
    const [texto, markup, bot] = m.sendMessage.mock.calls[0]
    expect(bot).toBe('escalamiento')
    expect(markup).toBeNull()
    const lineas = texto.split('\n')
    expect(lineas[0]).toBe('<b>Pide ayuda con su carga: Negocio Uno</b>')
    expect(lineas[1]).toContain('Pedro Pérez')
    expect(lineas[1]).toContain('3001234567')
    expect(texto).toContain('Filas por cargar: 3')
    expect(texto).toContain('Nota: No entiendo la columna de cuotas &lt;b&gt;')
    expect(lineas.at(-1)).toBe('https://app.control-finanzas.com/admin/cargas/s1')
    expect(m.db.sol.nota).toContain('Pide ayuda: No entiendo la columna')
    expect(resumenActual().ayuda).toEqual({ at: expect.any(String), nota: 'No entiendo la columna de cuotas <b>' })
  })

  it('sin nota no hay línea de nota; las filas por cargar descuentan lo creado', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c', prestamoId: 'p' } } }) })
    await pedirAyuda({ id: 's1', organizationId: 'o1' })
    const texto = m.sendMessage.mock.calls[0][0]
    expect(texto).not.toContain('Nota:')
    expect(texto).toContain('Filas por cargar: 2')
    expect(m.db.sol.nota).toBeNull()
    expect(resumenActual().ayuda).toEqual({ at: expect.any(String), nota: null })
    expect(resumenActual().creadas).toBeTruthy()
  })

  it('un segundo toque no vuelve a avisar', async () => {
    await pedirAyuda({ id: 's1', organizationId: 'o1' })
    const r = await pedirAyuda({ id: 's1', organizationId: 'o1' })
    expect(r).toEqual({ ok: true, yaEstaba: true })
    expect(m.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('solo se pide desde «en_revision» y solo de la propia organización', async () => {
    poner({ estado: 'leyendo' })
    expect((await pedirAyuda({ id: 's1', organizationId: 'o1' })).status).toBe(409)
    poner({ organizationId: 'OTRA' })
    expect((await pedirAyuda({ id: 's1', organizationId: 'o1' })).status).toBe(404)
    expect(m.sendMessage).not.toHaveBeenCalled()
  })

  it('devolverAlDueno vuelve a en_revision y borra resumen.ayuda (sin tocar lo creado); si no estaba en ayuda, 409', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c', prestamoId: 'p' } }, quitadas: ['1-1'] }) })
    await pedirAyuda({ id: 's1', organizationId: 'o1', nota: 'ayuda' })
    expect(resumenActual().ayuda).toBeTruthy()
    expect(await devolverAlDueno({ id: 's1', adminId: 'admin1' })).toEqual({ ok: true })
    expect(m.db.sol.estado).toBe('en_revision')
    expect(m.db.sol.revisadaPorId).toBe('admin1')
    expect(resumenActual().ayuda).toBeUndefined()
    expect(resumenActual().creadas).toEqual({ '1-0': { clienteId: 'c', prestamoId: 'p' } })
    expect(resumenActual().quitadas).toEqual(['1-1'])
    expect((await devolverAlDueno({ id: 's1', adminId: 'admin1' })).status).toBe(409)
  })

  it('devolverAlDueno no toca una carga cerrada o sin ayuda pedida', async () => {
    for (const estado of ['aprobada', 'rechazada', 'importando', 'leyendo']) {
      poner({ estado })
      expect((await devolverAlDueno({ id: 's1', adminId: 'a' })).status).toBe(409)
      expect(m.db.sol.estado).toBe(estado)
    }
  })
})

describe('⚠ la ayuda no se pierde cuando llega un archivo', () => {
  const nuevoArchivo = () => guardarArchivos('o1', [{ buffer: Buffer.from('abc'), nombre: 'nuevo.xlsx' }])
  const enAyuda = (extra = {}) => poner({
    estado: 'ayuda', archivos: JSON.stringify([{ n: 1, ruta: 'cargas/o1/s1/a1', nombre: 'a1.xlsx', leidoAt: 'x' }]),
    filas: JSON.stringify([fila(1, 0), fila(1, 1)]),
    resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }, ayuda: { at: '2026-11-22T10:00:00.000Z', nota: 'no entiendo' } }),
    ...extra,
  })

  it('en «ayuda» llega un archivo: se lee y la solicitud VUELVE a «ayuda», con todo lo demás intacto', async () => {
    enAyuda()
    m.leerArchivo.mockResolvedValue({ filas: [{ nombre: 'Eva', montoPrestado: 100000, _archivo: 2 }], fallos: [] })
    const r = await nuevoArchivo()
    expect(r.nuevos).toBe(1)
    expect(m.db.sol.estado).toBe('recibida')
    await procesarSolicitud('s1')
    expect(m.db.sol.estado).toBe('ayuda')
    expect(resumenActual().ayuda).toEqual({ at: '2026-11-22T10:00:00.000Z', nota: 'no entiendo' })
    expect(resumenActual().creadas).toEqual({ '1-0': { clienteId: 'c1', prestamoId: 'p1' } })
    expect(filasPendientes(m.db.sol).map((f) => f._id)).toEqual(['1-1', '2-0'])
    // Ya la había leído una vez: no es «la primera revisión», no se vuelve a avisar.
    expect(m.notificar).not.toHaveBeenCalled()
  })

  it('si la lectura falla a medias también vuelve a «ayuda», no a «en_revision»', async () => {
    enAyuda()
    m.leerArchivo.mockRejectedValue(new Error('Gemini 429'))
    await nuevoArchivo()
    await procesarSolicitud('s1')
    expect(m.db.sol.estado).toBe('ayuda')
    expect(m.db.sol.errorLectura).toMatch(/Gemini 429/)
    expect(resumenActual().ayuda).toBeTruthy()
  })

  it('sin ayuda pedida, terminar de leer deja la solicitud en «en_revision» como siempre', async () => {
    enAyuda({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    m.leerArchivo.mockResolvedValue({ filas: [], fallos: [] })
    await nuevoArchivo()
    await procesarSolicitud('s1')
    expect(m.db.sol.estado).toBe('en_revision')
  })

  it('pedir ayuda otra vez mientras se relee no avisa dos veces', async () => {
    enAyuda()
    await nuevoArchivo()
    expect(m.db.sol.estado).toBe('recibida')
    expect(await pedirAyuda({ id: 's1', organizationId: 'o1' })).toEqual({ ok: true, yaEstaba: true })
    expect(m.sendMessage).not.toHaveBeenCalled()
  })

  it('devolverAlDueno mientras se relee borra la marca: termina en «en_revision»', async () => {
    enAyuda()
    m.leerArchivo.mockResolvedValue({ filas: [{ nombre: 'Eva', montoPrestado: 100000, _archivo: 2 }], fallos: [] })
    await nuevoArchivo()
    expect(await devolverAlDueno({ id: 's1', adminId: 'admin1' })).toEqual({ ok: true })
    expect(m.db.sol.estado).toBe('recibida')
    await procesarSolicitud('s1')
    expect(m.db.sol.estado).toBe('en_revision')
    expect(resumenActual().ayuda).toBeUndefined()
  })
})

describe('el recordatorio de las 20 h', () => {
  const hace = (h) => new Date(Date.parse('2026-11-22T12:00:00Z') - h * 3600000)
  const ahora = new Date('2026-11-22T12:00:00Z')
  const pedida = (id, h) => ({ id, resumen: JSON.stringify({ ayuda: { at: hace(h).toISOString(), nota: null } }), createdAt: hace(500), updatedAt: hace(h), organization: { nombre: `Negocio ${id}` } })

  it('solo cuenta las de «ayuda»', async () => {
    m.prisma.solicitudCarga.findMany.mockImplementation(async ({ where }) => (where.OR ? [] : [pedida('a', 25)]))
    m.prisma.solicitudCarga.updateMany.mockResolvedValue({ count: 1 })
    await vueltaDeCargas({ ahora })
    const consulta = m.prisma.solicitudCarga.findMany.mock.calls.map((c) => c[0].where).find((w) => !w.OR)
    expect(consulta.estado).toEqual({ in: ['ayuda'] })
    expect(consulta.recordatorioAt).toBeNull()
  })

  it('cuenta desde que pidió ayuda, no desde que creó la solicitud', async () => {
    m.prisma.solicitudCarga.findMany.mockImplementation(async ({ where }) => (where.OR ? [] : [pedida('vieja', 25), pedida('nueva', 2)]))
    m.prisma.solicitudCarga.updateMany.mockResolvedValue({ count: 1 })
    const r = await vueltaDeCargas({ ahora })
    expect(r.recordadas).toBe(1)
    expect(m.sendMessage).toHaveBeenCalledTimes(1)
    const texto = m.sendMessage.mock.calls[0][0]
    expect(texto).toContain('hace 25 h')
    expect(texto).toContain('Negocio vieja')
    expect(texto).toContain('/admin/cargas/vieja')
    expect(texto).not.toMatch(/prometi/i)
    expect(m.sendMessage.mock.calls[0][2]).toBe('escalamiento')
  })

  it('si Telegram falla, la marca se quita para reintentar a la hora siguiente', async () => {
    m.prisma.solicitudCarga.findMany.mockImplementation(async ({ where }) => (where.OR ? [] : [pedida('a', 30)]))
    m.prisma.solicitudCarga.updateMany.mockResolvedValue({ count: 1 })
    m.sendMessage.mockResolvedValueOnce({ ok: false })
    const r = await vueltaDeCargas({ ahora })
    expect(r.recordadas).toBe(0)
    expect(m.prisma.solicitudCarga.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { recordatorioAt: null } })
  })
})

describe('guardarFilas', () => {
  it('pasa por el candado y deja editar en «ayuda» (Carlos) y en «en_revision» (dueño)', async () => {
    for (const estado of ['en_revision', 'ayuda']) {
      vi.clearAllMocks()
      poner({ estado })
      const r = await guardarFilas('s1', [{ nombre: 'Ana', montoPrestado: 5, _archivo: 1 }])
      expect(r.error).toBeUndefined()
      expect(m.prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(m.prisma.$transaction.mock.calls[0][1]).toEqual({ timeout: 15000 })
    }
  })

  it('solo en «en_revision» o «ayuda»; el resto, 409; sin solicitud, 404', async () => {
    for (const estado of ['aprobada', 'leyendo', 'recibida', 'importando']) {
      poner({ estado })
      expect((await guardarFilas('s1', [])).status).toBe(409)
    }
    expect((await guardarFilas('NO', [])).status).toBe(404)
  })

  it('⚠ guardar filas (Carlos) conserva lo ya creado, lo quitado y la ayuda, y les da su _id', async () => {
    const creadas = { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }
    const ayuda = { at: '2026-11-22T10:00:00.000Z', nota: 'x' }
    poner({ estado: 'ayuda', resumen: JSON.stringify({ creadas, quitadas: ['1-1'], ayuda, fallos: ['Archivo 2: vacío'] }) })
    const r = await guardarFilas('s1', [{ nombre: 'Ana', montoPrestado: 5, _archivo: 1, _id: '1-0' }, { nombre: 'Nueva', montoPrestado: 7, _archivo: 1 }])
    expect(r.resumen.creadas).toEqual(creadas)
    expect(resumenActual().creadas).toEqual(creadas)
    expect(resumenActual().quitadas).toEqual(['1-1'])
    expect(resumenActual().ayuda).toEqual(ayuda)
    expect(resumenActual().fallos).toEqual(['Archivo 2: vacío'])
    // «Nueva» no hereda el «1-1» que está en `quitadas` (antes de la ronda 1 de arreglos lo heredaba y quedaba escondida).
    expect(filasDe(m.db.sol).map((f) => f._id)).toEqual(['1-0', '1-2'])
    expect(JSON.parse(m.db.sol.filas).every((f) => f._id)).toBe(true)
  })
})

describe('despuesDeCargar', () => {
  it('sin dueño no revienta: se salta el registro y no manda WhatsApp a nadie', async () => {
    const r = await despuesDeCargar({ sol: solicitud(), dueno: null, clientes: 1, prestamos: 1, enLaCalle: 5000 })
    expect(r.whatsapp).toBe(true) // lo que conteste `enviarPaso`: aquí lo decide su sistema
    expect(m.db.actividad).toHaveLength(0)
    expect(m.enviarPaso.mock.calls[0][0].telefono).toBeUndefined()
  })

  it('cada paso falla solo: los demás corren', async () => {
    m.reiniciarPrueba.mockRejectedValueOnce(new Error('x'))
    m.notificar.mockRejectedValueOnce(new Error('x'))
    const r = await despuesDeCargar({ sol: solicitud(), dueno: m.db.dueno, clientes: 1, prestamos: 1, enLaCalle: 5000 })
    expect(m.enviarPaso).toHaveBeenCalledTimes(1)
    expect(r.finPrueba).toBeNull()
  })

  it('el registro dice quién cargó: el dueño o el asesor', async () => {
    await despuesDeCargar({ sol: solicitud(), dueno: m.db.dueno, clientes: 3, prestamos: 4, enLaCalle: 0, porElDueno: true })
    await despuesDeCargar({ sol: solicitud(), dueno: m.db.dueno, clientes: 3, prestamos: 4, enLaCalle: 0 })
    expect(m.db.actividad.map((a) => a.detalle)).toEqual([
      'Carga de cartera revisada por el dueño: 3 clientes, 4 préstamos',
      'Carga de cartera con asesor: 3 clientes, 4 préstamos',
    ])
  })
})

describe('el bot ya no promete 24 horas ni un asesor que carga', () => {
  const archivos = ['lib/bot-v2/respuestas-cuenta.js', 'lib/bot-v2/contexto.js', 'lib/bot-v2/argumentos.js', 'lib/seguimiento/respuestas.js']
  it.each(archivos)('%s', (f) => {
    const src = sinNotas(leer(f))
    expect(src).not.toMatch(/máximo 24 horas/)
    expect(src).not.toMatch(/se los cargamos|se lo cargamos|los carguemos nosotros|el equipo la está cargando|Una persona del equipo revisa cada cliente/)
  })
  it('la respuesta de la carga dice que la app lee y que él revisa y carga', async () => {
    const { respuestaCargaConAsesor } = await import('@/lib/bot-v2/respuestas-cuenta')
    const t = respuestaCargaConAsesor()
    expect(t).toContain('La app lo lee y le deja lo que encontró, para que usted lo revise y lo cargue.')
    expect(t).toMatch(/\/cargar-cartera/)
    expect(t).not.toMatch(/24 horas/)
  })
})

describe('el resumen de la solicitud sigue siendo legible', () => {
  it('resumenDeSolicitud devuelve null si no hay o está roto', () => {
    expect(resumenDeSolicitud({ resumen: null })).toBeNull()
    expect(resumenDeSolicitud({ resumen: '{' })).toBeNull()
  })
})

describe('⚠ la carrera dueño / Carlos: el servidor no deja aprobar mientras el dueño está cargando', () => {
  const ahora = new Date('2026-11-22T15:00:00Z')
  const haceMin = (min) => new Date(ahora.getTime() - min * 60000).toISOString()
  const buenos = { id: 's1', organizationId: 'o1', filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' }
  beforeEach(() => { m.db.prestamos = [{ id: 'p1', clienteId: 'c1', organizationId: 'o1', totalAPagar: 120000 }] })

  it('apuntarCreada deja la hora del último apunte en el resumen', async () => {
    await apuntarCreada({ ...buenos, ahora })
    expect(resumenActual().ultimoApunteAt).toBe('2026-11-22T15:00:00.000Z')
    expect(creadasDe(m.db.sol)).toEqual({ '1-0': { clienteId: 'c1', prestamoId: 'p1' } })
  })

  it('cada apunte nuevo renueva la hora; el repetido (yaEstaba) no escribe nada', async () => {
    await apuntarCreada({ ...buenos, ahora })
    m.db.prestamos.push({ id: 'p2', clienteId: 'c2', organizationId: 'o1', totalAPagar: 1 })
    await apuntarCreada({ ...buenos, filaId: '1-1', clienteId: 'c2', prestamoId: 'p2', ahora: new Date(ahora.getTime() + 60000) })
    expect(resumenActual().ultimoApunteAt).toBe('2026-11-22T15:01:00.000Z')
    const antes = m.db.sol.resumen
    const r = await apuntarCreada({ ...buenos, ahora: new Date(ahora.getTime() + 600000) })
    expect(r.yaEstaba).toBe(true)
    expect(m.db.sol.resumen).toBe(antes)
  })

  it('la hora del último apunte sobrevive a releer y a guardar filas', async () => {
    poner({ estado: 'recibida', archivos: JSON.stringify([{ n: 1, ruta: 'cargas/o1/s1/a', nombre: 'a.xlsx', leidoAt: 'x' }, { n: 2, ruta: 'cargas/o1/s1/b', nombre: 'b.xlsx' }]), resumen: JSON.stringify({ ultimoApunteAt: haceMin(2) }) })
    m.leerArchivo.mockResolvedValue({ filas: [{ nombre: 'Eva', montoPrestado: 1, _archivo: 2 }], fallos: [] })
    await procesarSolicitud('s1')
    expect(resumenActual().ultimoApunteAt).toBe(haceMin(2))
    await guardarFilas('s1', filasDe(m.db.sol))
    expect(resumenActual().ultimoApunteAt).toBe(haceMin(2))
  })

  it('apuntó hace menos de 10 minutos ⇒ 409, no toma la solicitud y no importa nada', async () => {
    for (const estado of ['en_revision', 'ayuda']) {
      poner({ estado, resumen: JSON.stringify({ ultimoApunteAt: haceMin(3) }) })
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1', ahora })
      expect(r, estado).toEqual({ error: 'El dueño está cargando su cartera ahora mismo. Espera unos minutos.', status: 409 })
      expect(m.db.sol.estado, estado).toBe(estado)
    }
    expect(m.prisma.solicitudCarga.updateMany).not.toHaveBeenCalled()
    expect(m.validarCartera).not.toHaveBeenCalled()
    expect(m.importarCartera).not.toHaveBeenCalled()
  })

  it('a los 10 minutos justos, y pasados, Carlos ya puede aprobar', async () => {
    for (const min of [10, 11, 600]) {
      poner({ estado: 'ayuda', resumen: JSON.stringify({ ultimoApunteAt: haceMin(min) }) })
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1', ahora })
      expect(r.error, `${min} min`).toBeUndefined()
      expect(m.db.sol.estado, `${min} min`).toBe('aprobada')
    }
  })

  it('sin hora de apunte (o ilegible) se comporta como siempre', async () => {
    for (const resumen of [JSON.stringify({}), JSON.stringify({ ultimoApunteAt: 'ayer' }), JSON.stringify({ ultimoApunteAt: null }), null]) {
      poner({ resumen })
      const r = await aprobarSolicitud({ id: 's1', adminId: 'admin1', ahora })
      expect(r.error, String(resumen)).toBeUndefined()
    }
  })

  it('un estado que no se puede aprobar sigue diciendo su propio 409, no el del dueño', async () => {
    poner({ estado: 'aprobada', resumen: JSON.stringify({ ultimoApunteAt: haceMin(1) }) })
    expect((await aprobarSolicitud({ id: 's1', adminId: 'a', ahora })).error).toMatch(/no se puede aprobar/)
  })
})
