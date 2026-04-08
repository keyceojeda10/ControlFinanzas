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
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'

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
    totalPagado:      p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
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

  logActividad({ session, accion: 'editar_prestamo', entidadTipo: 'prestamo', entidadId: id, detalle: `Estado cambiado a ${estado}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(actualizado)
}

// ─── DELETE /api/prestamos/[id] ────────────────────────────────────
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar préstamos' }, { status: 403 })
  }

  const { id } = await params
  const p = await obtenerPrestamo(id, session)
  if (!p) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

  const { organizationId } = session.user

  // Reversar capital y eliminar pagos + préstamo en transacción
  await prisma.$transaction(async (tx) => {
    // 1. Reversar desembolso original (ingreso al capital = el dinero vuelve)
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'ajuste',
      monto: p.montoPrestado,
      direccion: 'ingreso',
      descripcion: `Reverso desembolso - préstamo eliminado (${p.cliente.nombre})`,
      referenciaId: id,
      referenciaTipo: 'prestamo',
      creadoPorId: session.user.id,
    })

    // 2. Reversar cada pago real (egreso del capital)
    const pagosReales = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
    for (const pg of pagosReales) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: pg.montoPagado,
        direccion: 'egreso',
        descripcion: `Reverso recaudo - préstamo eliminado`,
        referenciaId: id,
        referenciaTipo: 'pago',
        creadoPorId: session.user.id,
      })
    }

    // 3. Eliminar pagos y préstamo
    await tx.pago.deleteMany({ where: { prestamoId: id } })
    await tx.prestamo.delete({ where: { id } })
  })

  logActividad({ session, accion: 'eliminar_prestamo', entidadTipo: 'prestamo', entidadId: id, detalle: `Préstamo de ${p.cliente.nombre} eliminado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({ ok: true, message: 'Préstamo eliminado' })
}
