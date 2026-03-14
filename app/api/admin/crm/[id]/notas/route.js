import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const notas = await prisma.notaSeguimiento.findMany({
    where: { organizationId: id },
    orderBy: { createdAt: 'desc' },
    include: { admin: { select: { nombre: true } } }
  })

  return NextResponse.json(notas)
}

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const { contenido, estadoContacto } = await req.json()

  if (!contenido?.trim()) {
    return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 })
  }

  const nota = await prisma.notaSeguimiento.create({
    data: {
      organizationId: id,
      adminId: session.user.id,
      contenido: contenido.trim(),
      estadoContacto: estadoContacto || null
    },
    include: { admin: { select: { nombre: true } } }
  })

  if (estadoContacto) {
    await prisma.organization.update({
      where: { id },
      data: { estadoContacto }
    })
  }

  await prisma.adminLog.create({
    data: {
      adminId: session.user.id,
      accion: 'crm_nota',
      organizacionId: id,
      detalle: `Nota: ${contenido.substring(0, 100)}`
    }
  })

  return NextResponse.json(nota)
}
