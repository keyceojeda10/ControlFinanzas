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
    const where = { id }
    if (rol === 'owner') where.organizationId = session.user.organizationId

    const ticket = await prisma.ticketSoporte.findFirst({
      where,
      include: {
        user: { select: { nombre: true, email: true, rol: true } },
        organization: { select: { nombre: true, plan: true } },
        mensajes: {
          include: { user: { select: { nombre: true, rol: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })

    // Marcar como leídos los mensajes del otro lado
    await prisma.mensajeTicket.updateMany({
      where: { ticketId: id, esAdmin: rol !== 'superadmin', leido: false },
      data: { leido: true },
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('[GET /api/soporte/[id]]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.rol !== 'superadmin') return NextResponse.json({ error: 'Solo superadmin' }, { status: 403 })

    const { id } = await params
    const { estado, contactoAtendido } = await request.json()

    const data = {}
    if (estado) data.estado = estado
    if (contactoAtendido !== undefined) data.contactoAtendido = contactoAtendido

    const ticket = await prisma.ticketSoporte.update({
      where: { id },
      data,
      include: {
        user: { select: { nombre: true, email: true } },
        organization: { select: { nombre: true, plan: true } },
      },
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('[PATCH /api/soporte/[id]]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
