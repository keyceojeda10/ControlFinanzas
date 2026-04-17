// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { obtenerDiasSinCobro, esHoySinCobro } from '@/lib/dias-sin-cobro'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5
const DAY_MS = 24 * 60 * 60 * 1000
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const fmtFechaColombia = (d) => {
  // Si recibimos YYYY-MM-DD, agregar timezone Colombia para evitar que se interprete como UTC
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

// Convierte una fecha YYYY-MM-DD de Colombia a rango UTC
// Ej: "2026-03-04" -> { inicio: 2026-03-04T05:00:00Z, fin: 2026-03-05T04:59:59Z }
const getColombiaDayRange = (fechaColombia) => {
  const inicio = new Date(fechaColombia + 'T00:00:00-05:00')
  const fin    = new Date(fechaColombia + 'T23:59:59.999-05:00')
  return { inicio, fin }
}

// Obtiene la fecha de hoy en Colombia como YYYY-MM-DD
const getHoyColombia = () => {
  const ahora = new Date(Date.now() - COLOMBIA_OFFSET)
  return ahora.toISOString().slice(0, 10)
}

const diasAtrasDesdeHoy = (fechaObjetivo, fechaHoy = getHoyColombia()) => {
  const hoy = new Date(fechaHoy + 'T00:00:00-05:00')
  const objetivo = new Date(fechaObjetivo + 'T00:00:00-05:00')
  return Math.floor((hoy - objetivo) / DAY_MS)
}


// Calcula el total esperado real desde los préstamos activos de las rutas.
// Respeta la jerarquía de días sin cobro cliente→ruta→org: si HOY es día sin cobro
// para ese cliente, su cuota no se espera (el cobrador no tiene por qué cobrarla).
async function calcularEsperadoReal(organizationId, cobradorId = null) {
  const whereRuta = { organizationId, activo: true }
  if (cobradorId) whereRuta.cobradorId = cobradorId

  const [rutas, org] = await Promise.all([
    prisma.ruta.findMany({
      where: whereRuta,
      select: {
        diasSinCobro: true,
        clientes: {
          select: {
            diasSinCobro: true,
            prestamos: {
              where: { estado: 'activo' },
              select: { cuotaDiaria: true },
            },
          },
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
  ])

  return rutas.reduce((total, ruta) =>
    total + ruta.clientes.reduce((a, c) => {
      const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
      if (esHoySinCobro(diasExcluidos)) return a
      return a + c.prestamos.reduce((b, p) => b + p.cuotaDiaria, 0)
    }, 0), 0)
}

// Calcula desembolsos realizados en el día para reflejar el saldo real de caja.
async function calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWherePrestamos = {
    organizationId,
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Vista global owner: total desembolsado de todos los préstamos del día.
  if (!cobradorId) {
    const desembolsosDia = await prisma.prestamo.aggregate({
      where: baseWherePrestamos,
      _sum: { montoPrestado: true },
    })
    return desembolsosDia._sum?.montoPrestado || 0
  }

  // Vista por cobrador: combinar (a) clientes de su ruta y (b) préstamos creados por su perfil.
  const [prestamosRuta, movimientosCreador, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        ...baseWherePrestamos,
        cliente: { ruta: { cobradorId } },
      },
      select: { id: true, montoPrestado: true },
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        creadoPorId: cobradorId,
        referenciaTipo: 'prestamo',
      },
      select: { referenciaId: true, monto: true },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: cobradorId,
        accion: 'crear_prestamo',
        createdAt: { gte: inicio, lt: fin },
      },
      select: { entidadId: true },
    }),
  ])

  const prestamoIdsActividad = actividadesCreador
    .map((a) => a.entidadId)
    .filter((id) => !!id)

  const prestamosActividad = prestamoIdsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: prestamoIdsActividad },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true },
    })
    : []

  const referenciasMovimiento = movimientosCreador
    .map((mov) => mov.referenciaId)
    .filter((id) => !!id)

  const prestamosReferenciados = referenciasMovimiento.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: referenciasMovimiento },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true },
    })
    : []

  const referenciasValidas = new Set(prestamosReferenciados.map((p) => p.id))

  const idsContabilizados = new Set(prestamosRuta.map((p) => p.id))
  let total = prestamosRuta.reduce((acc, p) => acc + p.montoPrestado, 0)

  for (const p of prestamosActividad) {
    if (!idsContabilizados.has(p.id)) {
      total += p.montoPrestado
      idsContabilizados.add(p.id)
    }
  }

  for (const mov of movimientosCreador) {
    if (!mov.referenciaId) {
      continue
    }
    if (!referenciasValidas.has(mov.referenciaId)) continue
    if (!idsContabilizados.has(mov.referenciaId)) {
      total += mov.monto
      idsContabilizados.add(mov.referenciaId)
    }
  }

  return total
}

