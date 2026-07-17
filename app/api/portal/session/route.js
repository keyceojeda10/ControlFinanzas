import { NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getPortalSession(request)
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: session.clienteId },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      telefono: true,
      direccion: true,
      estado: true,
      portalActivo: true,
      organization: {
        select: { nombre: true, country: true },
      },
    },
  })

  if (!cliente || !cliente.portalActivo || cliente.estado === 'eliminado') {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      estado: cliente.estado,
      orgNombre: cliente.organization.nombre,
      country: cliente.organization.country || 'co',
    },
  })
}
