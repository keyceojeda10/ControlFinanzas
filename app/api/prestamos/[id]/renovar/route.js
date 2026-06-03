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
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'

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
  const { montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, modoInteres, seguro, montoSeguro } = body

  const freq = frecuencia || 'diario'
  // Modo de interes para la renovacion. Default 'fijo' (el modelo nuevo);
  // si el front lo manda explicito, se respeta.
  const modoRenovacion = ['fijo', 'unico', 'saldo', 'manual'].includes(modoInteres) ? modoInteres : 'fijo'
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
  if (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(original.cliente.rutaId)) {
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

  // Seguro opcional en la renovacion (mismo comportamiento que crear: se suma al total)
  const conSeguro = !!seguro
  const montoSeguroNum = conSeguro ? Number(montoSeguro) || 0 : 0
  if (montoSeguroNum < 0) {
    return Response.json({ error: 'El monto del seguro no puede ser negativo' }, { status: 400 })
  }

  // Calcular valores del préstamo nuevo.
  // IMPORTANTE: el seguro NO se suma a totalAPagar (igual que en crear normal);
  // se guarda en su campo `montoSeguro` aparte. Asi el saldo pendiente y el
  // cierre del prestamo se comportan identico a los prestamos normales.
  const { totalAPagar, cuotaDiaria, fechaFin } = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq, modoInteres: modoRenovacion,
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

    // 1. Saldar el préstamo viejo SIN registrar un "pago" de dinero.
    // IMPORTANTE: el saldo viejo NO es efectivo que recoja el cobrador (es un
    // "abono falso" si se contara). Por eso NO creamos un pago tipo 'completo'
    // (que inflaria el recaudado del dia y el cierre de caja). En su lugar
    // ajustamos totalAPagar del viejo = lo realmente pagado, para que su saldo
    // quede en 0, y lo marcamos completado. El saldo viejo se "absorbe" en el
    // prestamo nuevo (que se desembolsa por el monto total).
    if (saldoPendiente > 0) {
      const totalPagadoViejo = original.pagos
        .filter(p => !['recargo', 'descuento'].includes(p.tipo))
        .reduce((a, p) => a + p.montoPagado, 0)
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { totalAPagar: Math.round(totalPagadoViejo), estado: 'completado' },
      })
    } else {
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { estado: 'completado' },
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
        modoInteres:   modoRenovacion,    // persistir el modo usado en el calculo
        diasPlazo:     Number(diasPlazo),
        fechaInicio:   new Date(fechaInicio),
        fechaFin,
        seguro:        conSeguro,
        renovadoDeId:  prestamoId,         // vinculo de continuidad con el prestamo anterior
        ...(conSeguro && montoSeguroNum > 0 && { montoSeguro: montoSeguroNum }),
      },
    })

    // 5. Registrar en capital SOLO el efectivo real que sale: la diferencia
    // entregada en mano (monto nuevo - saldo viejo absorbido). El saldo viejo
    // no volvio a la caja ni salio, asi que NO se registra recaudo ni se
    // desembolsa el total. Esto mantiene el control de caja exacto (sin abono
    // falso). Si diferencia=0 (no entrego mas), no hay movimiento de caja.
    if (diferencia > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'desembolso',
        monto: diferencia,
        descripcion: `Desembolso por renovación - ${original.cliente.nombre}`,
        referenciaId: nuevo.id,
        referenciaTipo: 'prestamo',
        rutaId: original.cliente?.rutaId || null,
        creadoPorId: userId,
      })
    }

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
