// app/api/admin/suscripciones/[id]/route.js — Gestión manual de suscripción
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await req.json()
  const { accion } = body // renovar | gracia | cancelar

  const sub = await prisma.suscripcion.findUnique({
    where: { id },
    include: { organization: { select: { id: true, nombre: true } } },
  })
  if (!sub) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })

  const orgNombre = sub.organization.nombre

  if (accion === 'renovar') {
    const nuevaFecha = new Date(sub.fechaVencimiento)
    nuevaFecha.setDate(nuevaFecha.getDate() + 30)
    await prisma.suscripcion.update({
      where: { id },
      data: { fechaVencimiento: nuevaFecha, estado: 'activa' },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'renovar_suscripcion',
        detalle:        `Suscripción de "${orgNombre}" renovada 30 días hasta ${nuevaFecha.toISOString().slice(0, 10)}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Suscripción renovada 30 días' })
  }

  if (accion === 'gracia') {
    const nuevaFecha = new Date(sub.fechaVencimiento)
    nuevaFecha.setDate(nuevaFecha.getDate() + 7)
    await prisma.suscripcion.update({
      where: { id },
      data: { fechaVencimiento: nuevaFecha, estado: 'activa' },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'gracia_suscripcion',
        detalle:        `Gracia de 7 días aplicada a "${orgNombre}" hasta ${nuevaFecha.toISOString().slice(0, 10)}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Gracia de 7 días aplicada' })
  }

  if (accion === 'cancelar') {
    await prisma.suscripcion.update({
      where: { id },
      data: { estado: 'cancelada' },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'cancelar_suscripcion',
        detalle:        `Suscripción de "${orgNombre}" cancelada`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Suscripción cancelada' })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
