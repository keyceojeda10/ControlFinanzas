// lib/__tests__/admin-cargas-ayuda.test.js
//
// Plan «La carga de cartera la revisa y la carga el dueño» (22 nov 2026), tarea 6:
// el panel de Carlos (`/admin/cargas`). La solicitud ya no le llega mientras el
// dueño la revisa: le llega cuando el dueño pide ayuda (estado «ayuda»). Desde
// ahí Carlos la puede devolver, y su «Aprobar e importar» tiene que decir dos
// cosas que antes no hacía falta decir:
//   · crea los préstamos con interés FIJO (si el negocio presta de otra forma, el
//     préstamo sale con otra cuenta: plata de alguien);
//   · las filas que el dueño ya creó no se importan otra vez (se verían dobles).
//
// La ruta se prueba de verdad (se llaman sus handlers); la página es 'use client'
// y no hay DOM en este repo, así que se ancla en el CÓDIGO (sin comentarios: los
// comentarios de aquí citan a los clientes).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const m = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  devolverAlDueno: vi.fn(),
  aprobarSolicitud: vi.fn(),
  rechazarSolicitud: vi.fn(),
  pedidos: [],
  db: { sol: null },
  prisma: null,
}))
m.prisma = {
  solicitudCarga: {
    findMany: vi.fn(async () => (m.db.lista ?? [])),
    // Como la base: del `select` del `include` solo salen las columnas pedidas.
    // Si el GET se olvidara de pedir `modoInteresDefault`, aquí llegaría `undefined`.
    findUnique: vi.fn(async (args) => {
      m.pedidos.push(args)
      if (!m.db.sol) return null
      const quiere = args.include?.organization?.select
      const org = quiere ? Object.fromEntries(Object.keys(quiere).filter((k) => k in m.db.sol.organization).map((k) => [k, m.db.sol.organization[k]])) : m.db.sol.organization
      return { ...m.db.sol, organization: org }
    }),
  },
  user: { findFirst: vi.fn(async () => ({ nombre: 'Pedro', telefono: '300', email: 'p@x.co' })) },
  ruta: { findMany: vi.fn(async () => []) },
}

vi.mock('next-auth', () => ({ getServerSession: (...a) => m.getServerSession(...a) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: m.prisma }))
// Lo puro de `solicitud.js` es el real; lo que escribe, simulado.
vi.mock('@/lib/carga-asesor/solicitud', async (original) => ({
  ...(await original()),
  devolverAlDueno: (...a) => m.devolverAlDueno(...a),
  aprobarSolicitud: (...a) => m.aprobarSolicitud(...a),
  rechazarSolicitud: (...a) => m.rechazarSolicitud(...a),
}))
// El almacén y el importador no se tocan aquí, pero `solicitud.js` los importa.
vi.mock('@/lib/importar-cartera', () => ({ validarCartera: vi.fn(), importarCartera: vi.fn() }))

const RUTA = await import('@/app/api/admin/cargas/[id]/route')
const SOL = await import('@/lib/carga-asesor/solicitud')

const raiz = path.resolve(__dirname, '..', '..')
const leer = (f) => readFileSync(path.join(raiz, f), 'utf8')
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const detalle = sinNotas(leer('app/admin/cargas/[id]/page.jsx'))
const lista = sinNotas(leer('app/admin/cargas/page.jsx'))
const inicio = sinNotas(leer('app/admin/inicio/page.jsx'))
const rutaSrc = sinNotas(leer('app/api/admin/cargas/[id]/route.js'))

const sesion = (rol = 'superadmin') => ({ user: { id: 'admin1', rol } })
const post = (cuerpo) => new Request('http://x/api/admin/cargas/s1', { method: 'POST', body: JSON.stringify(cuerpo) })
const params = { params: Promise.resolve({ id: 's1' }) }

const filas = [
  { _id: '1-0', nombre: 'Ana' }, { _id: '1-1', nombre: 'Beto' }, { _id: '1-2', nombre: 'Carla' }, { _id: '1-3', nombre: 'Dani' },
]
const solicitud = (over = {}) => ({
  id: 's1', organizationId: 'o1', estado: 'ayuda', origen: 'web', nota: null, createdAt: new Date('2026-11-20T10:00:00Z'), aprobadaAt: null,
  errorLectura: null, archivos: '[]', filas: JSON.stringify(filas),
  resumen: JSON.stringify({ ayuda: { at: '2026-11-22T10:00:00.000Z', nota: 'No me deja con las cédulas' }, creadas: { '1-0': { clienteId: 'c1', prestamoId: 'p1' } }, quitadas: ['1-3'] }),
  organization: { id: 'o1', nombre: 'Negocio Uno', plan: 'growth', diasSinCobro: 3, modoInteresDefault: 'saldo', _count: { clientes: 5 } },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  m.pedidos.length = 0
  m.getServerSession.mockResolvedValue(sesion())
  m.devolverAlDueno.mockResolvedValue({ ok: true })
  m.aprobarSolicitud.mockResolvedValue({ resultado: { clientesCreados: 1, prestamosCreados: 1 }, enLaCalle: 1, whatsapp: true })
  m.rechazarSolicitud.mockResolvedValue({ ok: true })
  m.db.sol = solicitud()
})

