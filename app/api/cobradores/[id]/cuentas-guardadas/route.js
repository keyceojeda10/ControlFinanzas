// Los aparatos donde un cobrador tiene su cuenta guardada. Solo el dueño, solo los suyos.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function cobradorDelDueno(params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.rol !== 'owner') return { error: Response.json({ error: 'No autorizado' }, { status: 403 }) }
  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
    select: { id: true },
  })
  if (!cobrador) return { error: Response.json({ error: 'Cobrador no encontrado' }, { status: 404 }) }
  return { cobrador }
}

export async function GET(request, { params }) {
  const { error, cobrador } = await cobradorDelDueno(params)
  if (error) return error
  const aparatos = await prisma.cuentaGuardada.findMany({
    where: { userId: cobrador.id },
    select: { id: true, dispositivo: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  return Response.json({ aparatos })
}

export async function DELETE(request, { params }) {
  const { error, cobrador } = await cobradorDelDueno(params)
  if (error) return error
  const aparato = new URL(request.url).searchParams.get('id')
  await prisma.cuentaGuardada.deleteMany({ where: { id: String(aparato ?? ''), userId: cobrador.id } })
  return Response.json({ ok: true })
}
