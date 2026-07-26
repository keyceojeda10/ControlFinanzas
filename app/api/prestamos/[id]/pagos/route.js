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
  tieneTablaAmortizacion,
  regenerarTablaAmortizacion,
  regenerarTablaAmortizacionDinamica,
  recalcularTablaDesdeSaldo,
  recalcularTablaSoloInteresDesdeSaldo,
  obtenerDiasPorPeriodo,
  calcularInteresesPendientes,
  obtenerProximaCuotaTabla,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { enviarPushOrg } from '@/lib/push'
import { trackEvent } from '@/lib/analytics'
import { getUtcOffset, getLocalDateStr, getLocalDayRange } from '@/lib/i18n'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { sanitizarCoords } from '@/lib/geo'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

async function cobradorPuedeGestionarPrestamos(userId) {
  const cobrador = await prisma.user.findUnique({
    where: { id: userId },
    select: { puedeGestionarPrestamos: true, puedeCrearPrestamos: true },
  })
  return Boolean(cobrador?.puedeGestionarPrestamos ?? cobrador?.puedeCrearPrestamos)
}

// Descuento y liquidacion REDUCEN lo que el cliente debe (riesgo de fraude del cobrador),
// por eso van detras de un permiso independiente, desactivado por defecto.
async function cobradorPuedeAplicarDescuentos(userId) {
  const cobrador = await prisma.user.findUnique({
    where: { id: userId },
    select: { puedeAplicarDescuentos: true },
  })
  return Boolean(cobrador?.puedeAplicarDescuentos)
}

