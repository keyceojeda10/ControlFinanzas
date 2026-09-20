// POST /api/pagos/[id]/ubicacion — las coordenadas que llegaron tarde.
//
// El cobro ya no espera al GPS (ver `lib/geo.js`): sale del teléfono en el acto
// y, si el GPS todavía no había contestado, la ubicación se le pone después.
//
// Es deliberadamente estrecho, porque la ubicación de un pago es un dato de
// AUDITORÍA —dónde estaba el cobrador cuando cobró— y no puede reescribirse:
//   · solo RELLENA: si el pago ya tiene coordenadas, no se tocan;
//   · solo quien registró el pago (o el dueño del negocio);
//   · solo en los cinco minutos siguientes al cobro.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizarCoords } from '@/lib/geo'

const VENTANA_MS = 5 * 60 * 1000

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { organizationId, id: userId, rol } = session.user
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const { latitud, longitud } = sanitizarCoords(body?.latitud, body?.longitud)
  if (latitud == null || longitud == null) return Response.json({ error: 'Ubicación no válida' }, { status: 400 })

  const pago = await prisma.pago.findFirst({
    where: { id, organizationId },
    select: { id: true, latitud: true, cobradorId: true, createdAt: true },
  })
  if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })
  if (rol !== 'owner' && pago.cobradorId !== userId) return Response.json({ error: 'No autorizado' }, { status: 403 })
  if (pago.latitud != null) return Response.json({ ok: true, yaTenia: true })
  if (Date.now() - new Date(pago.createdAt).getTime() > VENTANA_MS) {
    return Response.json({ error: 'Fuera de tiempo' }, { status: 409 })
  }

  // `latitud: null` en el where: si otro intento llegó primero, este no pisa.
  await prisma.pago.updateMany({ where: { id, organizationId, latitud: null }, data: { latitud, longitud } })
  return Response.json({ ok: true })
}
