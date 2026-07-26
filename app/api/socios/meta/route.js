// app/api/socios/meta/route.js
// Meta de capital de la sociedad (estilo SAS). Solo owner.
// GET: devuelve la meta actual. PUT: la fija (o la borra con null).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

export const dynamic = 'force-dynamic'

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return { error: Response.json({ error: 'No autorizado' }, { status: 401 }) }
  if (session.user.rol !== 'owner') return { error: Response.json({ error: 'Solo el owner' }, { status: 403 }) }
  return { session }
}

export async function GET() {
  const { session, error } = await guard()
  if (error) return error
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { metaSociedad: true },
  })
  return Response.json({ metaSociedad: org?.metaSociedad ?? null })
}

export async function PUT(request) {
  const { session, error } = await guard()
  if (error) return error

  const body = await request.json().catch(() => ({}))
  let meta = body?.metaSociedad
  if (meta === '' || meta === null || meta === undefined) {
    meta = null
  } else {
    meta = Number(meta)
    if (!Number.isFinite(meta) || meta < 0) {
      return Response.json({ error: 'La meta debe ser un número mayor o igual a 0' }, { status: 400 })
    }
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { metaSociedad: meta },
  })

  logActividad({
    session,
    accion: 'editar_organizacion',
    entidadTipo: 'organizacion',
    entidadId: session.user.organizationId,
    detalle: `Meta de sociedad ${meta === null ? 'quitada' : `fijada en ${Math.round(meta)}`}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ metaSociedad: meta })
}
