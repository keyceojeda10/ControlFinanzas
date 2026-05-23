// app/api/admin/whatsapp-bot/config/route.js — Configuracion del bot
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let config = await prisma.botConfig.findFirst()
  if (!config) {
    // Crear config default
    config = await prisma.botConfig.create({
      data: {
        systemPrompt: 'Eres un asesor comercial de Control Finanzas.',
        modelo: 'claude-sonnet-4-6',
      },
    })
  }

  return NextResponse.json(config)
}

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()

  let config = await prisma.botConfig.findFirst()
  const updateData = {}

  if (body.botActivo !== undefined) updateData.botActivo = body.botActivo
  if (body.modoPrueba !== undefined) updateData.modoPrueba = body.modoPrueba
  if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt
  if (body.modelo !== undefined) updateData.modelo = body.modelo
  if (body.limiteDiario !== undefined) updateData.limiteDiario = parseInt(body.limiteDiario)
  if (body.delayMinMs !== undefined) updateData.delayMinMs = parseInt(body.delayMinMs)
  if (body.delayMaxMs !== undefined) updateData.delayMaxMs = parseInt(body.delayMaxMs)
  if (body.limiteGastoUsd !== undefined) updateData.limiteGastoUsd = parseFloat(body.limiteGastoUsd)
  if (body.whatsappPersonal !== undefined) updateData.whatsappPersonal = body.whatsappPersonal

  if (config) {
    config = await prisma.botConfig.update({
      where: { id: config.id },
      data: updateData,
    })
  } else {
    config = await prisma.botConfig.create({
      data: {
        systemPrompt: body.systemPrompt || 'Eres un asesor comercial de Control Finanzas.',
        ...updateData,
      },
    })
  }

  return NextResponse.json(config)
}
