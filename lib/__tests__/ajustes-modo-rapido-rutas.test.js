// lib/__tests__/ajustes-modo-rapido-rutas.test.js
//
// Tarea 10 (23 nov 2026): el interruptor del modo rápido, de punta a punta.
//
//   GET   /api/ajustes/modo-rapido   → lo que lee la app: { activo }
//   GET   /api/admin/ajustes         → lo que muestra el panel: { modoRapido }
//   PATCH /api/admin/ajustes         → lo que mueve el interruptor (solo superadmin)
//
// Las rutas se llaman de verdad; la base y la sesión son simuladas.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const m = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  registrarAdminLog: vi.fn(async () => ({})),
  fila: null,
  falla: false,
  prisma: null,
}))
m.prisma = {
  ajusteGlobal: {
    findUnique: vi.fn(async () => {
      if (m.falla) throw new Error('base caída')
      return m.fila
    }),
    upsert: vi.fn(async ({ create }) => {
      m.fila = { valor: create.valor }
      return { ...create }
    }),
  },
}

vi.mock('next-auth', () => ({ getServerSession: (...a) => m.getServerSession(...a) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))
vi.mock('@/lib/admin-log', () => ({ registrarAdminLog: (...a) => m.registrarAdminLog(...a) }))

const PUBLICA = await import('@/app/api/ajustes/modo-rapido/route')
const ADMIN = await import('@/app/api/admin/ajustes/route')
const { invalidarAjustesGlobales } = await import('@/lib/ajustes-globales')

const patch = (cuerpo) => new Request('http://localhost/api/admin/ajustes', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
})

const SUPER = { user: { id: 'sa1', rol: 'superadmin' } }
const DUENO = { user: { id: 'u1', rol: 'owner', organizationId: 'o1' } }

beforeEach(() => {
  m.getServerSession.mockReset()
  m.registrarAdminLog.mockClear()
  m.prisma.ajusteGlobal.findUnique.mockClear()
  m.prisma.ajusteGlobal.upsert.mockClear()
  m.fila = null
  m.falla = false
  invalidarAjustesGlobales()
})

describe('GET /api/ajustes/modo-rapido (lo que lee la app)', () => {
  it('sin sesión: { activo: false } con 200, y no toca la base', async () => {
    m.getServerSession.mockResolvedValue(null)
    const res = await PUBLICA.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ activo: false })
    expect(m.prisma.ajusteGlobal.findUnique).not.toHaveBeenCalled()
  })

  it('sin sesión no se guarda en la caché del navegador (el login lo vería mal 60 s)', async () => {
    m.getServerSession.mockResolvedValue(null)
    const res = await PUBLICA.GET()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('con sesión de cualquier rol y sin fila: encendido', async () => {
    for (const rol of ['owner', 'cobrador', 'admin', 'superadmin']) {
      m.getServerSession.mockResolvedValue({ user: { id: 'x', rol } })
      invalidarAjustesGlobales()
      const res = await PUBLICA.GET()
      expect(res.status, rol).toBe(200)
      expect(await res.json(), rol).toEqual({ activo: true })
    }
  })

  it("con la fila en '0': apagado", async () => {
    m.getServerSession.mockResolvedValue(DUENO)
    m.fila = { valor: '0' }
    expect(await (await PUBLICA.GET()).json()).toEqual({ activo: false })
  })

  it('con sesión: Cache-Control private, max-age=60', async () => {
    m.getServerSession.mockResolvedValue(DUENO)
    const res = await PUBLICA.GET()
    expect(res.headers.get('cache-control')).toBe('private, max-age=60')
  })

  it('si la base falla: 503 sin `activo` y sin guardarse en el navegador', async () => {
    /* Un bache de la base NO es «apagado»: contestar { activo: false } le diría a
       cada teléfono que apague el modo rápido. Con 503 la app no decide nada y el
       service worker se queda como estaba (decidirModoRapido → null). */
    m.getServerSession.mockResolvedValue(DUENO)
    m.falla = true
    const res = await PUBLICA.GET()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const cuerpo = await res.json()
    expect(cuerpo).not.toHaveProperty('activo')
  })

  it('el 503 no se queda: en cuanto la base vuelve, contesta bien', async () => {
    m.getServerSession.mockResolvedValue(DUENO)
    m.falla = true
    expect((await PUBLICA.GET()).status).toBe(503)
    m.falla = false
    const res = await PUBLICA.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ activo: true })
  })
})

describe('GET /api/admin/ajustes (lo que muestra el panel)', () => {
  it('403 a quien no es superadmin, y sin sesión', async () => {
    for (const s of [null, DUENO, { user: { id: 'a', rol: 'admin' } }]) {
      m.getServerSession.mockResolvedValue(s)
      const res = await ADMIN.GET()
      expect(res.status).toBe(403)
    }
    expect(m.prisma.ajusteGlobal.findUnique).not.toHaveBeenCalled()
  })

  it('sin fila: modoRapido true (nace encendido)', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    const res = await ADMIN.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ modoRapido: true })
  })

  it("con la fila en '0': false", async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    m.fila = { valor: '0' }
    expect(await (await ADMIN.GET()).json()).toEqual({ modoRapido: false })
  })

  it('el panel nunca lee la caché de 60 s: ve lo que hay en la base', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    m.fila = { valor: '1' }
    await ADMIN.GET()
    m.fila = { valor: '0' }
    expect(await (await ADMIN.GET()).json()).toEqual({ modoRapido: false })
  })

  it('si la base falla dice 500, no «apagado» (un interruptor que miente es peor)', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    m.falla = true
    const res = await ADMIN.GET()
    expect(res.status).toBe(500)
  })
})

