// «Ver como este cobrador»: firma el pase para entrar a su vista de SOLO LECTURA.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { firmarPase } from '@/lib/pase-de-vista'
import { logActividad } from '@/lib/activity-log'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.rol !== 'owner' || session.user.soloLectura) {
    return Response.json({ error: 'Solo el dueño puede ver como un cobrador.' }, { status: 403 })
  }
  const { cobradorId } = await request.json().catch(() => ({}))
  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId: session.user.organizationId, rol: 'cobrador', activo: true },
    select: { id: true, nombre: true },
  })
  if (!cobrador) return Response.json({ error: 'Ese cobrador no está activo en tu negocio.' }, { status: 404 })
  logActividad({
    session, accion: 'ver_como_cobrador', entidadTipo: 'usuario', entidadId: cobrador.id,
    detalle: `Vio la app como ${cobrador.nombre}`,
  })
  const pase = firmarPase({ tipo: 'ver-como', ownerId: session.user.id, cobradorId: cobrador.id }, process.env.NEXTAUTH_SECRET)
  return Response.json({ pase })
}
