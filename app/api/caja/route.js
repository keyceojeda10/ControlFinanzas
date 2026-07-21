// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { tienePeriodoEsperadoHoy } from '@/lib/calculos'
import { getUtcOffset, getLocalDateStr, getLocalDayRange, formatFechaCorta } from '@/lib/i18n'

const DAY_MS = 24 * 60 * 60 * 1000
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const fmtFechaLocal = (d, country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const offsetStr = `-${pad(absOffset)}:00`
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + `T12:00:00${offsetStr}`)
    : new Date(d)
  return formatFechaCorta(fecha, country)
}

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

const getHoyLocal = (country = 'co') => getLocalDateStr(country)

const diasAtrasDesdeHoy = (fechaObjetivo, country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const offsetStr = `-${pad(absOffset)}:00`
  const fechaHoy = getHoyLocal(country)
  const hoy = new Date(fechaHoy + `T00:00:00${offsetStr}`)
  const objetivo = new Date(fechaObjetivo + `T00:00:00${offsetStr}`)
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
              // El clavo no genera cuota esperada (es el lado negativo): se excluye de la meta.
              where: { estado: 'activo', esClavo: false },
              select: {
                cuotaDiaria: true,
                frecuencia: true,
                fechaInicio: true,
                diasPlazo: true,
                diaCobroSemana: true,
                diaCobroMes: true,
                diaCobroMes2: true,
              },
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

  // Meta del dia: solo cuenta cuotas de prestamos cuyo ciclo de cobro toca
  // hoy (segun frecuencia + dia ancla). Antes sumaba TODAS las cuotas activas,
  // lo que inflaba la meta con cuotas semanales/mensuales que no se cobraban hoy.
  return rutas.reduce((total, ruta) =>
    total + ruta.clientes.reduce((a, c) => {
      const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
      const hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo([])
      return a + c.prestamos.reduce((b, p) => {
        return tienePeriodoEsperadoHoy(p, hoySinCobro, diasExcluidos, [])
          ? b + p.cuotaDiaria
          : b
      }, 0)
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
  // Para renovaciones, el MovimientoCapital tiene el monto real entregado en mano
  // (no el montoPrestado completo), así que se prioriza el monto del movimiento.
  // Buscar rutas del cobrador para incluir movimientos hechos por el owner en sus rutas
  const rutasCobrador = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true },
  })
  const rutaIds = rutasCobrador.map(r => r.id)

  const [prestamosRuta, movimientosDesembolso, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        ...baseWherePrestamos,
        cliente: { ruta: { cobradorId } },
      },
      select: { id: true, montoPrestado: true },
    }),
    // Movimientos de desembolso: por el cobrador O en sus rutas (incluye los del owner)
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        OR: [
          { creadoPorId: cobradorId },
          ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ],
      },
      select: { referenciaId: true, monto: true, createdAt: true },
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

  // Mapa de préstamo → monto real del movimiento (el más reciente gana si hubo edición)
  const montoRealPorPrestamo = new Map()
  for (const m of movimientosDesembolso) {
    if (!m.referenciaId) continue
    const prev = montoRealPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.createdAt) {
      montoRealPorPrestamo.set(m.referenciaId, { monto: m.monto, createdAt: m.createdAt })
    }
  }

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

  const idsContabilizados = new Set()
  let total = 0

  // Préstamos de la ruta: usar monto del movimiento si existe (correcto en renovaciones)
  for (const p of prestamosRuta) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : p.montoPrestado
  }

  // Préstamos creados por el cobrador fuera de su ruta
  for (const p of prestamosActividad) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : p.montoPrestado
  }

  // Movimientos del cobrador sin préstamo en ruta/actividad
  for (const mov of movimientosDesembolso) {
    if (!mov.referenciaId || idsContabilizados.has(mov.referenciaId)) continue
    idsContabilizados.add(mov.referenciaId)
    const real = montoRealPorPrestamo.get(mov.referenciaId)
    total += real ? real.monto : mov.monto
  }

  return total
}

