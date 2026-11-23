// lib/__tests__/carga-asesor-api-dueno.test.js
//
// Plan «La carga de cartera la revisa y la carga el dueño» (22 nov 2026), tarea 3:
// la API del dueño. Le enseña lo que el sistema leyó de sus archivos y apunta cada
// préstamo que él crea a partir de ello.
//
// ⚠ Dos cosas están en juego: (1) que nadie vea ni toque la solicitud de OTRO
// negocio (todo filtra por la organización de la sesión, y solo el dueño actúa) y
// (2) que un préstamo real nunca quede sin apuntar (se crearía dos veces).
//
// Las rutas se prueban de verdad (se llaman sus handlers); lo que se simula es la
// sesión, la base y lo que hace I/O de `solicitud.js` (apuntar, terminar, pedir
// ayuda, leer el archivo del almacén). Lo puro (`filasPendientes`, `creadasDe`…)
// es el real.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const m = vi.hoisted(() => {
  const db = { sol: null, org: null }
  // Como la base: un `where` con organizationId solo casa con las de ese negocio.
  // Si una ruta se olvidara del filtro, la solicitud de otro negocio SÍ saldría.
  const findFirst = vi.fn(async ({ where = {} } = {}) => {
    const s = db.sol
    if (!s) return null
    if (where.organizationId !== undefined && where.organizationId !== s.organizationId) return null
    if (where.id !== undefined && where.id !== s.id) return null
    return { ...s }
  })
  return {
    db,
    getServerSession: vi.fn(),
    prisma: {
      solicitudCarga: { findFirst },
      organization: { findUnique: vi.fn(async () => db.org) },
    },
    validarCartera: vi.fn(),
    apuntarCreada: vi.fn(),
    terminarCarga: vi.fn(),
    pedirAyuda: vi.fn(),
    leerArchivoGuardado: vi.fn(),
  }
})

