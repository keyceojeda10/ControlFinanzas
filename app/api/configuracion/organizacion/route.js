// app/api/configuracion/organizacion/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, createdAt: true, activo: true },
  })

  const sub = await prisma.suscripcion.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, plan: true, estado: true, fechaInicio: true, fechaVencimiento: true, montoCOP: true },
  })

  const diasRestantes = sub?.fechaVencimiento
    ? Math.ceil((new Date(sub.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // Historial de suscripciones
  const historial = await prisma.suscripcion.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, plan: true, estado: true, fechaInicio: true, fechaVencimiento: true, montoCOP: true, createdAt: true },
  })

  return NextResponse.json({ org, suscripcion: sub, diasRestantes, historial })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const { nombre, telefono, ciudad } = await req.json()

  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      nombre:   nombre.trim(),
      telefono: telefono?.trim() || null,
      ciudad:   ciudad?.trim()   || null,
    },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true },
  })

  return NextResponse.json({ ok: true, org })
}