// Suma el monto de seguros cobrados en el día (prestamos creados con seguro=true).
// El seguro YA viene sumado al total del prestamo; aqui solo se totaliza como
// referencia de "cuanto se gano en seguros" en el cierre del dia.
// Owner (cobradorId null): todos los del dia. Cobrador: los de clientes de su ruta.
async function calcularSegurosDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWhere = {
    organizationId,
    seguro: true,
    montoSeguro: { gt: 0 },
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Vista owner: todos los seguros del dia.
  if (!cobradorId) {
    const r = await prisma.prestamo.aggregate({
      where: baseWhere,
      _sum: { montoSeguro: true },
      _count: true,
    })
    return { monto: Math.round(r._sum?.montoSeguro || 0), cantidad: r._count || 0 }
  }

  // Vista cobrador: prestamos con seguro de (a) clientes de su ruta o (b) creados
  // por el (via actividadLog). Mismo criterio que el desembolsado del dia para
  // que el cuadrito de seguros sea consistente y no deje fuera prestamos que el
  // cobrador hizo a clientes de otra ruta.
  const [porRuta, actividades] = await Promise.all([
    prisma.prestamo.findMany({
      where: { ...baseWhere, cliente: { ruta: { cobradorId } } },
      select: { id: true, montoSeguro: true },
    }),
    prisma.actividadLog.findMany({
      where: { organizationId, userId: cobradorId, accion: 'crear_prestamo', createdAt: { gte: inicio, lt: fin } },
      select: { entidadId: true },
    }),
  ])

  const ids = new Map(porRuta.map(p => [p.id, p.montoSeguro || 0]))
  const idsActividad = actividades.map(a => a.entidadId).filter(Boolean).filter(id => !ids.has(id))
  if (idsActividad.length > 0) {
    const extra = await prisma.prestamo.findMany({
      where: { ...baseWhere, id: { in: idsActividad } },
      select: { id: true, montoSeguro: true },
    })
    for (const p of extra) ids.set(p.id, p.montoSeguro || 0)
  }

  let monto = 0
  for (const v of ids.values()) monto += v
  return { monto: Math.round(monto), cantidad: ids.size }
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
      fechaInicioDisplay: capital.createdAt ? fmtFechaLocal(capital.createdAt) : null,
    }
  }

  // Fallback de compatibilidad para organizaciones antiguas sin registro en Capital.
  const fechaCorte = typeof fechaColombia === 'string' && FECHA_REGEX.test(fechaColombia)
    ? fechaColombia
    : new Date(fechaColombia).toISOString().slice(0, 10)

  const { fin } = getDayRange(fechaCorte)

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
    fechaInicioDisplay: fmtFechaLocal(fechaInicioAcumulado),
  }
}

// Calcula estadísticas del día
// verSaldoCaja: si es true (owner siempre, o cobrador con permiso), expone saldoCapitalActual
// como disponibleHoy. Si es false (cobrador sin permiso), usa el flujo operativo del día.
async function getStatsDia(organizationId, fecha, cobradorId = null, verSaldoCaja = true) {
  // Convertir fecha Colombia a UTC
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10)
  const { inicio, fin } = getDayRange(fechaStr)

  // Obtener pagos del día usando rango UTC correcto.
  // Los pagos de un prestamo clavo SI cuentan en el recaudado/caja: es dinero
  // real que entró y el cobrador debe cuadrarlo. Lo unico que se aisla del clavo
  // es el lado negativo (mora, cuotas vencidas, cartera/esperado) — no los cobros.
  const wherePagos = {
    prestamo: { organizationId, estado: { not: 'cancelado' } },
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
    estado: { in: ['pendiente', 'aprobado'] },
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
  const segurosCobradosDia = await calcularSegurosDia(organizationId, inicio, fin, cobradorId)
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
  // Saldo en caja del día.
  // Si `verSaldoCaja` (owner o cobrador con permiso): devuelve saldoCapitalActual
  // (fuente de verdad, refleja TODOS los movimientos). Así cobrador y owner comparten el número.
  // Si NO tiene permiso: devuelve solo el flujo operativo (recogido - prestado - gastos).
  const disponibleHoy = verSaldoCaja
    ? Math.round(saldoCapitalActual)
    : saldoRealCaja
  // Ajustes "operativos" del día = todo lo que cambió capital - cobrado + prestado + gastos.
  // Solo relevante si el usuario tiene permiso para ver el saldo de caja (owner o
  // cobrador con verSaldoCaja); si no, queda en 0 porque el cobrador no ve ese saldo.
  const ajustesOperativosDia = verSaldoCaja
    ? Math.round((saldoCapitalActual - baseInicialDia) - recogida + desembolsadoDia + gastos)
    : 0
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
    segurosCobradosDia,
  }
}

