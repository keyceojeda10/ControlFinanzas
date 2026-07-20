import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ahora   = new Date()
  const en7Dias = new Date(ahora.getTime() + 7 * 86400000)
  const hace30d = new Date(ahora.getTime() - 30 * 86400000)
  const hace24h = new Date(ahora.getTime() - 24 * 3600000)
  const hace3d  = new Date(ahora.getTime() - 3 * 86400000)

  const EMAILS_INTERNOS = [
    'keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com',
    'controlfinanzasgmail@gmail.com', 'serviteclgx1@gmail.com',
  ]

  const orgs = await prisma.organization.findMany({
    where: {
      activo: true,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
    },
    include: {
      users: {
        where: { rol: 'owner' },
        select: { nombre: true, email: true, telefono: true, lastLoginAt: true, createdAt: true },
        take: 1,
      },
      _count: { select: { clientes: true, prestamos: true } },
      suscripciones: {
        orderBy: { fechaVencimiento: 'desc' },
        take: 1,
        select: { fechaVencimiento: true, montoCOP: true, estado: true, plan: true },
      },
    },
  })

  const vencidos = []
  const porVencer = []
  const sinActividad = []

  for (const org of orgs) {
    const owner = org.users[0]
    if (!owner) continue

    const sub = org.suscripciones[0]
    const fechaVenc = sub?.fechaVencimiento ?? org.planDemoHasta
    if (!fechaVenc) continue

    const diasVencido = Math.floor((ahora.getTime() - new Date(fechaVenc).getTime()) / 86400000)
    const diasParaVencer = -diasVencido

    const fila = {
      id: org.id,
      nombre: org.nombre,
      plan: sub?.plan ?? org.plan,
      ownerNombre: owner.nombre,
      ownerEmail: owner.email,
      ownerTelefono: owner.telefono ?? org.telefono ?? null,
      clientes: org._count.clientes,
      prestamos: org._count.prestamos,
      lastLoginAt: owner.lastLoginAt,
      fechaVencimiento: fechaVenc,
      diasVencido,
      esTrial: !sub?.montoCOP || sub.montoCOP === 0,
      algunVezPago: org.suscripciones.some(s => s.montoCOP > 0),
      waChurnSent: org.waChurnSent,
      waActivacionSent: org.waActivacionSent,
      createdAt: org.createdAt,
    }

    if (diasVencido > 0 && diasVencido <= 30) {
      vencidos.push(fila)
    } else if (diasParaVencer > 0 && diasParaVencer <= 7) {
      porVencer.push(fila)
    }

    if (
      org._count.clientes === 0 &&
      org._count.prestamos === 0 &&
      org.createdAt <= hace24h &&
      org.createdAt >= hace30d
    ) {
      sinActividad.push(fila)
    }
  }

  vencidos.sort((a, b) => a.diasVencido - b.diasVencido)
  porVencer.sort((a, b) => a.diasVencido - b.diasVencido)
  sinActividad.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  return NextResponse.json({
    vencidos,
    porVencer,
    sinActividad,
    resumen: {
      totalVencidos: vencidos.length,
      totalPorVencer: porVencer.length,
      totalSinActividad: sinActividad.length,
      vencidosConUso: vencidos.filter(v => v.prestamos >= 3).length,
    },
  })
}
