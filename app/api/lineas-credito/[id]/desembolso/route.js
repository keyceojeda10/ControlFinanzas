// app/api/lineas-credito/[id]/desembolso/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { puedeDesembolsar } from '@/lib/linea-credito'

// ─── POST /api/lineas-credito/[id]/desembolso ─────────────────────────────
// Registra un desembolso sobre una linea de credito activa.
// Owner: siempre puede.
// Cobrador: solo si tiene puedeDesembolsarLinea === true en su User record.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { id: lineaId } = await params

  try {
    // ── Validar permiso del cobrador ────────────────────────────────────────
    if (rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: userId },
        select: { puedeDesembolsarLinea: true },
      })
      if (!cobrador?.puedeDesembolsarLinea) {
        return Response.json(
          { error: 'No tienes permiso para desembolsar en lineas de credito' },
          { status: 403 }
        )
      }
    }

    // ── Validar input ───────────────────────────────────────────────────────
    const body = await request.json()
    const monto = Number(body?.monto)
    const nota  = body?.nota?.trim() || null

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
        desembolsos: { select: { monto: true, createdAt: true } },
        pagosLinea:  { select: { montoACapital: true, montoAInteres: true, createdAt: true } },
      },
    })

    if (!linea) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    // ── Validar reglas de negocio ───────────────────────────────────────────
    const { puede, razon } = puedeDesembolsar(linea, monto)
    if (!puede) {
      return Response.json({ error: razon }, { status: 400 })
    }

    // ── Crear el desembolso ─────────────────────────────────────────────────
    const desembolso = await prisma.desembolsoLinea.create({
      data: {
        lineaCreditoId:  lineaId,
        organizationId,
        monto,
        nota,
        registradoPorId: userId,
      },
    })

    return Response.json({ success: true, data: desembolso }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/lineas-credito/[id]/desembolso]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
