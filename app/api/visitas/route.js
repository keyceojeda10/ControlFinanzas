// app/api/visitas/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'

// `pago_parcial` es el que faltaba: el cliente SÍ pagó, pero ya dijo que no da
// más por hoy. Los otros cuatro describen por qué no pagó nada, y ninguno vale
// para «abonó $20.000 de los $100.000 y hasta ahí llega». Sin él, el cobrador
// no tenía forma de cerrar esa visita y el cliente le seguía saliendo de
// primero como pendiente toda la jornada.
const MOTIVOS_VALIDOS = ['no_estaba', 'negocio_cerrado', 'no_tenia_dinero', 'pidio_plazo', 'pago_parcial', 'otro']

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

/* ─── DELETE /api/visitas?clienteId=…&hoy=1 — deshacer el cierre de hoy ─────
   El cobrador cierra la visita de alguien que abonó y sigue debiendo, y el
   cliente saca otro billete a los dos minutos. Sin esta salida, «hasta aquí
   hoy» sería irreversible por una decisión que se toma de pie en una puerta.

   Solo borra las de HOY y solo de esta organización: una anotación de ayer es
   historial del negocio y no se toca desde un botón de la ruta. */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { organizationId } = session.user
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    if (!clienteId) {
      return Response.json({ error: 'clienteId es obligatorio' }, { status: 400 })
    }
    if (searchParams.get('hoy') !== '1') {
      return Response.json({ error: 'Solo se pueden deshacer las visitas de hoy' }, { status: 400 })
    }

    // El mismo corte de día que usan la ruta y cobros-hoy: medianoche local
    // guardada en UTC. Restar 24h desde «ahora» borraría también las de ayer
    // por la tarde.
    const ahora = new Date()
    const inicio = new Date(Date.UTC(
      ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 0, 0, 0, 0,
    ))
    const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)

    const { count } = await prisma.visitaReagendada.deleteMany({
      where: {
        organizationId,
        clienteId,
        fechaOriginal: { gte: inicio, lt: fin },
      },
    })

    try {
      await logActividad({
        userId: session.user.id,
        organizationId,
        accion: 'reabrir_visita',
        entidadTipo: 'cliente',
        entidadId: clienteId,
        descripcion: `Volvió a abrir la visita de hoy (${count} anotación${count === 1 ? '' : 'es'})`,
      })
    } catch {}

    return Response.json({ ok: true, borradas: count })
  } catch (err) {
    console.error('DELETE /api/visitas error:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
