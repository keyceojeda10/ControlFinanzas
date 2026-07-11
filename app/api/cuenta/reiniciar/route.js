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

    // Log de auditoria ANTES del borrado masivo (por si algo falla a mitad de camino,
    // queda registro de que se intento/inicio el reinicio).
    await prisma.adminLog.create({
      data: {
        organizacionId: orgId,
        adminId: session.user.id,
        accion: 'reiniciar_cuenta',
        detalle: 'Cuenta reiniciada por el owner',
      },
    })

    // ─── Wave 1: hojas mas profundas (dependen solo de organizationId) ──────
    await prisma.evento.deleteMany({ where: { organizationId: orgId } })
    await prisma.pushLog.deleteMany({ where: { organizationId: orgId } })
    await prisma.notificacion.deleteMany({ where: { organizationId: orgId } })
    await prisma.actividadLog.deleteMany({ where: { organizationId: orgId } })
    await prisma.asistenteMemoria.deleteMany({ where: { organizationId: orgId } })
    await prisma.adminLog.deleteMany({ where: { organizacionId: orgId } })
    await prisma.notaSeguimiento.deleteMany({ where: { organizationId: orgId } })
    await prisma.festivo.deleteMany({ where: { organizationId: orgId } })
    await prisma.visitaReagendada.deleteMany({ where: { organizationId: orgId } })
    await prisma.cierreCaja.deleteMany({ where: { organizationId: orgId } })
    await prisma.gastoMenor.deleteMany({ where: { organizationId: orgId } })

    // ─── Wave 1b: hojas dependientes de usuarios de la org (incluye owner) ──
    const userIds = (
      await prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true } })
    ).map((u) => u.id)
    await prisma.ubicacionLog.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } })

    // ─── Wave 1c: hojas de bot/tickets ───────────────────────────────────────
    await prisma.botConversacion.deleteMany({ where: { botLead: { organizationId: orgId } } })
    await prisma.mensajeTicket.deleteMany({ where: { ticket: { organizationId: orgId } } })

    // ─── Wave 1d: hojas de prestamos/lineas de credito ──────────────────────
    await prisma.cuotaAmortizacion.deleteMany({ where: { prestamo: { organizationId: orgId } } })
    await prisma.pago.deleteMany({ where: { organizationId: orgId } })
    await prisma.pagoLinea.deleteMany({ where: { organizationId: orgId } })
    await prisma.desembolsoLinea.deleteMany({ where: { organizationId: orgId } })
    await prisma.corteLinea.deleteMany({ where: { organizationId: orgId } })
    await prisma.movimientoCapital.deleteMany({ where: { organizationId: orgId } })
    await prisma.aporteSocio.deleteMany({ where: { organizationId: orgId } })

    // ─── Wave 2: padres de nivel medio ──────────────────────────────────────
    await prisma.botLead.deleteMany({ where: { organizationId: orgId } })
    await prisma.lead.deleteMany({ where: { organizationId: orgId } })
    await prisma.ticketSoporte.deleteMany({ where: { organizationId: orgId } })
    await prisma.prestamo.deleteMany({ where: { organizationId: orgId } })
    await prisma.lineaCredito.deleteMany({ where: { organizationId: orgId } })
    await prisma.capital.deleteMany({ where: { organizationId: orgId } })

    // ─── Wave 3: padres superiores ───────────────────────────────────────────
    await prisma.cliente.deleteMany({ where: { organizationId: orgId } })
    await prisma.socio.deleteMany({ where: { organizationId: orgId } })

    // ─── Wave 4: estructura ──────────────────────────────────────────────────
    await prisma.ruta.deleteMany({ where: { organizationId: orgId } })
    await prisma.grupoCobro.deleteMany({ where: { organizationId: orgId } })

    // ─── Wave 5: usuarios no-owner (borra en cascada lo que les quede) ─────
    await prisma.user.deleteMany({ where: { organizationId: orgId, rol: { not: 'owner' } } })

    // ─── Reiniciar estado de onboarding de la organizacion ──────────────────
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        onboardingStep: 0,
        onboardingFlujo: null,
      },
    })

    return NextResponse.json({ ok: true, mensaje: 'Cuenta reiniciada exitosamente' })
  } catch (error) {
    console.error('[api/cuenta/reiniciar]', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo reiniciar la cuenta. Intenta de nuevo o contacta a soporte.' },
      { status: 500 }
    )
  }
}
