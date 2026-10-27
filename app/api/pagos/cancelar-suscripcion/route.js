// app/api/pagos/cancelar-suscripcion/route.js — Cancelar suscripción recurrente
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preApprovalApi }   from '@/lib/mercadopago'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })
  /* Solo el dueño (27 oct 2026). No miraba el rol: un cobrador que llegara a
     «Mi plan» podía cancelar la suscripción del negocio. Es la misma regla de
     guardar o quitar el medio de pago de Wompi (`wompi/fuente`, `wompi/nequi`). */
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño de la cuenta puede cancelar la suscripción' }, { status: 403 })
  }

  const { motivo } = await req.json().catch(() => ({}))

  // Buscar suscripción recurrente activa
  const sub = await prisma.suscripcion.findFirst({
    where: {
      organizationId: orgId,
      tipo: 'recurrente',
      estado: 'activa',
      preapprovalId: { not: null },
    },
  })

  if (!sub) {
    return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 404 })
  }

  try {
    // Cancelar en MercadoPago
    try {
      await preApprovalApi.update({
        id: sub.preapprovalId,
        body: { status: 'cancelled' },
      })
    } catch (mpErr) {
      // Si MP ya la canceló o el preapproval no existe, continuar con la actualización local
      const status = mpErr?.status || mpErr?.statusCode
      if (status !== 400 && status !== 404) {
        throw mpErr
      }
      console.warn('[cancelar-suscripcion] MP ya cancelada o no encontrada, actualizando local:', mpErr.message)
    }

    // Actualizar registro local — mantener activa hasta fechaVencimiento
    await prisma.suscripcion.update({
      where: { id: sub.id },
      data: {
        mpStatus:          'cancelled',
        canceladaAt:       new Date(),
        motivoCancelacion: motivo || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cancelar-suscripcion] Error:', err)
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 })
  }
}
