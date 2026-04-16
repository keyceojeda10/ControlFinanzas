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

const REF_REVERSO_CANCELACION_DESEMBOLSO = 'prestamo_cancelado_reverso_desembolso'
const REF_REVERSO_CANCELACION_RECAUDO = 'prestamo_cancelado_reverso_recaudo'
const REF_CANCELACION_DEVOLVER_TODO = 'prestamo_cancelado_devolver_todo'
const REF_CANCELACION_DEVOLVER_RESTANTE = 'prestamo_cancelado_devolver_restante'

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

    if (p.estado === 'cancelado') {
      return Response.json({ error: 'Este préstamo ya está cancelado' }, { status: 400 })
    }

    const pagosReales = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
    const totalPagosReales = pagosReales.reduce((acc, pg) => acc + Number(pg.montoPagado || 0), 0)
    // Saldo aún no recuperado en caja: se acota por el saldo pendiente real del préstamo
    // (que ya considera abonos a capital que reducen totalAPagar). Así si el cliente abonó
    // $100k a capital, esa plata ya volvió a caja y no se cuenta como "restante a devolver".
    const saldoPendienteRestante = calcularSaldoPendiente(p)
    const saldoNoRecuperado = Math.max(0, Math.min(Number(p.montoPrestado) - totalPagosReales, saldoPendienteRestante))

    const modoReversionSolicitado = body?.modoReversionCapital === 'devolver_todo'
      ? 'devolver_todo'
      : body?.modoReversionCapital === 'devolver_restante'
        ? 'devolver_restante'
        : (totalPagosReales > 0 ? 'devolver_restante' : 'devolver_todo')

    const montoReversion = modoReversionSolicitado === 'devolver_todo'
      ? Number(p.montoPrestado)
      : saldoNoRecuperado

    const referenciaTipoCancelacion = modoReversionSolicitado === 'devolver_todo'
      ? REF_CANCELACION_DEVOLVER_TODO
      : REF_CANCELACION_DEVOLVER_RESTANTE

    const { actualizado, reversoAplicado } = await prisma.$transaction(async (tx) => {
      const reversoExistente = await tx.movimientoCapital.findFirst({
        where: {
          organizationId: session.user.organizationId,
          referenciaId: id,
          referenciaTipo: {
            in: [
              REF_REVERSO_CANCELACION_DESEMBOLSO,
              REF_REVERSO_CANCELACION_RECAUDO,
              REF_CANCELACION_DEVOLVER_TODO,
              REF_CANCELACION_DEVOLVER_RESTANTE,
            ],
          },
        },
        select: { id: true },
      })

      const actualizadoPrestamo = await tx.prestamo.update({
        where: { id },
        data: { estado },
      })

      let aplicoReverso = false

      if (!reversoExistente && montoReversion > 0) {
        await registrarMovimientoCapital(tx, {
          organizationId: session.user.organizationId,
          tipo: 'ajuste',
          monto: montoReversion,
          direccion: 'ingreso',
          descripcion: modoReversionSolicitado === 'devolver_todo'
            ? `Cancelación préstamo - devuelve todo a caja (${p.cliente.nombre})`
            : `Cancelación préstamo - devuelve solo pendiente (${p.cliente.nombre})`,
          referenciaId: id,
          referenciaTipo: referenciaTipoCancelacion,
          creadoPorId: session.user.id,
        })
        aplicoReverso = true
      }

      return { actualizado: actualizadoPrestamo, reversoAplicado: aplicoReverso }
    })

    logActividad({
      session,
      accion: 'editar_prestamo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: reversoAplicado
        ? `Estado cambiado a ${estado} con reverso de capital (${modoReversionSolicitado === 'devolver_todo' ? 'devolver todo' : 'devolver restante'}) por $${Math.round(montoReversion).toLocaleString('es-CO')}`
        : `Estado cambiado a ${estado} (reverso de capital ya existente)`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ...actualizado,
      reversoCapitalAplicado: reversoAplicado,
      modoReversionCapitalAplicado: modoReversionSolicitado,
      montoReversionCapital: Math.round(montoReversion),
      totalPagadoReal: Math.round(totalPagosReales),
      saldoNoRecuperado: Math.round(saldoNoRecuperado),
    })
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
  // Si el préstamo ya estaba cancelado, la reversión de capital ya se aplicó
  // al cancelarlo. Solo eliminamos los registros sin tocar capital.
  const estabaCancelado = p.estado === 'cancelado'

  await prisma.$transaction(async (tx) => {
    if (!estabaCancelado) {
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

      // 2b. Reversar descuentos aplicados (ingreso = devuelve lo descontado al capital)
      const descuentos = p.pagos.filter(pg => pg.tipo === 'descuento')
      for (const pg of descuentos) {
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'ajuste',
          monto: pg.montoPagado,
          direccion: 'ingreso',
          descripcion: `Reverso descuento - préstamo eliminado`,
          referenciaId: id,
          referenciaTipo: 'pago',
          creadoPorId: session.user.id,
        })
      }
    }

    // 3. Eliminar pagos y préstamo
    await tx.pago.deleteMany({ where: { prestamoId: id } })
    await tx.prestamo.delete({ where: { id } })
  })

  logActividad({ session, accion: 'eliminar_prestamo', entidadTipo: 'prestamo', entidadId: id, detalle: `Préstamo de ${p.cliente.nombre} eliminado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({ ok: true, message: 'Préstamo eliminado' })
}
