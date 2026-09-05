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
  capitalVivoSegunTabla,
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
  recalcularTablaSaldoDesdeSaldo,
  obtenerDiasPorPeriodo,
  interesCobrableAhora,
  obtenerProximaCuotaTabla,
  siguientePeriodo,
  esAbiertoConDevengo,
  periodoEnCursoAbierto,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { enviarPushOrg } from '@/lib/push'
import { trackEvent } from '@/lib/analytics'
import { getUtcOffset, getLocalDateStr, getLocalDayRange } from '@/lib/i18n'
import { marcadorOffline, resolverFechaDelPago } from '@/lib/pagos-sin-senal'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { sanitizarCoords } from '@/lib/geo'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { partirFilasParaAbono, capitalParaFuturas } from '@/lib/dinero/abono-capital'
import { elInteresSubeLaDeuda } from '@/lib/dinero/modos'

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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
      /* ⚠ SOLO AQUÍ Y EN LA LECTURA FINAL, LAS DOS FUERA DE LA TRANSACCIÓN.
         Lo metí en las TRECE consultas de esta ruta con un reemplazo global, y
         once caían DENTRO del `$transaction`: once viajes más a la base por
         cada pago. La transacción pasó de caber en sus 5 segundos a tardar
         5,35 y el abono a capital empezó a dar 500 — reproducible, tres de
         tres. El cálculo solo necesita los devengos para construir la
         respuesta, no para escribir. */
      devengos: { select: { periodo: true, interes: true, capitalBase: true }, orderBy: { periodo: 'asc' } },
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
  const { montoPagado, tipo, nota, diasAbonados, metodoPago, plataforma, metodoPagoId, latitud, longitud, aplazarUnPeriodo, fechaPago: fechaPagoCuerpo, offlineId } = body
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

  // ── PAGO DE SOLO INTERÉS · DOS CAMINOS QUE NO SE PUEDEN MEZCLAR ───────────
  //
  // CON tabla: el interés vencido existe fila por fila. Ya estaba pactado, así
  // que la deuda NO sube y el monto tiene tope. Es lo de siempre.
  //
  // SIN tabla (clásico y compañía, ~93% de la cartera): el interés viene DENTRO
  // de `totalAPagar` desde el primer día y no hay un saldo de interés aparte que
  // cobrar. Aquí «me pagó solo el interés» significa otra cosa: el cliente compra
  // tiempo, el capital no se mueve y el interés es NUEVO. Por eso sube la deuda.
  // Decidido con el dueño el 2 ago 2026.
  //
  // El monto lo pone el prestamista porque es lo que pactó con ESE cliente: el
  // sistema no lo sabe y adivinarlo sería inventar una cifra en la pantalla que
  // registra plata.
  if (tipo === 'intereses') {
    if (elInteresSubeLaDeuda(prestamo)) {
      // Tope de cordura: un dedazo no puede disparar la deuda. Nadie cobra de
      // interés más de lo que prestó; si pasa de ahí es un error de tecleo.
      const tope = Math.round(Number(prestamo.montoPrestado) || 0)
      if (tope > 0 && montoFinal > tope) {
        return Response.json({
          error: `El interés no puede pasar de ${tope}, que es lo que prestaste. Revisa el monto.`,
        }, { status: 400 })
      }
    } else {
      /* ⚠ SE MIRA LO COBRABLE HOY, NO SOLO LO VENCIDO.
       *
       * Antes esto era `calcularInteresesPendientes`, que solo suma las cuotas
       * cuya fecha ya llegó. A quien le pagan el interés de la quincena ANTES
       * de que caiga le salía «No hay intereses pendientes para pagar» y tenía
       * que llevar esos clientes en un cuaderno aparte. Lo reportó Crediya el
       * 14 de agosto y le pasaba todas las quincenas.
       *
       * `interesCobrableAhora` suma además el interés de la cuota que viene:
       * exactamente lo que el cliente está adelantando, ni un peso más. */
      const cobrable = Math.round(interesCobrableAhora(prestamo))
      if (cobrable <= 0) {
        return Response.json({
          error: 'Este préstamo no tiene interés por cobrar: está todo pagado.',
        }, { status: 400 })
      }
      /* ⚠ Y SE AVISA EN VEZ DE RECORTAR EN SILENCIO.
       *
       * Antes, pedir $75.000 cuando cabían $50.000 registraba $50.000 y no
       * decía nada: el cliente entregaba una plata y quedaba anotada otra. Es
       * la mitad de la queja de Crediya —«que yo pueda definir sin
       * limitaciones»—: el sistema decidía por él y encima callado. */
      if (montoFinal > cobrable) {
        return Response.json({
          error: `De interés se le puede recibir hasta ${cobrable}. Si le entregó más, lo que sobra va como abono a capital.`,
        }, { status: 400 })
      }
    }
  }

  // El pago de solo interés SIN tabla sube `totalAPagar`, o sea sube la deuda de
  // un cliente real. Eso pide el mismo permiso que el recargo, que es la otra
  // operación que la sube. NO se le exige nota: el recargo es un ajuste que hay
  // que justificar, y esto es un cobro corriente —el cliente entregó plata— que
  // se hace en la puerta y con una mano.
  if (tipo === 'intereses' && elInteresSubeLaDeuda(prestamo)) {
    const autorizado = rol === 'owner'
      || (rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(userId))
    if (!autorizado) {
      return Response.json({ error: 'No tienes permiso para registrar pagos de solo interés' }, { status: 403 })
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
    // El tope es el capital que dice la tabla, sin descontar abonos anteriores
    // dos veces. Ver `capitalVivoSegunTabla`.
    const capitalRestante = capitalVivoSegunTabla(prestamo)
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
  /* La liquidacion no puede superar el saldo pendiente (no tiene sentido cobrar
     mas) — salvo en un ABIERTO, donde el interes del periodo que esta corriendo
     todavia no esta en el saldo: la deuda solo sube cuando el periodo cierra.
     Sin este techo mas alto, cerrar hoy un prestamo de 18 dias cobraba capital
     pelado, que es justo el hueco reportado el 26 ago 2026. */
  const techoLiquidacion = saldoActual + (esAbiertoConDevengo(prestamo)
    ? (periodoEnCursoAbierto(prestamo)?.interesPeriodo ?? 0)
    : 0)
  if (tipo === 'liquidacion' && montoFinal > techoLiquidacion) {
    montoFinal = Math.round(techoLiquidacion)
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

  /* ══ COBROS QUE SUBEN DESDE LA COLA SIN SEÑAL ═══════════════════════════════
   *
   * Llegan con `offlineId` (la hora en que se guardaron en el teléfono) y con
   * `fechaPago` (esa misma hora). Ver `lib/pagos-sin-senal.js`. Tres reglas:
   *
   *  1 · MISMO COBRO DOS VECES = UNA VEZ. Un reintento tras un timeout que sí
   *      persistió creaba el pago dos veces; ahora el marcador en la nota lo
   *      reconoce y contesta 200 sin crear nada.
   *  2 · SIN EL 409 DE «DUPLICADO». Dos cuotas iguales cobradas sin señal en
   *      días distintos subían seguidas y la segunda moría como duplicado —y
   *      como el teléfono no tenía «Reintentar», se perdía—. Cada cobro de la
   *      cola lo confirmó una persona en su momento; el marcador distingue uno
   *      del otro.
   *  3 · LA FECHA REAL. El abono del jueves a las 7:43 pm es plata del jueves,
   *      no del viernes a las 12:03 cuando hubo señal: caja, mora y «al día»
   *      lo leen de `fechaPago`. Una sola excepción: si es un cobrador y la
   *      caja de ESE día ya está cerrada, se registra con hoy y la nota lo
   *      dice — meter plata en una caja cerrada la descuadra sin que nadie se
   *      entere. */
  // ⚠ La regla 1 YA vive más arriba (la idempotencia por `[offline:…]` en la
  // nota, que contesta `idempotente: true`); aquí no se repite. El marcador se
  // usa para las reglas 2 y 3.
  const marcador = offlineId ? marcadorOffline(String(offlineId)) : null
  let fechaDelPago = new Date()
  let notaFinal = nota
  if (marcador) {
    const r = resolverFechaDelPago({ fechaPago: fechaPagoCuerpo, ahora: fechaDelPago })
    fechaDelPago = r.fecha
    if (!r.motivo && rol === 'cobrador') {
      // Mismo convenio que más abajo: la hora local es UTC menos el desfase.
      const diaReal = new Date(fechaDelPago.getTime() - Math.abs(getUtcOffset(session.user.country ?? 'co')) * 60 * 60 * 1000).toISOString().slice(0, 10)
      if (diaReal !== getLocalDateStr(session.user.country ?? 'co')) {
        const { inicio, fin } = getLocalDayRange(diaReal, session.user.country ?? 'co')
        const cierreEseDia = await prisma.cierreCaja.findFirst({
          where: { organizationId, cobradorId: userId, fecha: { gte: inicio, lt: fin } },
          select: { reabiertoEn: true },
        })
        if (cierreEseDia && !cierreEseDia.reabiertoEn) {
          fechaDelPago = new Date()
          notaFinal = `${nota ? nota + ' · ' : ''}cobrado el ${diaReal.split('-').reverse().join('/')}; la caja de ese día ya estaba cerrada`
        }
      }
    }
  }

  // Detección de duplicado: mismo préstamo + mismo monto + mismo tipo en los últimos 60s
  const url = new URL(request.url)
  const confirmarDuplicado = url.searchParams.get('confirmarDuplicado') === '1'
  if (!confirmarDuplicado && !marcador) {
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
    const incluirParaLock = {
      pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      /* Los devengos: sin ellos no se sabe que periodo esta corriendo ni cuanto
         capital queda vivo en un abierto, y la decision se toma mal EN SILENCIO
         — ver [[feedback_verificar_prisma_select]]. */
      devengos: { select: { periodo: true, interes: true, capitalBase: true }, orderBy: { periodo: 'asc' } },
    }
    let prestamoLocked = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: incluirParaLock,
    })
    if (!prestamoLocked || prestamoLocked.estado !== 'activo') {
      throw new Error('PRESTAMO_NO_ACTIVO')
    }

    /* ══ COBRAR EL PERIODO QUE ESTA CORRIENDO ADELANTA EL CORTE ══════════════
     *
     * En un abierto la deuda solo sube cuando el periodo cierra. Si el
     * prestamista cobra hoy el interes del mes en curso —«hay veces que se
     * pasan dieciocho dias y el no quiere cobrar dieciocho dias de interes como
     * prorrateo, sino les cobra directamente el mes», 26 ago 2026— ese periodo
     * hay que ASENTARLO AHORA: si no, el pago bajaria el saldo por debajo del
     * capital y el prestamo diria que se debe menos de lo que se presto.
     *
     * Se asienta con la fecha de cierre como clave, la misma que usaria el
     * cron: cuando llegue el dia vera el periodo puesto y no lo cobrara dos
     * veces. Es la clave unica que ya evito el desastre de la linea de credito.
     *
     * ⚠ CUANTO SE ASIENTA DEPENDE DE SI EL PRESTAMO SIGUE VIVO:
     *   · cobrando interes — el periodo ENTERO. Se cierra por su valor real; si
     *     el cliente entrego menos, queda debiendo la diferencia. Asentar solo
     *     lo cobrado REGALARIA los dias que faltan, porque la clave unica
     *     impide volver a tocar ese periodo.
     *   · liquidando — solo lo que se cobra. El prestamo se cierra ahi y los
     *     dias que no corrieron no llegan a nacer: es exactamente la modalidad
     *     «proporcional» de la pantalla de liquidacion. */
    if (['intereses', 'liquidacion'].includes(tipo) && esAbiertoConDevengo(prestamoLocked)) {
      const enCurso = periodoEnCursoAbierto(prestamoLocked)
      if (enCurso) {
        const debido = Math.max(0, Math.round(
          calcularSaldoPendiente(prestamoLocked) - (calcularCapitalRestante(prestamoLocked) ?? 0),
        ))
        /* ⚠ CUANTO DE ESTE COBRO ES INTERES DEL PERIODO EN CURSO — Y LAS DOS
           PREGUNTAS NO SON LA MISMA. En un cobro de interes, el monto ES
           interes y solo hay que descontar lo que ya se debia. En una
           LIQUIDACION el monto lleva el capital dentro, asi que se descuenta
           el saldo entero; restando solo `debido` salia que pedia el millon de
           capital como interes y el corte se asentaba por el mes completo
           cobrando seis dias. Lo caza el espejo, no las pruebas: $200.000
           apuntados como interes ganado donde se cobraron $38.710. */
        const yaCubierto = tipo === 'liquidacion'
          ? Math.round(calcularSaldoPendiente(prestamoLocked))
          : debido
        const pideDelPeriodo = Math.max(0, Math.round(montoFinal) - yaCubierto)
        if (pideDelPeriodo > 0) {
          const aAsentar = tipo === 'liquidacion'
            ? Math.min(enCurso.interesPeriodo, pideDelPeriodo)
            : enCurso.interesPeriodo
          if (aAsentar > 0) {
            try {
              await tx.devengoInteres.create({
                data: {
                  prestamoId, organizationId,
                  periodo: enCurso.periodo,
                  capitalBase: enCurso.capitalBase,
                  interes: aAsentar,
                },
              })
              await tx.prestamo.update({
                where: { id: prestamoId },
                data: { totalAPagar: { increment: aAsentar } },
              })
              prestamoLocked = await tx.prestamo.findUnique({
                where: { id: prestamoId },
                include: incluirParaLock,
              })
            } catch (e) {
              /* P2002 = ese periodo ya estaba asentado por el cron o por otro
                 cobro a la vez. No es un error, es la defensa funcionando. */
              if (e?.code !== 'P2002') throw e
            }
          }
        }
      }
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
      const capitalRestanteLocked = capitalVivoSegunTabla(prestamoLocked)
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
          nota: notaFinal?.trim() || null,
          cuotaNumero,
          fechaPago: fechaDelPago,
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
      // ── G6 · EL ATRASO SE SIGUE DEBIENDO ──
      // Aquí «futura» estaba definida como «sin pagar», no como «aún no
      // vencida», así que una cuota ATRASADA entraba en el lote que se
      // reprograma con fechas nuevas y el atraso desaparecía. Nadie lo decidió:
      // era el efecto lateral de un filtro. Ver `lib/dinero/abono-capital.js`,
      // donde vive la decisión con sus pruebas — partirlo aquí a secas rompe la
      // invariante del capital en silencio.
      const filas = [...prestamoActualizado.cuotasAmortizacion]
      const { pagadas: filasPagadas, vencidas: filasVencidas, futuras: filasFuturas } =
        partirFilasParaAbono(filas, Date.now())

      if (filasFuturas.length > 0) {
        // El abono a capital baja el capital DIRECTO por el monto abonado.
        // `capitalVivoSegunTabla` da el capital vivo ANTES de este abono (los
        // abonos anteriores ya estan horneados en la tabla) y AQUI se le resta
        // este. Con `calcularCapitalRestante` —que es la cifra de reporte, con
        // los abonos ya descontados— se restarian DOS VECES y el globo se
        // encogeria de mas: deuda perdonada sin que nadie lo decida.
        const capitalAntesDelAbono = capitalVivoSegunTabla(prestamoActualizado)
        // ⚠ AQUÍ ESTABA LA TRAMPA de G6, y es de las que no fallan: hay que
        // RESTAR el capital que se quedan las vencidas. Si no, ese capital
        // queda a la vez en su fila y repartido otra vez entre las futuras
        // —contado dos veces— y `Σ capital + Σ abonos === montoPrestado` deja
        // de cumplirse sin que nada avise. La prueba que lo enseña está en
        // `abono-capital-no-borra-mora.test.js`: son $50.000 inventados en el
        // caso de ejemplo.
        const saldoCapitalRestante = capitalParaFuturas({
          capitalAntesDelAbono, abono: montoFinal, vencidas: filasVencidas,
        })
        // La fecha base es la de la ÚLTIMA fila que no se reprograma, sea
        // pagada o vencida. Con solo las pagadas, las futuras se recolocaban
        // desde antes del atraso y se solapaban con las vencidas que acabamos
        // de dejar quietas.
        const previas = [...filasPagadas, ...filasVencidas].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)
        const ultimaPrevia = previas[previas.length - 1]
        const fechaBase = ultimaPrevia ? new Date(ultimaPrevia.fechaEsperada) : new Date(prestamo.fechaInicio)
        const diasPeriodo = obtenerDiasPorPeriodo(prestamoActualizado.frecuencia)

        // Cada modo con tabla tiene su propia forma de recalcular tras el abono:
        //  - solo_interes: interes por periodo + balloon
        //  - saldo (frances): cuota fija, interes por MES (÷ PERIODOS_POR_MES)
        //  - lineal/lineal_dinamico: capital parejo, interes por cobro
        // Antes 'saldo' caia en la de lineal y sobrecobraba en semanal/quincenal.
        const modoRecalc = prestamoActualizado.modoInteres
        const recalcFn = modoRecalc === 'solo_interes' ? recalcularTablaSoloInteresDesdeSaldo
          : modoRecalc === 'saldo' ? recalcularTablaSaldoDesdeSaldo
          : recalcularTablaDesdeSaldo
        const tablaRecalculada = recalcFn({
          saldoInicial: saldoCapitalRestante,
          tasaInteres: prestamoActualizado.tasaInteres,
          numPeriodosRestantes: filasFuturas.length,
          primerNumeroPeriodo: filasFuturas[0].numeroPeriodo,
          fechaBase,
          diasPeriodo,
          frecuencia: prestamoActualizado.frecuencia,
          /* ⚠ `frecuencia` ya se mandaba y DOS de las tres funciones ni la
             declaraban: se calculaban las fechas a bloques de 30 días también
             en mensual. Con el día de corte va la otra mitad de la regla — sin
             él, un préstamo que cobra los 5 se recolocaba en el día que cayera
             la última cuota previa. */
          diaCobroMes: prestamoActualizado.diaCobroMes ?? null,
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
        // Las VENCIDAS entran en el total igual que las pagadas: siguen en la
        // tabla con su importe intacto y el cliente las sigue debiendo. Sin
        // sumarlas, `totalAPagar` caería justo por el atraso — que es
        // exactamente el perdón que este cambio viene a quitar, colado por la
        // puerta de atrás.
        const totalPagadoEnPagadas =
          filasPagadas.reduce((a, f) => a + f.cuotaTotal, 0) +
          filasVencidas.reduce((a, f) => a + f.cuotaTotal, 0)
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
        },
      })
    }

    // 2c-bis. Pago de solo interés SIN tabla: el interés es NUEVO, así que sube
    // `totalAPagar` — exactamente el mismo movimiento que el recargo de arriba.
    //
    // Presté $500.000 a pagar $600.000. Me paga $100.000 de solo interés:
    //   · `totalPagado` subió $100.000 (lo hizo `refrescarTotalesPrestamo`)
    //   · `totalAPagar` sube $100.000 aquí
    //   → el SALDO queda igual, el capital no se movió, y entró plata a la caja.
    //
    // Que el saldo no se mueva es el punto: el cliente compró tiempo, no bajó su
    // deuda. Y por eso tampoco se toca `diasPlazo` ni `cuotaDiaria`: el préstamo
    // se sigue cobrando hasta saldar, que es como ya funciona. Ver
    // `plazo_no_es_tope`.
    //
    // Va ANTES del cálculo de `nuevoSaldo` de más abajo. Si fuera después, el
    // saldo se leería con el pago ya restado pero sin el interés sumado, daría
    // <= 0 en el último cobro y el préstamo se cerraría solo.
    if (tipo === 'intereses' && elInteresSubeLaDeuda(prestamoActualizado)) {
      await tx.prestamo.update({
        where: { id: prestamoId },
        data: { totalAPagar: { increment: montoFinal } },
      })
      prestamoActualizado = await tx.prestamo.findUnique({
        where: { id: prestamoId },
        include: {
          pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
          cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
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
        // La MISMA fecha que la fila `Pago`: un cobro de la cola sin señal que
        // sube al día siguiente es plata del día que se cobró también en la
        // bolsa, no del día que hubo señal. Para un pago normal es «ahora».
        fecha: fechaDelPago,
        rutaId: prestamo.cliente?.rutaId || null,
        creadoPorId: userId,
        /* ⚠ EL MISMO VALOR QUE LA FILA `Pago`, NO EL CRUDO DEL CUERPO.
           Aquí iba `metodoPago || null` sin validar, mientras la fila `Pago`
           guardaba `metodoValido` —que degrada a null cualquier cosa que no sea
           efectivo/transferencia—. Un `metodoPago: 'nequi'` dejaba las dos
           filas del MISMO cobro con datos distintos.

           Hoy no descuadra ninguna cifra (las dos acaban contando como
           efectivo) y en producción no hay ni un solo caso: los únicos valores
           que existen son 'efectivo', 'transferencia' y null. Pero el desglose
           por cuenta manda lo desconocido a «sin registrar», así que en cuanto
           alguien mande un método raro la plata desaparecería de su cuenta.

           Para decir Nequi o Bancolombia está `metodoPagoId`, que apunta a la
           cuenta de verdad. `metodoPago` solo dice EN QUÉ FORMA entró. */
        metodoPago: metodoValido,
        metodoPagoId: metodoValido === 'transferencia' ? (metodoPagoId || null) : null,
      })
    }

    // Descuento: queda apuntado lo que se le perdonó al cliente.
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
        /* ⚠ SE APUNTA, NO MUEVE LA CAJA. Ver la nota larga de
           `registrarMovimientoCapital`: perdonar deuda no saca un billete de
           ningún sitio. La pérdida ya la enseña la CARTERA —bajar
           `totalAPagar` baja lo que queda en la calle— y restarla también del
           capital la cuenta dos veces. Medido: a GERMAN EDUARDO le prestó
           $120.000, no le pagaron nada, perdonó todo, y el libro le restaba
           $240.000. A Abigail Castro, $440.000 sobre $200.000 prestados. */
        noMueveCapital: true,
      })
    }

    /* Liquidación: queda escrito CUÁNTO se condonó al cerrar por anticipado,
       pero NO baja el capital.

       ⚠ `noMueveCapital`. Ese interés nunca estuvo en la caja: el cliente
       devolvió el capital entero y el prestamista renunció a cobrar lo que
       faltaba. Restarlo inventaba una pérdida, y era permanente y acumulativa
       porque `disponibleHoy = Capital.saldo`.

       Crediya, 26 ago 2026: prestó $900.000 a Jose Bermejo, le devolvieron
       $900.000 y el libro dejaba el préstamo en −$306.973. Ver la nota larga
       de `registrarMovimientoCapital`. */
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
        noMueveCapital: true,
      })
    }

    return prestamoActualizado
  }, {
    /* El límite de la transacción del pago. Prisma trae 5 s; en producción
       sobra (base en la misma máquina). En el espejo, con la base al otro
       lado de un túnel SSH, no llega, y sin esto no se puede verificar un
       pago de punta a punta. Producción no define la variable. */
    timeout: Number(process.env.PRISMA_TX_TIMEOUT_MS) || 5000,
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
      /* Los devengos de un préstamo abierto: sin ellos `interesCobrableAhora`
         no sabe cuánto se debe y el botón dice «está todo pagado» sobre un
         préstamo que sí debe. Ver [[feedback_verificar_prisma_select]]: pedir
         de menos no da error, da una decisión mal tomada en silencio. */
      devengos: { select: { periodo: true, interes: true, capitalBase: true }, orderBy: { periodo: 'asc' } },
    },
  })

  const diasExcluidosFinal = obtenerDiasSinCobro(prestamoFinal?.cliente, prestamoFinal?.cliente?.ruta, org)

  /* ══ COBRAR EL INTERÉS Y APLAZAR, EN EL MISMO GESTO ══════════════════════
   *
   * «Yo tengo clientes que en la quincena no me pueden dar la cuota, pero me
   *  dan el interés. Lo que hago es recibir el interés hoy y la cuota queda
   *  para la próxima quincena, pero sigue siendo igual.»
   *   — un prestamista, 16 ago 2026, explicando por qué seguía en Excel.
   *
   * La primera mitad ya funcionaba: el pago de solo interés sube la deuda y NO
   * toca la cuota, así que el cliente sigue debiendo sus $175.000 y no $125.000.
   * Lo que faltaba era la fecha, que había que mover por otra pantalla.
   *
   * ⚠ VA AQUÍ Y NO EN LA PANTALLA. `refrescarTotalesPrestamo` pone
   *   `proximoCobroManual` en null en CADA cambio de pagos: hecho desde el
   *   navegador en dos peticiones, la segunda podía fallar y dejar el interés
   *   cobrado sin el aplazo. Así o se hacen las dos cosas o ninguna.
   *
   * ⚠ SOLO donde cobrar interés significa comprar tiempo. Con tabla de
   *   amortización el interés ya estaba pactado y aplazar movería un calendario
   *   que nadie renegoció.
   */
  let proximoCobroFinal = calcularProximoCobro(prestamoFinal, diasExcluidosFinal, festivos)
  let aplazadoA = null
  if (aplazarUnPeriodo && tipo === 'intereses' && elInteresSubeLaDeuda(prestamoFinal) && proximoCobroFinal) {
    const nueva = siguientePeriodo(proximoCobroFinal, prestamoFinal.frecuencia, prestamoFinal.diaCobroMes)
    if (nueva) {
      await prisma.prestamo.update({
        where: { id: prestamoId },
        data: { proximoCobroManual: nueva },
      })
      proximoCobroFinal = nueva
      aplazadoA = nueva
      logActividad({
        session,
        accion: 'editar_prestamo',
        entidadTipo: 'prestamo',
        entidadId: prestamoId,
        detalle: `Cobro aplazado a ${nueva.toISOString().slice(0, 10)} al recibir solo el interés`,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      })
    }
  }

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
    proximoCobro:     proximoCobroFinal,
    aplazadoA,
    pagoHoy:          pagoHoy(prestamoFinal),
  }, { status: 201 })
}
