import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // Para superadmin: conteo total de tickets abiertos
    if (session.user.rol === 'superadmin') {
      const [ticketsAbiertos, contactosPendientes] = await Promise.all([
        prisma.ticketSoporte.count({
          where: { estado: { in: ['abierto', 'en_progreso'] } },
        }),
        prisma.ticketSoporte.count({
          where: { solicitaContacto: true, contactoAtendido: false },
        }),
      ])
      return NextResponse.json({ ticketsAbiertos, contactosPendientes })
    }

    // Para owner: conteo de mensajes sin leer
    if (session.user.rol === 'owner' && session.user.organizationId) {
      const mensajesSinLeer = await prisma.mensajeTicket.count({
        where: {
          ticket: { organizationId: session.user.organizationId },
          esAdmin: true,
          leido: false,
        },
      })
      return NextResponse.json({ mensajesSinLeer })
    }

    return NextResponse.json({ mensajesSinLeer: 0 })
  } catch (error) {
    console.error('[GET /api/soporte/stats]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
