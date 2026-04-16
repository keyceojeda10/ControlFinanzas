// app/api/prestamos/[id]/renovar/route.js
// Renueva un préstamo activo: liquida el saldo pendiente y crea uno nuevo.
// El cliente recibe en mano la diferencia (nuevoMonto - saldoPendiente).

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularPrestamo, calcularSaldoPendiente } from '@/lib/calculos'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { trackEvent }   from '@/lib/analytics'

async function cobradorPuedeGestionarPrestamos(userId) {
  const cobrador = await prisma.user.findUnique({
    where: { id: userId },
    select: { puedeGestionarPrestamos: true, puedeCrearPrestamos: true },
  })
  return Boolean(cobrador?.puedeGestionarPrestamos ?? cobrador?.puedeCrearPrestamos)
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const puedeGestionar = session.user.rol === 'owner'
    ? true
    : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))

  if (!puedeGestionar) {
    return Response.json({ error: 'No tienes permiso para renovar préstamos' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const { id: prestamoId } = await params

  const body = await request.json()
  const { montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia } = body

  const freq = frecuencia || 'diario'
  if (!['diario', 'semanal', 'quincenal', 'mensual'].includes(freq)) {
    return Response.json({ error: 'Frecuencia no válida' }, { status: 400 })
  }
  if (!montoPrestado || Number(montoPrestado) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }
  if (tasaInteres == null || tasaInteres === '' || Number(tasaInteres) < 0) {
    return Response.json({ error: 'La tasa de interés no es válida' }, { status: 400 })
  }
  if (!diasPlazo || Number(diasPlazo) <= 0) {
    return Response.json({ error: 'El plazo debe ser mayor a 0' }, { status: 400 })
  }
  if (!fechaInicio) {
    return Response.json({ error: 'La fecha de inicio es requerida' }, { status: 400 })
  }

  // Cargar préstamo original
  const original = await prisma.prestamo.findFirst({
    where: { id: prestamoId, organizationId },
    include: {
      cliente: { select: { id: true, nombre: true, rutaId: true } },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
    },
  })

  if (!original) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  if (session.user.rol === 'cobrador' && original.cliente.rutaId !== session.user.rutaId) {
    return Response.json({ error: 'No tienes acceso a este préstamo' }, { status: 403 })
  }
  if (original.estado !== 'activo') {
    return Response.json({ error: 'Solo se pueden renovar préstamos activos' }, { status: 400 })
  }

  const saldoPendiente = calcularSaldoPendiente(original)

  // El nuevo monto debe cubrir al menos el saldo pendiente
  if (Number(montoPrestado) < saldoPendiente) {
    return Response.json({
      error: `El nuevo monto debe ser al menos $${Math.round(saldoPendiente).toLocaleString('es-CO')} (saldo pendiente)`,
    }, { status: 400 })
  }

  // Calcular valores del préstamo nuevo
  const { totalAPagar, cuotaDiaria, fechaFin } = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq,
  })

  const diferencia = Number(montoPrestado) - saldoPendiente // lo que recibe en mano

  const orgConfig = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { capitalEstricto: true },
  })
  const modoEstricto = !!orgConfig?.capitalEstricto

  let faltanteCapital = 0
  let saldoCapitalActual = 0

  try {
  const nuevoPrestamo = await prisma.$transaction(async (tx) => {
    // Lock del capital ANTES de cualquier modificacion
    const capRow = await tx.$queryRaw`
      SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
    `
    const tieneCapital = Array.isArray(capRow) && capRow.length > 0
    const saldoCap = tieneCapital ? Number(capRow[0].saldo || 0) : 0

    // En modo estricto, validar que al liquidar + desembolsar no queda negativo.
    // Neto = diferencia entregada (montoNuevo - saldoLiquidado). El recaudo de
    // la liquidacion entra primero, pero validamos contra el neto real.
    if (modoEstricto && tieneCapital) {
      if (saldoCap < diferencia) {
        faltanteCapital = diferencia - saldoCap
        saldoCapitalActual = saldoCap
        throw new Error('CAPITAL_INSUFICIENTE')
      }
    }

    // 1. Liquidar el préstamo viejo: crear un pago tipo 'completo' por el saldo
    if (saldoPendiente > 0) {
      await tx.pago.create({
        data: {
          prestamoId,
          organizationId,
          cobradorId: userId,
          montoPagado: saldoPendiente,
          tipo: 'completo',
          nota: `Liquidación por renovación`,
          fechaPago: new Date(),
        },
      })
    }

    // 2. Marcar el préstamo viejo como completado
    await tx.prestamo.update({
      where: { id: prestamoId },
      data:  { estado: 'completado' },
    })

    // 3. Registrar recaudo del saldo liquidado en capital (si había saldo)
    if (saldoPendiente > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'recaudo',
        monto: saldoPendiente,
        descripcion: `Liquidación por renovación - ${original.cliente.nombre}`,
        referenciaId: prestamoId,
        referenciaTipo: 'pago',
        creadoPorId: userId,
      })
    }

    // 4. Crear el préstamo nuevo
    const nuevo = await tx.prestamo.create({
      data: {
        clienteId:     original.clienteId,
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

    // 5. Registrar desembolso del nuevo préstamo en capital
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      monto: Number(montoPrestado),
      descripcion: `Desembolso por renovación - ${original.cliente.nombre}`,
      referenciaId: nuevo.id,
      referenciaTipo: 'prestamo',
      creadoPorId: userId,
    })

    // 6. Asegurar que el cliente queda activo
    await tx.cliente.update({
      where: { id: original.clienteId },
      data:  { estado: 'activo' },
    })

    return nuevo
  })

  logActividad({
    session,
    accion: 'renovar_prestamo',
    entidadTipo: 'prestamo',
    entidadId: nuevoPrestamo.id,
    detalle: `Renovación: liquidó $${Math.round(saldoPendiente).toLocaleString('es-CO')}, nuevo préstamo $${Number(montoPrestado).toLocaleString('es-CO')}, entregó $${Math.round(diferencia).toLocaleString('es-CO')} - ${original.cliente.nombre}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  trackEvent({
    organizationId,
    userId,
    evento: 'renovar_prestamo',
    metadata: { montoNuevo: Number(montoPrestado), saldoLiquidado: saldoPendiente, diferencia },
  })

  return Response.json({
    id: nuevoPrestamo.id,
    saldoLiquidado: saldoPendiente,
    diferenciaEntregada: diferencia,
  }, { status: 201 })
  } catch (err) {
    if (err?.message === 'CAPITAL_INSUFICIENTE') {
      return Response.json({
        error: 'Capital insuficiente para renovar este préstamo',
        capitalInsuficiente: true,
        faltante: Math.round(faltanteCapital),
        saldoActual: Math.round(saldoCapitalActual),
      }, { status: 400 })
    }
    console.error('[POST /api/prestamos/[id]/renovar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
