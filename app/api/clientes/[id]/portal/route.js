import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params

  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: {
      id: true,
      portalActivo: true,
      pinPortal: true,
      ultimoAccesoPortal: true,
    },
  })

  if (!cliente) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  return Response.json({
    portalActivo: cliente.portalActivo,
    tienePin: !!cliente.pinPortal,
    ultimoAcceso: cliente.ultimoAccesoPortal,
  })
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  })
  if (!cliente) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const data = {}

  if (body.portalActivo !== undefined) {
    data.portalActivo = Boolean(body.portalActivo)
  }

  if (body.pin) {
    const pin = String(body.pin).trim()
    if (pin.length < 4 || pin.length > 6) {
      return Response.json({ error: 'El PIN debe tener entre 4 y 6 dígitos' }, { status: 400 })
    }
    if (!/^\d+$/.test(pin)) {
      return Response.json({ error: 'El PIN solo puede contener números' }, { status: 400 })
    }
    data.pinPortal = await bcrypt.hash(pin, 10)
    data.portalActivo = true
  }

  if (body.quitarPin) {
    data.pinPortal = null
    data.portalActivo = false
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'Sin cambios' }, { status: 400 })
  }

  await prisma.cliente.update({
    where: { id },
    data,
  })

  const updated = await prisma.cliente.findUnique({
    where: { id },
    select: { portalActivo: true, pinPortal: true, ultimoAccesoPortal: true },
  })

  return Response.json({
    portalActivo: updated.portalActivo,
    tienePin: !!updated.pinPortal,
    ultimoAcceso: updated.ultimoAccesoPortal,
  })
}
