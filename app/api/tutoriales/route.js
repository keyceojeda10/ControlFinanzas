// app/api/tutoriales/route.js — los videos del profe para ESTA persona.
//
// GET  → { habilitado, vistos, guardados, botonVisible, paraCobradores,
//          mostrarAvisos, descartados, primeraVez: { prestamo, cierre } }
// POST → apunta lo que pasó en el reproductor, en la ayuda o en un aviso.
//
// ⚠ «VISTO» VA EN EL SERVIDOR, POR PERSONA, como la bienvenida: guardado en el
// teléfono, en otro aparato saldría otra vez como nuevo. Y sin columna nueva:
// es la misma medición, en `Evento` (lib/tutoriales/profe.js). Los
// interruptores de Ayuda van igual, y manda el último.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EVENTOS, HITOS_TUTO, videoPorId, profeHabilitado } from '@/lib/tutoriales/profe'

const leer = (m) => { try { return JSON.parse(m || '{}') } catch { return {} } }

/** El último valor de un interruptor; `porDefecto` si nunca se tocó. */
async function ultimoValor(where, porDefecto) {
  const e = await prisma.evento.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { metadata: true } })
  if (!e) return porDefecto
  const v = leer(e.metadata).valor
  return typeof v === 'boolean' ? v : porDefecto
}

const APAGADO = { habilitado: false, vistos: [], guardados: [], botonVisible: true, paraCobradores: true, mostrarAvisos: true, descartados: [], primeraVez: {} }

export async function GET() {
  const session = await getServerSession(authOptions)
  const u = session?.user
  if (!u?.id || !u.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  // Sin habilitar, nada que leer: la app no pinta nada del profe.
  if (!profeHabilitado(u.organizationId)) return Response.json(APAGADO)
  const deMi = { organizationId: u.organizationId, userId: u.id }
  const [marcas, botonVisible, paraCobradores, mostrarAvisos, reset, algunPrestamo, algunCierre] = await Promise.all([
    prisma.evento.findMany({
      where: { ...deMi, evento: { in: [EVENTOS.visto, EVENTOS.guardado, EVENTOS.avisoNo] } },
      select: { evento: true, metadata: true, createdAt: true },
    }),
    ultimoValor({ ...deMi, evento: EVENTOS.prefBoton }, true),
    // Del negocio: lo decide el dueño para todos sus cobradores. Prendido de
    // entrada (decisión 4: los cobradores entran a Caja más que los dueños).
    ultimoValor({ organizationId: u.organizationId, evento: EVENTOS.prefCobradores }, true),
    ultimoValor({ ...deMi, evento: EVENTOS.prefAvisos }, true),
    prisma.evento.findFirst({ where: { ...deMi, evento: EVENTOS.avisosReset }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    // La primera vez solo cuenta si de verdad nunca pasó (Adenda 6, D).
    prisma.prestamo.findFirst({ where: { organizationId: u.organizationId }, select: { id: true } }),
    prisma.cierreCaja.findFirst({ where: { organizationId: u.organizationId, cobradorId: u.id }, select: { id: true } }),
  ])
  const vistos = new Set()
  const guardados = new Set()
  const descartados = new Set()
  for (const m of marcas) {
    const id = leer(m.metadata).id
    if (!id) continue
    if (m.evento === EVENTOS.visto) vistos.add(id)
    else if (m.evento === EVENTOS.guardado) guardados.add(id)
    // «Volver a mostrar los avisos» deja sin efecto los «Ya sé cómo» de antes.
    else if (!reset || m.createdAt > reset.createdAt) descartados.add(id)
  }
  return Response.json({
    habilitado: true,
    vistos: [...vistos], guardados: [...guardados], descartados: [...descartados],
    botonVisible, paraCobradores, mostrarAvisos,
    primeraVez: { prestamo: !algunPrestamo, cierre: !algunCierre },
  })
}

/* Lo que se puede apuntar. Todo lleva el id de un video del catálogo; las
   preferencias llevan `valor`. Nada más entra: es una tabla que se lee para
   decidir qué ve la gente. */
const TIPOS = {
  abierto: EVENTOS.abierto,
  cerrado: EVENTOS.cerrado,
  visto: EVENTOS.visto,
  guardado: EVENTOS.guardado,
  tarea: EVENTOS.tarea,
  avisoNo: EVENTOS.avisoNo,
  ...Object.fromEntries(HITOS_TUTO.map((h) => [String(h), EVENTOS.hito(h)])),
}
const PREFERENCIAS = ['prefBoton', 'prefCobradores', 'prefAvisos']

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const u = session?.user
  if (!u?.id || !u.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { tipo, id, segundo, origen, valor, via, termino } = body ?? {}

  if (PREFERENCIAS.includes(tipo)) {
    if (typeof valor !== 'boolean') return Response.json({ error: 'Falta el valor' }, { status: 400 })
    // Lo de los cobradores es del negocio: solo el dueño lo cambia.
    if (tipo === 'prefCobradores' && u.rol !== 'owner') return Response.json({ error: 'Solo el dueño' }, { status: 403 })
    await prisma.evento.create({
      data: { organizationId: u.organizationId, userId: u.id, evento: EVENTOS[tipo], metadata: JSON.stringify({ valor }) },
    })
    return Response.json({ ok: true })
  }
  if (tipo === 'avisosReset') {
    await prisma.evento.create({ data: { organizationId: u.organizationId, userId: u.id, evento: EVENTOS.avisosReset, metadata: '{}' } })
    return Response.json({ ok: true })
  }

  const evento = TIPOS[String(tipo)]
  if (!evento || !videoPorId(id)) return Response.json({ error: 'Evento inválido' }, { status: 400 })
  // «Visto» y «guardado» una sola vez por persona y video: son estado, no medición.
  if (evento === EVENTOS.visto || evento === EVENTOS.guardado) {
    const ya = await prisma.evento.findFirst({
      where: { organizationId: u.organizationId, userId: u.id, evento, metadata: { contains: `"id":"${id}"` } },
      select: { id: true },
    })
    if (ya) return Response.json({ ok: true })
  }
  await prisma.evento.create({
    data: {
      organizationId: u.organizationId,
      userId: u.id,
      evento,
      pagina: typeof origen === 'string' ? origen.slice(0, 120) : null,
      // `via`: de dónde se abrió (pastilla, ayuda, minuto, enlace, aviso). `termino`: cerró al acabar.
      metadata: JSON.stringify({
        id,
        ...(segundo != null && Number.isFinite(Number(segundo)) ? { segundo: Math.round(Number(segundo)) } : {}),
        ...(typeof via === 'string' && via ? { via: via.slice(0, 12) } : {}),
        ...(termino === true ? { termino: true } : {}),
      }),
    },
  })
  return Response.json({ ok: true })
}