vi.mock('next-auth', () => ({ getServerSession: (...a) => m.getServerSession(...a) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))
vi.mock('@/lib/importar-cartera', () => ({ validarCartera: (...a) => m.validarCartera(...a), importarCartera: vi.fn() }))
// Lo puro de `solicitud.js` es el real; lo que escribe o lee del almacén, simulado.
vi.mock('@/lib/carga-asesor/solicitud', async (original) => ({
  ...(await original()),
  apuntarCreada: (...a) => m.apuntarCreada(...a),
  terminarCarga: (...a) => m.terminarCarga(...a),
  pedirAyuda: (...a) => m.pedirAyuda(...a),
  leerArchivoGuardado: (...a) => m.leerArchivoGuardado(...a),
}))

const { GET } = await import('@/app/api/carga-asesor/route')
const { GET: GET_ARCHIVO } = await import('@/app/api/carga-asesor/archivo/[n]/route')
const { POST: POST_CARGADA } = await import('@/app/api/carga-asesor/cargada/route')
const { POST: POST_AYUDA } = await import('@/app/api/carga-asesor/ayuda/route')

const raiz = path.resolve(__dirname, '..', '..')
const leer = (f) => readFileSync(path.join(raiz, f), 'utf8')
// Los comentarios de este repo citan a los clientes: se busca solo en el código.
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const RUTAS = [
  'app/api/carga-asesor/route.js',
  'app/api/carga-asesor/archivo/[n]/route.js',
  'app/api/carga-asesor/cargada/route.js',
  'app/api/carga-asesor/ayuda/route.js',
]

const DUENO = { user: { id: 'u1', organizationId: 'o1', rol: 'owner' } }
const COBRADOR = { user: { id: 'u2', organizationId: 'o1', rol: 'cobrador' } }
const DUENO_AJENO = { user: { id: 'u9', organizationId: 'o2', rol: 'owner' } }

const fila = (n, k, extra = {}) => ({
  _id: `${n}-${k}`, nombre: `Cliente ${n}-${k}`, cedula: `${n}${k}00`, montoPrestado: 100000, tasaInteres: 20, frecuencia: 'diario',
  fechaInicio: '2026-01-05', numeroCuotas: 30, _archivo: n, _dudas: [], ...extra,
})
const solicitud = (over = {}) => ({
  id: 's1', organizationId: 'o1', estado: 'en_revision', origen: 'web',
  archivos: JSON.stringify([
    { n: 1, ruta: 'cargas/o1/s1/a1.xlsx', nombre: 'cartera.xlsx', tipo: 'excel', mime: 'application/vnd.ms-excel', filas: 3 },
    { n: 2, ruta: 'cargas/o1/s1/a2.jpg', nombre: 'foto.jpg', tipo: 'imagen', mime: 'image/jpeg', filas: 0, fallos: [] },
  ]),
  filas: JSON.stringify([fila(1, 0), fila(1, 1), fila(1, 2)]),
  resumen: JSON.stringify({}),
  nota: null, errorLectura: null, aprobadaAt: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
})
const poner = (over = {}) => { m.db.sol = solicitud(over) }

const get = (url = 'http://localhost/api/carga-asesor') => GET(new Request(url))
const post = (handler, body, { texto } = {}) => handler(new Request('http://localhost/api/carga-asesor/x', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: texto ?? JSON.stringify(body),
}))
const archivo = (n, query = '', sesion = DUENO) => {
  m.getServerSession.mockResolvedValue(sesion)
  return GET_ARCHIVO(new Request(`http://localhost/api/carga-asesor/archivo/${n}${query}`), { params: Promise.resolve({ n: String(n) }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getServerSession.mockResolvedValue(DUENO)
  m.db.org = { plan: 'growth', tasaDefault: null, frecuenciaDefault: null, modoInteresDefault: null }
  poner()
  m.validarCartera.mockResolvedValue({ filas: [], resumen: { espacioDisponible: 100, excedePlan: false } })
  m.apuntarCreada.mockResolvedValue({ ok: true, quedan: 2 })
  m.terminarCarga.mockResolvedValue({ ok: true, clientes: 3, prestamos: 3, enLaCalle: 300000, whatsapp: false })
  m.pedirAyuda.mockResolvedValue({ ok: true })
  m.leerArchivoGuardado.mockResolvedValue(Buffer.from('contenido'))
})

describe('las cuatro rutas son del dueño', () => {
  it('sin sesión: 401 y no se toca la base', async () => {
    m.getServerSession.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
    expect((await archivo(1, '', null)).status).toBe(401)
    expect((await post(POST_CARGADA, { solicitudId: 's1', terminar: true })).status).toBe(401)
    expect((await post(POST_AYUDA, { solicitudId: 's1' })).status).toBe(401)
    expect(m.prisma.solicitudCarga.findFirst).not.toHaveBeenCalled()
  })

  it('un cobrador: 403 en las cuatro, y no se toca la base ni el almacén', async () => {
    m.getServerSession.mockResolvedValue(COBRADOR)
    expect((await get()).status).toBe(403)
    expect((await archivo(1, '', COBRADOR)).status).toBe(403)
    expect((await post(POST_CARGADA, { solicitudId: 's1', filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' })).status).toBe(403)
    expect((await post(POST_AYUDA, { solicitudId: 's1' })).status).toBe(403)
    expect(m.prisma.solicitudCarga.findFirst).not.toHaveBeenCalled()
    expect(m.leerArchivoGuardado).not.toHaveBeenCalled()
    expect(m.apuntarCreada).not.toHaveBeenCalled()
    expect(m.terminarCarga).not.toHaveBeenCalled()
    expect(m.pedirAyuda).not.toHaveBeenCalled()
  })

  it('anclado en código: cada ruta pasa por sesionDueno() y la regla de «owner» vive en un solo sitio', () => {
    for (const f of RUTAS) {
      const src = sinNotas(leer(f))
      expect(src, f).toMatch(/import \{ sesionDueno \} from '@\/lib\/carga-asesor\/sesion-dueno'/)
      expect(src, f).toMatch(/const \{ session, error \} = await sesionDueno\(\)\s*\n\s*if \(error\) return error/)
      expect(src, f).toMatch(/export const runtime = 'nodejs'/)
      // Ninguna busca la solicitud por id a secas: siempre con la organización.
      expect(src, f).not.toMatch(/solicitudCarga\.findUnique/)
    }
    const ayudante = sinNotas(leer('lib/carga-asesor/sesion-dueno.js'))
    expect(ayudante).toMatch(/rol !== 'owner'/)
    expect(ayudante).toMatch(/!session\?\.user\?\.organizationId/)
  })
})

describe('GET /api/carga-asesor', () => {
  it('solo mira la solicitud de la organización de la sesión', async () => {
    await get()
    expect(m.prisma.solicitudCarga.findFirst.mock.calls[0][0].where.organizationId).toBe('o1')
  })

  it('el dueño de OTRO negocio no ve esta solicitud: ni la revisión ni las filas', async () => {
    m.getServerSession.mockResolvedValue(DUENO_AJENO)
    const r = await get()
    const j = await r.json()
    expect(j.solicitud).toBeNull()
    expect(j.revision).toBeNull()
    expect(JSON.stringify(j)).not.toContain('Cliente 1-0')
    expect(m.validarCartera).not.toHaveBeenCalled()
  })

  it('lo de hoy sigue igual: la vista con «cargado», los archivos sin su ruta y maxArchivos', async () => {
    poner({ estado: 'aprobada', aprobadaAt: new Date('2026-11-21T10:00:00Z'), resumen: JSON.stringify({ importado: { clientesCreados: 4, prestamosCreados: 5, enLaCalle: 800000 } }) })
    const j = await (await get()).json()
    expect(j.maxArchivos).toBe(40)
    expect(j.solicitud).toMatchObject({ id: 's1', estado: 'aprobada', cargado: { clientes: 4, prestamos: 5, enLaCalle: 800000 } })
    expect(j.solicitud.archivos).toEqual([
      { n: 1, nombre: 'cartera.xlsx', tipo: 'excel' },
      { n: 2, nombre: 'foto.jpg', tipo: 'imagen' },
    ])
    expect(JSON.stringify(j)).not.toContain('cargas/o1')
    // Ya cargada: no hay nada que revisar.
    expect(j.revision).toBeNull()
  })

  it('sin solicitud: solicitud y revisión nulas', async () => {
    m.db.sol = null
    const j = await (await get()).json()
    expect(j.solicitud).toBeNull()
    expect(j.revision).toBeNull()
  })

  it('en revisión trae las filas en la forma del lote, con su _id, y los archivos con problemas', async () => {
    const { revision } = await (await get()).json()
    expect(revision.filas.map((f) => f._id)).toEqual(['1-0', '1-1', '1-2'])
    // Forma del lote (monto/tasa/yaAbonado…), no la del importador (montoPrestado…).
    expect(revision.filas[0]).toMatchObject({ nombre: 'Cliente 1-0', monto: 100000, tasa: 20, frecuencia: 'diario', fechaInicio: '2026-01-05' })
    expect(revision.filas[0]).not.toHaveProperty('montoPrestado')
    // El archivo 2 se leyó y no dio ninguna fila: el dueño tiene que saberlo.
    expect(revision.problemas).toEqual([{ n: 2, nombre: 'foto.jpg', tipo: 'imagen', sinFilas: true, motivos: [] }])
    expect(revision.errorLectura).toBeNull()
    expect(revision.bloqueada).toBe(false)
  })

  it('⚠ no trae las filas que el dueño ya creó ni las que quitó, y dice cuáles creó', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }, quitadas: ['1-2'] }) })
    const { revision } = await (await get()).json()
    expect(revision.filas.map((f) => f._id)).toEqual(['1-1'])
    expect(revision.creadas).toEqual(['1-0'])
  })

  it('⚠ dice cuánto espacio deja el plan, midiendo SOLO lo que falta por cargar', async () => {
    poner({ resumen: JSON.stringify({ creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } } }) })
    m.validarCartera.mockResolvedValue({ filas: [], resumen: { espacioDisponible: 3, excedePlan: true } })
    const { revision } = await (await get()).json()
    expect(revision.espacio).toBe(3)
    expect(revision.excedePlan).toBe(true)
    const args = m.validarCartera.mock.calls[0][0]
    expect(args.organizationId).toBe('o1')
    expect(args.plan).toBe('growth')
    // Las pendientes, en la forma del importador y sin las marcas internas.
    expect(args.filas.map((f) => f.nombre)).toEqual(['Cliente 1-1', 'Cliente 1-2'])
    expect(args.filas[0]).toMatchObject({ montoPrestado: 100000, tasaInteres: 20 })
    expect(args.filas[0]).not.toHaveProperty('_id')
  })

  it('la base sale de «Cómo prestas por defecto» del negocio, y vacía si no lo tiene', async () => {
    let j = await (await get()).json()
    expect(j.revision.base).toEqual({ tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '' })
    m.db.org = { plan: 'growth', tasaDefault: 5, frecuenciaDefault: 'semanal', modoInteresDefault: 'unico' }
    j = await (await get()).json()
    expect(j.revision.base).toEqual({ tasa: '5', frecuencia: 'semanal', modoInteres: 'unico', rutaId: '' })
    // Sin pedir los tres «Default» en el select la base saldría vacía en silencio.
    const select = m.prisma.organization.findUnique.mock.calls[0][0].select
    expect(select).toMatchObject({ plan: true, tasaDefault: true, frecuenciaDefault: true, modoInteresDefault: true })
    expect(m.prisma.organization.findUnique.mock.calls[0][0].where).toEqual({ id: 'o1' })
  })

  it('el error de lectura pasa tal cual', async () => {
    poner({ errorLectura: 'La foto 3 no se pudo leer' })
    const { revision } = await (await get()).json()
    expect(revision.errorLectura).toBe('La foto 3 no se pudo leer')
  })

  it('con «ayuda» la revisión sigue, pero BLOQUEADA: Carlos la tiene', async () => {
    poner({ estado: 'ayuda' })
    const { revision, solicitud: s } = await (await get()).json()
    expect(s.estado).toBe('ayuda')
    expect(revision.bloqueada).toBe(true)
    expect(revision.filas).toHaveLength(3)
    expect(m.validarCartera).toHaveBeenCalledTimes(1)
  })

  it('leyendo o recibida: revisión BLOQUEADA, con las filas que haya (aunque sean ninguna), sin validar nada', async () => {
    for (const estado of ['leyendo', 'recibida']) {
      poner({ estado, filas: null })
      const { revision } = await (await get()).json()
      expect(revision, estado).toMatchObject({ filas: [], creadas: [], espacio: null, excedePlan: false, bloqueada: true })
      // Lo que ya se leyó de los archivos sí se enseña.
      expect(revision.problemas.map((p) => p.n), estado).toEqual([2])
    }
    expect(m.validarCartera).not.toHaveBeenCalled()
  })

  it('«esperando» (aún sin archivos) y «aprobada» no tienen revisión', async () => {
    for (const estado of ['esperando', 'aprobada', 'rechazada', 'importando']) {
      poner({ estado })
      expect((await (await get()).json()).revision, estado).toBeNull()
    }
  })

  it('si no se puede medir el espacio, la pantalla sigue: espacio null y sin bloquear por plan', async () => {
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {})
    m.validarCartera.mockRejectedValue(new Error('base caída'))
    const r = await get()
    expect(r.status).toBe(200)
    const { revision } = await r.json()
    expect(revision).toMatchObject({ espacio: null, excedePlan: false })
    expect(revision.filas).toHaveLength(3)
    expect(errores).toHaveBeenCalled()
    errores.mockRestore()
  })
})

