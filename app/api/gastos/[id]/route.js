// app/api/gastos/[id]/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo owners pueden aprobar/rechazar gastos' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const { estado } = body

  if (!['aprobado', 'rechazado'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const gasto = await prisma.gastoMenor.update({
    where: { id },
    data: { estado },
  })

  return NextResponse.json(gasto)
}
