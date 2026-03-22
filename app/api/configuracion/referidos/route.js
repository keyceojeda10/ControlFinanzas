// app/api/configuracion/referidos/route.js — Estadísticas de referidos para el owner
import { NextResponse }    from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }     from '@/lib/auth'
import { prisma }          from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.rol !== 'owner') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        codigoReferido: true,
        referidos: {
          select: {
            id: true,
            nombre: true,
            createdAt: true,
            suscripciones: {
              where: { montoCOP: { gt: 0 } },
              select: { id: true },
              take: 1,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        codigoReferido: org.codigoReferido,
        referidos:      org.referidos.map(r => ({
          id: r.id,
          nombre: r.nombre,
          createdAt: r.createdAt,
          pagado: r.suscripciones.length > 0,
        })),
        totalReferidos: org.referidos.length,
      },
    })
  } catch (err) {
    console.error('[referidos] Error:', err)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
