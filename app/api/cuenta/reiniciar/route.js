import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/cuenta/reiniciar
// Borra TODOS los datos de la organizacion (clientes, prestamos, pagos, rutas,
// caja, capital, etc.) dejando intactos: el registro de Organization, el
// usuario owner, y las Suscripciones (facturacion). Reinicia el onboarding.
//
// Solo el owner puede ejecutar esta accion. Requiere confirmacion explicita
// en el body para evitar borrados accidentales.
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const orgId = session.user.organizationId
    if (!orgId) {
      // Superadmin u otro usuario sin organizacion no puede reiniciar una cuenta.
      return NextResponse.json({ success: false, error: 'Esta accion requiere una organización asociada' }, { status: 400 })
    }

    if (session.user.rol !== 'owner') {
      return NextResponse.json({ success: false, error: 'Solo el propietario de la cuenta puede reiniciarla' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    if (body?.confirmacion !== 'REINICIAR') {
      return NextResponse.json({ success: false, error: 'Confirmación inválida. Escribe REINICIAR para continuar.' }, { status: 400 })
    }

    await prisma.adminLog.create({
      data: {
        organizacionId: orgId,
        adminId: session.user.id,
        accion: 'reiniciar_cuenta',
        detalle: 'Cuenta reiniciada por el owner',
      },
    })

    await prisma.$transaction(async (tx) => {
      // Wave 1: hojas mas profundas
      await tx.evento.deleteMany({ where: { organizationId: orgId } })
      await tx.pushLog.deleteMany({ where: { organizationId: orgId } })
      await tx.notificacion.deleteMany({ where: { organizationId: orgId } })
      await tx.actividadLog.deleteMany({ where: { organizationId: orgId } })
      await tx.asistenteMemoria.deleteMany({ where: { organizationId: orgId } })
      await tx.adminLog.deleteMany({ where: { organizacionId: orgId } })
      await tx.notaSeguimiento.deleteMany({ where: { organizationId: orgId } })
      await tx.festivo.deleteMany({ where: { organizationId: orgId } })
      await tx.visitaReagendada.deleteMany({ where: { organizationId: orgId } })
      await tx.cierreCaja.deleteMany({ where: { organizationId: orgId } })
      await tx.gastoMenor.deleteMany({ where: { organizationId: orgId } })

      // Wave 1b: hojas de usuarios
      const userIds = (
        await tx.user.findMany({ where: { organizationId: orgId }, select: { id: true } })
      ).map((u) => u.id)
      await tx.ubicacionLog.deleteMany({ where: { userId: { in: userIds } } })
      await tx.pushSubscription.deleteMany({ where: { userId: { in: userIds } } })

      // Wave 1c: hojas de bot/tickets
      await tx.botConversacion.deleteMany({ where: { botLead: { organizationId: orgId } } })
      await tx.mensajeTicket.deleteMany({ where: { ticket: { organizationId: orgId } } })

      // Wave 1d: hojas de prestamos/lineas de credito
      await tx.cuotaAmortizacion.deleteMany({ where: { prestamo: { organizationId: orgId } } })
      await tx.pago.deleteMany({ where: { organizationId: orgId } })
      await tx.pagoLinea.deleteMany({ where: { organizationId: orgId } })
      await tx.desembolsoLinea.deleteMany({ where: { organizationId: orgId } })
      await tx.corteLinea.deleteMany({ where: { organizationId: orgId } })
      await tx.movimientoCapital.deleteMany({ where: { organizationId: orgId } })
      await tx.aporteSocio.deleteMany({ where: { organizationId: orgId } })

      // Wave 2: padres de nivel medio
      await tx.botLead.deleteMany({ where: { organizationId: orgId } })
      await tx.lead.deleteMany({ where: { organizationId: orgId } })
      await tx.ticketSoporte.deleteMany({ where: { organizationId: orgId } })
      await tx.prestamo.deleteMany({ where: { organizationId: orgId } })
      await tx.lineaCredito.deleteMany({ where: { organizationId: orgId } })
      await tx.capital.deleteMany({ where: { organizationId: orgId } })

      // Wave 3: padres superiores
      await tx.cliente.deleteMany({ where: { organizationId: orgId } })
      await tx.socio.deleteMany({ where: { organizationId: orgId } })

      // Wave 4: estructura
      await tx.ruta.deleteMany({ where: { organizationId: orgId } })

      // Wave 5: usuarios no-owner
      await tx.user.deleteMany({ where: { organizationId: orgId, rol: { not: 'owner' } } })

      // Reiniciar onboarding
      await tx.organization.update({
        where: { id: orgId },
        data: { onboardingStep: 0, onboardingFlujo: null },
      })
    }, { timeout: 60000 })

    return NextResponse.json({ ok: true, mensaje: 'Cuenta reiniciada exitosamente' })
  } catch (error) {
    console.error('[api/cuenta/reiniciar]', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo reiniciar la cuenta. Intenta de nuevo o contacta a soporte.' },
      { status: 500 }
    )
  }
}
