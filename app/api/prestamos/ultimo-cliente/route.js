// app/api/prestamos/ultimo-cliente/route.js
// Devuelve el ultimo prestamo de un cliente (incluso completado) con sus
// condiciones para que el form de "Nuevo prestamo" pueda ofrecer "Repetir
// condiciones del anterior" con un click.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const puedeCrear =
    session.user.rol === 'owner' ||
    Boolean(session.user.permisos?.crearPrestamos)
  if (!puedeCrear) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')

  if (!clienteId) {
    return Response.json({ error: 'clienteId requerido' }, { status: 400 })
  }

  // Verifica multi-tenant: cliente debe pertenecer a la org.
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
    select: { id: true },
  })
  if (!cliente) return Response.json({ ultimo: null })

  // Ultimo prestamo por fecha de creacion. Incluye completados — la idea
  // es repetir condiciones, no importa el estado.
  const ultimo = await prisma.prestamo.findFirst({
    where: { clienteId, organizationId, estado: { notIn: ['cancelado'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      montoPrestado: true,
      tasaInteres: true,
      diasPlazo: true,
      frecuencia: true,
      diaCobroSemana: true,
      diaCobroMes: true,
      primerCobro: true,
      diaCobroMes2: true,
      createdAt: true,
    },
  })

  return Response.json({ ultimo })
}