describe('PATCH /api/admin/ajustes (mueve el interruptor)', () => {
  it('403 a quien no es superadmin: no escribe ni deja registro', async () => {
    for (const s of [null, DUENO, { user: { id: 'a', rol: 'admin' } }]) {
      m.getServerSession.mockResolvedValue(s)
      const res = await ADMIN.PATCH(patch({ modoRapido: false }))
      expect(res.status).toBe(403)
    }
    expect(m.prisma.ajusteGlobal.upsert).not.toHaveBeenCalled()
    expect(m.registrarAdminLog).not.toHaveBeenCalled()
  })

  it('apagar: guarda «0» con quién lo hizo y deja el registro', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    const res = await ADMIN.PATCH(patch({ modoRapido: false }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ modoRapido: false })
    expect(m.prisma.ajusteGlobal.upsert).toHaveBeenCalledWith({
      where: { clave: 'modo_rapido' },
      create: { clave: 'modo_rapido', valor: '0', actualizadoPorId: 'sa1' },
      update: { valor: '0', actualizadoPorId: 'sa1' },
    })
    expect(m.registrarAdminLog).toHaveBeenCalledWith({
      adminId: 'sa1', accion: 'modo_rapido', detalle: 'Modo rápido para todos: apagado',
    })
  })

  it('encender: guarda «1» y lo dice en el registro', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    const res = await ADMIN.PATCH(patch({ modoRapido: true }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ modoRapido: true })
    expect(m.prisma.ajusteGlobal.upsert.mock.calls[0][0].update.valor).toBe('1')
    expect(m.registrarAdminLog.mock.calls[0][0].detalle).toBe('Modo rápido para todos: encendido')
  })

  it('invalida la caché: la app lo ve en su siguiente pregunta, no 60 s después', async () => {
    m.getServerSession.mockResolvedValue(DUENO)
    expect(await (await PUBLICA.GET()).json()).toEqual({ activo: true }) // queda en caché
    m.getServerSession.mockResolvedValue(SUPER)
    await ADMIN.PATCH(patch({ modoRapido: false }))
    m.getServerSession.mockResolvedValue(DUENO)
    expect(await (await PUBLICA.GET()).json()).toEqual({ activo: false })
  })

  it('400 si el cuerpo no trae un booleano: nada se escribe', async () => {
    m.getServerSession.mockResolvedValue(SUPER)
    // `null` es JSON válido: desestructurarlo tiraba un TypeError (500) en vez de un 400.
    for (const cuerpo of [{}, { modoRapido: 'no' }, { modoRapido: 0 }, { modoRapido: null }, 'no es json', null, 'null', [], 5, '"texto"']) {
      const res = await ADMIN.PATCH(patch(cuerpo))
      expect(res.status, JSON.stringify(cuerpo)).toBe(400)
    }
    expect(m.prisma.ajusteGlobal.upsert).not.toHaveBeenCalled()
    expect(m.registrarAdminLog).not.toHaveBeenCalled()
  })
})

describe('el middleware deja pasar la pregunta de la app, y solo esa', () => {
  const mw = readFileSync(resolve(process.cwd(), 'middleware.js'), 'utf8')
  // Primero las líneas `//` y luego los bloques: un `// … /api/* …` abriría un «bloque» que se comería media página.
  const sinNotas = mw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const exentas = sinNotas.match(/const EXENTAS = \[([\s\S]*?)\]/)?.[1] ?? ''

  it('/api/ajustes/modo-rapido está en EXENTAS: el apagado le llega también a quien no ha pagado', () => {
    expect(exentas).toMatch(/'\/api\/ajustes\/modo-rapido'/)
  })

  it('no se exenta todo /api/ajustes/: lo que se añada mañana no entra por esta puerta', () => {
    expect(exentas).not.toMatch(/'\/api\/ajustes\/?'/)
  })

  it('⚠ bajo app/api/ajustes/ NO hay nada más que modo-rapido/route.js', () => {
    /* La entrada de EXENTAS se compara con `startsWith`: es un PREFIJO. Cualquier
       ruta nueva que empiece por `/api/ajustes/modo-rapido` (otra carpeta
       `modo-rapido-algo`, un subdirectorio, otro método) saltaría el bloqueo por
       plan vencido sin que nadie lo decidiera. Si esta prueba falla, la ruta nueva
       no puede vivir ahí, o hay que decidir a propósito si se exenta. */
    const raiz = resolve(process.cwd(), 'app/api/ajustes')
    const archivos = []
    const recorrer = (dir, prefijo) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = prefijo ? `${prefijo}/${e.name}` : e.name
        if (e.isDirectory()) recorrer(resolve(dir, e.name), ruta)
        else archivos.push(ruta)
      }
    }
    recorrer(raiz, '')
    expect(archivos.sort()).toEqual(['modo-rapido/route.js'])
  })

  it('y esa ruta solo lee: no exporta ningún método que escriba', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'app/api/ajustes/modo-rapido/route.js'), 'utf8')
    const codigo = ruta.replace(/^\s*\/\/.*$/gm, '')
    expect([...codigo.matchAll(/export (?:async )?function (\w+)/g)].map((x) => x[1])).toEqual(['GET'])
  })
})
