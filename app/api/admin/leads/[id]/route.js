import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendConversionEvent } from '@/lib/facebook-capi'

export async function GET(_req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, nombre: true, plan: true } },
      },
    })

    if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(lead)
  } catch (error) {
    console.error('[GET /api/admin/leads/[id]]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const data = {}
    if (body.estado) data.estado = body.estado
    if (body.notas !== undefined) data.notas = body.notas
    if (body.mensajesEnviados !== undefined) data.mensajesEnviados = body.mensajesEnviados
    if (body.organizationId !== undefined) data.organizationId = body.organizationId

    // Obtener estado anterior para detectar cambio a "registrado"
    const leadAnterior = body.estado ? await prisma.lead.findUnique({ where: { id }, select: { estado: true, telefono: true } }) : null

    const lead = await prisma.lead.update({ where: { id }, data })

    // Cuando un lead pasa a "registrado", enviar conversión a Meta CAPI con su teléfono
    if (body.estado === 'registrado' && leadAnterior?.estado !== 'registrado' && leadAnterior?.telefono) {
      sendConversionEvent({
        eventName: 'Lead',
        phone: leadAnterior.telefono,
        customData: { lead_source: 'whatsapp' },
      }).catch(() => {})
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('[PATCH /api/admin/leads/[id]]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    await prisma.lead.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { ok: true } })
  } catch (error) {
    console.error('[DELETE /api/admin/leads/[id]]', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}
