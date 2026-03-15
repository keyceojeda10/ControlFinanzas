import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return NextResponse.json(leads)
  } catch (error) {
    console.error('[GET /api/admin/leads]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id, estado, notas } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const data = {}
    if (estado) data.estado = estado
    if (notas !== undefined) data.notas = notas

    const lead = await prisma.lead.update({ where: { id }, data })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('[PATCH /api/admin/leads]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
