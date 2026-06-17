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
  calcularPrestamo,
  pagoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'
import { getLocalDayRange, getLocalDateStr } from '@/lib/i18n'
import { getCachedMutation, setCachedMutation, buildMutationKey } from '@/lib/mutation-idempotency'

const REF_REVERSO_CANCELACION_DESEMBOLSO = 'prestamo_cancelado_reverso_desembolso'
const REF_REVERSO_CANCELACION_RECAUDO = 'prestamo_cancelado_reverso_recaudo'
const REF_CANCELACION_DEVOLVER_TODO = 'prestamo_cancelado_devolver_todo'
const REF_CANCELACION_DEVOLVER_RESTANTE = 'prestamo_cancelado_devolver_restante'

async function obtenerPrestamo(id, session) {
  const p = await prisma.prestamo.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, fotoUrl: true, rutaId: true, diasSinCobro: true, montoMaximoPrestamo: true, ruta: { select: { diasSinCobro: true } } } },
      pagos: {
        orderBy: { fechaPago: 'desc' },
        include: {
          cobrador: { select: { id: true, nombre: true } },
        },
      },
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
    },
  })
  if (!p) return null
  // Cobrador solo puede ver préstamos de clientes de su ruta
  if (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(p.cliente.rutaId)) return null
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

  // Idempotencia: si viene X-Mutation-Id y ya procesamos esta mutacion, devolver cache
  const mutationId = request.headers.get('x-mutation-id')
  const idempKey = mutationId ? buildMutationKey(session, mutationId, id) : null
  if (idempKey) {
    const cached = getCachedMutation(idempKey)
    if (cached) return Response.json(cached)
  }

  const p = await obtenerPrestamo(id, session)
  if (!p) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

  const ifUnmodifiedSince = request.headers.get('x-if-unmodified-since')
  if (ifUnmodifiedSince && p.updatedAt) {
    const baseMs = Date.parse(ifUnmodifiedSince)
    const actualMs = new Date(p.updatedAt).getTime()
    if (!isNaN(baseMs) && actualMs > baseMs + 1000) {
      return Response.json({ error: 'Conflicto: el registro fue modificado en el servidor.' }, { status: 412 })
    }
  }

  const body = await request.json()
  const { estado, modo, fechaFin: nuevaFechaFinRaw, diasExtra } = body

  // ─── Modo: marcar / desmarcar TARJETA CLAVO ─────────────────────
  if (typeof body.esClavo === 'boolean') {
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede marcar tarjetas clavo' }, { status: 403 })
    }
    if (p.estado !== 'activo') {
      return Response.json({ error: 'Solo se pueden marcar como clavo los préstamos activos' }, { status: 400 })
    }

    const marcar = body.esClavo === true
    const conPerdida = marcar && body.clavoPerdida === true
    const orgId = session.user.organizationId

    // Capital aun no recuperado (lo que falta volver a caja de lo prestado)
    const pagosReales = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
    const totalPagosReales = pagosReales.reduce((a, pg) => a + Number(pg.montoPagado || 0), 0)
    const capitalNoRecuperado = Math.max(0, Number(p.montoPrestado) - totalPagosReales)

    const REF_CLAVO_PERDIDA = 'clavo_perdida'

    const actualizado = await prisma.$transaction(async (tx) => {
      // Si se marca con perdida: registrar el capital no recuperado como egreso/ajuste
      if (conPerdida && capitalNoRecuperado > 0) {
        const yaRegistrado = await tx.movimientoCapital.findFirst({
          where: { organizationId: orgId, referenciaId: id, referenciaTipo: REF_CLAVO_PERDIDA },
          select: { id: true },
        })
        if (!yaRegistrado) {
          await registrarMovimientoCapital(tx, {
            organizationId: orgId,
            tipo: 'ajuste',
            monto: capitalNoRecuperado,
            descripcion: `Tarjeta clavo - pérdida de capital`,
            referenciaId: id,
            referenciaTipo: REF_CLAVO_PERDIDA,
            rutaId: p.cliente?.rutaId || null,
            creadoPorId: session.user.id,
            direccion: 'egreso',
          })
        }
      }
      // Si se DESMARCA y antes se registro perdida: revertir ese ajuste (ingreso)
      if (!marcar) {
        const perdidaPrevia = await tx.movimientoCapital.findFirst({
          where: { organizationId: orgId, referenciaId: id, referenciaTipo: REF_CLAVO_PERDIDA },
          orderBy: { createdAt: 'desc' },
          select: { id: true, monto: true },
        })
        if (perdidaPrevia) {
          await registrarMovimientoCapital(tx, {
            organizationId: orgId,
            tipo: 'ajuste',
            monto: perdidaPrevia.monto,
            descripcion: `Reverso pérdida tarjeta clavo (desmarcado)`,
            referenciaId: id,
            referenciaTipo: 'clavo_perdida_reverso',
            rutaId: p.cliente?.rutaId || null,
            creadoPorId: session.user.id,
            direccion: 'ingreso',
          })
        }
      }
      return tx.prestamo.update({
        where: { id },
        data: {
          esClavo: marcar,
          clavoAt: marcar ? new Date() : null,
          clavoPerdida: conPerdida,
        },
      })
    })

    logActividad({
      session,
      accion: marcar ? 'marcar_clavo' : 'desmarcar_clavo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: marcar
        ? `Marcado como tarjeta clavo${conPerdida ? ` (pérdida $${Math.round(capitalNoRecuperado).toLocaleString('es-CO')})` : ''} - ${p.cliente?.nombre || ''}`
        : `Quitado de tarjetas clavo - ${p.cliente?.nombre || ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({ ok: true, esClavo: marcar, clavoPerdida: conPerdida })
  }

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

    const respuesta = {
      ...actualizado,
      reversoCapitalAplicado: reversoAplicado,
      modoReversionCapitalAplicado: modoReversionSolicitado,
      montoReversionCapital: Math.round(montoReversion),
      totalPagadoReal: Math.round(totalPagosReales),
      saldoNoRecuperado: Math.round(saldoNoRecuperado),
    }
    if (idempKey) setCachedMutation(idempKey, respuesta)
    return Response.json(respuesta)
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

    // Rechazar cambio de frecuencia: el recalculo se basa en p.frecuencia actual.
    // Cambiar frecuencia a mitad de prestamo requeriria redistribuir pagos pasados.
    if (body?.frecuencia && body.frecuencia !== p.frecuencia) {
      return Response.json({
        error: `No se puede cambiar la frecuencia al extender. El préstamo es ${p.frecuencia}.`,
      }, { status: 400 })
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
      // Recalcular cuota redistribuyendo SOLO el saldo pendiente en los periodos restantes.
      // p.totalAPagar puede haber sido ya reducido por abonos a capital / descuentos;
      // ese valor es la fuente de verdad. La nueva cuota se calcula sobre el saldo
      // pendiente real para no cobrarle de mas al cliente.
      if (totalPeriodosNuevos <= 0) {
        return Response.json({ error: 'Plazo muy corto' }, { status: 400 })
      }

      const totalPagadoReal = p.pagos
        .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
        .reduce((a, pg) => a + pg.montoPagado, 0)
      const saldoPendienteActual = Math.max(0, p.totalAPagar - totalPagadoReal)

      // Periodos ya transcurridos desde fechaInicio hasta hoy (aproximado por calendario).
      const hoyUtc = new Date()
      const diasTranscurridos = Math.max(0, Math.floor((hoyUtc - fechaInicio) / (1000 * 60 * 60 * 24)))
      const periodosYaTranscurridos = Math.min(totalPeriodosNuevos, Math.floor(diasTranscurridos / diasPorPeriodo))
      const periodosRestantes = Math.max(1, totalPeriodosNuevos - periodosYaTranscurridos)

      const cuotaBase = saldoPendienteActual / periodosRestantes
      const nuevaCuota = Math.max(50, Math.round(cuotaBase / 50) * 50)
      // Nuevo total a pagar = lo ya pagado + cuotas futuras. No se puede bajar
      // del total pagado (evita pedirle al cliente devolver dinero).
      const nuevoTotalAPagar = Math.max(totalPagadoReal, totalPagadoReal + nuevaCuota * periodosRestantes)

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
    if (idempKey) setCachedMutation(idempKey, actualizado)
    return Response.json(actualizado)
  }

  // ─── Modo 2b: corregir fecha de INICIO (mantiene el plazo) ─────
  // Mueve fechaInicio y desplaza fechaFin la misma cantidad de dias para
  // conservar diasPlazo. NO toca cuota, total ni pagos. La mora / proximo
  // cobro / estado se recalculan solos al leer el prestamo.
  if (modo === 'corregirInicio') {
    const puedeGestionar = session.user.rol === 'owner'
      ? true
      : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))
    if (!puedeGestionar) {
      return Response.json({ error: 'No tienes permiso para corregir la fecha de inicio' }, { status: 403 })
    }
    if (p.estado !== 'activo') {
      return Response.json({ error: 'Solo se puede corregir la fecha de inicio de préstamos activos' }, { status: 400 })
    }

    const nuevaFechaInicioRaw = body.fechaInicio
    if (!nuevaFechaInicioRaw) {
      return Response.json({ error: 'La nueva fecha de inicio es requerida' }, { status: 400 })
    }
    const nuevaFechaInicio = new Date(nuevaFechaInicioRaw)
    if (isNaN(nuevaFechaInicio.getTime())) {
      return Response.json({ error: 'Fecha inválida' }, { status: 400 })
    }

    // No permitir fecha futura (la org en su timezone).
    const country = session.user.country || 'co'
    const { fin: finHoy } = getLocalDayRange(getLocalDateStr(country), country)
    if (nuevaFechaInicio >= finHoy) {
      return Response.json({ error: 'La fecha de inicio no puede ser futura' }, { status: 400 })
    }

    const inicioAnterior = new Date(p.fechaInicio)
    // Desplazar fechaFin la misma cantidad de dias (conserva diasPlazo).
    const deltaMs = nuevaFechaInicio.getTime() - inicioAnterior.getTime()
    const nuevaFechaFin = new Date(new Date(p.fechaFin).getTime() + deltaMs)

    const actualizado = await prisma.prestamo.update({
      where: { id },
      data: {
        fechaInicio: nuevaFechaInicio,
        fechaFin: nuevaFechaFin,
        // diasPlazo se mantiene; cuota/total/pagos intactos.
      },
    })

    logActividad({
      session,
      accion: 'editar_prestamo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: `Fecha de inicio corregida: ${inicioAnterior.toISOString().slice(0,10)}→${nuevaFechaInicio.toISOString().slice(0,10)} (fin: ${new Date(p.fechaFin).toISOString().slice(0,10)}→${nuevaFechaFin.toISOString().slice(0,10)})`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    if (idempKey) setCachedMutation(idempKey, actualizado)
    return Response.json(actualizado)
  }

  // ─── Modo 3: editar dia de cobro (ancla) ───────────────────────
  if (modo === 'diaCobro') {
    const puedeGestionar = session.user.rol === 'owner'
      ? true
      : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))
    if (!puedeGestionar) {
      return Response.json({ error: 'No tienes permiso para editar el día de cobro' }, { status: 403 })
    }
    if (p.estado !== 'activo') {
      return Response.json({ error: 'Solo se puede editar el día de cobro de préstamos activos' }, { status: 400 })
    }

    const freq = p.frecuencia || 'diario'
    const dataUpdate = {}

    if (freq === 'semanal' || freq === 'quincenal') {
      // Semanal/quincenal acepta dia de la semana O dia del mes (mutuamente excluyentes)
      if (body?.diaCobroMes !== undefined && body?.diaCobroMes !== null) {
        const v = Number(body.diaCobroMes)
        if (body.diaCobroMes === '' || body.diaCobroMes === null) {
          dataUpdate.diaCobroMes = null
          dataUpdate.diaCobroSemana = null
        } else if (!Number.isInteger(v) || v < 1 || v > 31) {
          return Response.json({ error: 'Día del mes inválido (1-31)' }, { status: 400 })
        } else {
          dataUpdate.diaCobroMes = v
          dataUpdate.diaCobroSemana = null
        }
      } else {
        const raw = body?.diaCobroSemana
        if (raw === null || raw === '' || raw === undefined) {
          dataUpdate.diaCobroSemana = null
          dataUpdate.diaCobroMes = null
        } else {
          const v = Number(raw)
          if (!Number.isInteger(v) || v < 0 || v > 6) {
            return Response.json({ error: 'Día de la semana inválido (0-6)' }, { status: 400 })
          }
          dataUpdate.diaCobroSemana = v
          dataUpdate.diaCobroMes = null
        }
      }
    } else if (freq === 'mensual') {
      const raw = body?.diaCobroMes
      if (raw === null || raw === '' || raw === undefined) {
        dataUpdate.diaCobroMes = null
      } else {
        const v = Number(raw)
        if (!Number.isInteger(v) || v < 1 || v > 31) {
          return Response.json({ error: 'Día del mes inválido (1-31)' }, { status: 400 })
        }
        dataUpdate.diaCobroMes = v
      }
    } else {
      return Response.json({ error: 'La frecuencia diaria no admite día ancla' }, { status: 400 })
    }

    const actualizado = await prisma.prestamo.update({ where: { id }, data: dataUpdate })
    logActividad({
      session,
      accion: 'editar_prestamo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: `Día de cobro actualizado (${freq})`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    if (idempKey) setCachedMutation(idempKey, actualizado)
    return Response.json(actualizado)
  }

  // ─── Modo 4: editar préstamo completo (mismo día) ─────────────────
  if (modo === 'editar') {
    const puedeGestionar = session.user.rol === 'owner'
      ? true
      : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))
    if (!puedeGestionar) {
      return Response.json({ error: 'No tienes permiso para editar este préstamo' }, { status: 403 })
    }
    if (p.estado !== 'activo') {
      return Response.json({ error: 'Solo se pueden editar préstamos activos' }, { status: 400 })
    }

    // Ventana de edición: solo el mismo día que se creó (timezone de la org).
    const country = session.user.country || 'co'
    const hoyLocal = getLocalDateStr(country)
    const { inicio: inicioDia, fin: finDia } = getLocalDayRange(hoyLocal, country)
    const creadoAt = new Date(p.createdAt)
    if (creadoAt < inicioDia || creadoAt >= finDia) {
      return Response.json({
        error: 'Solo se puede editar un préstamo el mismo día que se creó. Pasado ese día, cancela y crea uno nuevo.',
      }, { status: 400 })
    }

    const {
      montoPrestado: nuevoMonto,
      tasaInteres,
      diasPlazo,
      fechaInicio: fechaInicioRaw,
      frecuencia,
      modoInteres,
      cuotaManual,
      diaCobroSemana,
      diaCobroMes,
      seguro,
      montoSeguro,
      nombreProducto,
      diasSinCobro: nuevosDiasSinCobro,
    } = body

    const hayPagos = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).length > 0
    const montoAnterior = Number(p.montoPrestado)
    const montoNuevo = nuevoMonto != null ? Number(nuevoMonto) : montoAnterior
    const montoCambia = Math.abs(montoNuevo - montoAnterior) > 0.01

    if (montoCambia && hayPagos) {
      return Response.json({
        error: 'No se puede cambiar el monto porque ya hay pagos registrados. Puedes corregir tasa, plazo y frecuencia.',
      }, { status: 400 })
    }
    if (montoNuevo <= 0) {
      return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }

    // Recalcular cuota y total con los nuevos parámetros.
    const fechaInicioUsar = fechaInicioRaw ? new Date(fechaInicioRaw) : new Date(p.fechaInicio)
    const diasPlazoUsar   = diasPlazo ?? p.diasPlazo
    const frecuenciaUsar  = frecuencia ?? p.frecuencia
    const modoInteresUsar = modoInteres ?? p.modoInteres
    const cuotaManualUsar = cuotaManual != null ? Number(cuotaManual) : undefined

    // Si ya hay pagos, recalculamos sobre el saldo pendiente (igual que "extender").
    // Si no hay pagos, calculamos desde el monto completo.
    const montoParaCalculo = hayPagos ? calcularSaldoPendiente(p) : montoNuevo

    const calc = calcularPrestamo({
      montoPrestado: montoParaCalculo,
      tasaInteres:   tasaInteres ?? p.tasaInteres,
      diasPlazo:     diasPlazoUsar,
      fechaInicio:   fechaInicioUsar,
      frecuencia:    frecuenciaUsar,
      modoInteres:   modoInteresUsar,
      cuotaManual:   cuotaManualUsar,
    })

    const dataUpdate = {
      montoPrestado: montoNuevo,
      tasaInteres:   tasaInteres ?? p.tasaInteres,
      diasPlazo:     diasPlazoUsar,
      fechaInicio:   fechaInicioUsar,
      fechaFin:      calc.fechaFin,
      frecuencia:    frecuenciaUsar,
      modoInteres:   modoInteresUsar,
      cuotaDiaria:   calc.cuotaDiaria,
      // Si hay pagos, el total es lo ya pagado + el nuevo saldo recalculado.
      totalAPagar:   hayPagos
        ? (p.totalPagado || 0) + calc.totalAPagar
        : calc.totalAPagar,
      diaCobroSemana: diaCobroSemana !== undefined ? diaCobroSemana : p.diaCobroSemana,
      diaCobroMes:    diaCobroMes    !== undefined ? diaCobroMes    : p.diaCobroMes,
      seguro:         seguro !== undefined ? Boolean(seguro) : p.seguro,
      montoSeguro:    montoSeguro != null ? Number(montoSeguro) : p.montoSeguro,
      nombreProducto: nombreProducto !== undefined ? nombreProducto : p.nombreProducto,
      diasSinCobro:   nuevosDiasSinCobro !== undefined ? nuevosDiasSinCobro : p.diasSinCobro,
    }

    // Si el monto cambió, reversar el desembolso anterior y registrar el nuevo.
    const orgId = session.user.organizationId
    const rutaId = p.cliente?.rutaId || null

    const actualizado = await prisma.$transaction(async (tx) => {
      if (montoCambia) {
        // Reversar desembolso original.
        await registrarMovimientoCapital(tx, {
          organizationId: orgId,
          tipo: 'ajuste',
          direccion: 'ingreso',
          monto: montoAnterior,
          descripcion: `Reverso desembolso - edición préstamo (anterior $${Math.round(montoAnterior).toLocaleString('es-CO')})`,
          referenciaId: id,
          referenciaTipo: 'prestamo',
          rutaId,
          creadoPorId: session.user.id,
        })
        // Registrar nuevo desembolso.
        await registrarMovimientoCapital(tx, {
          organizationId: orgId,
          tipo: 'desembolso',
          monto: montoNuevo,
          descripcion: `Desembolso actualizado - edición préstamo ($${Math.round(montoNuevo).toLocaleString('es-CO')})`,
          referenciaId: id,
          referenciaTipo: 'prestamo',
          rutaId,
          creadoPorId: session.user.id,
        })
      }
      return tx.prestamo.update({ where: { id }, data: dataUpdate })
    })

    const cambiosMonto = montoCambia ? ` monto ${Math.round(montoAnterior).toLocaleString('es-CO')}→${Math.round(montoNuevo).toLocaleString('es-CO')}` : ''
    logActividad({
      session,
      accion: 'editar_prestamo',
      entidadTipo: 'prestamo',
      entidadId: id,
      detalle: `Préstamo editado el mismo día de creación.${cambiosMonto} cuota→${Math.round(calc.cuotaDiaria).toLocaleString('es-CO')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    if (idempKey) setCachedMutation(idempKey, actualizado)
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
    }

    // Reversar pagos reales y descuentos SIEMPRE que existan. Al cancelar un
    // prestamo solo se reversa el desembolso no recuperado, pero los recaudos
    // por pagos permanecen. Si luego se elimina el prestamo, los pagos se
    // borran pero sus MovimientoCapital quedan huerfanos inflando el capital
    // permanentemente. Aqui los reversamos.
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

    // 3. Eliminar pagos y préstamo
    await tx.pago.deleteMany({ where: { prestamoId: id } })
    await tx.prestamo.delete({ where: { id } })
  })

  logActividad({ session, accion: 'eliminar_prestamo', entidadTipo: 'prestamo', entidadId: id, detalle: `Préstamo de ${p.cliente.nombre} eliminado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({ ok: true, message: 'Préstamo eliminado' })
}
