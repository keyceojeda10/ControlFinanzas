// app/api/prestamos/[id]/pagos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularSaldoPendiente,
  calcularDiasMora,
  calcularPorcentajePagado,
  calcularEstadoCliente,
  calcularCapitalRestante,
  calcularProximoCobro,
  calcularCuotasPendientes,
  calcularCuotasEnMora,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
  pagoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { enviarPushOrg } from '@/lib/push'
import { trackEvent } from '@/lib/analytics'

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
      cliente: {
        select: {
          id: true,
          rutaId: true,
          diasSinCobro: true,
          ruta: { select: { diasSinCobro: true } },
        },
      },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
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

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  const body = await request.json()
  const { montoPagado, tipo, nota, diasAbonados, metodoPago, plataforma } = body

  let montoFinal = Number(montoPagado)

  if (diasAbonados && Number(diasAbonados) > 0) {
    montoFinal = Math.round(prestamo.cuotaDiaria * Number(diasAbonados))
  }

  if (!montoFinal || montoFinal <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }
  if (!['completo', 'parcial', 'capital', 'recargo', 'descuento'].includes(tipo)) {
    return Response.json({ error: 'El tipo de pago no es válido' }, { status: 400 })
  }

  // Recargo y descuento: solo owner puede hacerlo y requiere nota
  if (['recargo', 'descuento'].includes(tipo)) {
    if (rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede aplicar recargos o descuentos' }, { status: 403 })
    }
    if (!nota?.trim()) {
      return Response.json({ error: 'Debes indicar el motivo del ajuste' }, { status: 400 })
    }
  }

  const saldoActual = calcularSaldoPendiente(prestamo)

  // Validación específica para abono a capital
  if (tipo === 'capital') {
    const capitalRestante = calcularCapitalRestante(prestamo)
    if (montoFinal > capitalRestante) {
      return Response.json({
        error: `El abono a capital no puede superar el capital restante: $${Math.round(capitalRestante).toLocaleString('es-CO')}`,
      }, { status: 400 })
    }
  }

  // Descuento no puede superar el saldo pendiente
  if (tipo === 'descuento' && montoFinal > saldoActual) {
    return Response.json({
      error: `El descuento no puede superar el saldo pendiente: $${Math.round(saldoActual).toLocaleString('es-CO')}`,
    }, { status: 400 })
  }

  // Recargo no tiene límite de saldo; para pagos normales, limitar al saldo
  if (!['recargo', 'descuento'].includes(tipo)) {
    montoFinal = Math.min(montoFinal, saldoActual)
  }

  // Registrar pago y actualizar estados en transacción
  const resultado = await prisma.$transaction(async (tx) => {
    // 1. Crear el pago
    const metodoValido = ['efectivo', 'transferencia'].includes(metodoPago) ? metodoPago : null
    await tx.pago.create({
      data: {
        prestamoId,
        organizationId,
        cobradorId: userId,
        montoPagado: montoFinal,
        tipo,
        metodoPago: metodoValido,
        plataforma: metodoValido === 'transferencia' ? (plataforma?.trim() || null) : null,
        nota: nota?.trim() || null,
        fechaPago: new Date(),
      },
    })

    // 2. Leer el préstamo actualizado con todos los pagos
    let prestamoActualizado = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
      },
    })

    // 2b. Abono a capital: reducir totalAPagar por el ahorro de intereses
    // La tasa es mensual proporcional, así que el ahorro depende de los días restantes
    if (tipo === 'capital') {
      const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000) // Colombia
      const inicio = new Date(prestamo.fechaInicio)
      const diasTranscurridos = Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)))
      const diasRestantes = Math.max(0, prestamo.diasPlazo - diasTranscurridos)
      const mesesRestantes = diasRestantes / 30
      const ahorroInteres = Math.round(montoFinal * (prestamo.tasaInteres / 100) * mesesRestantes)
      const totalPagadoActual = prestamoActualizado.pagos
        .filter(p => !['recargo', 'descuento'].includes(p.tipo))
        .reduce((a, p) => a + p.montoPagado, 0)
      const nuevoTotal = Math.max(totalPagadoActual, prestamoActualizado.totalAPagar - ahorroInteres)
      await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar: nuevoTotal } })
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: { pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } } },
      })
    }

    // 2c. Recargo: incrementar totalAPagar
    if (tipo === 'recargo') {
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { totalAPagar: { increment: montoFinal } },
      })
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: { pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } } },
      })
    }

    // 2d. Descuento: decrementar totalAPagar (piso = total ya pagado)
    if (tipo === 'descuento') {
      const totalPagadoReal = prestamoActualizado.pagos
        .filter(p => !['recargo', 'descuento'].includes(p.tipo))
        .reduce((a, p) => a + p.montoPagado, 0)
      const nuevoTotal = Math.max(totalPagadoReal, prestamoActualizado.totalAPagar - montoFinal)
      await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar: nuevoTotal } })
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: { pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } } },
      })
    }

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
      include: { pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } } },
    })

    // Ajustar estado del préstamo actual en el array local
    const prestamosAjustados = todosLosPrestamos.map((p) =>
      p.id === prestamoId ? { ...p, estado: estadoPrestamo } : p
    )

    const diasExcluidosCliente = obtenerDiasSinCobro(prestamo.cliente, prestamo.cliente?.ruta, org)
    const nuevoEstadoCliente = calcularEstadoCliente(prestamosAjustados, diasExcluidosCliente)
    await tx.cliente.update({
      where: { id: prestamo.cliente.id },
      data:  { estado: nuevoEstadoCliente },
    })

    // Registrar recaudo en capital (solo pagos reales, no ajustes)
    if (!['recargo', 'descuento'].includes(tipo)) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'recaudo',
        monto: montoFinal,
        descripcion: tipo === 'capital' ? `Abono a capital - préstamo` : `Pago recibido - préstamo`,
        referenciaId: prestamoId,
        referenciaTipo: 'pago',
        creadoPorId: userId,
      })
    }

    return prestamoActualizado
  })

  // Devolver el préstamo completo enriquecido para actualizar la UI
  const prestamoFinal = await prisma.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          rutaId: true,
          diasSinCobro: true,
          ruta: { select: { diasSinCobro: true } },
        },
      },
      pagos: {
        orderBy: { fechaPago: 'desc' },
        include: { cobrador: { select: { id: true, nombre: true } } },
      },
    },
  })

  const diasExcluidosFinal = obtenerDiasSinCobro(prestamoFinal?.cliente, prestamoFinal?.cliente?.ruta, org)

  const tipoLabel = { completo: 'completo', parcial: 'parcial', capital: 'abono capital', recargo: 'recargo', descuento: 'descuento' }
  logActividad({ session, accion: 'registrar_pago', entidadTipo: 'pago', entidadId: prestamoId, detalle: `Pago ${tipoLabel[tipo] || tipo} $${montoFinal.toLocaleString('es-CO')}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId, evento: 'registrar_pago', metadata: { tipo, monto: montoFinal } })

  // Push notification: notificar al owner cuando un cobrador registra pago
  if (rol === 'cobrador') {
    enviarPushOrg(organizationId, {
      title: 'Pago registrado',
      body: `${session.user.nombre} cobró $${montoFinal.toLocaleString('es-CO')} — ${prestamoFinal.cliente.nombre}`,
      url: `/prestamos/${prestamoId}`,
    }).catch(() => {})
  }

  return Response.json({
    ...prestamoFinal,
    totalPagado:      prestamoFinal.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo)).reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(prestamoFinal),
    porcentajePagado: calcularPorcentajePagado(prestamoFinal),
    diasMora:         calcularDiasMora(prestamoFinal, diasExcluidosFinal),
    cuotasPendientes: calcularCuotasPendientes(prestamoFinal),
    cuotasEnMora:     calcularCuotasEnMora(prestamoFinal, diasExcluidosFinal),
    montoEnMora:      calcularMontoEnMora(prestamoFinal, diasExcluidosFinal),
    montoParaPonerseAlDia: calcularMontoParaPonerseAlDia(prestamoFinal, diasExcluidosFinal),
    proximoCobro:     calcularProximoCobro(prestamoFinal, diasExcluidosFinal),
    pagoHoy:          pagoHoy(prestamoFinal),
  }, { status: 201 })
}
