// app/api/admin/suscripciones/route.js — Lista de suscripciones
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filtro = searchParams.get('estado') ?? '' // activa | vencida | cancelada | porVencer

  const ahora   = new Date()
  const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)

  const where = {}
  if (filtro === 'activa')    where.estado = 'activa'
  if (filtro === 'vencida')   where.estado = 'vencida'
  if (filtro === 'cancelada') where.estado = 'cancelada'
  if (filtro === 'porVencer') {
    where.estado = 'activa'
    where.fechaVencimiento = { lte: en7Dias, gte: ahora }
  }

  const suscripciones = await prisma.suscripcion.findMany({
    where,
    include: {
      organization: { select: { id: true, nombre: true, activo: true } },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  const resultado = suscripciones.map((s) => {
    const diasRestantes = Math.ceil(
      (new Date(s.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24)
    )
    return {
      id:               s.id,
      organizacionId:   s.organization.id,
      organizacion:     s.organization.nombre,
      orgActiva:        s.organization.activo,
      plan:             s.plan,
      estado:           s.estado,
      fechaInicio:      s.fechaInicio,
      fechaVencimiento: s.fechaVencimiento,
      montoCOP:         s.montoCOP,
      diasRestantes,
    }
  })

  return NextResponse.json(resultado)
}
