// app/api/cobradores/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const hoy = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
const manana = () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// ─── GET /api/cobradores/[id] ───────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo los owners pueden ver detalles de cobradores' }, { status: 403 })
  }

  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
    include: {
      rutas: {
        where:  { activo: true },
        include: { clientes: { select: { id: true, nombre: true, estado: true } } },
      },
      pagos: {
        where:  { fechaPago: { gte: hoy(), lt: manana() } },
        select: { montoPagado: true, prestamoId: true },
      },
    },
  })

  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  return Response.json({
    id:           cobrador.id,
    nombre:       cobrador.nombre,
    email:        cobrador.email,
    activo:       cobrador.activo,
    ruta:         cobrador.rutas[0] ?? null,
    recaudadoHoy: cobrador.pagos.reduce((a, p) => a + p.montoPagado, 0),
    pagosMes:     cobrador.pagos.length,
  })
}

// ─── PATCH /api/cobradores/[id] ─────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo los owners pueden modificar cobradores' }, { status: 403 })
  }

  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  const { activo } = await request.json()
  const actualizado = await prisma.user.update({
    where: { id },
    data:  { activo: Boolean(activo) },
    select: { id: true, nombre: true, email: true, activo: true },
  })

  return Response.json(actualizado)
}
