import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el owner puede registrar aportes' }, { status: 403 })
  }
  await bloquearSiSuscripcionVencida(session)

  const { id: socioId } = await params
  const body = await request.json()
  const { monto, fecha, nota } = body

  if (!monto || Number(monto) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  const socio = await prisma.socio.findFirst({
    where: { id: socioId, organizationId: session.user.organizationId },
  })
  if (!socio) {
    return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const aporte = await prisma.aporteSocio.create({
    data: {
      socioId,
      organizationId: session.user.organizationId,
      monto: Number(monto),
      fecha: fecha ? new Date(fecha) : new Date(),
      nota: nota?.trim() || null,
    },
  })

  logActividad({
    session,
    accion: 'registrar_aporte',
    entidadTipo: 'socio',
    entidadId: socioId,
    detalle: `Aporte de $${Math.round(Number(monto)).toLocaleString('es-CO')} para ${socio.nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json(aporte, { status: 201 })
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el owner puede eliminar aportes' }, { status: 403 })
  }

  const { id: socioId } = await params
  const { searchParams } = new URL(request.url)
  const aporteId = searchParams.get('aporteId')

  if (!aporteId) {
    return Response.json({ error: 'Falta aporteId' }, { status: 400 })
  }

  const aporte = await prisma.aporteSocio.findFirst({
    where: { id: aporteId, socioId, organizationId: session.user.organizationId },
  })
  if (!aporte) {
    return Response.json({ error: 'Aporte no encontrado' }, { status: 404 })
  }

  await prisma.aporteSocio.delete({ where: { id: aporteId } })

  logActividad({
    session,
    accion: 'eliminar_aporte',
    entidadTipo: 'socio',
    entidadId: socioId,
    detalle: `Aporte eliminado: $${Math.round(aporte.monto).toLocaleString('es-CO')}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ ok: true })
}
