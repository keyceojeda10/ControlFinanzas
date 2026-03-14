import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, nombre: true, email: true, rol: true, activo: true, emailVerificado: true, onboardingCompletado: true, createdAt: true }
      },
      _count: { select: { clientes: true, prestamos: true, rutas: true } },
      suscripciones: { orderBy: { createdAt: 'desc' }, take: 5 },
      notasSeguimiento: {
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { nombre: true } } }
      }
    }
  })

  if (!org) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(org)
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const data = {}
  if (body.estadoContacto) data.estadoContacto = body.estadoContacto
  if (body.fuenteRegistro !== undefined) data.fuenteRegistro = body.fuenteRegistro

  const org = await prisma.organization.update({ where: { id }, data })

  await prisma.adminLog.create({
    data: {
      adminId: session.user.id,
      accion: 'crm_actualizar',
      organizacionId: id,
      detalle: `Actualizado: ${Object.keys(data).join(', ')}`
    }
  })

  return NextResponse.json(org)
}