async function getCajaGeneralStats(organizationId, fechaColombia) {
  const capital = await prisma.capital.findUnique({
    where: { organizationId },
    select: {
      saldo: true,
      createdAt: true,
    },
  })

  // Fuente oficial del saldo general: capital persistente actual.
  if (capital) {
    return {
      saldoActual: Math.round(capital.saldo || 0),
      fechaInicioAcumulado: capital.createdAt || null,
      fechaInicioDisplay: capital.createdAt ? fmtFechaColombia(capital.createdAt) : null,
    }
  }

  // Fallback de compatibilidad para organizaciones antiguas sin registro en Capital.
  const fechaCorte = typeof fechaColombia === 'string' && FECHA_REGEX.test(fechaColombia)
    ? fechaColombia
    : new Date(fechaColombia).toISOString().slice(0, 10)

  const { fin } = getColombiaDayRange(fechaCorte)

  const primerCierre = await prisma.cierreCaja.findFirst({
    where: { organizationId },
    orderBy: { fecha: 'asc' },
    select: { fecha: true },
  })

  if (!primerCierre) {
    return {
      saldoActual: 0,
      fechaInicioAcumulado: null,
      fechaInicioDisplay: null,
    }
  }

  const fechaInicioAcumulado = new Date(primerCierre.fecha)

  const [cierresAcumulado, movimientosManualesCaja] = await Promise.all([
    prisma.cierreCaja.aggregate({
      where: {
        organizationId,
        fecha: { gte: fechaInicioAcumulado, lte: fin },
      },
      _sum: { saldoRealCaja: true },
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        createdAt: { gte: fechaInicioAcumulado, lte: fin },
        OR: [
          {
            tipo: 'ajuste',
            referenciaTipo: 'caja_ajuste',
          },
          {
            tipo: { in: ['inyeccion', 'retiro'] },
            referenciaTipo: 'caja_capital_manual',
          },
        ],
      },
      select: {
        tipo: true,
        monto: true,
        saldoAnterior: true,
        saldoNuevo: true,
      },
    }),
  ])

  const saldoCierresAcumulado = cierresAcumulado._sum?.saldoRealCaja || 0
  const netoMovimientosCajaAcumulado = movimientosManualesCaja.reduce((acc, mov) => {
    if (mov.tipo === 'inyeccion') return acc + mov.monto
    if (mov.tipo === 'retiro') return acc - mov.monto
    const esIngreso = mov.saldoNuevo >= mov.saldoAnterior
    return acc + (esIngreso ? mov.monto : -mov.monto)
  }, 0)

  return {
    saldoActual: saldoCierresAcumulado + netoMovimientosCajaAcumulado,
    fechaInicioAcumulado,
    fechaInicioDisplay: fmtFechaColombia(fechaInicioAcumulado),
  }
}

