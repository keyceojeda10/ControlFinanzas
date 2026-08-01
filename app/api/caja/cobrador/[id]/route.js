// app/api/caja/cobrador/[id]/route.js
// Caja detallada de UN cobrador para una fecha: lo que prestó, lo que cobró, los
// seguros que generó, sus gastos, el efectivo que maneja hoy, el capital que le
// queda a cada una de sus rutas, y la línea de movimientos del día (cobros +
// préstamos entregados + gastos). Solo accesible por el owner de la organización.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const TIPOS_AJUSTE_PAGO = ['recargo', 'descuento']

// Lista deduplicada de préstamos que el cobrador entregó en el día, con cliente,
// monto REAL desembolsado (no montoPrestado, porque en renovaciones el monto del
// MovimientoCapital ya descuenta el saldo absorbido), ruta y hora.
// rutaIds: IDs de las rutas activas del cobrador (para capturar desembolsos hechos
// por el owner en nombre del cobrador — en esos casos creadoPorId es el owner, no el cobrador).
async function getDesembolsosCobradorDia(organizationId, inicio, fin, cobradorId, rutaIds = []) {
  // Fuente primaria: MovimientoCapital de tipo desembolso — tiene el monto real.
  // En renovaciones = diferencia entregada en mano; en préstamos nuevos = montoPrestado.
  // Busca por creadoPorId (cobrador creó) OR rutaId (movimiento pertenece a su ruta,
  // aunque lo haya creado el owner).
  const [movimientos, prestamosRutaDia] = await Promise.all([
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
      select: { referenciaId: true, monto: true, rutaId: true, createdAt: true },
    }),
    // Préstamos de la ruta del cobrador en el día (para detectar los que no tienen
    // MovimientoCapital — orgs sin capital configurado — y también para obtener nombres).
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
        cliente: { ruta: { cobradorId } },
      },
      select: {
        id: true,
        montoPrestado: true,
        renovadoDeId: true,
        createdAt: true,
        cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
      },
    }),
  ])

  // Mapa de préstamo ID → monto real del MovimientoCapital (el más reciente gana,
  // porque al editar un préstamo se crea un nuevo desembolso con el monto corregido).
  const montoRealPorPrestamo = new Map()
  for (const m of movimientos) {
    if (!m.referenciaId) continue
    const prev = montoRealPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.fecha) {
      montoRealPorPrestamo.set(m.referenciaId, { monto: m.monto, rutaId: m.rutaId, fecha: m.createdAt })
    }
  }

  // También buscar préstamos fuera de la ruta que el cobrador creó (via MovimientoCapital)
  const idsEnRuta = new Set(prestamosRutaDia.map((p) => p.id))
  const idsExtraConMovimiento = [...montoRealPorPrestamo.keys()].filter((id) => !idsEnRuta.has(id))
  let prestamosExtra = []
  if (idsExtraConMovimiento.length > 0) {
    prestamosExtra = await prisma.prestamo.findMany({
      where: { organizationId, id: { in: idsExtraConMovimiento }, estado: { not: 'cancelado' } },
      select: {
        id: true,
        montoPrestado: true,
        renovadoDeId: true,
        createdAt: true,
        cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
      },
    })
  }

  const vistos = new Set()
  const items = []

  const agregar = (p, montoOverride) => {
    if (!p || vistos.has(p.id)) return
    vistos.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    items.push({
      tipo: 'prestamo',
      id: p.id,
      // Usa el monto del MovimientoCapital si existe (correcto en renovaciones).
      // Sin movimiento: en una RENOVACION el efectivo entregado no es el monto
      // nuevo (incluye el saldo viejo absorbido, que nunca salio de la caja);
      // asumir montoPrestado inflaba la salida. En prestamo nuevo si es el monto.
      monto: mov?.monto ?? montoOverride ?? (p.renovadoDeId ? 0 : p.montoPrestado),
      // `monto` es el EFECTIVO que salio; `valor` es el tamaño de la cartulina.
      // En un prestamo nuevo son iguales; en una renovacion el valor incluye el
      // saldo viejo absorbido, que nunca salio de la caja. Se llevan los dos para
      // poder resumir el dia sin que falte nada (ver prestadoDetalle en el GET).
      valor: p.montoPrestado || 0,
      esRenovacion: !!p.renovadoDeId,
      cliente: p.cliente?.nombre || null,
      clienteCedula: p.cliente?.cedula || null,
      rutaId: p.cliente?.ruta?.id || mov?.rutaId || null,
      rutaNombre: p.cliente?.ruta?.nombre || null,
      fecha: mov?.fecha || p.createdAt,
    })
  }

  for (const p of prestamosRutaDia) agregar(p)
  for (const p of prestamosExtra) agregar(p)

  return items
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Solo el owner ve la caja detallada de otro cobrador.
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver la caja por cobrador' }, { status: 403 })
  }

  const { organizationId, country = 'co' } = session.user
  const { id: cobradorId } = await params
  const { searchParams } = new URL(request.url)
  // Soporta día único (?fecha=) o rango histórico acumulado (?desde=&hasta=).
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')
  const FECHA_RX = /^\d{4}-\d{2}-\d{2}$/
  const esRango = desdeParam && hastaParam && FECHA_RX.test(desdeParam) && FECHA_RX.test(hastaParam)
  const fechaBase = searchParams.get('fecha') || getLocalDateStr(country)
  const { inicio } = esRango ? getLocalDayRange(desdeParam, country) : getLocalDayRange(fechaBase, country)
  const { fin }    = esRango ? getLocalDayRange(hastaParam, country) : getLocalDayRange(fechaBase, country)

  // Validar cobrador + leer config de la org en paralelo.
  const [cobrador, org] = await Promise.all([
    prisma.user.findFirst({
      where: { id: cobradorId, organizationId, rol: 'cobrador' },
      select: { id: true, nombre: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { capitalEsEfectivo: true, renovacionesEnCobrado: true },
    }),
  ])
  if (!cobrador) {
    return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })
  }

  // Obtener rutas primero para pasarlas a getDesembolsosCobradorDia y capturar
  // desembolsos hechos por el owner en rutas del cobrador (creadoPorId = owner).
  const rutas = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true },
    orderBy: { orden: 'asc' },
  })
  const rutaIds = rutas.map((r) => r.id)

  // Esta pantalla es la caja POR RUTA: todo lo que se movio en las rutas del
  // cobrador. Los desembolsos ya se buscaban por `creadoPorId OR rutaId`, pero los
  // cobros solo por `cobradorId` — asimetria que dejaba la caja contradiciendose:
  // al reasignar una ruta a un cobrador nuevo, su caja mostraba el PRESTADO de la
  // ruta (y hasta el "inicio del dia" calculado con lo cobrado) pero Cobrado $0,
  // porque los pagos los habia registrado el cobrador anterior o el dueño.
  // Ahora los cobros usan el mismo criterio: registrados por el cobrador O de
  // clientes de sus rutas.
  const wherePagoCaja = {
    fechaPago: { gte: inicio, lt: fin },
    prestamo: { organizationId, estado: { not: 'cancelado' } },
    OR: [
      { cobradorId },
      ...(rutaIds.length > 0 ? [{ prestamo: { cliente: { rutaId: { in: rutaIds } } } }] : []),
    ],
  }

  const [cobros, gastos, desembolsos, cierre, recargos, primerMovPorRuta] = await Promise.all([
    // Cobros del día: pagos reales (excluye ajustes) del cobrador o de sus rutas.
    prisma.pago.findMany({
      where: {
        ...wherePagoCaja,
        tipo: { notIn: TIPOS_AJUSTE_PAGO },
      },
      select: {
        montoPagado: true,
        fechaPago: true,
        metodoPago: true,
        plataforma: true,
        prestamo: {
          select: {
            esClavo: true,
            cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
          },
        },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.gastoMenor.findMany({
      where: { organizationId, cobradorId, estado: { in: ['pendiente', 'aprobado'] }, fecha: { gte: inicio, lt: fin } },
      select: { monto: true, description: true, fecha: true, estado: true },
      orderBy: { fecha: 'asc' },
    }),
    getDesembolsosCobradorDia(organizationId, inicio, fin, cobradorId, rutaIds),
    prisma.cierreCaja.findFirst({
      where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } },
      select: { id: true },
    }),
    // Recargos del día: aplicados por el cobrador o en clientes de sus rutas
    prisma.pago.aggregate({
      where: {
        ...wherePagoCaja,
        tipo: 'recargo',
      },
      _sum: { montoPagado: true },
      _count: { id: true },
    }),
    // Movimientos del día por ruta para calcular delta neto y saldo de apertura
    rutaIds.length > 0
      ? prisma.movimientoCapital.findMany({
          where: {
            organizationId,
            rutaId: { in: rutaIds },
            createdAt: { gte: inicio, lt: fin },
          },
          select: { rutaId: true, tipo: true, monto: true, saldoAnterior: true, saldoNuevo: true, ajusteArranqueRuta: true, descripcion: true },
        })
      : [],
  ])

  // Saldo de apertura = saldoCapital actual - delta neto del día.
  // Cada movimiento incrementó o decrementó la sub-bolsa de la ruta:
  //   ingreso (recaudo, inyeccion, capital_inicial) → +monto
  //   egreso (desembolso, gasto, retiro) → −monto
  //   ajuste → usamos la diferencia saldoNuevo−saldoAnterior del capital global
  //            para determinar la dirección (positiva = ingreso a la ruta)
  const TIPOS_INGRESO = new Set(['recaudo', 'inyeccion', 'capital_inicial'])
  const TIPOS_EGRESO = new Set(['desembolso', 'gasto', 'retiro'])
  const deltaPorRuta = new Map()
  for (const m of primerMovPorRuta) {
    if (!m.rutaId) continue
    const prev = deltaPorRuta.get(m.rutaId) || 0
    let delta = 0
    if (TIPOS_INGRESO.has(m.tipo)) delta = m.monto
    else if (TIPOS_EGRESO.has(m.tipo)) delta = -m.monto
    else if (m.tipo === 'ajuste') {
      if (m.ajusteArranqueRuta) {
        delta = m.monto
      } else {
        delta = (m.saldoNuevo >= m.saldoAnterior) ? m.monto : -m.monto
      }
    }
    deltaPorRuta.set(m.rutaId, prev + delta)
  }
  const saldoAperturaTotal = rutas.reduce((acc, r) => {
    const delta = deltaPorRuta.get(r.id) || 0
    return acc + Math.round((r.saldoCapital || 0) - delta)
  }, 0)

  // Renovaciones del dia: cuanto se renovo en total, cuanto de eso fue saldo viejo
  // "absorbido" (la cartulina: el cliente ya lo debia, no entrego efectivo) y cuanto
  // salio en mano.
  const renovacionesDia = rutaIds.length > 0
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
        renovadoDeId: { not: null },
        cliente: { rutaId: { in: rutaIds } },
      },
      select: { id: true, montoPrestado: true },
    })
    : []
  const entregadoPorPrestamo = new Map(desembolsos.map(d => [d.id, d.monto || 0]))
  let renovadoValorTotal = 0
  let renovadoEntregado = 0
  for (const r of renovacionesDia) {
    renovadoValorTotal += r.montoPrestado || 0
    renovadoEntregado += entregadoPorPrestamo.get(r.id) ?? 0
  }
  const absorbidoRenovaciones = Math.round(Math.max(0, renovadoValorTotal - renovadoEntregado))

  // Vista BRUTA (opcional por negocio): el saldo absorbido se cuenta como cobrado
  // Y como prestado. Es como piensa el prestamista de gota a gota ("recogi la
  // cartulina y presté una nueva") y es lo que hace la competencia. El efectivo del
  // dia sale IGUAL en las dos vistas porque se suma a ambos lados; sumarlo solo al
  // cobrado inflaria la caja.
  const brutoRenovaciones = !!org?.renovacionesEnCobrado
  const ajusteBruto = brutoRenovaciones ? absorbidoRenovaciones : 0

  // Totales del día.
  const cobradoDia = Math.round(cobros.reduce((a, p) => a + (p.montoPagado || 0), 0)) + ajusteBruto
  const prestadoDia = Math.round(desembolsos.reduce((a, d) => a + (d.monto || 0), 0)) + ajusteBruto
  const gastosDia = Math.round(gastos.reduce((a, g) => a + (g.monto || 0), 0))
  // Gastos aún PENDIENTES: no han bajado el saldoCapital de la ruta todavía.
  // Los APROBADOS ya descontaron del saldoCapital (ver fix en gastos/[id]).
  const gastosPendientesDia = Math.round(
    gastos.filter((g) => g.estado === 'pendiente').reduce((a, g) => a + (g.monto || 0), 0)
  )
  // ── EN QUE SE COBRO ──────────────────────────────────────────────────────
  //
  // Una caja fisica no contiene Nequi. En el cliente de 10 cobradores el 12%
  // del recaudo entra por transferencia ($35.261.200 en 736 pagos) y la caja lo
  // contaba como efectivo, asi que el fajo de la noche NO PODIA cuadrar nunca y
  // el cobrador cargaba con un faltante que no era suyo.
  //
  // Lo que no dice nada cuenta como efectivo: es el modo por defecto de un
  // cobro en la calle, y descartarlo perdia plata del desglose.
  const cobradoDigital = Math.round(
    cobros.filter((p) => p.metodoPago === 'transferencia').reduce((a, p) => a + (p.montoPagado || 0), 0)
  )
  const cobradoEfectivo = cobradoDia - cobradoDigital

  let efectivoDia = cobradoDia - prestadoDia - gastosDia
  const capitalRutasTotal = Math.round(rutas.filter(r => r.capitalHabilitado).reduce((a, r) => a + (r.saldoCapital || 0), 0))
  const recargosMontoTotal = Math.round(recargos._sum?.montoPagado || 0)
  const recargosCantidad = recargos._count?.id || 0

  // Desglose por ruta: prestado / cobrado / seguros + saldoCapital de la ruta.
  // Los seguros se generan al crear el préstamo, así que se cuentan junto al desembolso.
  const porRutaMap = new Map(
    rutas.map((r) => [r.id, {
      rutaId: r.id,
      nombre: r.nombre,
      saldoCapital: Math.round(r.saldoCapital || 0),
      // Sin capital habilitado el saldo de la ruta no significa nada (la bolsa es
      // global). Se envia para que la UI no alerte por un cero que no es un saldo.
      capitalHabilitado: !!r.capitalHabilitado,
      prestadoDia: 0,
      cobradoDia: 0,
      segurosDia: 0,
      capitalEnCalle: 0, // acumulado colocado (stock), no el flujo del dia
      conIntereses: 0,
    }])
  )
  const bucket = (rutaId) => {
    if (rutaId && porRutaMap.has(rutaId)) return porRutaMap.get(rutaId)
    // Movimientos de clientes fuera de las rutas del cobrador (ej. préstamo creado a
    // un cliente de otra ruta): se agrupan en "Otros" para no perderlos.
    if (!porRutaMap.has('__otros__')) {
      porRutaMap.set('__otros__', { rutaId: null, nombre: 'Otros', saldoCapital: 0, prestadoDia: 0, cobradoDia: 0, segurosDia: 0, capitalEnCalle: 0, conIntereses: 0 })
    }
    return porRutaMap.get('__otros__')
  }

  for (const d of desembolsos) bucket(d.rutaId).prestadoDia += d.monto || 0
  for (const p of cobros) bucket(p.prestamo?.cliente?.ruta?.id).cobradoDia += p.montoPagado || 0

  // Vista bruta: el saldo absorbido de cada renovacion suma a AMBOS lados en la
  // ruta del cliente, igual que en los totales (si no, la suma por ruta no cuadra
  // con el total de arriba).
  if (brutoRenovaciones && renovacionesDia.length > 0) {
    const rutaPorPrestamo = new Map(desembolsos.map(d => [d.id, d.rutaId]))
    for (const r of renovacionesDia) {
      const absorbido = Math.max(0, (r.montoPrestado || 0) - (entregadoPorPrestamo.get(r.id) ?? 0))
      if (absorbido <= 0) continue
      const b = bucket(rutaPorPrestamo.get(r.id) ?? null)
      b.cobradoDia += absorbido
      b.prestadoDia += absorbido
    }
  }

  // Seguros del día por ruta (préstamos con seguro creados hoy). Se consulta aparte
  // para tener el montoSeguro real por préstamo.
  const segurosHoy = await prisma.prestamo.findMany({
    where: {
      organizationId,
      seguro: true,
      montoSeguro: { gt: 0 },
      createdAt: { gte: inicio, lt: fin },
      estado: { not: 'cancelado' },
      id: { in: desembolsos.map((d) => d.id) },
    },
    select: { id: true, montoSeguro: true, cliente: { select: { ruta: { select: { id: true } } } } },
  })
  let segurosDiaTotal = 0
  for (const s of segurosHoy) {
    segurosDiaTotal += s.montoSeguro || 0
    bucket(s.cliente?.ruta?.id).segurosDia += s.montoSeguro || 0
  }

  // Capital acumulado EN LA CALLE por ruta. Ojo: esto NO es flujo del dia (como
  // prestadoDia) sino el stock colocado. Sin esto, la tarjeta decia solo
  // "Capital: $X" mostrando unicamente la sub-bolsa disponible, y se leia como
  // si ese fuera todo el dinero de la ruta. Misma regla que rutas/[id] y el
  // listado —solo activos, sin clavos— para que las tres pantallas cuadren.
  const prestamosEnCalle = await prisma.prestamo.findMany({
    where: {
      organizationId,
      estado: 'activo',
      esClavo: false,
      cliente: { rutaId: { in: rutas.map((r) => r.id) } },
    },
    select: {
      montoPrestado: true,
      totalAPagar: true,
      cliente: { select: { ruta: { select: { id: true } } } },
    },
  })
  for (const p of prestamosEnCalle) {
    const b = bucket(p.cliente?.ruta?.id)
    b.capitalEnCalle += p.montoPrestado || 0
    b.conIntereses   += p.totalAPagar ?? p.montoPrestado ?? 0
  }

  // ⚠ AQUI SE INVENTABA PLATA.
  //
  // Habia un `efectivoDia += segurosDiaTotal + recargosMontoTotal` con el
  // comentario «son plata fisica cobrada». No lo son, ninguno de los dos:
  //
  //   · El RECARGO sube lo que el cliente DEBE. No entra un peso. Por eso el
  //     libro lo excluye del recaudo a proposito (pagos/route.js:620), y por eso
  //     tampoco puede aparecer en el fajo de la noche.
  //   · El SEGURO ya viene dentro del total del prestamo y se cobra repartido en
  //     las cuotas. Sumarlo el dia de la creacion lo cuenta DOS VECES: una en la
  //     cuota y otra aqui.
  //
  // El subtitulo de la pantalla lo declaraba sin darse cuenta: «Cobrado +
  // Seguros + Recargos − Prestado − Gastos». Las dos primeras sumas sobran.

  // ── LO QUE DEBERIA TENER EN LA MANO ──
  //
  // SOLO EFECTIVO, y como una cuenta que se puede seguir a mano:
  // con lo que salio + lo cobrado en billetes − lo prestado − lo gastado.
  //
  // Lo que entro por transferencia NO esta aqui: ya esta en la cuenta bancaria,
  // el cobrador no lo carga encima.
  const efectivoEnMano = saldoAperturaTotal + cobradoEfectivo - prestadoDia - gastosDia

  // Con `capitalEsEfectivo` el negocio entiende que el cobrador carga TODA la
  // bolsa de la ruta, no solo lo del dia. Es otra pregunta y por eso es otra
  // cifra; el saldoCapital ya tiene restados los gastos aprobados, asi que solo
  // se restan los que siguen pendientes.
  const dineroEnMano = org?.capitalEsEfectivo
    ? capitalRutasTotal - gastosPendientesDia
    : efectivoEnMano

  const porRuta = [...porRutaMap.values()].map((r) => ({
    ...r,
    prestadoDia: Math.round(r.prestadoDia),
    cobradoDia: Math.round(r.cobradoDia),
    segurosDia: Math.round(r.segurosDia),
    capitalEnCalle: Math.round(r.capitalEnCalle),
    conIntereses: Math.round(r.conIntereses),
  }))

  // Línea de movimientos del día: cobros + préstamos + gastos, ordenados por hora.
  const movimientos = [
    ...cobros.map((p) => ({
      tipo: 'cobro',
      monto: Math.round(p.montoPagado || 0),
      cliente: p.prestamo?.cliente?.nombre || null,
      clienteCedula: p.prestamo?.cliente?.cedula || null,
      rutaNombre: p.prestamo?.cliente?.ruta?.nombre || null,
      esClavo: !!p.prestamo?.esClavo,
      fecha: p.fechaPago,
    })),
    ...desembolsos.map((d) => ({
      tipo: 'prestamo',
      monto: Math.round(d.monto || 0),
      cliente: d.cliente,
      clienteCedula: d.clienteCedula,
      rutaNombre: d.rutaNombre,
      esClavo: false,
      fecha: d.fecha,
    })),
    // Los gastos NO se listan en los movimientos de caja (tienen su propio apartado
    // en el menú). Sí siguen contando en el cálculo del efectivo del día (arriba).
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  // KPIs informativos de gestión por ruta
  const [clientesNuevos, prestamosNuevos, renovaciones, clientesActivos, cobrosDia] = await Promise.all([
    prisma.cliente.count({
      where: {
        organizationId,
        rutaId: { in: rutaIds },
        createdAt: { gte: inicio, lt: fin },
      },
    }),
    prisma.prestamo.count({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
        renovadoDeId: null,
        cliente: { rutaId: { in: rutaIds } },
      },
    }),
    prisma.prestamo.count({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
        renovadoDeId: { not: null },
        cliente: { rutaId: { in: rutaIds } },
      },
    }),
    prisma.cliente.count({
      where: {
        organizationId,
        rutaId: { in: rutaIds },
        prestamos: { some: { estado: 'activo', esClavo: false } },
      },
    }),
    // Clientes cobrados: mismo criterio que los cobros (cobrador O sus rutas)
    prisma.pago.findMany({
      where: {
        ...wherePagoCaja,
        tipo: { notIn: TIPOS_AJUSTE_PAGO },
      },
      select: { prestamo: { select: { clienteId: true } } },
      distinct: ['prestamoId'],
    }),
  ])

  // Desglose por método de pago
  const desgloseMetodo = {}
  for (const p of cobros) {
    const mp = p.metodoPago || 'otro'
    if (mp === 'transferencia') {
      const pl = p.plataforma || 'Transferencia'
      desgloseMetodo[pl] = (desgloseMetodo[pl] || { monto: 0, tipo: 'transferencia' })
      desgloseMetodo[pl].monto += Number(p.montoPagado || 0)
    } else if (mp === 'efectivo') {
      desgloseMetodo['Efectivo'] = (desgloseMetodo['Efectivo'] || { monto: 0, tipo: 'efectivo' })
      desgloseMetodo['Efectivo'].monto += Number(p.montoPagado || 0)
    }
  }
  const desgloseMetodoPago = Object.entries(desgloseMetodo)
    .map(([label, v]) => ({ label, monto: Math.round(v.monto), tipo: v.tipo }))
    .sort((a, b) => b.monto - a.monto)

  const renovacionesInfo = {
    cantidad: renovacionesDia.length,
    valorTotal: Math.round(renovadoValorTotal),
    entregadoEnMano: Math.round(renovadoEntregado),
    absorbido: absorbidoRenovaciones,
    // true = el absorbido YA esta sumado en cobradoDia y prestadoDia (vista bruta)
    enCobrado: brutoRenovaciones,
  }


  // Resumen COMPLETO de lo que presto el cobrador hoy.
  //
  // Antes lo unico que resumia el dia era la caja de renovaciones, que solo se
  // pintaba si habia renovaciones CON saldo absorbido — un prestamo nuevo no la
  // generaba nunca. El dueño de la cartera mas grande lo leyo como el total del
  // dia y reporto que "los prestamos nuevos no se suman": a un cobrador suyo le
  // faltaba la mitad ($1.000.000 de $2.000.000). El numero de la tarjeta estaba
  // bien; lo que faltaba era el resumen.
  //
  // Se deriva de `desembolsos`, la MISMA lista que produce prestadoDia, para que
  // el resumen y la tarjeta no puedan contradecirse.
  const sum = (arr, campo) => Math.round(arr.reduce((a, x) => a + (x[campo] || 0), 0))
  const itemsNuevos = desembolsos.filter((d) => !d.esRenovacion)
  const itemsRenov  = desembolsos.filter((d) => d.esRenovacion)
  const valorNuevos = sum(itemsNuevos, 'valor')
  const valorRenovaciones = sum(itemsRenov, 'valor')
  const efectivoTotal = sum(desembolsos, 'monto')
  const prestadoDetalle = {
    nuevos:       { cantidad: itemsNuevos.length, valor: valorNuevos, efectivo: sum(itemsNuevos, 'monto') },
    renovaciones: {
      cantidad: itemsRenov.length,
      valor: valorRenovaciones,
      efectivo: sum(itemsRenov, 'monto'),
      absorbido: Math.max(0, valorRenovaciones - sum(itemsRenov, 'monto')),
    },
    // Lo que valen las cartulinas que entrego hoy, nuevas y renovadas.
    valorTotal: valorNuevos + valorRenovaciones,
    // Lo que de verdad salio de su mano.
    efectivoTotal,
    // Que de los dos esta mostrando la tarjeta "Prestado", para poder decirlo en
    // la UI en vez de dejar al prestamista adivinando por que no cuadran.
    tarjetaMuestra: brutoRenovaciones ? 'valor' : 'efectivo',
  }

  // ── LA CUENTA DEL DIA ────────────────────────────────────────────────────
  //
  // Las lineas en el orden en que se leen, con su signo, para poder seguirla a
  // mano. Es LA especificacion que pidio el dueño: «que hasta un niño de
  // primaria pueda sacar sus cuentas rapidas».
  //
  // La regla: TODO lo que suma o resta esta aqui. Si falta una linea, la cuenta
  // no da y no hay forma de saber por que — que es justo lo que pasaba con las
  // cinco cifras sueltas en cajitas de la version anterior.
  //
  // Cada `id` es el del catalogo de `lib/dinero/procedencia.js`, para que la
  // pantalla haga el renglon tocable sin traducir nada.
  const cuenta = [
    { id: 'apertura', rotulo: 'Con lo que salió', monto: saldoAperturaTotal, signo: 0 },
    { id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: cobradoEfectivo, signo: 1 },
    { id: 'desembolsos', rotulo: 'Prestó en efectivo', monto: prestadoDia, signo: -1 },
    { id: 'gastos', rotulo: 'Gastó', monto: gastosDia, signo: -1 },
  ].filter((l) => l.monto !== 0 || l.id === 'apertura')

  // Lo que hizo hoy: SIEMPRE cantidad y valor juntos. «10 renovaciones» sin el
  // valor no dice nada, y «$2.400.000 en renovaciones» sin cuantas tampoco.
  //
  // Lo que esta en cero NO se filtra aqui: lo decide la pantalla, que es la que
  // sabe si le sobra sitio. Pero viaja con su cero para que se pueda decir «hoy
  // no hubo renovaciones» en una linea, en vez de con una tarjeta vacia.
  const hizo = [
    { id: 'prestamosNuevos', rotulo: 'Préstamos nuevos', cantidad: prestadoDetalle.nuevos.cantidad, monto: prestadoDetalle.nuevos.efectivo },
    { id: 'renovaciones', rotulo: 'Renovaciones', cantidad: prestadoDetalle.renovaciones.cantidad, monto: prestadoDetalle.renovaciones.efectivo, nota: prestadoDetalle.renovaciones.absorbido ? `${prestadoDetalle.renovaciones.absorbido} absorbidos del saldo viejo` : null },
    { id: 'clientesNuevos', rotulo: 'Clientes nuevos', cantidad: clientesNuevos, monto: null },
    { id: 'seguros', rotulo: 'Seguros', cantidad: segurosHoy.length, monto: Math.round(segurosDiaTotal) },
    { id: 'recargos', rotulo: 'Recargos', cantidad: recargosCantidad, monto: recargosMontoTotal },
    { id: 'gastos', rotulo: 'Gastos', cantidad: gastos.length, monto: gastosDia },
  ]

  return Response.json({
    cobrador: { id: cobrador.id, nombre: cobrador.nombre },
    // La cuenta del dia y lo que hizo, ya ordenados. La pantalla los pinta, no
    // los arma: armarlos alli es como se acaba con lineas que no suman.
    cuenta,
    cuentaSuma: cuenta.reduce((a, l) => a + l.signo * l.monto, 0),
    hizo,
    fecha: esRango ? null : fechaBase,
    esRango,
    desde: esRango ? desdeParam : null,
    hasta: esRango ? hastaParam : null,
    cerrado: esRango ? null : !!cierre,
    resumen: {
      cobradoDia,
      prestadoDia,
      segurosDia: Math.round(segurosDiaTotal),
      gastosDia,
      efectivoDia,
      capitalRutasTotal,
      dineroEnMano,
      capitalEsEfectivo: !!org?.capitalEsEfectivo,
      recargosMonto: recargosMontoTotal,
      recargosCantidad,
      gastosPendientesMonto: gastosPendientesDia,
      gastosPendientesCantidad: gastos.filter((g) => g.estado === 'pendiente').length,
      saldoApertura: saldoAperturaTotal,
    },
    prestadoDetalle,
    gestion: {
      clientesNuevos,
      prestamosNuevos,
      renovaciones,
      clientesActivos,
      clientesCobrados: new Set(cobrosDia.map(p => p.prestamo?.clienteId)).size,
    },
    // Detalle de las renovaciones del dia (valor renovado / absorbido / entregado).
    // Lo consume el bloque "Renovaciones de hoy" de CajaCobradorDetalle.
    renovaciones: renovacionesInfo,
    desgloseMetodoPago,
    porRuta,
    movimientos,
    gastos: gastos.map((g) => ({
      description: g.description,
      monto: Math.round(g.monto || 0),
      fecha: g.fecha,
      estado: g.estado,
    })),
  })
}
