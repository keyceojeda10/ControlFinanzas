// app/api/festivos/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── DELETE /api/festivos/[id] ──────────────────────────────────
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ success: false, error: 'Solo el administrador puede gestionar festivos' }, { status: 403 })
  }

  const { id } = await params

  try {
    const festivo = await prisma.festivo.findFirst({
      where: { id, organizationId: session.user.organizationId },
    })
    if (!festivo) {
      return Response.json({ success: false, error: 'Festivo no encontrado' }, { status: 404 })
    }

    await prisma.festivo.delete({ where: { id } })
    return Response.json({ success: true, ok: true })
  } catch (err) {
    console.error('[DELETE /api/festivos/[id]]', err)
    return Response.json({ success: false, error: 'Error al eliminar festivo' }, { status: 500 })
  }
}
