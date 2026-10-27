// app/api/prestamos/permiso/[id]/route.js — El dueño aprueba o rechaza que un
// cobrador le haga otra cartulina a un cliente que ya debe.
// POST { decision: 'aprobar' | 'rechazar' }. Ver lib/dinero/permiso-prestamo.js.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'
import { notificar }        from '@/lib/notificar'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { organizationId } = session.user
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const aprobar = body.decision === 'aprobar'
  if (!aprobar && body.decision !== 'rechazar') {
    return Response.json({ error: 'Decisión no válida' }, { status: 400 })
  }

  // Solo la que sigue esperando: dos dueños a la vez no la resuelven dos veces.
  const { count } = await prisma.permisoPrestamo.updateMany({
    where: { id, organizationId, estado: 'pendiente' },
    data: { estado: aprobar ? 'aprobado' : 'rechazado', resueltoPorId: session.user.id, resueltoEn: new Date() },
  })
  if (count === 0) return Response.json({ error: 'Esta solicitud ya fue resuelta' }, { status: 404 })

  const permiso = await prisma.permisoPrestamo.findUnique({ where: { id } })
  const cliente = await prisma.cliente.findFirst({
    where: { id: permiso.clienteId, organizationId },
    select: { nombre: true },
  })
  const nombre = cliente?.nombre ?? 'el cliente'

  logActividad({
    session,
    accion: aprobar ? 'aprobar_permiso_prestamo' : 'rechazar_permiso_prestamo',
    entidadTipo: 'cliente',
    entidadId: permiso.clienteId,
    detalle: `${aprobar ? 'Dio permiso' : 'No dio permiso'} para prestarle otra vez a ${nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  notificar({
    organizationId, para: permiso.cobradorId,
    tipo: aprobar ? 'permiso_prestamo_aprobado' : 'permiso_prestamo_rechazado',
    titulo: aprobar ? 'Te dieron permiso para prestar' : 'No te dieron permiso para prestar',
    mensaje: aprobar
      ? `Ya puedes hacerle la otra cartulina a ${nombre}. Sirve para un préstamo, hoy.`
      : `El administrador no autorizó otra cartulina para ${nombre}.`,
    href: aprobar ? `/prestamos/nuevo?clienteId=${permiso.clienteId}` : `/clientes/${permiso.clienteId}`,
    datos: { permisoId: id, clienteId: permiso.clienteId },
  })

  return Response.json({ estado: aprobar ? 'aprobado' : 'rechazado' })
}
