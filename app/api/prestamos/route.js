// app/api/prestamos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularPrestamo,
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  pagoHoy,
} from '@/lib/calculos'

// ─── GET /api/prestamos ─────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaId } = session.user
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')
  const estado    = searchParams.get('estado')
  const buscar    = searchParams.get('buscar')?.trim()

  // Filtro de cliente (cobrador → solo su ruta)
  const filtroCliente = rol === 'cobrador' && rutaId
    ? { rutaId }
    : {}

  const where = {
    organizationId,
    ...(clienteId && { clienteId }),
    ...(estado    && { estado }),
    ...(buscar    && {
      cliente: {
        OR: [
          { nombre: { contains: buscar } },
          { cedula: { contains: buscar } },
        ],
      },
    }),
    ...(rol === 'cobrador' && rutaId && {
      cliente: { ...filtroCliente },
    }),
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, rutaId: true } },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const resultado = prestamos.map((p) => ({
    id:               p.id,
    clienteId:        p.clienteId,
    cliente:          p.cliente,
    montoPrestado:    p.montoPrestado,
    totalAPagar:      p.totalAPagar,
    cuotaDiaria:      p.cuotaDiaria,
    frecuencia:       p.frecuencia,
    tasaInteres:      p.tasaInteres,
    diasPlazo:        p.diasPlazo,
    fechaInicio:      p.fechaInicio,
    fechaFin:         p.fechaFin,
    estado:           p.estado,
    totalPagado:      p.pagos.reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    diasMora:         calcularDiasMora(p),
    pagoHoy:          pagoHoy(p),
  }))

  return Response.json(resultado)
}

// ─── POST /api/prestamos ────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede crear préstamos' }, { status: 403 })
  }

  const { organizationId } = session.user
  const body = await request.json()
  const { clienteId, montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia } = body

  const freq = frecuencia || 'diario'
  const frecuenciasValidas = ['diario', 'semanal', 'quincenal', 'mensual']
  if (!frecuenciasValidas.includes(freq)) {
    return Response.json({ error: 'Frecuencia no válida' }, { status: 400 })
  }

  // Validaciones
  if (!clienteId)     return Response.json({ error: 'El cliente es requerido' },          { status: 400 })
  if (!montoPrestado) return Response.json({ error: 'El monto es requerido' },            { status: 400 })
  if (!tasaInteres)   return Response.json({ error: 'La tasa de interés es requerida' },  { status: 400 })
  if (!diasPlazo)     return Response.json({ error: 'El plazo es requerido' },            { status: 400 })
  if (!fechaInicio)   return Response.json({ error: 'La fecha de inicio es requerida' },  { status: 400 })

  if (Number(montoPrestado) <= 0) return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  if (Number(tasaInteres)   <= 0) return Response.json({ error: 'La tasa debe ser mayor a 0' },  { status: 400 })
  if (Number(diasPlazo)     <= 0) return Response.json({ error: 'El plazo debe ser mayor a 0' }, { status: 400 })

  // Verificar que el cliente pertenece a la organización
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Calcular valores del préstamo
  const { totalAPagar, cuotaDiaria, fechaFin } = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq,
  })

  // Crear préstamo y actualizar estado del cliente en transacción
  const prestamo = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.prestamo.create({
      data: {
        clienteId,
        organizationId,
        montoPrestado: Number(montoPrestado),
        tasaInteres:   Number(tasaInteres),
        totalAPagar,
        cuotaDiaria,
        frecuencia:    freq,
        diasPlazo:     Number(diasPlazo),
        fechaInicio:   new Date(fechaInicio),
        fechaFin,
      },
    })

    // Actualizar estado del cliente a activo
    await tx.cliente.update({
      where: { id: clienteId },
      data:  { estado: 'activo' },
    })

    return nuevo
  })

  return Response.json(prestamo, { status: 201 })
}
