// app/api/rutas/[id]/optimizar/route.js — Optimizar el orden de una ruta.
//
// ⚠ EL ORDEN ES UNO POR RUTA: lo que optimiza el cobrador cambia también el del
// dueño. Por eso (19 nov 2026, decisión del dueño, ver lib/rutas/orden-de-ruta.js):
//   · POST del DUEÑO   → optimiza ya, guardando antes el orden que había.
//   · POST del COBRADOR → queda PEDIDO; el dueño lo aprueba o lo rechaza (PATCH)
//     desde «Esperan tu decisión» o desde la ruta. Mientras tanto nada cambia.
//   · Con menos de 8 de cada 10 clientes ubicados no se optimiza ni se pide.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { esId }             from '@/lib/ids'
import { logActividad }     from '@/lib/activity-log'
import { notificar }        from '@/lib/notificar'
import {
  clientesEnOrden, optimizarGuardandoElAnterior, textoSinUbicacion, ubicacionSuficiente,
} from '@/lib/rutas/orden-de-ruta'

const ipDe = (request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { id: userId, organizationId, rol } = session.user

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId, ...(rol === 'cobrador' ? { cobradorId: userId } : {}) },
    select: { id: true, nombre: true },
  })
  if (!ruta) {
    return Response.json({ error: rol === 'cobrador' ? 'No tienes acceso a esta ruta' : 'Ruta no encontrada' },
      { status: rol === 'cobrador' ? 403 : 404 })
  }

  // ── EL COBRADOR PIDE ──
  if (rol === 'cobrador') {
    const clientes = await clientesEnOrden(prisma, { organizationId, rutaId: id })
    if (clientes.length < 2) return Response.json({ error: 'La ruta no tiene clientes para ordenar.' }, { status: 400 })
    const ubicacion = ubicacionSuficiente(clientes)
    if (!ubicacion.alcanza) return Response.json({ error: textoSinUbicacion(ubicacion), ubicacion }, { status: 400 })

    const yaPedida = await prisma.ordenRuta.findFirst({
      where: { organizationId, rutaId: id, clase: 'solicitud', estado: 'pendiente' },
      select: { id: true, createdAt: true },
    })
    if (yaPedida) return Response.json({ solicitado: true, yaPedida: true, solicitudId: yaPedida.id, desde: yaPedida.createdAt })

    const solicitud = await prisma.ordenRuta.create({
      data: { organizationId, rutaId: id, clase: 'solicitud', estado: 'pendiente', pedidoPorId: userId },
    })
    logActividad({
      session, accion: 'pedir_optimizar_ruta', entidadTipo: 'ruta', entidadId: id,
      detalle: `Pidió optimizar la ruta ${ruta.nombre}`, ip: ipDe(request),
    })
    notificar({
      organizationId, para: 'owners', tipo: 'optimizar_ruta',
      titulo: 'Piden optimizar una ruta',
      mensaje: `${session.user.nombre} quiere ordenar la ruta ${ruta.nombre} por cercanía. Cambia el orden para los dos.`,
      href: `/rutas/${id}`, datos: { ordenRutaId: solicitud.id, rutaId: id },
    })
    return Response.json({ solicitado: true, solicitudId: solicitud.id, desde: solicitud.createdAt }, { status: 202 })
  }

  // ── EL DUEÑO OPTIMIZA ──
  const r = await optimizarGuardandoElAnterior(prisma, { organizationId, rutaId: id, userId })
  if (!r.ok) return Response.json({ error: r.error, ubicacion: r.ubicacion }, { status: 400 })

  // Si el cobrador lo había pedido, ya está hecho.
  const pendientes = await prisma.ordenRuta.findMany({
    where: { organizationId, rutaId: id, clase: 'solicitud', estado: 'pendiente' },
    select: { id: true, pedidoPorId: true },
  })
  if (pendientes.length) {
    await prisma.ordenRuta.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
      data: { estado: 'aprobada', resueltoPorId: userId, resueltoEn: new Date() },
    })
  }

  logActividad({
    session, accion: 'optimizar_ruta', entidadTipo: 'ruta', entidadId: id,
    detalle: `Optimizó la ruta ${ruta.nombre}: ${r.clientesReordenados} clientes ordenados por cercanía`, ip: ipDe(request),
  })
  return Response.json(r)
}

// ── EL DUEÑO DECIDE EL PEDIDO DEL COBRADOR ──
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el dueño aprueba este pedido' }, { status: 403 })

  const { id } = await params
  const { id: userId, organizationId } = session.user
  const body = await request.json().catch(() => ({}))
  const decision = body.decision === 'aprobar' ? 'aprobar' : body.decision === 'rechazar' ? 'rechazar' : null
  if (!decision) return Response.json({ error: 'Falta la decisión' }, { status: 400 })
  // `esId`: un número casaría con cualquier fila (lib/ids.js).
  if (!esId(body.solicitudId)) return Response.json({ error: 'Falta el pedido' }, { status: 400 })

  const solicitud = await prisma.ordenRuta.findFirst({
    where: { id: body.solicitudId, organizationId, rutaId: id, clase: 'solicitud' },
  })
  if (!solicitud) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 })
  if (solicitud.estado !== 'pendiente') return Response.json({ error: 'Este pedido ya se decidió' }, { status: 409 })

  const ruta = await prisma.ruta.findFirst({ where: { id, organizationId }, select: { nombre: true } })

  if (decision === 'rechazar') {
    await prisma.ordenRuta.update({
      where: { id: solicitud.id },
      data: { estado: 'rechazada', resueltoPorId: userId, resueltoEn: new Date() },
    })
    logActividad({
      session, accion: 'rechazar_optimizar_ruta', entidadTipo: 'ruta', entidadId: id,
      detalle: `No aprobó optimizar la ruta ${ruta?.nombre ?? ''}`, ip: ipDe(request),
    })
    notificar({
      organizationId, para: solicitud.pedidoPorId, tipo: 'optimizar_ruta_rechazado',
      titulo: 'No se optimizó la ruta',
      mensaje: `${session.user.nombre} prefirió dejar la ruta ${ruta?.nombre ?? ''} como está.`,
      href: `/rutas/${id}`, datos: { ordenRutaId: solicitud.id, rutaId: id },
    })
    return Response.json({ ok: true, estado: 'rechazada' })
  }

  const r = await optimizarGuardandoElAnterior(prisma, { organizationId, rutaId: id, userId })
  if (!r.ok) return Response.json({ error: r.error, ubicacion: r.ubicacion }, { status: 400 })
  await prisma.ordenRuta.update({
    where: { id: solicitud.id },
    data: { estado: 'aprobada', resueltoPorId: userId, resueltoEn: new Date() },
  })
  logActividad({
    session, accion: 'aprobar_optimizar_ruta', entidadTipo: 'ruta', entidadId: id,
    detalle: `Aprobó optimizar la ruta ${ruta?.nombre ?? ''}: ${r.clientesReordenados} clientes ordenados por cercanía`, ip: ipDe(request),
  })
  notificar({
    organizationId, para: solicitud.pedidoPorId, tipo: 'optimizar_ruta_aprobado',
    titulo: 'Tu ruta ya está optimizada',
    mensaje: `${session.user.nombre} aprobó ordenar la ruta ${ruta?.nombre ?? ''} por cercanía.`,
    href: `/rutas/${id}`, datos: { ordenRutaId: solicitud.id, rutaId: id },
  })
  return Response.json({ ...r, estado: 'aprobada' })
}
