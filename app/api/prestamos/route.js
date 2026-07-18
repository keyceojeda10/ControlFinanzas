// app/api/prestamos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularPrestamo,
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  calcularCapitalRestante,
  calcularProximoCobro,
  pagoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { trackEvent } from '@/lib/analytics'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { getLocalDateStr } from '@/lib/i18n'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { rutaPermitida } from '@/lib/limites-plan'
import { enviarPushOrg } from '@/lib/push'

// ─── GET /api/prestamos ─────────────────────────────────────────
export async function GET(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaIds = [] } = session.user
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')
  const estado    = searchParams.get('estado')
  const frecuenciaRaw = searchParams.get('frecuencia')
  const frecuencia = ['diario', 'semanal', 'quincenal', 'mensual'].includes(frecuenciaRaw) ? frecuenciaRaw : null
  const buscar    = searchParams.get('buscar')?.trim()
  const rutaId    = searchParams.get('rutaId')
  const creadoPorId = searchParams.get('creadoPorId')
  const renovacion = searchParams.get('renovacion') // 'si' | 'no' | null
  const modoInteres = searchParams.get('modoInteres')
  const page      = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit     = Math.min(Number(searchParams.get('limit')) || 50, 100)

  // Cobrador sin ruta asignada no ve nada (previene fuga de datos multi-tenant)
  if (rol === 'cobrador' && rutaIds.length === 0) {
    return Response.json(page != null ? { prestamos: [], total: 0, page, totalPages: 0 } : [])
  }

  const clienteWhere = {
    ...(rol === 'cobrador' && { rutaId: { in: rutaIds } }),
    ...(rutaId && { rutaId }),
    ...(buscar && {
      OR: [
        { nombre: { contains: buscar } },
        { cedula: { contains: buscar } },
      ],
    }),
  }
  const where = {
    organizationId,
    ...(clienteId && { clienteId }),
    ...(estado    ? { estado } : rol === 'cobrador' ? { estado: { not: 'pendiente_aprobacion' } } : {}),
    ...(frecuencia && { frecuencia }),
    ...(creadoPorId && { creadoPorId }),
    ...(renovacion === 'si' && { renovadoDeId: { not: null } }),
    ...(renovacion === 'no' && { renovadoDeId: null }),
    ...(modoInteres && { modoInteres }),
    ...(Object.keys(clienteWhere).length > 0 && { cliente: clienteWhere }),
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, fotoUrl: true, rutaId: true, diasSinCobro: true, ruta: { select: { id: true, nombre: true, diasSinCobro: true } } } },
      // Solo los ultimos 10 pagos: suficiente para pagoHoy y calcularCapitalRestante.
      // El totalPagado real se lee del campo denormalizado del prestamo.
      pagos: {
        take: 10,
        orderBy: { fechaPago: 'desc' },
        select: { id: true, montoPagado: true, fechaPago: true, tipo: true },
      },
      cuotasAmortizacion: {
        orderBy: { numeroPeriodo: 'asc' },
        select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    ...(page != null && { take: limit, skip: (page - 1) * limit }),
  })

  // Config org para días sin cobro + festivos
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

  // Lookup de nombres de creadores para auditoría
  const creadorIds = [...new Set(prestamos.map(p => p.creadoPorId).filter(Boolean))]
  const creadoresMap = new Map()
  if (creadorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: creadorIds } },
      select: { id: true, nombre: true },
    })
    users.forEach(u => creadoresMap.set(u.id, u.nombre))
  }

  // Cachear diasExcluidos por cliente: el calculo es identico para todos
  // los prestamos del mismo cliente, asi que se hace una sola vez.
  const diasExcluidosCache = new Map()
  const getDiasExcluidos = (cliente) => {
    const key = cliente?.id
    if (!key) return obtenerDiasSinCobro(cliente, cliente?.ruta, org)
    if (!diasExcluidosCache.has(key)) {
      diasExcluidosCache.set(key, obtenerDiasSinCobro(cliente, cliente?.ruta, org))
    }
    return diasExcluidosCache.get(key)
  }

  const resultado = prestamos.map((p) => {
    const diasExcluidos = getDiasExcluidos(p.cliente)
    return {
    id:               p.id,
    clienteId:        p.clienteId,
    cliente:          p.cliente,
    creadoPorId:      p.creadoPorId,
    creadoPorNombre:  creadoresMap.get(p.creadoPorId) || null,
    renovadoDeId:     p.renovadoDeId,
    montoPrestado:    p.montoPrestado,
    totalAPagar:      p.totalAPagar,
    cuotaDiaria:      p.cuotaDiaria,
    frecuencia:       p.frecuencia,
    diaCobroSemana:   p.diaCobroSemana,
    diaCobroMes:      p.diaCobroMes,
    diaCobroMes2:     p.diaCobroMes2,
    tasaInteres:      p.tasaInteres,
    diasPlazo:        p.diasPlazo,
    fechaInicio:      p.fechaInicio,
    fechaFin:         p.fechaFin,
    estado:           p.estado,
    modoInteres:      p.modoInteres,
    createdAt:        p.createdAt,
    ultimoPagoAt:     p.ultimoPagoAt,
    // Usa el campo denormalizado (mantenido por refrescarTotalesPrestamo).
    totalPagado:      p.totalPagado ?? 0,
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    capitalRestante:  calcularCapitalRestante(p),
    diasMora:         calcularDiasMora(p, diasExcluidos, festivos),
    pagoHoy:          pagoHoy(p),
    proximoCobro:     calcularProximoCobro(p, diasExcluidos, festivos),
  }})

  // Orden cronologico puro: prestamo mas nuevo arriba (ya viene del Prisma orderBy).
  // El cliente que quiera ver los prestamos agrupados por persona usa el filtro
  // "Agrupar por cliente" en el frontend, que reordena ahi.

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    const total = await prisma.prestamo.count({ where })
    return Response.json({ prestamos: resultado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(resultado)
  } catch (err) {
    console.error('[GET /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/prestamos ────────────────────────────────────────
export async function POST(request) {
  let faltanteCapital = 0
  let saldoCapitalActual = 0
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeCrearPrestamos: true },
      })
      if (!cobrador?.puedeCrearPrestamos) {
        return Response.json({ error: 'No tienes permiso para crear préstamos' }, { status: 403 })
      }
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { organizationId, rol } = session.user
  const body = await request.json()
  const { clienteId, montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, yaAbonado, cuotaManual, inyeccionPrevia, diaCobroSemana, diaCobroMes, diaCobroMes2, seguro, montoSeguro, modoInteres, nombreProducto, interesAdelantado, capitalExtra, socioId } = body

  const freq = frecuencia || 'diario'
  const frecuenciasValidas = ['diario', 'semanal', 'quincenal', 'mensual']
  if (!frecuenciasValidas.includes(freq)) {
    return Response.json({ error: 'Frecuencia no válida' }, { status: 400 })
  }

  // Dia ancla: semanal/quincenal usa diaCobroSemana (0-6), mensual usa diaCobroMes (1-31).
  // Ambos son opcionales. Se ignoran para frecuencias que no aplican.
  let diaCobroSemanaDb = null
  let diaCobroMesDb = null
  let diaCobroMes2Db = null
  if ((freq === 'semanal' || freq === 'quincenal') && diaCobroSemana != null && diaCobroSemana !== '') {
    const v = Number(diaCobroSemana)
    if (!Number.isInteger(v) || v < 0 || v > 6) {
      return Response.json({ error: 'Día de la semana inválido (0-6)' }, { status: 400 })
    }
    diaCobroSemanaDb = v
  }
  if ((freq === 'mensual' || freq === 'quincenal') && diaCobroMes != null && diaCobroMes !== '') {
    const v = Number(diaCobroMes)
    if (!Number.isInteger(v) || v < 1 || v > 31) {
      return Response.json({ error: 'Día del mes inválido (1-31)' }, { status: 400 })
    }
    diaCobroMesDb = v
  }
  if (freq === 'quincenal' && diaCobroMes2 != null && diaCobroMes2 !== '') {
    const v = Number(diaCobroMes2)
    if (!Number.isInteger(v) || v < 1 || v > 31) {
      return Response.json({ error: 'Segundo día del mes inválido (1-31)' }, { status: 400 })
    }
    diaCobroMes2Db = v
  }

  // Validaciones
  if (!clienteId)     return Response.json({ error: 'El cliente es requerido' },          { status: 400 })
  if (!montoPrestado) return Response.json({ error: 'El monto es requerido' },            { status: 400 })
  if (tasaInteres == null || tasaInteres === '') return Response.json({ error: 'La tasa de interés es requerida' }, { status: 400 })
  if (!diasPlazo)     return Response.json({ error: 'El plazo es requerido' },            { status: 400 })
  if (!fechaInicio)   return Response.json({ error: 'La fecha de inicio es requerida' },  { status: 400 })

  // Bloquear fechas futuras: si el cobrador se equivoca con la fecha el prestamo
  // no aparece en cobro hasta esa fecha (bug silencioso). Comparamos en zona horaria del usuario.
  const hoyLocal = getLocalDateStr(session.user.country ?? 'co')
  if (typeof fechaInicio === 'string' && fechaInicio > hoyLocal) {
    return Response.json({ error: 'La fecha de inicio no puede ser futura' }, { status: 400 })
  }

  if (Number(montoPrestado) <= 0) return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  if (Number(tasaInteres)   < 0)  return Response.json({ error: 'La tasa no puede ser negativa' },  { status: 400 })
  if (Number(diasPlazo)     <= 0) return Response.json({ error: 'El plazo debe ser mayor a 0' }, { status: 400 })
  const abono = Number(yaAbonado) || 0
  if (abono < 0) return Response.json({ error: 'El abono no puede ser negativo' }, { status: 400 })

  // Verificar que el cliente pertenece a la organización
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  if (cliente.rutaId && !await rutaPermitida(organizationId, cliente.rutaId)) {
    return Response.json({ error: 'La ruta de este cliente excede el limite de tu plan. Mejora tu plan o desactiva rutas que no uses.' }, { status: 403 })
  }

  if (cliente.montoMaximoPrestamo && Number(montoPrestado) > cliente.montoMaximoPrestamo) {
    return Response.json({
      error: `El monto supera el tope de este cliente (${Math.round(cliente.montoMaximoPrestamo).toLocaleString('es-CO')})`,
    }, { status: 400 })
  }

  // El cobrador puede crear préstamos a clientes de cualquiera de sus rutas
  // asignadas (consistente con GET /api/prestamos que ya filtra por rutaIds[]).
  if (rol === 'cobrador') {
    const rutasAsignadas = await prisma.ruta.findMany({
      where: { organizationId, cobradorId: session.user.id, activo: true },
      select: { id: true },
    })

    if (rutasAsignadas.length === 0) {
      return Response.json({ error: 'No tienes una ruta activa asignada' }, { status: 400 })
    }

    const rutaIdsAsignadas = rutasAsignadas.map(r => r.id)
    if (!cliente.rutaId) {
      if (rutaIdsAsignadas.length === 1) {
        await prisma.cliente.update({
          where: { id: clienteId },
          data: { rutaId: rutaIdsAsignadas[0] },
        })
        cliente.rutaId = rutaIdsAsignadas[0]
      } else {
        return Response.json({ error: 'Este cliente no tiene ruta asignada. Asignale una ruta antes de crear el préstamo.' }, { status: 400 })
      }
    } else if (!rutaIdsAsignadas.includes(cliente.rutaId)) {
      return Response.json({ error: 'Solo puedes crear préstamos para clientes de tus rutas asignadas' }, { status: 403 })
    }
  }

  // Ruta a la que se atribuyen los movimientos de capital (sub-bolsa por ruta).
  const rutaIdCapital = cliente.rutaId || null

  // Calcular valores del préstamo (cuotaManual opcional sobreescribe la cuota calculada)
  const cuotaManualNum = Number(cuotaManual) || 0
  if (cuotaManualNum < 0) {
    return Response.json({ error: 'La cuota manual no puede ser negativa' }, { status: 400 })
  }
  // Validar modo de interes; si viene cuotaManual el calculo lo trata como manual.
  const modoValido = ['fijo', 'unico', 'saldo', 'manual', 'lineal', 'solo_interes', 'lineal_dinamico'].includes(modoInteres) ? modoInteres : 'fijo'
  const calc = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq, modoInteres: modoValido,
    ...(cuotaManualNum > 0 && { cuotaManual: cuotaManualNum }),
    interesAdelantado: modoValido === 'solo_interes' && !!interesAdelantado,
    ...(Array.isArray(capitalExtra) && capitalExtra.length > 0 && { capitalExtra }),
    diaCobroMes: diaCobroMesDb,
    diaCobroMes2: diaCobroMes2Db,
  })
  const { totalAPagar, cuotaDiaria, fechaFin } = calc
  const modoInteresFinal = calc.modoInteres  // 'manual' si hubo cuotaManual

  // Validar abono vs total
  if (abono > totalAPagar) {
    return Response.json({ error: 'El abono no puede ser mayor al total a pagar' }, { status: 400 })
  }

  // Leer config de modo estricto de la organización
  const orgConfig = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { capitalEstricto: true, requiereAprobacionPrestamos: true },
  })
  const modoEstricto = !!orgConfig?.capitalEstricto
  const esPendiente = rol === 'cobrador' && !!orgConfig?.requiereAprobacionPrestamos

  // Normalizar inyección previa (si viene del frontend al elegir "inyectar y continuar")
  const inyeccionMonto = Number(inyeccionPrevia?.monto) || 0
  const inyeccionDescripcion = typeof inyeccionPrevia?.descripcion === 'string'
    ? inyeccionPrevia.descripcion.trim()
    : ''

  if (socioId) {
    const socioValido = await prisma.socio.findFirst({
      where: { id: socioId, organizationId },
      select: { id: true },
    })
    if (!socioValido) {
      return Response.json({ error: 'Socio no encontrado' }, { status: 400 })
    }
  }

  // Crear préstamo y actualizar estado del cliente en transacción
  const prestamo = await prisma.$transaction(async (tx) => {
    if (!esPendiente) {
      // Lock + lectura del capital actual
      const capRow = await tx.$queryRaw`
        SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
      `
      const tieneCapital = Array.isArray(capRow) && capRow.length > 0
      let saldoCap = tieneCapital ? Number(capRow[0].saldo || 0) : 0

      if (inyeccionMonto > 0 && tieneCapital) {
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'inyeccion',
          monto: inyeccionMonto,
          descripcion: inyeccionDescripcion || `Inyección al crear préstamo - ${cliente.nombre}`,
          referenciaTipo: 'caja_capital_manual',
          rutaId: rutaIdCapital,
          creadoPorId: session.user.id,
        })
        saldoCap += inyeccionMonto
      }

      if (modoEstricto && tieneCapital) {
        const neto = Number(montoPrestado) - abono
        if (saldoCap < neto) {
          faltanteCapital = neto - saldoCap
          saldoCapitalActual = saldoCap
          throw new Error('CAPITAL_INSUFICIENTE')
        }
      }
    }

    const nuevo = await tx.prestamo.create({
      data: {
        clienteId,
        organizationId,
        creadoPorId: session.user.id,
        montoPrestado: Number(montoPrestado),
        tasaInteres:   Number(tasaInteres),
        totalAPagar,
        cuotaDiaria,
        frecuencia:    freq,
        modoInteres:   modoInteresFinal,
        interesAdelantado: modoInteresFinal === 'solo_interes' && !!interesAdelantado,
        ...(typeof nombreProducto === 'string' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim().slice(0, 100) }),
        diaCobroSemana: diaCobroSemanaDb,
        diaCobroMes:    diaCobroMesDb,
        diaCobroMes2:   diaCobroMes2Db,
        ...(socioId && { socioId }),
        ...(Array.isArray(calc.capitalExtra) && calc.capitalExtra.length > 0 && { capitalExtra: calc.capitalExtra }),
        diasPlazo:     calc.numPeriodos * calc.diasPeriodo,
        fechaInicio:   new Date(`${fechaInicio}T05:00:00.000Z`),
        fechaFin,
        seguro:        !!seguro,
        ...(seguro && montoSeguro > 0 && { montoSeguro: Number(montoSeguro) }),
        ...(esPendiente && { estado: 'pendiente_aprobacion' }),
      },
    })

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

    if (!esPendiente) {
      await tx.cliente.update({
        where: { id: clienteId },
        data:  { estado: 'activo' },
      })

      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'desembolso',
        monto: Number(montoPrestado),
        descripcion: `Desembolso préstamo a ${cliente.nombre}`,
        referenciaId: nuevo.id,
        referenciaTipo: 'prestamo',
        rutaId: rutaIdCapital,
        creadoPorId: session.user.id,
      })

      if (abono > 0) {
        await tx.pago.create({
          data: {
            prestamoId:     nuevo.id,
            organizationId,
            cobradorId:     session.user.id,
            montoPagado:    abono,
            tipo:           'completo',
            fechaPago:      new Date(`${fechaInicio}T05:00:00.000Z`),
            nota:           'Abono previo (préstamo en curso)',
          },
        })
        await refrescarTotalesPrestamo(tx, nuevo.id)
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'recaudo',
          monto: abono,
          descripcion: `Abono previo préstamo en curso - ${cliente.nombre}`,
          referenciaId: nuevo.id,
          referenciaTipo: 'prestamo',
          creadoPorId: session.user.id,
        })
      }
    } else if (abono > 0) {
      // Guardar el abono previo pero sin movimiento de capital (se registra al aprobar)
      await tx.pago.create({
        data: {
          prestamoId:     nuevo.id,
          organizationId,
          cobradorId:     session.user.id,
          montoPagado:    abono,
          tipo:           'completo',
          fechaPago:      new Date(`${fechaInicio}T05:00:00.000Z`),
          nota:           'Abono previo (préstamo en curso)',
        },
      })
      await refrescarTotalesPrestamo(tx, nuevo.id)
    }

    return nuevo
  })

  logActividad({ session, accion: esPendiente ? 'solicitar_prestamo' : 'crear_prestamo', entidadTipo: 'prestamo', entidadId: prestamo.id, detalle: `${esPendiente ? 'Solicitud de préstamo' : 'Préstamo'} $${Number(montoPrestado).toLocaleString('es-CO')} a ${cliente.nombre}${abono > 0 ? ` (en curso, abono previo $${abono.toLocaleString('es-CO')})` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: esPendiente ? 'solicitar_prestamo' : 'crear_prestamo', metadata: { monto: Number(montoPrestado) } })

  if (esPendiente) {
    const owners = await prisma.user.findMany({
      where: { organizationId, rol: 'owner' },
      select: { id: true },
    })
    if (owners.length > 0) {
      await prisma.notificacion.createMany({
        data: owners.map(o => ({
          organizationId,
          userId: o.id,
          tipo: 'solicitud_prestamo',
          titulo: 'Solicitud de prestamo',
          mensaje: `${session.user.nombre} solicita crear un prestamo de $${Number(montoPrestado).toLocaleString('es-CO')} para ${cliente.nombre}.`,
          datos: JSON.stringify({ prestamoId: prestamo.id, clienteId, monto: Number(montoPrestado), cobrador: session.user.nombre }),
        })),
      })
    }
    enviarPushOrg(organizationId, {
      title: 'Solicitud de prestamo',
      body: `${session.user.nombre} solicita $${Number(montoPrestado).toLocaleString('es-CO')} para ${cliente.nombre}`,
      url: `/prestamos/${prestamo.id}`,
    }).catch(() => {})
  }

  return Response.json({ ...prestamo, pendienteAprobacion: esPendiente }, { status: 201 })
  } catch (err) {
    if (err?.message === 'CAPITAL_INSUFICIENTE') {
      return Response.json({
        error: 'Capital insuficiente para desembolsar este préstamo',
        capitalInsuficiente: true,
        faltante: Math.round(faltanteCapital),
        saldoActual: Math.round(saldoCapitalActual),
      }, { status: 400 })
    }
    console.error('[POST /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
