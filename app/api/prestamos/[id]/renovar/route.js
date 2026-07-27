// app/api/prestamos/[id]/renovar/route.js
// Renueva un préstamo activo: liquida el saldo pendiente y crea uno nuevo.
// El cliente recibe en mano la diferencia (nuevoMonto - saldoPendiente).

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularPrestamo, calcularSaldoPendiente, calcularCapitalRestante } from '@/lib/calculos'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { trackEvent }   from '@/lib/analytics'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

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
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub

  const puedeGestionar = session.user.rol === 'owner'
    ? true
    : (session.user.rol === 'cobrador' && await cobradorPuedeGestionarPrestamos(session.user.id))

  if (!puedeGestionar) {
    return Response.json({ error: 'No tienes permiso para renovar préstamos' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const { id: prestamoId } = await params

  const body = await request.json()
  const { montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, modoInteres, seguro, montoSeguro, cuotaManual } = body

  const freq = frecuencia || 'diario'
  // Modo de interes para la renovacion. Default 'fijo' (el modelo nuevo);
  // si el front lo manda explicito, se respeta.
  const modoRenovacion = ['fijo', 'unico', 'saldo', 'manual', 'solo_interes', 'lineal', 'lineal_dinamico'].includes(modoInteres) ? modoInteres : 'fijo'
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
      cliente: { select: { id: true, nombre: true, rutaId: true, montoMaximoPrestamo: true } },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
      cuotasAmortizacion: { select: { numeroPeriodo: true, capital: true, interes: true, cuotaTotal: true, pagado: true, interesPagado: true }, orderBy: { numeroPeriodo: 'asc' } },
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
  // Para prestamos con tabla (globo/lineal), el capital restante es la deuda
  // real sin intereses futuros. Para la renovacion, el minimo es el capital
  // adeudado (no el totalAPagar que incluye intereses no devengados).
  const capitalRestante = calcularCapitalRestante(original)
  const minimoRenovacion = capitalRestante != null ? capitalRestante : saldoPendiente

  if (original.cliente.montoMaximoPrestamo && Number(montoPrestado) > original.cliente.montoMaximoPrestamo) {
    return Response.json({
      error: `El monto supera el tope de este cliente (${Math.round(original.cliente.montoMaximoPrestamo).toLocaleString('es-CO')})`,
    }, { status: 400 })
  }

  // El nuevo monto debe cubrir al menos el capital adeudado
  if (Number(montoPrestado) < minimoRenovacion) {
    return Response.json({
      error: `El nuevo monto debe ser al menos $${Math.round(minimoRenovacion).toLocaleString('es-CO')} (capital adeudado)`,
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
  const cuotaManualNum = cuotaManual ? Number(cuotaManual) : undefined
  const calc = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq, modoInteres: modoRenovacion,
    ...(cuotaManualNum > 0 && { cuotaManual: cuotaManualNum }),
    ...(modoRenovacion === 'solo_interes' && { interesAdelantado: !!body.interesAdelantado }),
  })
  // Ver la guardia equivalente en POST /api/prestamos: una cuota que no cubre el
  // interes del primer periodo hace que el prestamo nunca amortice.
  if (calc.cuotaInsuficiente) {
    return Response.json({
      error: `Esa cuota no alcanza a cubrir el interés. El primer período genera $${calc.interesPrimerPeriodo.toLocaleString('es-CO')} de interés, así que con una cuota menor la deuda nunca baja. Cuota mínima: $${calc.cuotaMinima.toLocaleString('es-CO')}. Para terminar de pagar en el plazo elegido: $${calc.cuotaSugerida.toLocaleString('es-CO')}.`,
      cuotaInsuficiente: true,
    }, { status: 400 })
  }

  const { totalAPagar, cuotaDiaria, fechaFin } = calc
  const modoInteresFinal = calc.modoInteres

  const diferencia = Number(montoPrestado) - minimoRenovacion // lo que recibe en mano

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
        creadoPorId:   session.user.id,
        montoPrestado: Number(montoPrestado),
        tasaInteres:   Number(tasaInteres),
        totalAPagar,
        cuotaDiaria,
        frecuencia:    freq,
        modoInteres:   modoInteresFinal,
        interesAdelantado: modoInteresFinal === 'solo_interes' && !!body.interesAdelantado,
        // El plazo REAL sale del calculo, no del formulario. Con cuota manual el
        // plazo se auto-extiende (ver calcularPrestamo) y guardar el valor pedido
        // dejaba el prestamo contradiciendose: un caso real quedo con "180 dias"
        // (12 cobros) y un total que exige 22. calcularProximoCobro usa el plazo
        // como tope, asi que al pagar la cuota 12 el prestamo desaparecia de los
        // cobros debiendo todavia $3.000.000. Crear siempre lo guardo asi; renovar,
        // editar y carga masiva se habian quedado atras.
        diasPlazo:     calc.numPeriodos * calc.diasPeriodo,
        // Fijar mediodia Colombia (T05:00Z) igual que la creacion normal. Con
        // new Date('YYYY-MM-DD') (medianoche UTC) inicioDiaColombia lo corria al
        // dia anterior -> el calendario/mora quedaba 1 dia adelantado.
        fechaInicio:   new Date(`${String(fechaInicio).slice(0, 10)}T05:00:00.000Z`),
        fechaFin,
        seguro:        conSeguro,
        renovadoDeId:  prestamoId,
        ...(conSeguro && montoSeguroNum > 0 && { montoSeguro: montoSeguroNum }),
      },
    })

    // Persistir la tabla si el calculo la genero — vale para lineal, solo_interes,
    // lineal_dinamico Y saldo (frances). La lista hardcodeada omitia 'saldo', asi
    // que un saldo renovado quedaba sin tabla y degradaba a comportamiento plano.
    if (Array.isArray(calc.tablaAmortizacion) && calc.tablaAmortizacion.length > 0) {
      await tx.cuotaAmortizacion.createMany({
        data: calc.tablaAmortizacion.map((p) => ({
          prestamoId: nuevo.id,
          numeroPeriodo: p.numeroPeriodo,
          capital: p.capital,
          interes: p.interes,
          cuotaTotal: p.cuotaTotal,
          saldoRestante: p.saldoRestante,
          fechaEsperada: p.fechaEsperada,
          pagado: 0,
        })),
      })
    }

    // 5. Registrar en capital SOLO el efectivo real que sale: la diferencia
    // entregada en mano (monto nuevo - saldo viejo absorbido). El saldo viejo
    // no volvio a la caja ni salio, asi que NO se registra recaudo ni se
    // desembolsa el total. Esto mantiene el control de caja exacto (sin abono
    // falso).
    //
    // El movimiento se registra SIEMPRE, incluso con diferencia = 0 (renovacion
    // por el mismo monto que debia: no entrego efectivo). Antes se saltaba con
    // `if (diferencia > 0)` y entonces la caja no encontraba movimiento y caia al
    // fallback `p.montoPrestado`, mostrando como salida de caja TODO el monto
    // renovado (ej: renovar 160k por 160k mostraba -160.000 sin que saliera un
    // peso). Con el movimiento en 0 el ledger queda completo y la caja no adivina.
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      monto: diferencia,
      descripcion: diferencia > 0
        ? `Desembolso por renovación - ${original.cliente.nombre}`
        : `Renovación sin efectivo entregado - ${original.cliente.nombre}`,
      referenciaId: nuevo.id,
      referenciaTipo: 'prestamo',
      rutaId: original.cliente?.rutaId || null,
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
