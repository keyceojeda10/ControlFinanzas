// app/api/tarjeta/enlace/[clienteId]/route.js — EL ENLACE QUE VA EN EL RECIBO.
//
// ⚠ No cuelga de /api/clientes: el service worker cachea ese prefijo, y sin señal
// devolvería un enlace para un pago que el servidor todavía no conoce.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarToken, urlDeTarjeta } from '@/lib/tarjeta/enlace'

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user?.organizationId
  if (!organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { clienteId } = await params
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
    select: { id: true, rutaId: true, organization: { select: { reciboCliente: true } } },
  })
  if (!cliente) return Response.json({ error: 'No encontrado' }, { status: 404 })
  if (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(cliente.rutaId)) {
    return Response.json({ error: 'No encontrado' }, { status: 404 })
  }

  if (cliente.organization.reciboCliente !== 'tarjeta') return Response.json({ url: null })
  const token = await asegurarToken(cliente.id)
  return Response.json({ url: token ? urlDeTarjeta(token) : null })
}
