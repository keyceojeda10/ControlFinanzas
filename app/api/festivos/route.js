// app/api/festivos/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { esHoyFestivo } from '@/lib/dias-sin-cobro'

// ─── GET /api/festivos ──────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  try {
    const festivos = await prisma.festivo.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { fecha: 'asc' },
    })
    return Response.json({ success: true, festivos, esHoyFestivo: esHoyFestivo(festivos) })
  } catch (err) {
    console.error('[GET /api/festivos]', err)
    return Response.json({ success: false, error: 'Error al obtener festivos' }, { status: 500 })
  }
}

// ─── POST /api/festivos ─────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ success: false, error: 'Solo el administrador puede gestionar festivos' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const { fecha, nombre } = body

  if (!fecha) {
    return Response.json({ success: false, error: 'Fecha requerida' }, { status: 400 })
  }

  const fechaDate = new Date(fecha)
  if (isNaN(fechaDate.getTime())) {
    return Response.json({ success: false, error: 'Fecha inválida' }, { status: 400 })
  }

  // Normalizar a medianoche UTC para almacenamiento consistente
  const fechaNorm = new Date(Date.UTC(
    fechaDate.getUTCFullYear(),
    fechaDate.getUTCMonth(),
    fechaDate.getUTCDate()
  ))

  try {
    const festivo = await prisma.festivo.create({
      data: {
        organizationId: session.user.organizationId,
        fecha: fechaNorm,
        nombre: nombre?.trim() || null,
      },
    })
    return Response.json({ success: true, festivo }, { status: 201 })
  } catch (err) {
    if (err.code === 'P2002') {
      return Response.json({ success: false, error: 'Ya existe un festivo en esa fecha' }, { status: 409 })
    }
    console.error('[POST /api/festivos]', err)
    return Response.json({ success: false, error: 'Error al crear festivo' }, { status: 500 })
  }
}
