// app/api/lineas-credito/[id]/corte/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { generarCorte }     from '@/lib/linea-credito'

// ─── DELETE /api/lineas-credito/[id]/corte?corteId=xxx ────────────────────
// Solo admin. Solo el ultimo corte de la linea (para no descuadrar la cadena).
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  const { id: lineaId } = await params

  if (rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar cortes' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const corteId = searchParams.get('corteId')

    if (!corteId) {
      return Response.json({ error: 'corteId es requerido' }, { status: 400 })
    }

    const corte = await prisma.corteLinea.findUnique({
      where: { id: corteId },
      select: { id: true, lineaCreditoId: true, organizationId: true, fechaCorte: true },
    })

    if (!corte || corte.organizationId !== organizationId || corte.lineaCreditoId !== lineaId) {
      return Response.json({ error: 'Corte no encontrado' }, { status: 404 })
    }

    // Solo permitir eliminar el ultimo corte
    const ultimoCorte = await prisma.corteLinea.findFirst({
      where: { lineaCreditoId: lineaId },
      orderBy: { fechaCorte: 'desc' },
      select: { id: true },
    })

    if (ultimoCorte.id !== corteId) {
      return Response.json({ error: 'Solo se puede eliminar el ultimo corte generado' }, { status: 400 })
    }

    await prisma.corteLinea.delete({ where: { id: corteId } })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/lineas-credito/[id]/corte]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/lineas-credito/[id]/corte ──────────────────────────────────
// Genera el corte mensual (estado de cuenta) de una linea de credito.
// Solo el owner puede ejecutar esta accion.
// Body opcional: { fechaCorte } — si no se provee, se usa la fecha actual.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  const { id: lineaId }         = await params

  // Solo el owner puede generar cortes
  if (rol !== 'owner') {
    return Response.json(
      { error: 'Solo el administrador puede generar cortes de linea de credito' },
      { status: 403 }
    )
  }

  try {
    // ── Validar input ───────────────────────────────────────────────────────
    let body = {}
    try {
      body = await request.json()
    } catch {
      // body vacio es valido: se usa fechaCorte = now()
    }

    const fechaCorte = body?.fechaCorte ? new Date(body.fechaCorte) : new Date()

    if (Number.isNaN(fechaCorte.getTime())) {
      return Response.json(
        { error: 'fechaCorte no es una fecha valida' },
        { status: 400 }
      )
    }

    // ── Cargar la linea con todas las relaciones necesarias ─────────────────
    const linea = await prisma.lineaCredito.findFirst({
      where: { id: lineaId, organizationId },
      include: {
        desembolsos: {
          select: { monto: true, createdAt: true },
        },
        pagosLinea: {
          select: { montoACapital: true, montoAInteres: true, montoTotal: true, createdAt: true },
        },
        cortesLinea: {
          select: {
            id:                true,
            periodo:           true,
            fechaCorte:        true,
            saldoAnterior:     true,
            totalDesembolsos:  true,
            interesesGenerados: true,
            totalCargos:       true,
            totalPagado:       true,
            saldoNuevo:        true,
            pagoMinimo:        true,
            createdAt:         true,
          },
          orderBy: { fechaCorte: 'desc' },
        },
      },
    })

    if (!linea) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    // ── Calcular datos del corte sin guardar ────────────────────────────────
    const datosCorte = generarCorte(linea, fechaCorte)

    // ── Verificar que no exista ya un corte para el mismo periodo ───────────
    // La restriccion @@unique([lineaCreditoId, periodo]) en el schema lo
    // bloquearia de todas formas, pero damos un error amigable antes.
    const periodoExistente = linea.cortesLinea.find(
      (c) => c.periodo === datosCorte.periodo
    )
    if (periodoExistente) {
      return Response.json(
        {
          error: `Ya existe un corte para el periodo ${datosCorte.periodo}. Solo puede haber un corte por mes.`,
        },
        { status: 409 }
      )
    }

    // ── Persistir el corte ─────────────────────────────────────────────────
    const corte = await prisma.corteLinea.create({
      data: {
        lineaCreditoId:     datosCorte.lineaCreditoId,
        organizationId:     datosCorte.organizationId,
        periodo:            datosCorte.periodo,
        fechaCorte:         datosCorte.fechaCorte,
        saldoAnterior:      datosCorte.saldoAnterior,
        totalDesembolsos:   datosCorte.totalDesembolsos,
        interesesGenerados: datosCorte.interesesGenerados,
        totalCargos:        datosCorte.totalCargos,
        totalPagado:        datosCorte.totalPagado,
        saldoNuevo:         datosCorte.saldoNuevo,
        pagoMinimo:         datosCorte.pagoMinimo,
      },
    })

    return Response.json({ success: true, data: corte }, { status: 201 })
  } catch (err) {
    // Capturar la violacion de unique constraint como fallback defensivo
    if (err?.code === 'P2002') {
      return Response.json(
        { error: 'Ya existe un corte para ese periodo en esta linea de credito.' },
        { status: 409 }
      )
    }
    console.error('[POST /api/lineas-credito/[id]/corte]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
