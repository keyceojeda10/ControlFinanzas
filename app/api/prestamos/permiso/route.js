// app/api/prestamos/permiso/route.js — El cobrador pide permiso para hacerle
// otra cartulina a un cliente que ya debe. Ver lib/dinero/permiso-prestamo.js.
//
// GET  ?clienteId=  → en qué va: { necesita, cantidad, saldo, estado, permisoId }
// POST { clienteId, monto } → crea la solicitud (o devuelve la que ya espera)
//      y le avisa al dueño. Aprobarla o rechazarla es `permiso/[id]`.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'
import { notificar, plata } from '@/lib/notificar'
import { situacionParaPrestar } from '@/lib/dinero/permiso-prestamo'

function respuesta(s) {
  return {
    necesita: s.necesita,
    cantidad: s.cantidad,
    saldo: s.saldo,
    estado: s.permiso?.estado ?? null,
    permisoId: s.permiso?.id ?? null,
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { organizationId, rol, id: userId, country } = session.user
  const clienteId = new URL(request.url).searchParams.get('clienteId')
  if (!clienteId) return Response.json({ error: 'El cliente es requerido' }, { status: 400 })

  const s = await situacionParaPrestar(prisma, { organizationId, clienteId, userId, rol, country })
  return Response.json(respuesta(s))
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { organizationId, rol, id: userId, country } = session.user
  if (rol !== 'cobrador') return Response.json({ error: 'Solo un cobrador pide este permiso' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const clienteId = typeof body.clienteId === 'string' ? body.clienteId : null
  const monto = Number(body.monto) > 0 ? Math.round(Number(body.monto)) : null
  if (!clienteId) return Response.json({ error: 'El cliente es requerido' }, { status: 400 })

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
    select: { id: true, nombre: true },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const s = await situacionParaPrestar(prisma, { organizationId, clienteId, userId, rol, country })
  if (!s.necesita) return Response.json(respuesta(s))
  // Ya hay una esperando o ya se la aprobaron hoy: no se pide dos veces.
  if (s.permiso && (s.permiso.estado === 'pendiente' || s.permiso.estado === 'aprobado')) {
    return Response.json(respuesta(s))
  }

  const permiso = await prisma.permisoPrestamo.create({
    data: { organizationId, clienteId, cobradorId: userId, monto },
  })

  logActividad({
    session,
    accion: 'solicitud_permiso_prestamo',
    entidadTipo: 'cliente',
    entidadId: clienteId,
    detalle: `Pidió permiso para prestarle otra vez a ${cliente.nombre}${monto ? ` (${plata(monto)})` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  notificar({
    organizationId, para: 'owners', tipo: 'permiso_prestamo',
    titulo: 'Piden permiso para prestar',
    mensaje: `${session.user.nombre} quiere hacerle otra cartulina a ${cliente.nombre}${monto ? ` por ${plata(monto)}` : ''}. Ya debe ${plata(s.saldo)}.`,
    href: `/clientes/${clienteId}`, datos: { permisoId: permiso.id, clienteId },
  })

  return Response.json(respuesta({ ...s, permiso }), { status: 201 })
}