// Calcula estadísticas del día
async function getStatsDia(organizationId, fecha, cobradorId = null) {
  // Convertir fecha Colombia a UTC
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10)
  const { inicio, fin } = getColombiaDayRange(fechaStr)

  // Obtener pagos del día usando rango UTC correcto
  const wherePagos = {
    prestamo: { organizationId },
    fechaPago: { gte: inicio, lt: fin },
  }
  if (cobradorId) {
    wherePagos.cobradorId = cobradorId
  }

  const pagosDia = await prisma.pago.findMany({
    where: { ...wherePagos, tipo: { notIn: ['recargo', 'descuento'] } },
    select: { montoPagado: true }
  })

  const recogida = pagosDia.reduce((a, p) => a + p.montoPagado, 0)

  // Calcular esperado real desde las cuotas diarias de préstamos activos
  const esperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId))

  // Obtener gastos del día
  const whereGastosDia = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    estado: 'aprobado',
  }
  if (cobradorId) whereGastosDia.cobradorId = cobradorId

  const gastosDia = await prisma.gastoMenor.aggregate({
    where: whereGastosDia,
    _sum: { monto: true },
  })

  // Movimientos manuales de caja/capital del día (inyecciones, retiros y ajustes)
  // para reflejar el dinero físico real disponible en caja.
  const movimientosManualDia = cobradorId
    ? []
    : await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        tipo: { in: ['capital_inicial', 'inyeccion', 'retiro', 'ajuste'] },
        OR: [
          { referenciaTipo: null },
          { referenciaTipo: { in: ['caja_ajuste', 'caja_capital_manual'] } },
        ],
      },
      select: {
        tipo: true,
        monto: true,
        saldoAnterior: true,
        saldoNuevo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

  // Base inicial del día = saldo de capital justo antes del primer movimiento del día.
  // Si no hubo movimientos hoy, base = saldo actual de capital.
  // Se calcula SIEMPRE (owner y cobrador) porque ahora ambos ven el mismo saldo en caja.
  let baseInicialDia = 0
  let saldoCapitalActual = 0
  const cap = await prisma.capital.findUnique({
    where: { organizationId },
    select: { saldo: true },
  })
  if (cap) {
    saldoCapitalActual = Number(cap.saldo || 0)
    const primerMov = await prisma.movimientoCapital.findFirst({
      where: { organizationId, createdAt: { gte: inicio, lt: fin } },
      orderBy: { createdAt: 'asc' },
      select: { saldoAnterior: true },
    })
    baseInicialDia = primerMov ? Number(primerMov.saldoAnterior || 0) : saldoCapitalActual
  }

  const gastos = gastosDia._sum?.monto || 0
  const desembolsadoDia = await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId)
  const ajustesManualDia = movimientosManualDia.reduce((acc, mov) => {
    if (mov.tipo === 'capital_inicial' || mov.tipo === 'inyeccion') return acc + mov.monto
    if (mov.tipo === 'retiro') return acc - mov.monto
    const esIngreso = mov.saldoNuevo >= mov.saldoAnterior
    return acc + (esIngreso ? mov.monto : -mov.monto)
  }, 0)
  const diferencia = recogida - esperado
  const disponibleOperativo = recogida - gastos
  const saldoRealCaja = disponibleOperativo - desembolsadoDia
  const saldoRealCajaConAjustes = saldoRealCaja + ajustesManualDia
  // Saldo en caja del día — MISMO valor para owner y cobrador.
  // Fuente de verdad: saldo de capital actual (refleja TODOS los movimientos: cobros,
  // desembolsos, gastos, cancelaciones, reversos, ajustes). Así el cobrador ve el
  // mismo saldo que el owner y ambos pueden coordinar cuánto hay disponible para prestar.
  const disponibleHoy = Math.round(saldoCapitalActual)
  // Ajustes "operativos" del día = todo lo que cambió capital - cobrado + prestado + gastos.
  // Esto deja visible el delta no operativo (retiros, cancelaciones, etc).
  // Se calcula tanto para owner como para cobrador porque ambos comparten el mismo saldo.
  const ajustesOperativosDia = Math.round((saldoCapitalActual - baseInicialDia) - recogida + desembolsadoDia + gastos)
  const disponible = disponibleOperativo // Compatibilidad temporal

  // Calcular tasa de recaudo
  const tasaRecaudo = esperado > 0 ? Math.round((recogida / esperado) * 100) : 0

  return {
    esperado,
    recogida,
    gastos,
    desembolsadoDia,
    diferencia,
    disponibleOperativo,
    saldoRealCaja,
    ajustesManualDia,
    saldoRealCajaConAjustes,
    baseInicialDia: Math.round(baseInicialDia),
    ajustesOperativosDia,
    disponibleHoy,
    disponible,
    tasaRecaudo,
  }
}

