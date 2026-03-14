import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarEmail } from '@/lib/email'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rol } = session.user
    if (rol !== 'superadmin' && rol !== 'owner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const tipo = searchParams.get('tipo')

    const where = {}
    if (rol === 'owner') {
      where.organizationId = session.user.organizationId
    } else {
      if (estado) where.estado = estado
      if (tipo) where.tipo = tipo
    }

    const tickets = await prisma.ticketSoporte.findMany({
      where,
      include: {
        user: { select: { nombre: true, email: true } },
        organization: { select: { nombre: true, plan: true } },
        _count: {
          select: {
            mensajes: {
              where: { leido: false, esAdmin: rol === 'owner' },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('[GET /api/soporte]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners pueden crear tickets' }, { status: 403 })
    if (!session.user.organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

    const { tipo, asunto, descripcion, solicitaContacto = false, telefonoContacto } = await request.json()
    const TIPOS_VALIDOS = ['bug', 'pregunta', 'solicitud', 'problema_pago', 'otro']
    if (!tipo || !asunto || !descripcion) {
      return NextResponse.json({ error: 'tipo, asunto y descripcion son requeridos' }, { status: 400 })
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de ticket no válido' }, { status: 400 })
    }

    const ticket = await prisma.ticketSoporte.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        tipo,
        asunto,
        descripcion,
        solicitaContacto,
        telefonoContacto: solicitaContacto ? telefonoContacto : null,
      },
      include: {
        user: { select: { nombre: true, email: true } },
        organization: { select: { nombre: true, plan: true } },
      },
    })

    // Email de notificación
    enviarEmail({
      to: 'soporte@control-finanzas.com',
      subject: `[Ticket #${ticket.id.slice(-6).toUpperCase()}] ${asunto}`,
      html: (() => {
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        return `
        <h2>Nuevo ticket de soporte</h2>
        <p><b>Organización:</b> ${esc(ticket.organization.nombre)} (${esc(ticket.organization.plan)})</p>
        <p><b>Usuario:</b> ${esc(ticket.user.nombre)} (${esc(ticket.user.email)})</p>
        <p><b>Tipo:</b> ${esc(tipo)}</p>
        <p><b>Asunto:</b> ${esc(asunto)}</p>
        <p><b>Descripción:</b> ${esc(descripcion)}</p>
        ${solicitaContacto ? `<p><b>Solicita contacto:</b> ${esc(telefonoContacto || 'sin teléfono')}</p>` : ''}
        <p><a href="https://app.control-finanzas.com/admin/soporte/${ticket.id}">Ver en panel admin</a></p>
        `
      })(),
    }).catch(() => {})

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('[POST /api/soporte]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
