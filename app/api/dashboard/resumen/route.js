// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPatrimonio } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getLocalDate(country = 'co') {
  return new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 403 })

  // Cobrador: limitar metricas a clientes/prestamos/pagos de SU ruta
  const esCobrador = session.user.rol === 'cobrador'
  const rutaIdsCobrador = session.user.rutaIds ?? []
  const filtroRutaCliente = esCobrador ? { rutaId: { in: rutaIdsCobrador } } : {}
  const filtroRutaPagos = esCobrador
    ? { prestamo: { estado: { not: 'cancelado' }, cliente: { rutaId: { in: rutaIdsCobrador } } } }
    : { prestamo: { estado: { not: 'cancelado' } } }

  // Rangos UTC que representan "hoy" y "este mes" en hora Colombia (UTC-5)
  // Colombia midnight = UTC 05:00. Fin del día Colombia = UTC 04:59:59 del día siguiente.
  const country = session.user.country ?? 'co'
  const hoy = getLocalDate(country)
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()
  const inicioDiaUTC = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC    = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))
  const inicioMes    = new Date(Date.UTC(y, m, 1, 5, 0, 0))
  const finMes       = new Date(Date.UTC(y, m + 1, 1, 4, 59, 59))
  // Rango de ayer Colombia: para comparativos vs ayer
  const inicioAyerUTC = new Date(Date.UTC(y, m, d - 1, 5, 0, 0))
  const finAyerUTC    = new Date(Date.UTC(y, m, d, 4, 59, 59))
  // Rango ultimos 7 dias (incluye hoy) para sparkline
  const inicio7DiasUTC = new Date(Date.UTC(y, m, d - 6, 5, 0, 0))
  // Rango ultimos 30 dias (incluye hoy) para heatmap calendario
  const inicio30DiasUTC = new Date(Date.UTC(y, m, d - 29, 5, 0, 0))

  const [
    org,
    festivos,
    prestamosActivosDetalle,
    prestamosCompletados,
    pagosHoy,
    pagosMes,
    ultimosPagos,
    rutasActivas,
    capitalRow,
    gastosMesAgg,
    pagosAyer,
    pagosHoyPorCobrador,
    prestamosHoy,
    gastosHoy,
    movimientosHoy,
    clientesSinRutaCount,
    clientesSinPagosLargo,
    pagos30Dias,
    pagosMesDetalle,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { diasSinCobro: true },
    }),

    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        esClavo: false,
        cliente: {
          estado: { notIn: ['eliminado', 'inactivo'] },
          ...filtroRutaCliente,
        },
      },
      select: {
        id: true,
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        cuotaDiaria: true,
        fechaInicio: true,
        diasPlazo: true,
        frecuencia: true,
        estado: true,
        totalPagado: true,
        ultimoPagoAt: true,
        modoInteres: true,
        proximoCobroManual: true,
        cuotasAmortizacion: {
          orderBy: { numeroPeriodo: 'asc' },
          select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, interesPagado: true, fechaEsperada: true },
        },
        cliente: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
            diasSinCobro: true,
            ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
          },
        },
      },
    }),

    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'completado',
        ...(esCobrador ? { cliente: { rutaId: { in: rutaIdsCobrador } } } : {}),
      },
    }),

    // Pagos de hoy (excluye recargos/descuentos — son ajustes contables, no efectivo)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: {
          gte: inicioDiaUTC,
          lte: finDiaUTC,
        },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Pagos del mes (excluye recargos/descuentos)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Últimos 5 pagos registrados
    prisma.pago.findMany({
      where: { organizationId: orgId, ...filtroRutaPagos },
      orderBy: { fechaPago: 'desc' },
      take: 5,
      select: {
        id: true,
        montoPagado: true,
        fechaPago: true,
        tipo: true,
        prestamo: {
          select: {
            cliente: { select: { nombre: true } },
          },
        },
      },
    }),

    prisma.ruta.count({
      where: {
        organizationId: orgId,
        activo: true,
        ...(esCobrador ? { id: { in: rutaIdsCobrador } } : {}),
      },
    }),

    // Saldo de capital actual (caja disponible). Solo para owner/superadmin.
    esCobrador ? Promise.resolve(null) : prisma.capital.findFirst({
      where: { organizationId: orgId },
      select: { saldo: true },
    }),

    // Gastos del mes. Solo para owner/superadmin.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioMes, lte: finMes },
      },
      _sum: { monto: true },
    }),

    // Pagos de AYER (para comparativo vs hoy)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioAyerUTC, lte: finAyerUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Desglose de pagos de hoy POR COBRADOR (solo owner; cobrador ya ve solo lo suyo)
    esCobrador ? Promise.resolve([]) : prisma.pago.groupBy({
      by: ['cobradorId'],
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Préstamos creados hoy (para "lo que pasó hoy")
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: inicioDiaUTC, lte: finDiaUTC },
        ...(esCobrador ? { cliente: { rutaId: { in: rutaIdsCobrador } } } : {}),
      },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Gastos de hoy. Solo owner.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioDiaUTC, lte: finDiaUTC },
      },
      _sum: { monto: true },
      _count: true,
    }),

    // Movimientos de capital hoy (retiros e inyecciones). Solo owner.
    esCobrador ? Promise.resolve([]) : prisma.movimientoCapital.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { in: ['retiro', 'inyeccion'] },
      },
      select: { tipo: true, monto: true, descripcion: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Alerta: clientes activos sin ruta asignada. Solo owner.
    esCobrador ? Promise.resolve(0) : prisma.cliente.count({
      where: {
        organizationId: orgId,
        rutaId: null,
        estado: { notIn: ['eliminado', 'inactivo'] },
        prestamos: { some: { estado: 'activo' } },
      },
    }),

    // Alerta: prestamos activos sin pagos hace +7 dias (clientes "abandonados")
    // Usa ultimoPagoAt denormalizado en vez de subqueries every/none sobre pagos
    // (every/none generan dependent subqueries por fila, caros a escala).
    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: {
          estado: { notIn: ['eliminado', 'inactivo'] },
          ...filtroRutaCliente,
        },
        OR: [
          { ultimoPagoAt: null },
          { ultimoPagoAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),

    // Pagos individuales de los ultimos 30 dias para construir sparkline 7d y heatmap 30d
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicio30DiasUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      select: { montoPagado: true, fechaPago: true },
    }),

    // Pagos del mes CON el prestamo para calcular interes ganado proporcional.
    // Solo owner (el cobrador no ve la ganancia del negocio).
    esCobrador ? Promise.resolve([]) : prisma.pago.findMany({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      select: {
        montoPagado: true,
        prestamo: { select: { montoPrestado: true, totalAPagar: true } },
      },
    }),
  ])

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  let saldoPorCobrar = 0
  let capitalPrestado = 0
  let cuotaDiariaTotal = 0
  const proximosACompletar = []

  // Cachear diasExcluidos por cliente: los prestamos del mismo cliente
  // comparten el calculo. Evita repetirlo cientos de veces en orgs grandes.
  const diasExcluidosCache = new Map()
  const getDiasExcluidos = (cliente) => {
    if (!cliente?.id) return obtenerDiasSinCobro(cliente, cliente?.ruta, org)
    if (!diasExcluidosCache.has(cliente.id)) {
      diasExcluidosCache.set(cliente.id, obtenerDiasSinCobro(cliente, cliente?.ruta, org))
    }
    return diasExcluidosCache.get(cliente.id)
  }

  for (const p of prestamosActivosDetalle) {
    clientesActivos.add(p.clienteId)
    // Cartera activa = totalAPagar (capital + intereses esperados). Lo que va
    // a entrar a la organizacion cuando se cobre todo. NO es saldo pendiente.
    carteraActiva += p.totalAPagar ?? 0
    // Saldo por cobrar = saldo pendiente real (totalAPagar - pagado, sin recargos/descuentos).
    saldoPorCobrar += calcularSaldoPendiente(p)
    capitalPrestado += p.montoPrestado ?? 0
    cuotaDiariaTotal += p.cuotaDiaria ?? 0

    const diasExcluidos = getDiasExcluidos(p.cliente)
    if (calcularDiasMora(p, diasExcluidos, festivos) > 0) {
      clientesMora.add(p.clienteId)
    }

    const saldoP = calcularSaldoPendiente(p)
    const pctPagado = p.totalAPagar > 0 ? Math.round(((p.totalPagado || 0) / p.totalAPagar) * 100) : 0
    if (pctPagado >= 80 && pctPagado < 100 && saldoP > 0) {
      const cuotasRest = p.cuotaDiaria > 0 ? Math.ceil(saldoP / p.cuotaDiaria) : 0
      proximosACompletar.push({
        prestamoId: p.id,
        clienteId: p.clienteId,
        clienteNombre: p.cliente?.nombre ?? '—',
        clienteTelefono: p.cliente?.telefono ?? null,
        rutaNombre: p.cliente?.ruta?.nombre ?? null,
        montoPrestado: p.montoPrestado,
        saldoPendiente: Math.round(saldoP),
        porcentaje: pctPagado,
        cuotaDiaria: p.cuotaDiaria,
        cuotasRestantes: cuotasRest,
      })
    }
  }

  // Patrimonio = lo que te deben (saldo real por cobrar) + lo que tienes en caja.
  //
  // NO se restan los gastos del mes: `capital.saldo` YA los descontó. En
  // lib/capital.js el tipo 'gasto' esta en la lista de egresos, asi que todo
  // gasto aprobado ya bajo el saldo. Restarlos aqui otra vez subestimaba el
  // patrimonio exactamente en los gastos del mes, y es el numero por el que el
  // dueño decide si retira utilidades.
  const cajaDisponible = capitalRow?.saldo ?? 0
  const gastosMes = gastosMesAgg?._sum?.monto ?? 0 // se sigue enviando: la UI lo muestra aparte
  const patrimonio = esCobrador ? null : calcularPatrimonio({ saldoPorCobrar, cajaDisponible })

  // Mapear cobradorIds a nombres para el desglose de hoy
  const cobradorIds = (pagosHoyPorCobrador || []).map(g => g.cobradorId).filter(Boolean)
  const cobradores = cobradorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: cobradorIds }, organizationId: orgId },
        select: { id: true, nombre: true },
      })
    : []
  const nombrePorId = new Map(cobradores.map(c => [c.id, c.nombre]))
  const desgloseCobradores = (pagosHoyPorCobrador || [])
    .map(g => ({
      cobradorId: g.cobradorId,
      nombre: g.cobradorId ? (nombrePorId.get(g.cobradorId) || 'Cobrador eliminado') : 'Sin asignar',
      pagos: g._count,
      monto: g._sum?.montoPagado ?? 0,
    }))
    .sort((a, b) => b.monto - a.monto)

  // Totales del dia para "lo que paso hoy"
  const prestamosHoyMontoTotal = prestamosHoy.reduce((acc, p) => acc + (p.montoPrestado ?? 0), 0)
  const retirosHoyMonto = (movimientosHoy || []).filter(m => m.tipo === 'retiro').reduce((a, m) => a + m.monto, 0)
  const inyeccionesHoyMonto = (movimientosHoy || []).filter(m => m.tipo === 'inyeccion').reduce((a, m) => a + m.monto, 0)
  const gastosHoyMonto = gastosHoy?._sum?.monto ?? 0
  const gastosHoyCount = gastosHoy?._count ?? 0

  // Comparativos vs ayer
  const cobrosAyerMonto = pagosAyer?._sum?.montoPagado ?? 0
  const cobrosAyerCount = pagosAyer?._count ?? 0

  // Interes ganado este mes (proporcional). Solo owner.
  // De cada pago, fraccion de interes = (totalAPagar - montoPrestado) / totalAPagar.
  // Funciona para prestamos y mercancia (ahi el "interes" es la ganancia
  // = precio venta - costo). El resto del pago es recuperacion de capital.
  let interesGanadoMes = null
  if (!esCobrador) {
    let interes = 0
    for (const pago of (pagosMesDetalle || [])) {
      const total = pago.prestamo?.totalAPagar ?? 0
      const capital = pago.prestamo?.montoPrestado ?? 0
      const monto = pago.montoPagado ?? 0
      if (total > 0 && total > capital) {
        interes += monto * ((total - capital) / total)
      }
    }
    interesGanadoMes = Math.round(interes)
  }

  // Sparkline 7d y Heatmap 30d (de mas viejo a mas reciente, hoy es el ultimo)
  // sparkline7d[6] = hoy, heatmap30d[29] = hoy
  const sparkline7d = Array(7).fill(0)
  const heatmap30d = Array(30).fill(0)
  for (const p of pagos30Dias) {
    const fecha = new Date(p.fechaPago)
    const offsetMs = Math.abs(getUtcOffset(country)) * 60 * 60 * 1000
    const fechaCO = new Date(fecha.getTime() - offsetMs)
    const diaCO = Date.UTC(fechaCO.getUTCFullYear(), fechaCO.getUTCMonth(), fechaCO.getUTCDate())
    const hoyCO = Date.UTC(y, m, d)
    const diasAtras = Math.floor((hoyCO - diaCO) / (24 * 60 * 60 * 1000))
    if (diasAtras >= 0 && diasAtras < 30) {
      heatmap30d[29 - diasAtras] += p.montoPagado
      if (diasAtras < 7) sparkline7d[6 - diasAtras] += p.montoPagado
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    clientes: {
      total:  clientesActivos.size,
      enMora: clientesMora.size,
    },
    prestamos: {
      activos:         prestamosActivosDetalle.length,
      completados:     prestamosCompletados,
      carteraActiva:   carteraActiva,
      saldoPorCobrar:  saldoPorCobrar,
      capitalPrestado: capitalPrestado,
      cuotaDiariaTotal: cuotaDiariaTotal,
    },
    finanzas: esCobrador ? null : {
      cajaDisponible,
      gastosMes,
      patrimonio,
    },
    cobros: {
      hoy:         pagosHoy._sum?.montoPagado    ?? 0,
      cantidadHoy: pagosHoy._count              ?? 0,
      mes:         pagosMes._sum?.montoPagado   ?? 0,
      cantidadMes: pagosMes._count              ?? 0,
      ayer:        cobrosAyerMonto,
      cantidadAyer: cobrosAyerCount,
      interesGanadoMes,
      sparkline7d,
      heatmap30d,
    },
    rutas: {
      activas: rutasActivas ?? 0,
    },
    ultimosPagos: ultimosPagos.map((p) => ({
      id:         p.id,
      cliente:    p.prestamo.cliente.nombre,
      monto:      p.montoPagado,
      fecha:      p.fechaPago,
      tipo:       p.tipo,
    })),
    // Nuevo: resumen completo del dia (lo que paso hoy)
    actividadHoy: {
      pagos: {
        cantidad: pagosHoy._count ?? 0,
        monto: pagosHoy._sum?.montoPagado ?? 0,
      },
      prestamos: {
        cantidad: prestamosHoy.length,
        monto: prestamosHoyMontoTotal,
        lista: prestamosHoy.slice(0, 5).map(p => ({
          id: p.id,
          cliente: p.cliente?.nombre ?? '—',
          monto: p.montoPrestado,
          totalAPagar: p.totalAPagar,
        })),
      },
      gastos: esCobrador ? null : {
        cantidad: gastosHoyCount,
        monto: gastosHoyMonto,
      },
      retiros: esCobrador ? null : {
        monto: retirosHoyMonto,
      },
      inyecciones: esCobrador ? null : {
        monto: inyeccionesHoyMonto,
      },
      desgloseCobradores: esCobrador ? null : desgloseCobradores,
    },
    alertas: esCobrador ? null : {
      clientesSinRuta: clientesSinRutaCount ?? 0,
      prestamosSinPagosLargo: clientesSinPagosLargo ?? 0,
      mora30plus: 0,
      proximosACompletar: proximosACompletar
        .sort((a, b) => b.porcentaje - a.porcentaje)
        .slice(0, 20),
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
