// app/api/lineas-credito/[id]/pago/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { aplicarPago }      from '@/lib/linea-credito'

// ─── DELETE /api/lineas-credito/[id]/pago?pagoId=xxx ──────────────────────
// Solo admin, solo pagos creados hoy.
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  const { id: lineaId } = await params

  if (rol === 'cobrador') {
    return Response.json({ error: 'Sin permiso para eliminar pagos' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const pagoId = searchParams.get('pagoId')

    if (!pagoId) {
      return Response.json({ error: 'pagoId es requerido' }, { status: 400 })
    }

    const pago = await prisma.pagoLinea.findUnique({
      where: { id: pagoId },
      select: { id: true, lineaCreditoId: true, organizationId: true, createdAt: true },
    })

    if (!pago || pago.organizationId !== organizationId || pago.lineaCreditoId !== lineaId) {
      return Response.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    const hoy = new Date()
    const creado = new Date(pago.createdAt)
    if (creado.toDateString() !== hoy.toDateString()) {
      return Response.json({ error: 'Solo se pueden eliminar pagos del dia de hoy' }, { status: 400 })
    }

    await prisma.pagoLinea.delete({ where: { id: pagoId } })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/lineas-credito/[id]/pago]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/lineas-credito/[id]/pago ───────────────────────────────────
// Registra un pago sobre una linea de credito.
// Primero cubre intereses pendientes, luego capital (segun aplicarPago).
// Cobrador: el cliente de la linea debe pertenecer a una de sus rutas.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId, rutaIds = [] } = session.user
  const { id: lineaId } = await params

  try {
    // ── Validar input ───────────────────────────────────────────────────────
    const body      = await request.json()
    const monto     = Number(body?.monto)
    const metodoPago = body?.metodoPago?.trim() || null
    const nota      = body?.nota?.trim() || null

    if (!monto || monto <= 0 || !Number.isFinite(monto)) {
      return Response.json(
        { error: 'El monto debe ser un numero positivo' },
        { status: 400 }
      )
    }

    // ── Cargar la linea con relaciones necesarias ───────────────────────────
    const linea = await prisma.lineaCredito.findFirst({
      where: { id: lineaId, organizationId },
      include: {
        cliente:    { select: { id: true, rutaId: true } },
        desembolsos: {
          select: { monto: true, createdAt: true },
        },
        pagosLinea: {
          select: { montoACapital: true, montoAInteres: true, montoTotal: true, createdAt: true },
        },
        cortesLinea: {
          select: { interesesGenerados: true, fechaCorte: true, saldoNuevo: true, createdAt: true },
          orderBy: { fechaCorte: 'desc' },
        },
      },
    })

    if (!linea) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    if (linea.estado === 'cerrada') {
      return Response.json({ error: 'No se pueden registrar pagos en una linea cerrada' }, { status: 400 })
    }

    // ── Cobrador: verificar acceso por ruta del cliente ────────────────────
    if (rol === 'cobrador' && !rutaIds.includes(linea.cliente.rutaId)) {
      return Response.json(
        { error: 'No tienes acceso a esta linea de credito' },
        { status: 403 }
      )
    }

    // ── Calcular distribucion del pago ─────────────────────────────────────
    const { montoAInteres, montoACapital, saldoRestante } = aplicarPago(linea, monto)

    // ── Persistir el pago ──────────────────────────────────────────────────
    const pago = await prisma.pagoLinea.create({
      data: {
        lineaCreditoId: lineaId,
        organizationId,
        montoTotal:    monto,
        montoAInteres,
        montoACapital,
        metodoPago:    metodoPago || null,
        cobradorId:    rol === 'cobrador' ? userId : null,
        nota,
      },
    })

    return Response.json(
      {
        success: true,
        data: {
          ...pago,
          montoAInteres,
          montoACapital,
          saldoRestante,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/lineas-credito/[id]/pago]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
