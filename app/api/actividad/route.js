// app/api/actividad/route.js — Listar actividad de la organización (paginado, filtros)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLocalDayRange } from '@/lib/i18n'

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Solo owner puede ver la actividad
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const tipo = searchParams.get('tipo')       // filtro por accion
  const userId = searchParams.get('userId')   // filtro por usuario
  const desde = searchParams.get('desde')     // filtro fecha inicio (YYYY-MM-DD)
  const hasta = searchParams.get('hasta')     // filtro fecha fin (YYYY-MM-DD)
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  // ⚠ LOS DÍAS DEL NEGOCIO, NO LOS DE UTC. `new Date('2026-10-19')` es la
  // medianoche UTC —las 7 de la noche del 18 en Colombia—, y el `setHours` del
  // «hasta» corría en la zona del servidor, que en producción es UTC: «desde el
  // 19» traía lo de anoche, y «hasta el 19» dejaba fuera lo del 19 después de las
  // 7. Es el mismo fallo que ponía lo de anoche bajo «Hoy» en la pantalla (QA,
  // 19 oct 2026); la frontera es la de la caja (`getLocalDayRange`).
  const country = session.user.country
  const createdAtFilter = {}
  if (ES_DIA.test(desde ?? '')) createdAtFilter.gte = getLocalDayRange(desde, country).inicio
  if (ES_DIA.test(hasta ?? '')) createdAtFilter.lte = getLocalDayRange(hasta, country).fin

  const where = {
    organizationId: session.user.organizationId,
    ...(tipo && { accion: tipo }),
    ...(userId && { userId }),
    ...(Object.keys(createdAtFilter).length > 0 && { createdAt: createdAtFilter }),
  }

  const actividad = await prisma.actividadLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      user: { select: { id: true, nombre: true, rol: true } },
    },
  })

  const hasMore = actividad.length > limit
  const pagina = hasMore ? actividad.slice(0, limit) : actividad
  const nextCursor = hasMore ? pagina[pagina.length - 1].id : null

  // ── LO QUE EL DUEÑO DECIDIÓ DESPUÉS SOBRE CADA GASTO ──
  //
  // QA, 19 oct 2026: «Camilo Ortiz registró gasto · Gasto $25.000 -
  // Pinchazo/Llanta · −$25.000», y el dueño lo había rechazado. La fila se
  // escribe al ANOTAR el gasto y nunca se vuelve a tocar; su `entidadId` es el
  // id del gasto (`/api/gastos`), así que se le pregunta al gasto cómo quedó.
  // Medido en el espejo: encuentra su gasto en 1.698 de 1.855 filas, y las 157
  // que no son exactamente los 157 gastos borrados (`eliminar_gasto`). Por eso
  // el que no aparece es «eliminado».
  const idsGasto = pagina
    .filter((a) => a.accion === 'registrar_gasto' && a.entidadId)
    .map((a) => a.entidadId)
  const estadoDeGasto = new Map()
  if (idsGasto.length > 0) {
    const gastos = await prisma.gastoMenor.findMany({
      where: { id: { in: idsGasto }, organizationId: session.user.organizationId },
      select: { id: true, estado: true },
    })
    for (const g of gastos) estadoDeGasto.set(g.id, g.estado)
  }
  const items = pagina.map((a) => (a.accion === 'registrar_gasto' && a.entidadId
    ? { ...a, gastoEstado: estadoDeGasto.get(a.entidadId) ?? 'eliminado' }
    : a))

  return Response.json({ items, nextCursor })
}
