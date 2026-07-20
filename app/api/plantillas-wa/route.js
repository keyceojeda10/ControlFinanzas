import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({})

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plantillasWA: true },
  })

  return NextResponse.json(org?.plantillasWA ?? {})
}

export async function PUT(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const body = await req.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { plantillasWA: body },
  })

  return NextResponse.json({ ok: true })
}