describe('POST accion «devolver»', () => {
  it('llama a devolverAlDueno con el id de la solicitud y el de Carlos (el de la sesión)', async () => {
    const r = await RUTA.POST(post({ accion: 'devolver' }), params)
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ ok: true })
    expect(m.devolverAlDueno).toHaveBeenCalledTimes(1)
    expect(m.devolverAlDueno).toHaveBeenCalledWith({ id: 's1', adminId: 'admin1' })
    expect(m.aprobarSolicitud).not.toHaveBeenCalled()
  })

  it('lo que diga devolverAlDueno (409: no pide ayuda) llega tal cual a la pantalla', async () => {
    m.devolverAlDueno.mockResolvedValue({ error: 'No está pidiendo ayuda', status: 409 })
    const r = await RUTA.POST(post({ accion: 'devolver' }), params)
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('No está pidiendo ayuda')
  })

  it('⚠ solo el superadmin: el dueño y quien no entró no la devuelven', async () => {
    for (const s of [sesion('owner'), sesion('admin'), null]) {
      m.getServerSession.mockResolvedValue(s)
      expect((await RUTA.POST(post({ accion: 'devolver' }), params)).status).toBe(403)
    }
    expect(m.devolverAlDueno).not.toHaveBeenCalled()
  })

  it('una acción que no existe sigue siendo 400 y no llama a nada', async () => {
    expect((await RUTA.POST(post({ accion: 'devolverla' }), params)).status).toBe(400)
    expect(m.devolverAlDueno).not.toHaveBeenCalled()
  })

  it('aprobar y rechazar siguen donde estaban', async () => {
    await RUTA.POST(post({ accion: 'aprobar', ruta: 'Norte', noCobrarDomingos: true }), params)
    expect(m.aprobarSolicitud).toHaveBeenCalledWith({ id: 's1', adminId: 'admin1', ruta: 'Norte', noCobrarDomingos: true })
  })
})

describe('POST accion «rechazar»', () => {
  it('lo que diga rechazarSolicitud (409: el dueño ya empezó) llega tal cual a la pantalla', async () => {
    m.rechazarSolicitud.mockResolvedValue({ error: 'El dueño ya empezó a cargar esta cartera. Espera a que pida ayuda.', status: 409 })
    const r = await RUTA.POST(post({ accion: 'rechazar', motivo: 'x' }), params)
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe('El dueño ya empezó a cargar esta cartera. Espera a que pida ayuda.')
    expect(m.rechazarSolicitud).toHaveBeenCalledWith({ id: 's1', adminId: 'admin1', motivo: 'x' })
  })
})

