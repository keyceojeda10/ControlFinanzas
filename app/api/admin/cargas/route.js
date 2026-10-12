// app/api/admin/cargas/route.js — las cargas de cartera con asesor (superadmin).
// Abiertas primero, con su antigüedad: se le prometió al cliente en 24 h.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { archivosDe, resumenDeSolicitud, ESTADOS_ABIERTOS } from '@/lib/carga-asesor/solicitud'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const filas = await prisma.solicitudCarga.findMany({
    where: { OR: [{ estado: { in: [...ESTADOS_ABIERTOS, 'importando'] } }, { updatedAt: { gte: new Date(Date.now() - 30 * 86400000) } }] },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, estado: true, origen: true, archivos: true, resumen: true, createdAt: true, aprobadaAt: true, errorLectura: true,
      organization: { select: { id: true, nombre: true, plan: true } },
    },
  })
  const abiertos = new Set([...ESTADOS_ABIERTOS, 'importando'])
  const cargas = filas
    .map((s) => ({
      id: s.id, estado: s.estado, origen: s.origen, creada: s.createdAt, aprobada: s.aprobadaAt,
      archivos: archivosDe(s).length, resumen: resumenDeSolicitud(s), errorLectura: !!s.errorLectura,
      negocio: s.organization,
    }))
    .sort((a, b) => (abiertos.has(b.estado) - abiertos.has(a.estado)) || (new Date(a.creada) - new Date(b.creada)))
  return NextResponse.json({ cargas })
}
