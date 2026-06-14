// app/api/admin/whatsapp-bot/leads/route.js — Lista + crear leads del bot
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const busqueda = searchParams.get('q')
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = Math.min(parseInt(searchParams.get('limite') || '50'), 100)

  const where = {}
  if (estado) where.estado = estado
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda } },
      { telefono: { contains: busqueda } },
    ]
  }

  const [leads, total] = await Promise.all([
    prisma.botLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
    prisma.botLead.count({ where }),
  ])

  return NextResponse.json({ leads, total, pagina, paginas: Math.ceil(total / limite) })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { nombre, telefono, cantClientes, esPrestamista, metodoActual, planInteres } = body

  if (!telefono) {
    return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
  }

  // Dedup
  const existe = await prisma.botLead.findFirst({ where: { telefono } })
  if (existe) {
    return NextResponse.json({ error: 'Ya existe un lead con ese teléfono', lead: existe }, { status: 409 })
  }

  const lead = await prisma.botLead.create({
    data: {
      nombre: nombre || 'Sin nombre',
      telefono,
      cantClientes: cantClientes || undefined,
      esPrestamista: esPrestamista || undefined,
      metodoActual: metodoActual || undefined,
      planInteres: planInteres || undefined,
    },
  })

  return NextResponse.json(lead, { status: 201 })
}