// ─── GET /api/caja ──────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  
  const fechaParam = searchParams.get('fecha')
  const cobradorParam = searchParams.get('cobradorId')

  // Usar fecha de Colombia (hoy por defecto)
  const fechaBase = fechaParam || getHoyColombia()

  const { inicio, fin } = getColombiaDayRange(fechaBase)

  const whereCierres = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
    ...(rol === 'owner' && cobradorParam && { cobradorId: cobradorParam }),
  }

  // Obtener cierres del día
  const cierres = await prisma.cierreCaja.findMany({
    where: whereCierres,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Obtener stats del día
  const statsCobradorId = rol === 'cobrador' ? userId : (rol === 'owner' ? (cobradorParam || null) : null)
  const [statsDiaRaw, cajaGeneral] = await Promise.all([
    getStatsDia(organizationId, fechaBase, statsCobradorId),
    rol === 'owner' ? getCajaGeneralStats(organizationId, fechaBase) : Promise.resolve(null),
  ])

  // Cobrador: oculta `ajustesManualDia` (solo relevante en cifras operativas internas
  // que el cobrador no necesita ver). El `disponibleHoy` ya llega calculado igual que al owner.
  const statsDia = rol === 'owner'
    ? statsDiaRaw
    : {
      ...statsDiaRaw,
      ajustesManualDia: 0,
      saldoRealCajaConAjustes: statsDiaRaw.saldoRealCaja,
    }

  // Obtener gastos del día para mostrar en lista
  const whereGastos = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
  }
  if (rol === 'cobrador') {
    whereGastos.cobradorId = userId
  }

  const gastos = await prisma.gastoMenor.findMany({
    where: whereGastos,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  })

  const wherePagosDia = {
    organizationId,
    fechaPago: { gte: inicio, lt: fin },
    tipo: { notIn: ['recargo', 'descuento'] },
  }
  if (rol === 'cobrador') {
    wherePagosDia.cobradorId = userId
  }
  if (rol === 'owner' && cobradorParam) {
    wherePagosDia.cobradorId = cobradorParam
  }

  const pagosDiaRaw = await prisma.pago.findMany({
    where: wherePagosDia,
    select: {
      id: true,
      montoPagado: true,
      fechaPago: true,
      tipo: true,
      metodoPago: true,
      plataforma: true,
      cobrador: {
        select: { id: true, nombre: true },
      },
      prestamo: {
        select: {
          id: true,
          cliente: {
            select: { id: true, nombre: true, cedula: true },
          },
        },
      },
    },
    orderBy: { fechaPago: 'desc' },
    take: 400,
  })

  const pagosDia = pagosDiaRaw.map((pago) => ({
    id: pago.id,
    montoPagado: Math.round(pago.montoPagado || 0),
    fechaPago: pago.fechaPago,
    tipo: pago.tipo,
    metodoPago: pago.metodoPago || null,
    plataforma: pago.plataforma || null,
    cobradorId: pago.cobrador?.id || null,
    cobradorNombre: pago.cobrador?.nombre || null,
    prestamoId: pago.prestamo?.id || null,
    clienteId: pago.prestamo?.cliente?.id || null,
    clienteNombre: pago.prestamo?.cliente?.nombre || 'Cliente',
    clienteCedula: pago.prestamo?.cliente?.cedula || null,
  }))
  const totalPagosDia = pagosDia.reduce((acc, pago) => acc + pago.montoPagado, 0)

  // Para owner: obtener lista de cobradores con estado de cierre
  let cobradores = []
  if (rol === 'owner') {
    const [todosCobradores, recaudosDiaRaw, rutasActivas] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, rol: 'cobrador', activo: true },
        select: { id: true, nombre: true },
      }),
      prisma.pago.groupBy({
        by: ['cobradorId'],
        where: {
          organizationId,
          fechaPago: { gte: inicio, lt: fin },
          tipo: { notIn: ['recargo', 'descuento'] },
          cobradorId: { not: null },
        },
        _sum: { montoPagado: true },
      }),
      prisma.ruta.findMany({
        where: { organizationId, activo: true },
        select: {
          cobradorId: true,
          clientes: {
            select: {
              prestamos: {
                where: { estado: 'activo' },
                select: { cuotaDiaria: true },
              },
            },
          },
        },
      }),
    ])

    const recaudoPorCobrador = recaudosDiaRaw.reduce((acc, row) => {
      if (!row.cobradorId) return acc
      acc[row.cobradorId] = Math.round(row._sum?.montoPagado || 0)
      return acc
    }, {})

    const esperadoPorCobrador = rutasActivas.reduce((acc, ruta) => {
      if (!ruta.cobradorId) return acc
      const esperadoRuta = ruta.clientes.reduce((totalCliente, cliente) =>
        totalCliente + cliente.prestamos.reduce((totalPrestamo, p) => totalPrestamo + p.cuotaDiaria, 0), 0)

      acc[ruta.cobradorId] = Math.round((acc[ruta.cobradorId] || 0) + esperadoRuta)
      return acc
    }, {})

    const cierreIds = new Set(cierres.map(c => c.cobradorId))
    cobradores = todosCobradores.map(c => {
      const cierre = cierres.find(ci => ci.cobradorId === c.id) || null
      const recaudadoDia = recaudoPorCobrador[c.id] || 0
      const esperadoDia = esperadoPorCobrador[c.id] || 0

      return {
        id: c.id,
        nombre: c.nombre,
        cerrado: cierreIds.has(c.id),
        cierre,
        recaudadoDia,
        esperadoDia,
        sugeridoCierre: recaudadoDia,
      }
    })
  }

  const payload = {
    cierres,
    gastos,
    pagosDia,
    resumenPagosDia: {
      cantidad: pagosDia.length,
      total: totalPagosDia,
    },
    cobradores,
    stats: {
      dia: statsDia,
    },
    fechaDisplay: fmtFechaColombia(fechaBase),
    fecha: typeof fechaBase === 'string' ? fechaBase : new Date(fechaBase).toISOString().slice(0, 10)
  }

  if (rol === 'owner' && cajaGeneral) {
    payload.stats.cajaGeneral = cajaGeneral
  }

  return Response.json(payload)
}

