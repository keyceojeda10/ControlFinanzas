// app/api/tutoriales/route.js — los videos del profe para ESTA persona.
//
// GET  → { vistos, guardados, botonVisible, paraCobradores }
// POST → apunta lo que pasó en el reproductor o en la lengüeta.
//
// ⚠ «VISTO» VA EN EL SERVIDOR, POR PERSONA, como la bienvenida: guardado en el
// teléfono, la lengüeta volvería a nacer abierta en el otro aparato. Y sin
// columna nueva: es la misma medición, en `Evento` (lib/tutoriales/profe.js).
// Los dos interruptores de Ayuda van igual, y manda el último.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EVENTOS, HITOS_TUTO, videoPorId } from '@/lib/tutoriales/profe'

const leer = (m) => { try { return JSON.parse(m || '{}') } catch { return {} } }

/** El último valor de un interruptor; `porDefecto` si nunca se tocó. */
async function ultimoValor(where, porDefecto) {
  const e = await prisma.evento.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { metadata: true } })
  if (!e) return porDefecto
  const v = leer(e.metadata).valor
  return typeof v === 'boolean' ? v : porDefecto
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const u = session?.user
  if (!u?.id || !u.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const [marcas, botonVisible, paraCobradores] = await Promise.all([
    prisma.evento.findMany({
      where: { organizationId: u.organizationId, userId: u.id, evento: { in: [EVENTOS.visto, EVENTOS.guardado] } },
      select: { evento: true, metadata: true },
    }),
    ultimoValor({ organizationId: u.organizationId, userId: u.id, evento: EVENTOS.prefBoton }, true),
    // Del negocio: lo decide el dueño para todos sus cobradores. Prendido de
    // entrada (decisión 4: los cobradores entran a Caja más que los dueños).
    ultimoValor({ organizationId: u.organizationId, evento: EVENTOS.prefCobradores }, true),
  ])
  const vistos = new Set()
  const guardados = new Set()
  for (const m of marcas) {
    const id = leer(m.metadata).id
    if (!id) continue
    if (m.evento === EVENTOS.visto) vistos.add(id)
    else guardados.add(id)
  }
  return Response.json({ vistos: [...vistos], guardados: [...guardados], botonVisible, paraCobradores })
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
  ...Object.fromEntries(HITOS_TUTO.map((h) => [String(h), EVENTOS.hito(h)])),
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const u = session?.user
  if (!u?.id || !u.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { tipo, id, segundo, origen, valor, via, termino } = body ?? {}

  if (tipo === 'prefBoton' || tipo === 'prefCobradores') {
    if (typeof valor !== 'boolean') return Response.json({ error: 'Falta el valor' }, { status: 400 })
    // Lo de los cobradores es del negocio: solo el dueño lo cambia.
    if (tipo === 'prefCobradores' && u.rol !== 'owner') return Response.json({ error: 'Solo el dueño' }, { status: 403 })
    await prisma.evento.create({
      data: { organizationId: u.organizationId, userId: u.id, evento: EVENTOS[tipo], metadata: JSON.stringify({ valor }) },
    })
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
      // `via`: de dónde se abrió (D1, E2, ayuda). `termino`: cerró al acabar.
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
