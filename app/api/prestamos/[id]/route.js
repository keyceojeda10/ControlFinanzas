// app/api/prestamos/[id]/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  pagoHoy,
} from '@/lib/calculos'

async function obtenerPrestamo(id, session) {
  const p = await prisma.prestamo.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, rutaId: true } },
      pagos: {
        orderBy: { fechaPago: 'desc' },
        include: {
          cobrador: { select: { id: true, nombre: true } },
        },
      },
    },
  })
  if (!p) return null
  // Cobrador solo puede ver préstamos de clientes de su ruta
  if (session.user.rol === 'cobrador' && p.cliente.rutaId !== session.user.rutaId) return null
  return p
}

// ─── GET /api/prestamos/[id] ────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const p = await obtenerPrestamo(id, session)
  if (!p) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

  return Response.json({
    ...p,
    totalPagado:      p.pagos.reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    diasMora:         calcularDiasMora(p),
    pagoHoy:          pagoHoy(p),
  })
}

// ─── PATCH /api/prestamos/[id] ──────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede modificar préstamos' }, { status: 403 })
  }

  const { id } = await params
  const p = await obtenerPrestamo(id, session)
  if (!p) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

  const { estado } = await request.json()
  if (!['cancelado'].includes(estado)) {
    return Response.json({ error: 'Estado no válido' }, { status: 400 })
  }

  const actualizado = await prisma.prestamo.update({
    where: { id },
    data:  { estado },
  })

  return Response.json(actualizado)
}