// ─── POST /api/caja ─────────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const body = await request.json()

  const cobradorId = rol === 'owner' ? (body.cobradorId ?? userId) : userId

  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  const fechaColombia = typeof body.fecha === 'string' && FECHA_REGEX.test(body.fecha)
    ? body.fecha
    : getHoyColombia()

  const diasAtras = diasAtrasDesdeHoy(fechaColombia)
  if (diasAtras < 0) {
    return Response.json({ error: 'No puedes registrar cierres en fechas futuras' }, { status: 400 })
  }

  const maxDiasAtrasPermitidos = rol === 'owner' ? 7 : 1
  if (diasAtras > maxDiasAtrasPermitidos) {
    return Response.json({ error: 'Esta fecha ya no está disponible para ajustes' }, { status: 403 })
  }

  const { inicio, fin } = getColombiaDayRange(fechaColombia)

  const existeCierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicio, lt: fin },
    },
  })

  const totalRecogido = Number(body.totalRecogido ?? 0)
  if (totalRecogido < 0) {
    return Response.json({ error: 'El total recogido no puede ser negativo' }, { status: 400 })
  }

  const totalEsperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId))

  // Obtener gastos del día
  const gastosDia = await prisma.gastoMenor.aggregate({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicio, lt: fin },
      estado: 'aprobado',
    },
    _sum: { monto: true },
  })

  const totalGastos = gastosDia._sum?.monto || 0
  const totalDesembolsadoDia = await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId)
  const saldoOperativoDia = totalRecogido - totalGastos
  const saldoRealCajaDia = saldoOperativoDia - totalDesembolsadoDia
  const diferencia = totalRecogido - totalEsperado

  if (existeCierre) {
    if (diasAtras === 0 && rol !== 'owner') {
      return Response.json({ error: 'Ya existe un cierre de caja para hoy' }, { status: 409 })
    }

    const cierreActualizado = await prisma.cierreCaja.update({
      where: { id: existeCierre.id },
      data: {
        totalEsperado: Math.round(totalEsperado),
        totalRecogido: Math.round(totalRecogido),
        totalGastos: Math.round(totalGastos),
        totalDesembolsado: Math.round(totalDesembolsadoDia),
        saldoOperativo: Math.round(saldoOperativoDia),
        saldoRealCaja: Math.round(saldoRealCajaDia),
        diferencia: Math.round(diferencia),
      },
      include: { cobrador: { select: { id: true, nombre: true } } },
    })

    logActividad({
      session,
      accion: 'ajuste_cierre_caja',
      entidadTipo: 'caja',
      entidadId: cierreActualizado.id,
      detalle: `Ajuste cierre ${cobrador.nombre} (${fmtFechaColombia(fechaColombia)}) - recogido $${Math.round(totalRecogido).toLocaleString('es-CO')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ...cierreActualizado,
      ajustado: true,
      resumenFinanciero: {
        totalDesembolsadoDia: cierreActualizado.totalDesembolsado,
        saldoOperativoDia: cierreActualizado.saldoOperativo,
        saldoRealCajaDia: cierreActualizado.saldoRealCaja,
      },
    }, { status: 200 })
  }

  const cierre = await prisma.cierreCaja.create({
    data: {
      organizationId,
      cobradorId,
      fecha: new Date(fechaColombia + 'T00:00:00-05:00'),
      totalEsperado: Math.round(totalEsperado),
      totalRecogido: Math.round(totalRecogido),
      totalGastos: Math.round(totalGastos),
      totalDesembolsado: Math.round(totalDesembolsadoDia),
      saldoOperativo: Math.round(saldoOperativoDia),
      saldoRealCaja: Math.round(saldoRealCajaDia),
      diferencia: Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  logActividad({ session, accion: 'cierre_caja', entidadTipo: 'caja', entidadId: cierre.id, detalle: `Cierre de caja ${cobrador.nombre} - recogido $${Math.round(totalRecogido).toLocaleString('es-CO')}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({
    ...cierre,
    resumenFinanciero: {
      totalDesembolsadoDia: cierre.totalDesembolsado,
      saldoOperativoDia: cierre.saldoOperativo,
      saldoRealCajaDia: cierre.saldoRealCaja,
    },
  }, { status: 201 })
}
