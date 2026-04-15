// app/api/prestamos/[id]/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  calcularProximoCobro,
  calcularCuotasPendientes,
  calcularCuotasEnMora,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
  pagoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'

async function obtenerPrestamo(id, session) {
  const p = await prisma.prestamo.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, rutaId: true, diasSinCobro: true, ruta: { select: { diasSinCobro: true } } } },
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

async function cobradorPuedeGestionarPrestamos(userId) {
  const cobrador = await prisma.user.findUnique({
    where: { id: userId },
    select: { puedeGestionarPrestamos: true, puedeCrearPrestamos: true },
  })
  return Boolean(cobrador?.puedeGestionarPrestamos ?? cobrador?.puedeCrearPrestamos)
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

  // Resolver días sin cobro
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { diasSinCobro: true },
  })
  const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)

  return Response.json({
    ...p,
    totalPagado:      p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    diasMora:         calcularDiasMora(p, diasExcluidos),
    cuotasPendientes: calcularCuotasPendientes(p),
    cuotasEnMora:     calcularCuotasEnMora(p, diasExcluidos),
    montoEnMora:      calcularMontoEnMora(p, diasExcluidos),
    montoParaPonerseAlDia: calcularMontoParaPonerseAlDia(p, diasExcluidos),
    pagoHoy:          pagoHoy(p),
    proximoCobro:     calcularProximoCobro(p, diasExcluidos),
  })
}

// ─── PATCH /api/prestamos/[id] ──────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const p = await obtenerPrestamo(id, session)
  if (!p) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

  const body = await request.json()
  const { estado, modo, fechaFin: nuevaFechaFinRaw, diasExtra } = body

  // ─── Modo 1: cambio de estado (cancelar) ────────────────────────
  if (estado) {
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede cambiar el estado del préstamo' }, { status: 403 })
    }
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

  // ─── Modo 2: modificar plazo (extender o corregir fecha) ───────
  if (modo === 'extender' || modo === 'corregir') {
    const puedeGestionar = session.user.rol === 'owner'
      ? true
      : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))

    if (!puedeGestionar) {
      return Response.json({ error: 'No tienes permiso para modificar el plazo del préstamo' }, { status: 403 })
    }

    if (p.estado !== 'activo') {
      return Response.json({ error: 'Solo se puede modificar el plazo de préstamos activos' }, { status: 400 })
    }
    if (!nuevaFechaFinRaw) {
      return Response.json({ error: 'La nueva fecha de finalización es requerida' }, { status: 400 })
    }

    const fechaInicio = new Date(p.fechaInicio)
    const nuevaFechaFin = new Date(nuevaFechaFinRaw)
    if (isNaN(nuevaFechaFin.getTime())) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }
    if (nuevaFechaFin <= fechaInicio) {
      return Response.json({ error: 'La nueva fecha debe ser posterior a la fecha de inicio' }, { status: 400 })
    }

    // Días totales del nuevo plazo
    const nuevoDiasPlazo = Math.round((nuevaFechaFin - fechaInicio) / (1000 * 60 * 60 * 24))
    if (nuevoDiasPlazo <= 0) {
      return Response.json({ error: 'El plazo debe ser mayor a 0 días' }, { status: 400 })
    }

    const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[p.frecuencia] || 1
    const totalPeriodosNuevos = Math.ceil(nuevoDiasPlazo / diasPorPeriodo)

    const dataUpdate = {
      diasPlazo: nuevoDiasPlazo,
      fechaFin:  nuevaFechaFin,
    }
    let detalleLog = ''

    if (modo === 'extender') {
      // Recalcular cuota redistribuyendo el saldo pendiente en los periodos restantes
      // - totalAPagar se mantiene (no se cobran intereses extra, solo se estira el plazo)
      // - cuota nueva = totalAPagar / totalPeriodosNuevos (redondeada a múltiplo de 50)
      if (totalPeriodosNuevos <= 0) {
        return Response.json({ error: 'Plazo muy corto' }, { status: 400 })
      }
      const cuotaBase = p.totalAPagar / totalPeriodosNuevos
      const nuevaCuota = Math.max(50, Math.round(cuotaBase / 50) * 50)
      // Ajustar totalAPagar para que cierre exacto con la cuota redondeada
      const nuevoTotalAPagar = nuevaCuota * totalPeriodosNuevos

      // El nuevo total no puede ser menor a lo ya pagado
      const totalPagadoReal = p.pagos
        .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
        .reduce((a, pg) => a + pg.montoPagado, 0)
      if (nuevoTotalAPagar < totalPagadoReal) {
        return Response.json({ error: 'El nuevo total no puede ser menor a lo ya pagado' }, { status: 400 })
      }

      dataUpdate.cuotaDiaria = nuevaCuota
      dataUpdate.totalAPagar = nuevoTotalAPagar
      detalleLog = `Plazo extendido: ${p.diasPlazo}→${nuevoDiasPlazo} días, cuota ${Math.round(p.cuotaDiaria).toLocaleString('es-CO')}→${nuevaCuota.toLocaleString('es-CO')}`
    } else {
      // Corregir: solo cambia fechas, no toca cuota ni total
      detalleLog = `Fecha fin corregida: ${new Date(p.fechaFin).toISOString().slice(0,10)}→${nuevaFechaFin.toISOString().slice(0,10)}`
    }

    const actualizado = await prisma.prestamo.update({
      where: { id },
      data: dataUpdate,
    })

    logActividad({
      session,
      accion: 'editar_prestamo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: detalleLog,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    return Response.json(actualizado)
  }

  return Response.json({ error: 'Operación no válida' }, { status: 400 })
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