// ─── GET /api/caja ──────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId, permisos } = session.user
  const { searchParams } = new URL(request.url)
  
  const fechaParam = searchParams.get('fecha')
  const cobradorParam = searchParams.get('cobradorId')
  // Rango histórico (opcional): si llegan desde/hasta, se devuelve un bloque "rango"
  // con totales acumulados del periodo (sin tocar la vista de día).
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  // Usar fecha de Colombia (hoy por defecto)
  const fechaBase = fechaParam || getHoyLocal()

  const { inicio, fin } = getDayRange(fechaBase)

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
      reabiertoPor: { select: { id: true, nombre: true } },
      solicitudReaperturaPor: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Obtener stats del día
  const statsCobradorId = rol === 'cobrador' ? userId : (rol === 'owner' ? (cobradorParam || null) : null)
  // Owner siempre ve saldoCapitalActual. Cobrador solo si tiene el permiso.
  const puedeVerSaldoCaja = rol === 'owner' || Boolean(permisos?.verSaldoCaja)
  const [statsDiaRaw, cajaGeneral] = await Promise.all([
    getStatsDia(organizationId, fechaBase, statsCobradorId, puedeVerSaldoCaja),
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
    prestamo: { estado: { not: 'cancelado' } },
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
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      }),
      prisma.pago.groupBy({
        by: ['cobradorId'],
        where: {
          organizationId,
          fechaPago: { gte: inicio, lt: fin },
          tipo: { notIn: ['recargo', 'descuento'] },
          cobradorId: { not: null },
          prestamo: { estado: { not: 'cancelado' } },
        },
        _sum: { montoPagado: true },
      }),
      prisma.ruta.findMany({
        where: { organizationId, activo: true },
        select: {
          cobradorId: true,
          diasSinCobro: true,
          clientes: {
            select: {
              diasSinCobro: true,
              prestamos: {
                // El clavo no aporta cuota esperada al cobrador (es el lado negativo).
                where: { estado: 'activo', esClavo: false },
                select: {
                  cuotaDiaria: true,
                  frecuencia: true,
                  fechaInicio: true,
                  diasPlazo: true,
                  diaCobroSemana: true,
                  diaCobroMes: true,
                  diaCobroMes2: true,
                },
              },
            },
          },
        },
      }),
    ])
    const orgCfg = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    })

    const recaudoPorCobrador = recaudosDiaRaw.reduce((acc, row) => {
      if (!row.cobradorId) return acc
      acc[row.cobradorId] = Math.round(row._sum?.montoPagado || 0)
      return acc
    }, {})

    const esperadoPorCobrador = rutasActivas.reduce((acc, ruta) => {
      if (!ruta.cobradorId) return acc
      const esperadoRuta = ruta.clientes.reduce((totalCliente, cliente) => {
        const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, orgCfg)
        const hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo([])
        return totalCliente + cliente.prestamos.reduce((totalPrestamo, p) => {
          return tienePeriodoEsperadoHoy(p, hoySinCobro, diasExcluidos, [])
            ? totalPrestamo + p.cuotaDiaria
            : totalPrestamo
        }, 0)
      }, 0)

      acc[ruta.cobradorId] = Math.round((acc[ruta.cobradorId] || 0) + esperadoRuta)
      return acc
    }, {})

    const cierreIds = new Set(cierres.map(c => c.cobradorId))
    cobradores = await Promise.all(todosCobradores.map(async (c) => {
      const cierre = cierres.find(ci => ci.cobradorId === c.id) || null
      const recaudadoDia = recaudoPorCobrador[c.id] || 0
      const esperadoDia = esperadoPorCobrador[c.id] || 0

      // Caja detallada por cobrador: lo que prestó, los seguros que generó, sus gastos,
      // el efectivo que maneja hoy y el capital que le queda a sus rutas (sub-bolsa).
      const [prestadoDia, segurosDia, gastosAgg, rutasCobrador] = await Promise.all([
        calcularDesembolsadoDia(organizationId, inicio, fin, c.id),
        calcularSegurosDia(organizationId, inicio, fin, c.id),
        prisma.gastoMenor.aggregate({
          where: { organizationId, cobradorId: c.id, estado: 'aprobado', fecha: { gte: inicio, lt: fin } },
          _sum: { monto: true },
        }),
        prisma.ruta.findMany({
          where: { cobradorId: c.id, organizationId, activo: true },
          select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true },
          orderBy: { orden: 'asc' },
        }),
      ])
      const gastosDiaCobrador = Math.round(gastosAgg._sum?.monto || 0)
      const prestadoDiaR = Math.round(prestadoDia || 0)
      const rutasConCapital = rutasCobrador.filter(r => r.capitalHabilitado)
      const capitalRutasTotal = rutasConCapital.reduce((a, r) => a + (r.saldoCapital || 0), 0)

      return {
        id: c.id,
        nombre: c.nombre,
        cerrado: cierreIds.has(c.id),
        cierre,
        recaudadoDia,
        esperadoDia,
        sugeridoCierre: recaudadoDia,
        prestadoDia: prestadoDiaR,
        segurosDia: { monto: Math.round(segurosDia?.monto || 0), cantidad: segurosDia?.cantidad || 0 },
        gastosDia: gastosDiaCobrador,
        // Efectivo en mano hoy = cobrado - prestado - gastos.
        efectivoDia: recaudadoDia - prestadoDiaR - gastosDiaCobrador,
        capitalRutas: rutasConCapital.length > 0 ? {
          total: Math.round(capitalRutasTotal),
          rutas: rutasConCapital.map(r => ({ id: r.id, nombre: r.nombre, saldoCapital: Math.round(r.saldoCapital || 0) })),
        } : null,
      }
    }))
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
    fechaDisplay: fmtFechaLocal(fechaBase),
    fecha: typeof fechaBase === 'string' ? fechaBase : new Date(fechaBase).toISOString().slice(0, 10)
  }

  if (rol === 'owner' && cajaGeneral) {
    payload.stats.cajaGeneral = cajaGeneral
  }

  // Capital TOTAL de la organización (saldo en caja + cartera activa).
  //
  // La condicion era solo `rol === 'cobrador' && permisos?.verCapital`, asi que
  // el DUEÑO nunca recibia el dato y la tarjeta simplemente no le aparecia,
  // aunque el front si lo da por permitido (useAuth: puedeVerCapital = esOwner
  // || permisos.verCapital). Era un olvido, no una decision de diseño.
  if (rol === 'owner' || (rol === 'cobrador' && permisos?.verCapital)) {
    const [cap, prestamosActivos] = await Promise.all([
      prisma.capital.findUnique({
        where: { organizationId },
        select: { saldo: true },
      }),
      prisma.prestamo.findMany({
        // esClavo excluido: el schema define el clavo como prestamo incobrable
        // que "se excluye de saldos/cartera/capital", y asi lo hacen las demas
        // pantallas. Aqui se colaba e inflaba la cartera de esta tarjeta.
        where: { organizationId, estado: 'activo', esClavo: false },
        select: {
          totalAPagar: true,
          montoPrestado: true,
          pagos: { select: { montoPagado: true, tipo: true } },
        },
      }),
    ])
    const saldoCaja = Math.round(cap?.saldo ?? 0)
    let carteraActiva = 0   // pendiente por cobrar, CON intereses
    let capitalPrestado = 0 // capital puro colocado, SIN intereses
    for (const p of prestamosActivos) {
      const pagado = p.pagos
        .filter((pg) => !['recargo', 'descuento'].includes(pg.tipo))
        .reduce((a, pg) => a + pg.montoPagado, 0)
      carteraActiva   += Math.max(0, (p.totalAPagar || 0) - pagado)
      capitalPrestado += p.montoPrestado || 0
    }
    payload.stats.capitalOrganizacion = {
      saldoCaja,
      carteraActiva: Math.round(carteraActiva),
      capitalPrestado: Math.round(capitalPrestado),
      // Se deja el mismo significado de siempre a proposito: cambiar que cuenta
      // como "capital total" es una decision del negocio, no un refactor.
      total: saldoCaja + Math.round(carteraActiva),
    }
  }

  // Cobrador con permiso verCapitalRuta: ve SOLO el capital de SU(S) ruta(s).
  // Muestra la suma total + el desglose por ruta. No ve el capital global.
  if (rol === 'cobrador' && permisos?.verCapitalRuta) {
    const rutaIds = session.user.rutaIds ?? []
    if (rutaIds.length > 0) {
      const rutasCobrador = await prisma.ruta.findMany({
        where: { id: { in: rutaIds }, organizationId },
        select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true },
        orderBy: { orden: 'asc' },
      })
      const rutasConCapital = rutasCobrador.filter(r => r.capitalHabilitado)
      if (rutasConCapital.length > 0) {
        const total = rutasConCapital.reduce((a, r) => a + (r.saldoCapital || 0), 0)
        payload.stats.capitalRutas = {
          total: Math.round(total),
          rutas: rutasConCapital.map(r => ({ id: r.id, nombre: r.nombre, saldoCapital: Math.round(r.saldoCapital || 0) })),
        }
      }
    }
  }

  // Bloque "rango" (histórico acumulado): solo si llegan desde/hasta válidos.
  // Devuelve totales del periodo (cobrado, prestado, gastos, # pagos) + lista de pagos,
  // sin alterar la vista de día. Respeta el cobrador seleccionado (owner) o el propio (cobrador).
  if (desdeParam && hastaParam && FECHA_REGEX.test(desdeParam) && FECHA_REGEX.test(hastaParam)) {
    const { inicio: inicioRango } = getDayRange(desdeParam)
    const { fin: finRango } = getDayRange(hastaParam)
    const cobradorRango = rol === 'cobrador' ? userId : (cobradorParam || null)

    const wherePagosRango = {
      organizationId,
      fechaPago: { gte: inicioRango, lt: finRango },
      tipo: { notIn: ['recargo', 'descuento'] },
      prestamo: { estado: { not: 'cancelado' } },
    }
    if (cobradorRango) wherePagosRango.cobradorId = cobradorRango

    const whereGastosRango = {
      organizationId,
      fecha: { gte: inicioRango, lt: finRango },
      estado: 'aprobado',
    }
    if (cobradorRango) whereGastosRango.cobradorId = cobradorRango

    const [pagosRangoRaw, gastosRangoAgg, prestadoRango, segurosRango] = await Promise.all([
      prisma.pago.findMany({
        where: wherePagosRango,
        select: {
          id: true, montoPagado: true, fechaPago: true, tipo: true,
          metodoPago: true, plataforma: true,
          cobrador: { select: { id: true, nombre: true } },
          prestamo: { select: { cliente: { select: { nombre: true } } } },
        },
        orderBy: { fechaPago: 'desc' },
        take: 1000,
      }),
      prisma.gastoMenor.aggregate({ where: whereGastosRango, _sum: { monto: true } }),
      calcularDesembolsadoDia(organizationId, inicioRango, finRango, cobradorRango),
      calcularSegurosDia(organizationId, inicioRango, finRango, cobradorRango),
    ])

    const pagosRango = pagosRangoRaw.map((p) => ({
      id: p.id,
      montoPagado: Math.round(p.montoPagado || 0),
      fechaPago: p.fechaPago,
      cobradorNombre: p.cobrador?.nombre || null,
      clienteNombre: p.prestamo?.cliente?.nombre || 'Cliente',
    }))
    const cobradoRango = pagosRango.reduce((a, p) => a + p.montoPagado, 0)
    const prestadoRangoR = Math.round(prestadoRango || 0)
    const gastosRangoR = Math.round(gastosRangoAgg._sum?.monto || 0)

    // Resumen por día (para la lista inteligente en semana/mes): agrupa el cobrado por fecha local.
    const porDiaMap = {}
    for (const p of pagosRango) {
      const f = fmtFechaLocal(p.fechaPago)
      porDiaMap[f] = (porDiaMap[f] || 0) + p.montoPagado
    }
    const porDia = Object.entries(porDiaMap)
      .map(([fecha, cobrado]) => ({ fecha, cobrado: Math.round(cobrado) }))

    // Desglose por método de pago del período
    const desgloseMetodoRango = {}
    for (const p of pagosRangoRaw) {
      const mp = p.metodoPago || 'otro'
      if (mp === 'transferencia') {
        const pl = p.plataforma || 'Transferencia'
        if (!desgloseMetodoRango[pl]) desgloseMetodoRango[pl] = { monto: 0, tipo: 'transferencia' }
        desgloseMetodoRango[pl].monto += Number(p.montoPagado || 0)
      } else if (mp === 'efectivo') {
        if (!desgloseMetodoRango['Efectivo']) desgloseMetodoRango['Efectivo'] = { monto: 0, tipo: 'efectivo' }
        desgloseMetodoRango['Efectivo'].monto += Number(p.montoPagado || 0)
      }
    }
    const desgloseMetodoPago = Object.entries(desgloseMetodoRango)
      .map(([label, v]) => ({ label, monto: Math.round(v.monto), tipo: v.tipo }))
      .sort((a, b) => b.monto - a.monto)

    payload.rango = {
      desde: desdeParam,
      hasta: hastaParam,
      cobrado: cobradoRango,
      prestado: prestadoRangoR,
      gastos: gastosRangoR,
      seguros: { monto: Math.round(segurosRango?.monto || 0), cantidad: segurosRango?.cantidad || 0 },
      efectivoNeto: cobradoRango - prestadoRangoR - gastosRangoR,
      cantidadPagos: pagosRango.length,
      pagos: pagosRango,
      porDia,
      desgloseMetodoPago,
    }
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
    : getHoyLocal()

  const diasAtras = diasAtrasDesdeHoy(fechaColombia)
  if (diasAtras < 0) {
    return Response.json({ error: 'No puedes registrar cierres en fechas futuras' }, { status: 400 })
  }

  const maxDiasAtrasPermitidos = rol === 'owner' ? 7 : 1
  if (diasAtras > maxDiasAtrasPermitidos) {
    return Response.json({ error: 'Esta fecha ya no está disponible para ajustes' }, { status: 403 })
  }

  const { inicio, fin } = getDayRange(fechaColombia)

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

    const recogidoAntes = Math.round(existeCierre.totalRecogido || 0)
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
        editadoEn: new Date(),
        editadoPorId: userId,
        // Re-confirmar el cierre vuelve a bloquear nuevos pagos.
        reabiertoEn: null,
        reabiertoPorId: null,
        solicitudReaperturaEn: null,
        solicitudReaperturaPorId: null,
      },
      include: { cobrador: { select: { id: true, nombre: true } } },
    })

    const quienEdita = rol === 'owner' && cobradorId !== userId ? ' (editado por admin)' : ''
    logActividad({
      session,
      accion: 'ajuste_cierre_caja',
      entidadTipo: 'caja',
      entidadId: cierreActualizado.id,
      detalle: `Ajuste cierre ${cobrador.nombre} (${fmtFechaLocal(fechaColombia)})${quienEdita} - recogido $${recogidoAntes.toLocaleString('es-CO')} -> $${Math.round(totalRecogido).toLocaleString('es-CO')}`,
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
