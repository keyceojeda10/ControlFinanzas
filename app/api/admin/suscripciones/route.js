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
  const filtro = searchParams.get('estado') ?? '' // activa | vencida | cancelada | porVencer | trialPorVencer

  const ahora   = new Date()
  const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Excluir siempre subs pending (pagos MP iniciados pero no completados)
  const baseWhere = {
    OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
  }
  const where = { ...baseWhere }

  if (filtro === 'activa')    where.estado = 'activa'
  if (filtro === 'vencida')   where.estado = 'vencida'
  if (filtro === 'cancelada') where.estado = 'cancelada'
  if (filtro === 'porVencer') {
    where.estado = 'activa'
    where.fechaVencimiento = { lte: en7Dias, gte: ahora }
  }
  // Trials vigentes que vencen en los proximos 7 dias (montoCOP = 0)
  if (filtro === 'trialPorVencer') {
    where.estado = 'activa'
    where.montoCOP = 0
    where.fechaVencimiento = { lte: en7Dias, gte: ahora }
  }

  const suscripciones = await prisma.suscripcion.findMany({
    where,
    include: {
      organization: {
        select: {
          id: true,
          nombre: true,
          activo: true,
          telefono: true,
          users: {
            where: { rol: 'owner' },
            select: { email: true, telefono: true, lastLoginAt: true },
            take: 1,
          },
          _count: { select: { clientes: true, prestamos: true } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  })

  const resultado = suscripciones.map((s) => {
    const diasRestantes = Math.ceil(
      (new Date(s.fechaVencimiento) - ahora) / (1000 * 60 * 60 * 24)
    )
    const owner = s.organization.users?.[0]
    const esTrial = (s.montoCOP ?? 0) === 0
    return {
      id:               s.id,
      organizacionId:   s.organization.id,
      organizacion:     s.organization.nombre,
      orgActiva:        s.organization.activo,
      ownerEmail:       owner?.email ?? null,
      ownerTelefono:    owner?.telefono ?? s.organization.telefono ?? null,
      ownerLastLoginAt: owner?.lastLoginAt ?? null,
      clientes:         s.organization._count.clientes,
      prestamos:        s.organization._count.prestamos,
      plan:             s.plan,
      estado:           s.estado,
      esTrial,
      fechaInicio:      s.fechaInicio,
      fechaVencimiento: s.fechaVencimiento,
      montoCOP:         s.montoCOP,
      diasRestantes,
    }
  })

  return NextResponse.json(resultado)
}
