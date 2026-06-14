// app/api/visitas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'

const MOTIVOS_VALIDOS = ['no_estaba', 'negocio_cerrado', 'no_tenia_dinero', 'pidio_plazo', 'otro']

// ─── POST /api/visitas — Crear visita reagendada ────────────────
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId } = session.user
    const body = await request.json()
    const { clienteId, prestamoId, rutaId, fechaOriginal, fechaReagendada, motivo, motivoDetalle } = body

    if (!clienteId || !fechaReagendada || !motivo) {
      return Response.json({ error: 'clienteId, fechaReagendada y motivo son obligatorios' }, { status: 400 })
    }

    if (!MOTIVOS_VALIDOS.includes(motivo)) {
      return Response.json({ error: 'Motivo inválido' }, { status: 400 })
    }

    // Verificar que el cliente pertenece a la organizacion
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, organizationId },
      select: { id: true, nombre: true },
    })
    if (!cliente) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const visita = await prisma.visitaReagendada.create({
      data: {
        organizationId,
        clienteId,
        prestamoId: prestamoId || null,
        cobradorId: session.user.id,
        rutaId: rutaId || null,
        fechaOriginal: new Date(fechaOriginal || Date.now()),
        fechaReagendada: new Date(fechaReagendada),
        motivo,
        motivoDetalle: motivo === 'otro' ? motivoDetalle?.trim() || null : null,
      },
    })

    // Log de actividad
    try {
      await logActividad({
        userId: session.user.id,
        organizationId,
        accion: 'reagendar_visita',
        entidadTipo: 'cliente',
        entidadId: clienteId,
        detalle: `Reagendada visita a ${cliente.nombre} para ${new Date(fechaReagendada).toLocaleDateString('es-CO')} — motivo: ${motivo}`,
        request,
      })
    } catch {}

    return Response.json(visita, { status: 201 })
  } catch (err) {
    console.error('POST /api/visitas error:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ─── GET /api/visitas?clienteId=X — Historial de reagendamientos ─
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId } = session.user
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')

    if (!clienteId) {
      return Response.json({ error: 'clienteId requerido' }, { status: 400 })
    }

    const visitas = await prisma.visitaReagendada.findMany({
      where: { organizationId, clienteId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return Response.json(visitas)
  } catch (err) {
    console.error('GET /api/visitas error:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
