import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rol } = session.user
    if (rol !== 'superadmin' && rol !== 'owner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const despues = searchParams.get('despues')

    // Verificar acceso al ticket
    if (rol === 'owner') {
      const ticket = await prisma.ticketSoporte.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      })
      if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const where = { ticketId: id }
    if (despues) where.createdAt = { gt: new Date(despues) }

    const mensajes = await prisma.mensajeTicket.findMany({
      where,
      include: { user: { select: { nombre: true, rol: true } } },
      orderBy: { createdAt: 'asc' },
    })

    // Marcar como leídos los del otro lado
    if (mensajes.length > 0) {
      await prisma.mensajeTicket.updateMany({
        where: { ticketId: id, esAdmin: rol !== 'superadmin', leido: false },
        data: { leido: true },
      })
    }

    return NextResponse.json(mensajes)
  } catch (error) {
    console.error('[GET /api/soporte/[id]/mensajes]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rol } = session.user
    if (rol !== 'superadmin' && rol !== 'owner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params
    const { contenido } = await request.json()
    if (!contenido?.trim()) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

    // Verificar acceso
    if (rol === 'owner') {
      const ticket = await prisma.ticketSoporte.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      })
      if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const mensaje = await prisma.mensajeTicket.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        contenido: contenido.trim(),
        esAdmin: rol === 'superadmin',
      },
      include: { user: { select: { nombre: true, rol: true } } },
    })

    // Touch updatedAt del ticket
    await prisma.ticketSoporte.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(mensaje, { status: 201 })
  } catch (error) {
    console.error('[POST /api/soporte/[id]/mensajes]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
