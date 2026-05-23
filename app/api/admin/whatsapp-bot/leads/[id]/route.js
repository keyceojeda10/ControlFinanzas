// app/api/admin/whatsapp-bot/leads/[id]/route.js — Detalle, update, delete de un BotLead
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const lead = await prisma.botLead.findUnique({
    where: { id },
    include: { cfLead: true },
  })

  if (!lead) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  return NextResponse.json(lead)
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()

  const updateData = {}
  if (body.estado !== undefined) updateData.estado = body.estado
  if (body.botActivo !== undefined) updateData.botActivo = body.botActivo
  if (body.temperatura !== undefined) updateData.temperatura = Math.max(0, Math.min(100, body.temperatura))
  if (body.alertado !== undefined) updateData.alertado = body.alertado

  const lead = await prisma.botLead.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(lead)
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  await prisma.botLead.delete({ where: { id } }) // cascade deletes conversaciones

  return NextResponse.json({ ok: true })
}
