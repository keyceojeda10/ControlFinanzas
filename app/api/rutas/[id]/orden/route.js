import { getServerSession } from 'next-auth'
import { authOptions }     from '@/lib/auth'
import prisma              from '@/lib/prisma'

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId } = session.user

  const clientes = await prisma.cliente.findMany({
    where: { rutaId: id, organizationId, estado: { not: 'eliminado' } },
    select: { id: true, nombre: true, ordenRuta: true },
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
  })

  return Response.json(clientes)
}