describe('GET /api/carga-asesor/archivo/[n]', () => {
  it('da el original con las mismas cabeceras que la ruta del superadmin', async () => {
    const r = await archivo(2)
    expect(r.status).toBe(200)
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe('contenido')
    expect(r.headers.get('Content-Type')).toBe('image/jpeg')
    expect(r.headers.get('Content-Disposition')).toBe('inline')
    expect(r.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(m.leerArchivoGuardado).toHaveBeenCalledWith('cargas/o1/s1/a2.jpg')
  })

  it('un Excel se descarga como adjunto, no se abre en la página', async () => {
    const r = await archivo(1)
    expect(r.headers.get('Content-Disposition')).toMatch(/^attachment/)
    expect(r.headers.get('Content-Disposition')).toContain('cartera.xlsx')
  })

  it('⚠ la solicitud de OTRA organización: 404 y no se lee nada del almacén', async () => {
    const r = await archivo(1, '', DUENO_AJENO)
    expect(r.status).toBe(404)
    expect(m.leerArchivoGuardado).not.toHaveBeenCalled()
    expect(m.prisma.solicitudCarga.findFirst.mock.calls[0][0].where.organizationId).toBe('o2')
  })

  it('con ?solicitudId se busca esa, pero siempre dentro de la organización de la sesión', async () => {
    expect((await archivo(2, '?solicitudId=s1')).status).toBe(200)
    expect(m.prisma.solicitudCarga.findFirst.mock.calls[0][0].where).toMatchObject({ id: 's1', organizationId: 'o1' })
    // La de otro negocio, aunque la nombre por su id, no existe para este dueño.
    expect((await archivo(2, '?solicitudId=s1', DUENO_AJENO)).status).toBe(404)
    // Una que no existe.
    expect((await archivo(2, '?solicitudId=otra')).status).toBe(404)
  })

  it('un archivo que no está en la solicitud, o que ya no está en el almacén: 404', async () => {
    expect((await archivo(9)).status).toBe(404)
    m.leerArchivoGuardado.mockResolvedValue(null)
    expect((await archivo(1)).status).toBe(404)
  })
})

describe('POST /api/carga-asesor/cargada', () => {
  const apunte = { solicitudId: 's1', filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' }

  it('apunta la fila con la organización de la SESIÓN, aunque el cuerpo traiga otra', async () => {
    const r = await post(POST_CARGADA, { ...apunte, organizationId: 'o2' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, quedan: 2 })
    expect(m.apuntarCreada).toHaveBeenCalledTimes(1)
    expect(m.apuntarCreada).toHaveBeenCalledWith({ id: 's1', organizationId: 'o1', filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' })
    expect(m.terminarCarga).not.toHaveBeenCalled()
  })

  it('⚠ un préstamo de otro negocio ⇒ 404 (lo dice apuntarCreada) y nada queda apuntado', async () => {
    m.apuntarCreada.mockResolvedValue({ error: 'Ese préstamo no es de este negocio', status: 404 })
    const r = await post(POST_CARGADA, apunte)
    expect(r.status).toBe(404)
    expect(await r.json()).toEqual({ error: 'Ese préstamo no es de este negocio' })
  })

  it('la solicitud de OTRO negocio ⇒ 404 sin llegar a apuntar ni a terminar', async () => {
    m.getServerSession.mockResolvedValue(DUENO_AJENO)
    expect((await post(POST_CARGADA, apunte)).status).toBe(404)
    expect((await post(POST_CARGADA, { solicitudId: 's1', terminar: true })).status).toBe(404)
    expect(m.prisma.solicitudCarga.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', organizationId: 'o2' })
    expect(m.apuntarCreada).not.toHaveBeenCalled()
    expect(m.terminarCarga).not.toHaveBeenCalled()
  })

  it('⚠ un préstamo que YA existe se apunta aunque la solicitud esté en «ayuda», leyendo o recibida', async () => {
    for (const estado of ['ayuda', 'leyendo', 'recibida', 'en_revision']) {
      poner({ estado })
      m.apuntarCreada.mockClear()
      const r = await post(POST_CARGADA, apunte)
      expect(r.status, estado).toBe(200)
      expect(m.apuntarCreada, estado).toHaveBeenCalledTimes(1)
    }
  })

  it('una solicitud cerrada la rechaza apuntarCreada (409) y se dice tal cual', async () => {
    m.apuntarCreada.mockResolvedValue({ error: 'Está aprobada: ya no se puede apuntar', status: 409 })
    expect((await post(POST_CARGADA, apunte)).status).toBe(409)
  })

  it('cuerpo roto o incompleto ⇒ 400 sin tocar nada', async () => {
    expect((await post(POST_CARGADA, null, { texto: '{no es json' })).status).toBe(400)
    expect((await post(POST_CARGADA, null, { texto: '[]' })).status).toBe(400)
    expect((await post(POST_CARGADA, { filaId: '1-0', clienteId: 'c1', prestamoId: 'p1' })).status).toBe(400)
    expect((await post(POST_CARGADA, { solicitudId: 's1' })).status).toBe(400)
    expect((await post(POST_CARGADA, { ...apunte, prestamoId: '' })).status).toBe(400)
    expect(m.apuntarCreada).not.toHaveBeenCalled()
    expect(m.terminarCarga).not.toHaveBeenCalled()
  })

  it('⚠ los ids deben ser texto: un objeto o un número en el where de Prisma casaría con otra fila', async () => {
    for (const malo of [{ clienteId: { not: '' } }, { prestamoId: { contains: '' } }, { clienteId: 0 }, { prestamoId: ['p1'] }, { filaId: 7 }]) {
      expect((await post(POST_CARGADA, { ...apunte, ...malo })).status, JSON.stringify(malo)).toBe(400)
    }
    expect((await post(POST_CARGADA, { solicitudId: { not: '' }, terminar: true })).status).toBe(400)
    expect(m.prisma.solicitudCarga.findFirst).not.toHaveBeenCalled()
    expect(m.apuntarCreada).not.toHaveBeenCalled()
  })

  describe('terminar', () => {
    it('termina con lo que quitó, y solo con ids de texto', async () => {
      const r = await post(POST_CARGADA, { solicitudId: 's1', terminar: true, quitadas: ['1-1', 5, '1-2', null, { a: 1 }], organizationId: 'o2' })
      expect(r.status).toBe(200)
      expect(await r.json()).toMatchObject({ ok: true, clientes: 3, prestamos: 3 })
      expect(m.terminarCarga).toHaveBeenCalledTimes(1)
      expect(m.terminarCarga).toHaveBeenCalledWith({ id: 's1', organizationId: 'o1', quitadas: ['1-1', '1-2'] })
      expect(m.apuntarCreada).not.toHaveBeenCalled()
    })

    it('sin «quitadas» termina sin quitar nada', async () => {
      await post(POST_CARGADA, { solicitudId: 's1', terminar: true })
      expect(m.terminarCarga).toHaveBeenCalledWith({ id: 's1', organizationId: 'o1', quitadas: [] })
    })

    it('«quitadas» que no es una lista ⇒ 400', async () => {
      expect((await post(POST_CARGADA, { solicitudId: 's1', terminar: true, quitadas: '1-1' })).status).toBe(400)
      expect(m.terminarCarga).not.toHaveBeenCalled()
    })

    it('⚠ en «ayuda» ⇒ 409 y NO se termina (Carlos la tiene)', async () => {
      poner({ estado: 'ayuda' })
      const r = await post(POST_CARGADA, { solicitudId: 's1', terminar: true, quitadas: [] })
      expect(r.status).toBe(409)
      expect((await r.json()).error).toMatch(/Carlos/)
      expect(m.terminarCarga).not.toHaveBeenCalled()
    })

    it('si quedan filas, lo dice (200 con ok:false y cuántas) y no hay error', async () => {
      m.terminarCarga.mockResolvedValue({ ok: false, quedan: 4 })
      const r = await post(POST_CARGADA, { solicitudId: 's1', terminar: true })
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ ok: false, quedan: 4 })
    })

    it('los errores de terminarCarga pasan con su estado', async () => {
      m.terminarCarga.mockResolvedValue({ error: 'Todavía no cargaste ningún cliente: sube otro archivo o pide ayuda', status: 400 })
      const r = await post(POST_CARGADA, { solicitudId: 's1', terminar: true })
      expect(r.status).toBe(400)
      expect((await r.json()).error).toMatch(/Todavía no cargaste/)
    })

    it('terminar dos veces: la segunda contesta yaTerminada sin error', async () => {
      m.terminarCarga.mockResolvedValue({ ok: true, yaTerminada: true })
      poner({ estado: 'aprobada' })
      const r = await post(POST_CARGADA, { solicitudId: 's1', terminar: true })
      expect(r.status).toBe(200)
      expect(await r.json()).toEqual({ ok: true, yaTerminada: true })
    })
  })
})

describe('POST /api/carga-asesor/ayuda', () => {
  it('pide la ayuda con la organización de la sesión y la nota', async () => {
    const r = await post(POST_AYUDA, { solicitudId: 's1', nota: 'No entiendo la foto 3', organizationId: 'o2' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(m.pedirAyuda).toHaveBeenCalledWith({ id: 's1', organizationId: 'o1', nota: 'No entiendo la foto 3' })
  })

  it('la nota es opcional, y si no es texto se descarta', async () => {
    await post(POST_AYUDA, { solicitudId: 's1' })
    expect(m.pedirAyuda).toHaveBeenLastCalledWith({ id: 's1', organizationId: 'o1', nota: '' })
    await post(POST_AYUDA, { solicitudId: 's1', nota: { x: 1 } })
    expect(m.pedirAyuda).toHaveBeenLastCalledWith({ id: 's1', organizationId: 'o1', nota: '' })
  })

  it('la solicitud de OTRO negocio ⇒ 404 y no se avisa a Carlos', async () => {
    m.getServerSession.mockResolvedValue(DUENO_AJENO)
    expect((await post(POST_AYUDA, { solicitudId: 's1' })).status).toBe(404)
    expect(m.prisma.solicitudCarga.findFirst.mock.calls[0][0].where).toEqual({ id: 's1', organizationId: 'o2' })
    expect(m.pedirAyuda).not.toHaveBeenCalled()
  })

  it('sin solicitudId, con un id que no es texto o con cuerpo roto ⇒ 400', async () => {
    expect((await post(POST_AYUDA, {})).status).toBe(400)
    expect((await post(POST_AYUDA, { solicitudId: { not: '' } })).status).toBe(400)
    expect((await post(POST_AYUDA, null, { texto: 'no es json' })).status).toBe(400)
    expect(m.pedirAyuda).not.toHaveBeenCalled()
  })

  it('los errores de pedirAyuda pasan con su estado (p. ej. todavía leyendo)', async () => {
    m.pedirAyuda.mockResolvedValue({ error: 'Está leyendo: todavía no se puede pedir ayuda', status: 409 })
    const r = await post(POST_AYUDA, { solicitudId: 's1' })
    expect(r.status).toBe(409)
    expect((await r.json()).error).toMatch(/todavía no se puede pedir ayuda/)
  })

  it('un segundo toque no es un error (yaEstaba)', async () => {
    m.pedirAyuda.mockResolvedValue({ ok: true, yaEstaba: true })
    const r = await post(POST_AYUDA, { solicitudId: 's1' })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true, yaEstaba: true })
  })
})
