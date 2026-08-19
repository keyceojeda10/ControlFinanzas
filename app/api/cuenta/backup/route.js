// app/api/cuenta/backup/route.js — Exportar TODOS los datos de la organización
// como un archivo JSON descargable. Solo el owner puede generar este backup.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // ── Sesión y permisos ──────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.rol !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario de la cuenta puede generar el backup' },
        { status: 403 }
      )
    }

    const orgId = session.user.organizationId
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Sin organización asociada' }, { status: 400 })
    }

    // ── Organización (registro base + verificación de existencia) ──
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 404 })
    }

    // ── Queries de todos los modelos org-scoped en paralelo ──
    const [
      usuarios,
      rutas,
      clientes,
      prestamos,
      pagos,
      lineasCredito,
      desembolsosLinea,
      pagosLinea,
      cortesLinea,
      socios,
      aportesSocios,
      capital,
      movimientosCapital,
      cierresCaja,
      gastosMenores,
      festivos,
      visitasReagendadas,
      ticketsSoporte,
      notificaciones,
      actividadLogs,
      adminLogs,
      leads,
      botLeads,
    ] = await Promise.all([
      prisma.user.findMany({ where: { organizationId: orgId } }),
      prisma.ruta.findMany({ where: { organizationId: orgId } }),
      prisma.cliente.findMany({ where: { organizationId: orgId } }),
      prisma.prestamo.findMany({
        where: { organizationId: orgId },
        /* Los devengos también: en un préstamo abierto son la única constancia
           de cuánto interés nació y cuándo. Un respaldo sin ellos no permite
           reconstruir la deuda. */
        include: { cuotasAmortizacion: true, devengos: true },
      }),
      prisma.pago.findMany({ where: { organizationId: orgId } }),
      prisma.lineaCredito.findMany({ where: { organizationId: orgId } }),
      prisma.desembolsoLinea.findMany({ where: { organizationId: orgId } }),
      prisma.pagoLinea.findMany({ where: { organizationId: orgId } }),
      prisma.corteLinea.findMany({ where: { organizationId: orgId } }),
      prisma.socio.findMany({ where: { organizationId: orgId } }),
      prisma.aporteSocio.findMany({ where: { organizationId: orgId } }),
      prisma.capital.findUnique({ where: { organizationId: orgId } }),
      prisma.movimientoCapital.findMany({ where: { organizationId: orgId } }),
      prisma.cierreCaja.findMany({ where: { organizationId: orgId } }),
      prisma.gastoMenor.findMany({ where: { organizationId: orgId } }),
      prisma.festivo.findMany({ where: { organizationId: orgId } }),
      prisma.visitaReagendada.findMany({ where: { organizationId: orgId } }),
      prisma.ticketSoporte.findMany({
        where: { organizationId: orgId },
        include: { mensajes: true },
      }),
      prisma.notificacion.findMany({ where: { organizationId: orgId } }),
      prisma.actividadLog.findMany({ where: { organizationId: orgId } }),
      // AdminLog usa el campo `organizacionId` (con tilde), no `organizationId`.
      prisma.adminLog.findMany({ where: { organizacionId: orgId } }),
      prisma.lead.findMany({ where: { organizationId: orgId } }),
      prisma.botLead.findMany({
        where: { organizationId: orgId },
        include: { conversaciones: true },
      }),
    ])

    // ── Nunca exponer password hashes ni tokens sensibles ──
    const usuariosSinPassword = usuarios.map((u) => {
      const { password, tokenVerificacion, ...resto } = u
      return resto
    })

    // ── Ensamblar el backup ──────────────────────────────────
    const backup = {
      meta: {
        version: 1,
        exportDate: new Date().toISOString(),
        organizationId: orgId,
        organizationNombre: org.nombre,
      },
      organizacion: org,
      usuarios: usuariosSinPassword,
      rutas,
      clientes,
      prestamos,
      pagos,
      lineasCredito,
      desembolsosLinea,
      pagosLinea,
      cortesLinea,
      socios,
      aportesSocios,
      capital,
      movimientosCapital,
      cierresCaja,
      gastosMenores,
      festivos,
      visitasReagendadas,
      ticketsSoporte,
      notificaciones,
      actividadLogs,
      adminLogs,
      leads,
      botLeads,
    }

    const fecha = new Date().toISOString().slice(0, 10)
    const nombreOrgSlug = (org.nombre || 'organizacion')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'organizacion'

    const filename = `backup-${nombreOrgSlug}-${fecha}.json`
    const body = JSON.stringify(backup, null, 2)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[api/cuenta/backup] Error generando backup:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo generar el backup. Intenta nuevamente.' },
      { status: 500 }
    )
  }
}
