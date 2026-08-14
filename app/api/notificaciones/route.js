import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const soloCount = searchParams.get('count') === '1'

  if (soloCount) {
    const count = await prisma.notificacion.count({
      where: { userId: session.user.id, leida: false },
    })
    return Response.json({ count })
  }

  const notificaciones = await prisma.notificacion.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return Response.json(notificaciones)
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()

  if (body.marcarTodasLeidas) {
    await prisma.notificacion.updateMany({
      where: { userId: session.user.id, leida: false },
      data: { leida: true },
    })
    return Response.json({ ok: true })
  }

  if (body.id) {
    // updateMany con userId en el where: sin eso, cualquier usuario podia
    // marcar como leida la notificacion de otro con solo mandar su id.
    const { count } = await prisma.notificacion.updateMany({
      where: { id: body.id, userId: session.user.id },
      data: { leida: true },
    })
    if (count === 0) return Response.json({ error: 'No encontrada' }, { status: 404 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Parámetros inválidos' }, { status: 400 })
}

/* ══ BORRAR ════════════════════════════════════════════════════════════════
   Faltaba, y el dueño lo pidió con las palabras exactas de lo que le pasa:
   «yo le di leídas, pero me van a salir todas ahí, así como tenues, pero no se
   me van a quitar».

   Marcar leída y borrar son dos cosas distintas: leída es «ya lo vi», borrada es
   «fuera». Con solo lo primero la lista crece para siempre y deja de servir.

   ⚠ `deleteMany` con el `userId` en el WHERE, igual que el PATCH: sin eso
   cualquiera podría borrar la notificación de otro mandando su id. */
export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  if (body.borrarLeidas) {
    const { count } = await prisma.notificacion.deleteMany({
      where: { userId: session.user.id, leida: true },
    })
    return Response.json({ ok: true, borradas: count })
  }

  if (body.borrarTodas) {
    const { count } = await prisma.notificacion.deleteMany({
      where: { userId: session.user.id },
    })
    return Response.json({ ok: true, borradas: count })
  }

  if (body.id) {
    const { count } = await prisma.notificacion.deleteMany({
      where: { id: body.id, userId: session.user.id },
    })
    if (count === 0) return Response.json({ error: 'No encontrada' }, { status: 404 })
    return Response.json({ ok: true, borradas: count })
  }

  return Response.json({ error: 'Parámetros inválidos' }, { status: 400 })
}