// ─── POST /api/prestamos/[id]/pagos ─────────────────────────────
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Respaldo (defensa en profundidad) por si el JWT esta stale: el middleware
  // ya bloquea /api/* con suscripcion vencida, pero confirmamos contra DB.
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub

  const { rol, rutaIds = [], organizationId, id: userId } = session.user
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
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
    },
  })

  if (!prestamo) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  if (prestamo.estado !== 'activo') {
    return Response.json({ error: 'No se pueden registrar pagos en préstamos inactivos' }, { status: 400 })
  }

  // Cobrador: verificar que el cliente es de su ruta
  if (rol === 'cobrador' && !rutaIds.includes(prestamo.cliente.rutaId)) {
    return Response.json({ error: 'No tienes acceso a este préstamo' }, { status: 403 })
  }

  // Cobrador: si ya cerro su caja de hoy y nadie la reabrio, no puede registrar mas pagos.
  if (rol === 'cobrador') {
    const { inicio, fin } = getLocalDayRange(getLocalDateStr())
    const cierreHoy = await prisma.cierreCaja.findFirst({
      where: { organizationId, cobradorId: userId, fecha: { gte: inicio, lt: fin } },
      select: { reabiertoEn: true },
    })
    if (cierreHoy && !cierreHoy.reabiertoEn) {
      return Response.json({
        error: 'Ya cerraste tu caja de hoy. Reabre la caja desde la pantalla de Caja para seguir registrando pagos.',
      }, { status: 403 })
    }
  }

  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  const body = await request.json()
  const { montoPagado, tipo, nota, diasAbonados, metodoPago, plataforma, metodoPagoId, latitud, longitud } = body
  // Sanitizar coords del pago: si vienen fuera de rango, se guardan como null
  // (no rechazar el pago, MVP de geo es no-bloqueante).
  const coordsPago = sanitizarCoords(latitud, longitud)

  let montoFinal = Number(montoPagado)

  // Solo usar diasAbonados como fuente del monto si NO se envió montoPagado explícito.
  // Antes: si el usuario editaba el monto manualmente, el backend lo sobrescribía con
  // cuotaDiaria * diasAbonados, registrando un monto distinto al que el cobrador escribió.
  if (diasAbonados && Number(diasAbonados) > 0 && (!montoFinal || montoFinal <= 0)) {
    montoFinal = Math.round(prestamo.cuotaDiaria * Number(diasAbonados))
  }

  // Liquidacion puede ser monto 0: el cliente ya pago lo justo y solo se
  // perdona el interes futuro restante (cierre sin cobro adicional).
  if (tipo !== 'liquidacion' && (!montoFinal || montoFinal <= 0)) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }
  if (tipo === 'liquidacion' && (montoFinal == null || montoFinal < 0 || Number.isNaN(montoFinal))) {
    montoFinal = 0
  }
  if (!['completo', 'parcial', 'capital', 'recargo', 'descuento', 'liquidacion', 'intereses'].includes(tipo)) {
    return Response.json({ error: 'El tipo de pago no es válido' }, { status: 400 })
  }

  if (tipo === 'intereses') {
    if (!['lineal', 'solo_interes', 'lineal_dinamico'].includes(prestamo.modoInteres)) {
      return Response.json({ error: 'Pago a intereses solo aplica para préstamos con tabla de amortización' }, { status: 400 })
    }
    const interesesPendientes = Math.round(calcularInteresesPendientes(prestamo))
    if (interesesPendientes <= 0) {
      return Response.json({ error: 'No hay intereses pendientes para pagar' }, { status: 400 })
    }
    if (montoFinal > interesesPendientes) {
      montoFinal = interesesPendientes
    }
  }

  // Recargo, descuento y liquidacion requieren autorizacion + nota (auditoria).
  // - recargo: SUMA al saldo (no regala dinero) -> permiso de gestionar prestamos.
  // - descuento / liquidacion: REDUCEN el saldo (riesgo de fraude) -> permiso especifico.
  if (['recargo', 'descuento', 'liquidacion'].includes(tipo)) {
    let autorizado = rol === 'owner'
    if (!autorizado && rol === 'cobrador') {
      autorizado = (tipo === 'recargo')
        ? await cobradorPuedeGestionarPrestamos(userId)
        : await cobradorPuedeAplicarDescuentos(userId)
    }

    if (!autorizado) {
      return Response.json({ error: 'No tienes permiso para esta operación' }, { status: 403 })
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

  // Recargo no tiene límite de saldo; para pagos normales, limitar al saldo.
  // Liquidacion: el monto de cierre lo define el prestamista (puede ser < saldo
  // porque perdona interes futuro), no se topa al saldo.
  if (!['recargo', 'descuento', 'liquidacion'].includes(tipo)) {
    montoFinal = Math.min(montoFinal, saldoActual)
  }
  // La liquidacion no puede superar el saldo pendiente (no tiene sentido cobrar mas)
  if (tipo === 'liquidacion' && montoFinal > saldoActual) {
    montoFinal = Math.round(saldoActual)
  }

  // Idempotencia offline: si la nota incluye [offline:ISO], ese ISO es unique key.
  // Si ya existe un pago con esa misma nota en este prestamo, devolvemos el existente
  // (evita duplicados cuando el cliente reintenta tras timeout que sí persistió en DB).
  const offlineMatch = typeof nota === 'string' ? nota.match(/\[offline:([^\]]+)\]/) : null
  if (offlineMatch) {
    const existente = await prisma.pago.findFirst({
      where: {
        prestamoId,
        organizationId,
        nota: { contains: `[offline:${offlineMatch[1]}]` },
      },
      select: { id: true, fechaPago: true, montoPagado: true },
    })
    if (existente) {
      return Response.json({
        ok: true,
        idempotente: true,
        pagoId: existente.id,
        fechaPago: existente.fechaPago,
        montoPagado: existente.montoPagado,
      })
    }
  }

  // Detección de duplicado: mismo préstamo + mismo monto + mismo tipo en los últimos 60s
  const url = new URL(request.url)
  const confirmarDuplicado = url.searchParams.get('confirmarDuplicado') === '1'
  if (!confirmarDuplicado) {
    const hace60s = new Date(Date.now() - 60 * 1000)
    const reciente = await prisma.pago.findFirst({
      where: {
        prestamoId,
        organizationId,
        montoPagado: montoFinal,
        tipo,
        fechaPago: { gte: hace60s },
      },
      select: { id: true, fechaPago: true },
    })
    if (reciente) {
      return Response.json({
        error: 'Posible pago duplicado',
        duplicado: true,
        pagoReciente: { id: reciente.id, fechaPago: reciente.fechaPago },
      }, { status: 409 })
    }
  }

  // Registrar pago y actualizar estados en transacción
  let resultado
  try {
  resultado = await prisma.$transaction(async (tx) => {
    // 0. Lock del prestamo para evitar sobrepago por race condition.
    // Releemos totalAPagar y pagos DENTRO de la transaccion con FOR UPDATE.
    await tx.$queryRaw`
      SELECT id FROM Prestamo WHERE id = ${prestamoId} FOR UPDATE
    `
    const prestamoLocked = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
        cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      },
    })
    if (!prestamoLocked || prestamoLocked.estado !== 'activo') {
      throw new Error('PRESTAMO_NO_ACTIVO')
    }
    const saldoLocked = calcularSaldoPendiente(prestamoLocked)

    // Re-acotar el monto al saldo real ya committeado por otras tx.
    if (!['recargo', 'descuento'].includes(tipo)) {
      montoFinal = Math.min(montoFinal, saldoLocked)
      if (montoFinal <= 0) {
        throw new Error('SALDO_CERO')
      }
    }
    if (tipo === 'capital') {
      const capitalRestanteLocked = calcularCapitalRestante(prestamoLocked)
      if (montoFinal > capitalRestanteLocked) {
        montoFinal = capitalRestanteLocked
      }
      if (montoFinal <= 0) {
        throw new Error('CAPITAL_AGOTADO')
      }
    }
    if (tipo === 'descuento' && montoFinal > saldoLocked) {
      throw new Error('DESCUENTO_EXCEDE_SALDO')
    }

    // 1. Crear el pago. En liquidacion con monto 0 (el cliente ya pago lo justo
    // y solo se perdona el interes futuro) no se registra un pago de $0.
    const metodoValido = ['efectivo', 'transferencia'].includes(metodoPago) ? metodoPago : null
    const cuotaNumero = tieneTablaAmortizacion(prestamo) && !['recargo', 'descuento', 'liquidacion'].includes(tipo)
      ? obtenerProximaCuotaTabla(prestamo)?.numeroPeriodo ?? null
      : null
    if (!(tipo === 'liquidacion' && montoFinal === 0)) {
      await tx.pago.create({
        data: {
          prestamoId,
          organizationId,
          cobradorId: userId,
          montoPagado: montoFinal,
          tipo,
          metodoPago: metodoValido,
          plataforma: metodoValido === 'transferencia' ? (plataforma?.trim() || null) : null,
          metodoPagoId: metodoValido === 'transferencia' && metodoPagoId ? metodoPagoId : null,
          nota: nota?.trim() || null,
          cuotaNumero,
          fechaPago: new Date(),
          latitud: coordsPago.latitud,
          longitud: coordsPago.longitud,
        },
      })
    }

    // 1b. Refrescar totalPagado/ultimoPagoAt denormalizados del prestamo.
    await refrescarTotalesPrestamo(tx, prestamoId)

    // 2. Leer el préstamo actualizado con todos los pagos
    let prestamoActualizado = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: {
        pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
        cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      },
    })

    // 2b. Abono a capital: reducir totalAPagar por el ahorro de intereses
    // La tasa es mensual proporcional, así que el ahorro depende de los días restantes
    if (tipo === 'capital' && tieneTablaAmortizacion(prestamoActualizado)) {
      // Modo lineal: recalcular las cuotas futuras (no pagadas) sobre el nuevo
      // saldo de capital, manteniendo intacto lo ya pagado/devengado.
      const filas = [...prestamoActualizado.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
      const filasPagadas = filas.filter(f => (f.pagado || 0) >= f.cuotaTotal)
      const filasFuturas = filas.filter(f => (f.pagado || 0) < f.cuotaTotal)

      if (filasFuturas.length > 0) {
        // El abono a capital baja el capital DIRECTO por el monto abonado.
        // calcularCapitalRestante da el capital vivo ANTES de este abono (ya
        // refleja abonos anteriores y excluye los abonos de la cascada); le
        // restamos este abono. Antes se usaba tal cual y repartia el abono
        // primero en intereses, asi que casi no bajaba el capital.
        const capitalAntesDelAbono = calcularCapitalRestante(prestamoActualizado)
        const saldoCapitalRestante = Math.max(0, capitalAntesDelAbono - montoFinal)
        const ultimaPagada = filasPagadas[filasPagadas.length - 1]
        const fechaBase = ultimaPagada ? new Date(ultimaPagada.fechaEsperada) : new Date(prestamo.fechaInicio)
        const diasPeriodo = obtenerDiasPorPeriodo(prestamoActualizado.frecuencia)

        const recalcFn = prestamoActualizado.modoInteres === 'solo_interes'
          ? recalcularTablaSoloInteresDesdeSaldo
          : recalcularTablaDesdeSaldo
        const tablaRecalculada = recalcFn({
          saldoInicial: saldoCapitalRestante,
          tasaInteres: prestamoActualizado.tasaInteres,
          numPeriodosRestantes: filasFuturas.length,
          primerNumeroPeriodo: filasFuturas[0].numeroPeriodo,
          fechaBase,
          diasPeriodo,
          interesAdelantado: !!prestamoActualizado.interesAdelantado,
        })

        for (const fila of tablaRecalculada) {
          await tx.cuotaAmortizacion.update({
            where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
            data: {
              capital: fila.capital,
              interes: fila.interes,
              cuotaTotal: fila.cuotaTotal,
              saldoRestante: fila.saldoRestante,
              fechaEsperada: fila.fechaEsperada,
              pagado: 0,
            },
          })
        }

        // totalAPagar = cuotas ya pagadas completas + abonos a capital (que ya no
        // estan en la tabla futura porque bajaron el capital) + lo que falta.
        // Sin sumar los abonos, el totalAPagar quedaba por debajo de lo ya pagado.
        const totalPagadoEnPagadas = filasPagadas.reduce((a, f) => a + f.cuotaTotal, 0)
        const abonosCapitalTotal = (prestamoActualizado.pagos ?? [])
          .filter(p => p.tipo === 'capital')
          .reduce((a, p) => a + (p.montoPagado ?? 0), 0)
        const nuevoTotalAPagar = Math.round(
          totalPagadoEnPagadas + abonosCapitalTotal + tablaRecalculada.reduce((a, f) => a + f.cuotaTotal, 0)
        )
        await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar: nuevoTotalAPagar } })
      }

      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    } else if (tipo === 'capital') {
      const ahora = new Date(Date.now() - Math.abs(getUtcOffset(session.user.country ?? 'co')) * 60 * 60 * 1000)
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
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
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
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    }

    // 2d. Descuento: decrementar totalAPagar.
    // Rechazar si excede el espacio disponible (totalAPagar - totalPagadoReal):
    // antes se recortaba silenciosamente con Math.max, generando inconsistencia
    // contable porque el cobrador creia haber aplicado mas descuento del real.
    if (tipo === 'descuento') {
      const totalPagadoReal = prestamoActualizado.pagos
        .filter(p => !['recargo', 'descuento'].includes(p.tipo))
        .reduce((a, p) => a + p.montoPagado, 0)
      const espacioDescuento = prestamoActualizado.totalAPagar - totalPagadoReal
      if (montoFinal > espacioDescuento) {
        throw new Error(`DESCUENTO_EXCESIVO:${Math.round(espacioDescuento)}`)
      }
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { totalAPagar: prestamoActualizado.totalAPagar - montoFinal },
      })
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    }

    // 2e. Liquidacion anticipada: el cliente paga el cierre (capital + interes
    // devengado) que es MENOR al saldo pactado. Ajustamos totalAPagar para que
    // el saldo quede exactamente en 0, perdonando el interes futuro no devengado.
    let interesPerdonado = 0
    if (tipo === 'liquidacion') {
      const totalPagadoReal = prestamoActualizado.pagos
        .filter(p => !['recargo', 'descuento'].includes(p.tipo))
        .reduce((a, p) => a + p.montoPagado, 0)
      // interes que se perdona = lo que quedaba del total pactado por encima de lo pagado
      interesPerdonado = Math.max(0, Math.round(prestamoActualizado.totalAPagar - totalPagadoReal))
      // totalAPagar pasa a ser exactamente lo pagado -> saldo 0
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { totalAPagar: Math.round(totalPagadoReal) },
      })

      // Modo lineal: marcar todas las cuotas como pagadas (saldo queda en 0).
      if (tieneTablaAmortizacion(prestamoActualizado)) {
        for (const fila of prestamoActualizado.cuotasAmortizacion) {
          if ((fila.pagado || 0) < fila.cuotaTotal) {
            await tx.cuotaAmortizacion.update({
              where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
              data: { pagado: fila.cuotaTotal },
            })
          }
        }
      }

      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    }

    // 2f. Pago a intereses: distribuir monto a interesPagado de cuotas vencidas
    if (tipo === 'intereses' && tieneTablaAmortizacion(prestamoActualizado)) {
      const filasOrdenadas = [...prestamoActualizado.cuotasAmortizacion].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
      const ahora = new Date()
      let restante = montoFinal
      for (const fila of filasOrdenadas) {
        if (restante <= 0) break
        if (new Date(fila.fechaEsperada) > ahora) continue
        if ((fila.pagado || 0) >= fila.cuotaTotal) continue
        const interesNoPagado = Math.max(0, fila.interes - (fila.interesPagado || 0))
        if (interesNoPagado <= 0) continue
        const aplicar = Math.min(restante, interesNoPagado)
        await tx.cuotaAmortizacion.update({
          where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
          data: { interesPagado: (fila.interesPagado || 0) + aplicar },
        })
        restante -= aplicar
      }
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    }

    // 2g. Modo lineal: distribuir el total pagado real en cascada sobre la
    // tabla de amortizacion (cuota mas antigua primero). La liquidacion ya
    // marca todas las filas como pagadas arriba, no hace falta repetir aqui.
    // Pagos tipo intereses ya se distribuyeron a interesPagado, no a pagado.
    if (tipo !== 'liquidacion' && tipo !== 'intereses' && tieneTablaAmortizacion(prestamoActualizado) && prestamoActualizado.modoInteres !== 'lineal_dinamico') {
      const actualizaciones = regenerarTablaAmortizacion(prestamoActualizado)
      for (const fila of actualizaciones) {
        await tx.cuotaAmortizacion.update({
          where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
          data: { pagado: fila.pagado },
        })
      }
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
      })
    }

    // 2h. Modo lineal_dinamico: tras cada pago normal (completo/parcial), la
    // cuota en curso se llena (interes primero, luego capital) y las cuotas
    // futuras se RECALCULAN sobre el capital real restante (a diferencia de
    // 'lineal', donde la tabla queda fija). Liquidacion e intereses ya se
    // manejaron arriba y no deben re-procesarse aqui.
    if (['completo', 'parcial'].includes(tipo) && tieneTablaAmortizacion(prestamoActualizado) && prestamoActualizado.modoInteres === 'lineal_dinamico') {
      const { actualizaciones, totalAPagar: nuevoTotalAPagar } = regenerarTablaAmortizacionDinamica(prestamoActualizado)
      for (const fila of actualizaciones) {
        await tx.cuotaAmortizacion.update({
          where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
          data: {
            pagado: fila.pagado,
            ...(fila.capital !== undefined ? {
              capital: fila.capital,
              interes: fila.interes,
              cuotaTotal: fila.cuotaTotal,
              saldoRestante: fila.saldoRestante,
            } : {}),
          },
        })
      }
      if (nuevoTotalAPagar != null) {
        await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar: nuevoTotalAPagar } })
      }
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
        },
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
    const nuevoEstadoCliente = calcularEstadoCliente(prestamosAjustados, diasExcluidosCliente, festivos)
    await tx.cliente.update({
      where: { id: prestamo.cliente.id },
      data:  { estado: nuevoEstadoCliente },
    })

    // Registrar recaudo en capital (solo pagos reales > 0, no ajustes)
    if (!['recargo', 'descuento'].includes(tipo) && montoFinal > 0) {
      const descRecaudo = tipo === 'capital' ? `Abono a capital - préstamo`
        : tipo === 'liquidacion' ? `Liquidación anticipada - préstamo`
        : `Pago recibido - préstamo`
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'recaudo',
        monto: montoFinal,
        descripcion: descRecaudo,
        referenciaId: prestamoId,
        referenciaTipo: 'pago',
        rutaId: prestamo.cliente?.rutaId || null,
        creadoPorId: userId,
        metodoPago: metodoPago || null,
        metodoPagoId: metodoPagoId || null,
      })
    }

    // Descuento: refleja la perdida como ajuste negativo del capital
    if (tipo === 'descuento') {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: montoFinal,
        descripcion: `Descuento aplicado - préstamo${nota?.trim() ? ` (${nota.trim()})` : ''}`,
        referenciaId: prestamoId,
        referenciaTipo: 'pago',
        rutaId: prestamo.cliente?.rutaId || null,
        creadoPorId: userId,
        direccion: 'egreso',
      })
    }

    // Liquidacion: registrar el interes futuro PERDONADO como ajuste (egreso),
    // para que la contabilidad refleje cuanto se condono al cerrar anticipado.
    if (tipo === 'liquidacion' && interesPerdonado > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: interesPerdonado,
        descripcion: `Interés perdonado por pago anticipado - préstamo${nota?.trim() ? ` (${nota.trim()})` : ''}`,
        referenciaId: prestamoId,
        referenciaTipo: 'pago',
        rutaId: prestamo.cliente?.rutaId || null,
        creadoPorId: userId,
        direccion: 'egreso',
      })
    }

    return prestamoActualizado
  })
  } catch (err) {
    if (err?.message === 'PRESTAMO_NO_ACTIVO') {
      return Response.json({ error: 'El préstamo ya no está activo' }, { status: 400 })
    }
    if (err?.message === 'SALDO_CERO') {
      return Response.json({ error: 'El préstamo ya fue saldado por otro pago' }, { status: 409 })
    }
    if (err?.message === 'CAPITAL_AGOTADO') {
      return Response.json({ error: 'El capital del préstamo ya fue cubierto por otro abono' }, { status: 409 })
    }
    if (err?.message === 'DESCUENTO_EXCEDE_SALDO') {
      return Response.json({ error: 'El descuento excede el saldo pendiente actual' }, { status: 400 })
    }
    if (err?.message?.startsWith('DESCUENTO_EXCESIVO:')) {
      const espacio = err.message.split(':')[1]
      return Response.json({
        error: `El descuento excede el espacio disponible. Maximo permitido: $${Number(espacio).toLocaleString('es-CO')}`,
      }, { status: 400 })
    }
    console.error('[POST /api/prestamos/[id]/pagos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

  // Referencia explicita a `resultado` (usada por el flujo de retorno abajo).
  void resultado

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
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
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
    capitalRestante:  calcularCapitalRestante(prestamoFinal),
    porcentajePagado: calcularPorcentajePagado(prestamoFinal),
    diasMora:         calcularDiasMora(prestamoFinal, diasExcluidosFinal, festivos),
    cuotasPendientes: calcularCuotasPendientes(prestamoFinal),
    cuotasEnMora:     calcularCuotasEnMora(prestamoFinal, diasExcluidosFinal, festivos),
    montoEnMora:      calcularMontoEnMora(prestamoFinal, diasExcluidosFinal, festivos),
    montoParaPonerseAlDia: calcularMontoParaPonerseAlDia(prestamoFinal, diasExcluidosFinal, festivos),
    proximoCobro:     calcularProximoCobro(prestamoFinal, diasExcluidosFinal, festivos),
    pagoHoy:          pagoHoy(prestamoFinal),
  }, { status: 201 })
}
