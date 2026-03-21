// app/api/prestamos/[id]/pagos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularSaldoPendiente,
  calcularDiasMora,
  calcularPorcentajePagado,
  calcularEstadoCliente,
  pagoHoy,
} from '@/lib/calculos'
import { registrarMovimientoCapital } from '@/lib/capital'

// ─── POST /api/prestamos/[id]/pagos ─────────────────────────────
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { rol, rutaId, organizationId, id: userId } = session.user
  const { id: prestamoId } = await params

  // Obtener préstamo con cliente y pagos
  const prestamo = await prisma.prestamo.findFirst({
    where: { id: prestamoId, organizationId },
    include: {
      cliente: { select: { id: true, rutaId: true } },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true } },
    },
  })

  if (!prestamo) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  if (prestamo.estado !== 'activo') {
    return Response.json({ error: 'No se pueden registrar pagos en préstamos inactivos' }, { status: 400 })
  }

  // Cobrador: verificar que el cliente es de su ruta
  if (rol === 'cobrador' && prestamo.cliente.rutaId !== rutaId) {
    return Response.json({ error: 'No tienes acceso a este préstamo' }, { status: 403 })
  }

  const body = await request.json()
  const { montoPagado, tipo, nota, diasAbonados } = body

  let montoFinal = Number(montoPagado)

  if (diasAbonados && Number(diasAbonados) > 0) {
    montoFinal = prestamo.cuotaDiaria * Number(diasAbonados)
  }

  if (!montoFinal || montoFinal <= 0) {
    return Response.json({ error: 'El monto del pago debe ser mayor a 0' }, { status: 400 })
  }
  if (!['completo', 'parcial'].includes(tipo)) {
    return Response.json({ error: 'El tipo de pago no es válido' }, { status: 400 })
  }

  const saldoActual = calcularSaldoPendiente(prestamo)
  montoFinal = Math.min(montoFinal, saldoActual)

  // Registrar pago y actualizar estados en transacción
  const resultado = await prisma.$transaction(async (tx) => {
    // 1. Crear el pago
    await tx.pago.create({
      data: {
        prestamoId,
        organizationId,
        cobradorId: userId,
        montoPagado: montoFinal,
        tipo,
        nota: nota?.trim() || null,
        fechaPago: new Date(),
      },
    })

    // 2. Leer el préstamo actualizado con todos los pagos
    const prestamoActualizado = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        pagos: { select: { id: true, montoPagado: true, fechaPago: true } },
      },
    })

    const nuevoSaldo = calcularSaldoPendiente(prestamoActualizado)

    // 3. Si saldo = 0 → marcar préstamo como completado
    let estadoPrestamo = prestamoActualizado.estado
    if (nuevoSaldo <= 0) {
      estadoPrestamo = 'completado'
      await tx.prestamo.update({ where: { id: prestamoId }, data: { estado: 'completado' } })
    }

    // 4. Recalcular estado del cliente considerando TODOS sus préstamos activos
    const todosLosPrestamos = await tx.prestamo.findMany({
      where:   { clienteId: prestamo.cliente.id },
      include: { pagos: { select: { montoPagado: true, fechaPago: true } } },
    })

    // Ajustar estado del préstamo actual en el array local
    const prestamosAjustados = todosLosPrestamos.map((p) =>
      p.id === prestamoId ? { ...p, estado: estadoPrestamo } : p
    )

    const nuevoEstadoCliente = calcularEstadoCliente(prestamosAjustados)
    await tx.cliente.update({
      where: { id: prestamo.cliente.id },
      data:  { estado: nuevoEstadoCliente },
    })

    // Registrar recaudo en capital (si está configurado)
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'recaudo',
      monto: montoFinal,
      descripcion: `Pago recibido - préstamo`,
      referenciaId: prestamoId,
      referenciaTipo: 'pago',
      creadoPorId: userId,
    })

    return prestamoActualizado
  })

  // Devolver el préstamo completo enriquecido para actualizar la UI
  const prestamoFinal = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, rutaId: true } },
      pagos: {
        orderBy: { fechaPago: 'desc' },
        include: { cobrador: { select: { id: true, nombre: true } } },
      },
    },
  })

  return Response.json({
    ...prestamoFinal,
    totalPagado:      prestamoFinal.pagos.reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(prestamoFinal),
    porcentajePagado: calcularPorcentajePagado(prestamoFinal),
    diasMora:         calcularDiasMora(prestamoFinal),
    pagoHoy:          pagoHoy(prestamoFinal),
  }, { status: 201 })
}
