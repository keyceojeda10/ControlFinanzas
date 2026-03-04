// app/api/gastos/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId

  const gastos = await prisma.gastoMenor.findMany({
    where: { organizationId: orgId },
    include: { cobrador: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
  })

  const resultado = gastos.map((g) => ({
    id: g.id,
    description: g.description,
    monto: g.monto,
    fecha: g.fecha,
    estado: g.estado,
    cobradorId: g.cobradorId,
    cobradorNombre: g.cobrador?.nombre,
  }))

  return NextResponse.json(resultado)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'cobrador') {
    return NextResponse.json({ error: 'Solo cobradores pueden reportar gastos' }, { status: 403 })
  }

  const body = await req.json()
  const { description, monto } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  const gasto = await prisma.gastoMenor.create({
    data: {
      description: description.trim(),
      monto: Number(monto),
      cobradorId: session.user.id,
      organizationId: session.user.organizationId,
    },
  })

  return NextResponse.json(gasto)
}