describe('GET: lo que la ficha necesita para avisar y para marcar', () => {
  it('trae el modo de interés por defecto del negocio (el aviso del interés fijo lo lee de ahí)', async () => {
    const j = await (await RUTA.GET(new Request('http://x'), params)).json()
    expect(j.negocio.modoInteresDefault).toBe('saldo')
    expect(j.negocio.clientes).toBe(5)
  })

  it('trae los ids de las filas que el dueño creó y de las que quitó', async () => {
    const j = await (await RUTA.GET(new Request('http://x'), params)).json()
    expect(j.solicitud.creadas).toEqual(['1-0'])
    expect(j.solicitud.quitadas).toEqual(['1-3'])
    // Las filas siguen todas ahí: la ficha las marca, no las esconde.
    expect(j.solicitud.filas.map((f) => f._id)).toEqual(['1-0', '1-1', '1-2', '1-3'])
    expect(j.solicitud.resumen.ayuda.nota).toBe('No me deja con las cédulas')
  })

  it('sin creadas ni quitadas (solicitud de antes): listas vacías, no undefined', async () => {
    m.db.sol = solicitud({ resumen: null })
    const j = await (await RUTA.GET(new Request('http://x'), params)).json()
    expect(j.solicitud.creadas).toEqual([])
    expect(j.solicitud.quitadas).toEqual([])
  })

  it('un negocio sin modo por defecto lo dice vacío, no inventa «fijo»', async () => {
    m.db.sol = solicitud({ organization: { id: 'o1', nombre: 'N', plan: 'growth', diasSinCobro: 3, modoInteresDefault: null, _count: { clientes: 0 } } })
    const j = await (await RUTA.GET(new Request('http://x'), params)).json()
    expect(j.negocio.modoInteresDefault ?? null).toBeNull()
  })

  it('el select de la organización pide modoInteresDefault (un select que no lo pide lo deja ciego en silencio)', () => {
    expect(rutaSrc).toMatch(/organization:\s*\{\s*select:\s*\{[^}]*modoInteresDefault:\s*true/)
  })

  it('solo el superadmin lee', async () => {
    m.getServerSession.mockResolvedValue(sesion('owner'))
    expect((await RUTA.GET(new Request('http://x'), params)).status).toBe(403)
  })
})

describe('los estados: la ficha y las listas dicen lo mismo que el servidor', () => {
  const arreglo = (src, nombre) => {
    const t = src.match(new RegExp(`const ${nombre} = \\[([^\\]]*)\\]`))
    expect(t, `no hay «const ${nombre} = [...]»`).toBeTruthy()
    return [...t[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }

  it('la ficha deja editar y aprobar en en_revision y en ayuda, y la lista escrita a mano es la del servidor', () => {
    const editables = arreglo(detalle, 'ESTADOS_EDITABLES')
    expect([...editables].sort()).toEqual([...SOL.ESTADOS_EDITABLES].sort())
    expect(editables).toEqual(expect.arrayContaining(['en_revision', 'ayuda']))
    expect(detalle).toMatch(/const abierta = ESTADOS_EDITABLES\.includes\(s\.estado\)/)
    // Ya no es «solo en revisión».
    expect(detalle).not.toMatch(/const abierta = s\.estado === 'en_revision'/)
  })

  it('⚠ el contador del inicio es lo que tiene que atender Carlos: solo «ayuda» (y «importando», que si se queda pegada es suya)', () => {
    // Lo que el dueño todavía revisa (en_revision) o lo que aún se lee no es de Carlos.
    const enInicio = inicio.match(/filter\(\(c\) => \[([^\]]*)\]\.includes\(c\.estado\)\)/)
    expect(enInicio, 'el inicio no filtra las cargas como se esperaba').toBeTruthy()
    const estados = [...enInicio[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect([...estados].sort()).toEqual([...SOL.ESTADOS_POR_ATENDER, 'importando'].sort())
    for (const nada of ['en_revision', 'recibida', 'leyendo', 'esperando']) expect(estados).not.toContain(nada)
    // Y el rótulo no promete «por revisar» lo que el dueño está revisando.
    expect(inicio).toContain('`${n} por atender`')
    expect(inicio).not.toContain('`${n} por revisar`')
  })

  it('la lista sabe pintar «ayuda» con su propio nombre (no el crudo)', () => {
    expect(lista).toMatch(/ayuda:\s*\{\s*texto:\s*'[^']+'/)
  })
})

describe('la ficha: «Rechazar» no sale si el dueño ya empezó a cargar', () => {
  it('el motivo y el botón van dentro de {!duenoCargando && (…)}, igual que el 409 del servidor', () => {
    const i = detalle.indexOf('aria-label="Motivo del rechazo"')
    const j = detalle.indexOf("accion({ accion: 'rechazar'")
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
    const abre = detalle.lastIndexOf('{!duenoCargando && (', i)
    expect(abre).toBeGreaterThan(-1)
    // Entre la apertura y el botón no se cierra ese bloque.
    expect(detalle.slice(abre, j)).not.toMatch(/\n\s*\)\}\s*\n/)
    // «Aprobar e importar» sigue fuera de él (lo bloquea `bloqueada`, no desaparece).
    expect(detalle.indexOf('Aprobar e importar ${')).toBeLessThan(abre)
  })
})

describe('la lista: «tarde» es de la que pidió ayuda, desde que la pidió', () => {
  it('la API de la lista manda resumen.ayuda.at de cada carga (la página mide desde ahí)', async () => {
    const { GET: LISTA } = await import('@/app/api/admin/cargas/route')
    m.db.lista = [{
      id: 's1', estado: 'ayuda', origen: 'web', archivos: '[]', createdAt: new Date('2026-11-20T10:00:00Z'), aprobadaAt: null, errorLectura: null,
      resumen: JSON.stringify({ filas: 3, ayuda: { at: '2026-11-22T10:00:00.000Z', nota: null } }), organization: { id: 'o1', nombre: 'N', plan: 'growth' },
    }]
    const j = await (await LISTA()).json()
    expect(j.cargas[0].estado).toBe('ayuda')
    expect(j.cargas[0].resumen.ayuda.at).toBe('2026-11-22T10:00:00.000Z')
    m.db.lista = null
  })

  it('«tarde» (rojo, más de 20 h) solo cuenta para «ayuda» y se mide desde resumen.ayuda.at, no desde que se creó', () => {
    expect(lista).toMatch(/const t = c\.estado === 'ayuda' \? Date\.parse\(c\.resumen\?\.ayuda\?\.at\) : NaN/)
    // Sin hora legible no se inventa una («hace NaN días»): no hay renglón y no hay rojo.
    expect(lista).toMatch(/const ayudaAt = Number\.isFinite\(t\) \? t : null/)
    expect(lista).toMatch(/const tarde = ayudaAt != null && datos\.ahora - ayudaAt > 20 \* 3600000/)
    // Ya no: todo estado abierto, desde la creación.
    expect(lista).not.toMatch(/ABIERTA\.includes\(c\.estado\)/)
    expect(lista).not.toMatch(/datos\.ahora - new Date\(c\.creada\) > 20/)
    expect(lista).not.toMatch(/const ABIERTA/)
  })

  it('la hora de creación ya no se pinta de rojo: lo rojo es «pidió ayuda hace …»', () => {
    expect(lista).toMatch(/pidió ayuda \{hace\(ayudaAt, datos\.ahora\)\}/)
    expect(lista).toMatch(/\{hace\(c\.creada, datos\.ahora\)\}/)
    expect(lista).not.toMatch(/color: tarde \? 'var\(--cf-red-dark\)' : 'var\(--cf-ink-2\)'/)
  })
})

describe('la ficha: «Devolver al dueño»', () => {
  it('solo se ofrece en «ayuda»', () => {
    const i = detalle.indexOf(">Devolver al dueño<")
    expect(i).toBeGreaterThan(-1)
    // El botón vive dentro de un `{s.estado === 'ayuda' && (` y no antes de otro cierre.
    const antes = detalle.slice(0, i)
    const abre = antes.lastIndexOf("s.estado === 'ayuda' &&")
    expect(abre).toBeGreaterThan(-1)
    expect(antes.slice(abre)).not.toMatch(/\)\}\s*\n\s*\{/)
  })

  it('manda la acción «devolver» y, si hay cambios sin guardar, los guarda antes (no se pierden al recargar)', () => {
    expect(detalle).toMatch(/accion:\s*'devolver'/)
    expect(detalle).toMatch(/\(cuerpo\.accion === 'aprobar' \|\| cuerpo\.accion === 'devolver'\) && sucio && !\(await guardar\(\)\)/)
  })
})

describe('la ficha: el aviso del interés fijo', () => {
  it('sale cuando el negocio tiene un modo y no es «fijo», con el nombre del modo, ANTES del botón', () => {
    expect(detalle).toMatch(/import \{[^}]*etiquetaModo[^}]*\} from '@\/lib\/dinero\/modos'/)
    expect(detalle).toMatch(/const modoDistinto = !!d\.negocio\.modoInteresDefault && d\.negocio\.modoInteresDefault !== 'fijo'/)
    expect(detalle).toMatch(/\{modoDistinto && \(/)
    expect(detalle).toContain('Este negocio presta en {etiquetaModo(d.negocio.modoInteresDefault)}.')
    expect(detalle).toContain('crea los préstamos con interés fijo. Si no es así, devuélvesela al dueño para que la cargue él.')
    const aviso = detalle.indexOf('crea los préstamos con interés fijo')
    const boton = detalle.indexOf('Aprobar e importar ${')
    expect(aviso).toBeGreaterThan(-1)
    expect(boton).toBeGreaterThan(aviso)
  })

  it('un negocio sin modo (o ya en «fijo») no lleva aviso: no se supone nada', () => {
    // La condición pide que exista el modo; «fijo» y vacío caen fuera.
    expect(detalle).toMatch(/!!d\.negocio\.modoInteresDefault &&/)
    expect(detalle).not.toMatch(/modoInteresDefault \|\| 'fijo'/)
  })
})

describe('la ficha: lo que el dueño ya cargó', () => {
  it('marca las creadas y las quitadas con su nombre', () => {
    expect(detalle).toContain('Ya la cargó el dueño')
    expect(detalle).toContain('La quitó el dueño')
    expect(detalle).toMatch(/new Set\(d\?\.solicitud\.creadas \?\? \[\]\)/)
    expect(detalle).toMatch(/new Set\(d\?\.solicitud\.quitadas \?\? \[\]\)/)
  })

  it('esas filas no se editan ni se quitan', () => {
    expect(detalle).toMatch(/const cerrada = cargada \|\| quitada/)
    expect(detalle).toMatch(/disabled=\{!abierta \|\| cerrada\}/)
    expect(detalle).toMatch(/\{abierta && !cerrada && \(/)
  })

  it('no cuentan entre las que se van a importar (filas, a crear, prestado, error, dudosas)', () => {
    expect(detalle).toMatch(/const porImportar = filas\.filter\(\(f\) => !cerradaPorDueno\(f, idsCargadas, idsQuitadas\)\)/)
    expect(detalle).toMatch(/const resumenPorImportar = resumenDe\(porImportar\)/)
    // El botón se bloquea por los errores de lo que SE IMPORTA: una fila ya creada
    // se revalida como «repetida» o con error y no debe frenar a Carlos.
    expect(detalle).toMatch(/const conError = resumenPorImportar\.conError/)
    expect(detalle).toMatch(/const bloqueada = conError > 0 \|\| r\.excedePlan \|\| duenoCargando/)
    expect(detalle).toMatch(/disabled=\{!!ocupado \|\| bloqueada\}/)
    expect(detalle).toMatch(/`Aprobar e importar \$\{resumenPorImportar\.aCrear\}`/)
    // Ninguna cifra sale ya del resumen de TODAS las filas (lo que incluye lo ya cargado).
    expect(detalle).not.toMatch(/\(r\.conError \?\? 0\)/)
    expect(detalle).not.toMatch(/\br\.aCrear/)
    expect(detalle).not.toMatch(/\br\.prestado/)
    expect(detalle).not.toMatch(/\br\.dudosas/)
  })

  it('«en la calle» no se enseña con filas del dueño de por medio (no se puede partir: lo calcula la validación de todas)', () => {
    expect(detalle).toMatch(/\{nCargadas \+ nQuitadas === 0 && <span>\{formatMoney\(r\.enLaCalle \?\? 0\)\} en la calle<\/span>\}/)
    expect(detalle).toMatch(/\{nCargadas > 0 && <span>\{nCargadas\} ya las cargó el dueño<\/span>\}/)
    expect(detalle).toMatch(/\{nQuitadas > 0 && <span>\{nQuitadas\} las quitó el dueño<\/span>\}/)
  })

  it('«Rellenar» no toca las filas del dueño, y «Solo las que hay que mirar» tampoco las muestra', () => {
    expect(detalle).toMatch(/cerradaPorDueno\(f, idsCargadas, idsQuitadas\) \? f : \{/)
    expect(detalle).toMatch(/!cerradaPorDueno\(f, idsCargadas, idsQuitadas\) && \(f\._estado === 'error'/)
  })

  it('en «en_revision» con filas ya creadas no se puede aprobar: el servidor lo dice y la ficha avisa', () => {
    expect(detalle).toMatch(/const duenoCargando = s\.estado === 'en_revision' && \(s\.creadas\?\.length \?\? 0\) > 0/)
    expect(detalle).toContain('El dueño ya empezó a cargar esta cartera. Espera a que pida ayuda.')
  })
})

describe('la ficha: la nota del dueño al pedir ayuda', () => {
  it('sale arriba, antes de las cifras, cuando existe', () => {
    expect(detalle).toMatch(/\{r\.ayuda\?\.nota && \(/)
    const nota = detalle.indexOf('r.ayuda?.nota')
    const cifras = detalle.indexOf('{resumenPorImportar.filas} filas')
    expect(nota).toBeGreaterThan(-1)
    expect(cifras).toBeGreaterThan(nota)
  })
})

describe('la ficha: el botón «Actualizar» no sale en «ayuda»', () => {
  it('solo sale en lo que no se puede editar ni está cerrado (leyendo, importando…)', () => {
    expect(detalle).toMatch(/\{!abierta && s\.estado !== 'aprobada' && s\.estado !== 'rechazada' && \(/)
    expect(detalle).not.toMatch(/s\.estado !== 'en_revision' && s\.estado !== 'aprobada'/)
  })
})

describe('no hay emojis en lo nuevo', () => {
  it('ficha y lista sin emojis', () => {
    const emoji = /\p{Extended_Pictographic}/u
    expect(emoji.test(detalle)).toBe(false)
    expect(emoji.test(lista)).toBe(false)
  })
})
