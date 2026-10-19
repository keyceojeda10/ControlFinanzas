// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { notificar, plata } from '@/lib/notificar'
import { calcularCapitalRestante } from '@/lib/calculos'
import { esperadoDeCartera, SELECT_PRESTAMO } from '@/lib/dinero/esperado'
import { getUtcOffset, getLocalDateStr, formatFechaCorta } from '@/lib/i18n'
// Una sola definición para los TRES sitios que cierran cajas. Ver el archivo:
// estaba duplicada con los argumentos en orden distinto y el tercer sitio se
// quedó sin ninguna, escribiendo 0.
import { calcularDesembolsadoDia } from '@/lib/dinero/desembolsado'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'
import { cobrosDeRenovadas, coteo } from '@/lib/dinero/coteo'
import { enLaManoDelDia } from '@/lib/dinero/en-la-mano'
import { rutaIdsDe, getDayRange, calcularEsperadoReal, calcularSegurosDia, getStatsDia } from '@/lib/caja/stats-dia'
import { SIN_ABONO_PREVIO, prestamosMigrados } from '@/lib/dinero/abono-previo'

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




// ── LO PRESTADO HOY, PARTIDO POR RUTA (T08-02) ─────────────────────────────
//
// La cuarta cifra que pedía la lámina de «Caja · por ruta» y que faltaba: «cada
// ruta con lo recaudado... más lo esperado y lo prestado en la calle». La dejé
// fuera cuando hice la pestaña porque `/api/rutas` no manda lo desembolsado y no
// quise repartir un total a ojo entre rutas. Esto lo trae DE VERDAD, contado
// préstamo a préstamo.
//
// La ruta sale del CLIENTE (`prestamo.cliente.ruta`), igual que en `pagosDia`:
// un préstamo no tiene ruta, la tiene la persona a la que se le presta.
//
// ⚠ SE DEVUELVE `efectivoEntregado`, NO `montoPrestado`. En una renovación el
// monto nuevo incluye el saldo viejo absorbido, que nunca salió de la caja:
// renovar $160.000 a quien ya debía $160.000 no saca un peso a la calle. Es la
// misma regla que `calcularDesembolsadoDia` y `calcularPrestadoDetalleDia`; si
// aquí se pusiera el monto de la cartulina, esta pestaña diría una cifra y el
// saldo de caja otra para el mismo día.
//
// ── EL CAPITAL DE CADA RUTA ────────────────────────────────────────────────
//
// NO se calcula aquí: `Ruta.saldoCapital` ya existe y lo mantiene
// `lib/capital.js` en cada movimiento. Reconstruirlo a mano desde
// `MovimientoCapital` es un error que ya cometí midiendo — el
// `ajusteArranqueRuta` cuenta para la RUTA (siempre como egreso) pero no para el
// saldo global, y sin eso salen cifras absurdas (me dio $2.501 millones donde
// había $14 millones).
//
// Se devuelve TAMBIÉN lo no asignado: el capital del negocio que no vive en la
// calle de ningún cobrador. En el negocio del video son $8.803.600 de
// $14.357.755, o sea que sin esa línea la suma de las rutas parecería que le
// falta plata. No es un descuadre, es plata sin ruta — y hay que decirlo.
async function calcularCapitalPorRuta(organizationId) {
  const [rutas, capital] = await Promise.all([
    prisma.ruta.findMany({
      where: { organizationId, activo: true },
      // El NOMBRE viaja aquí a propósito: si la pantalla tuviera que sacarlo de
      // `/api/rutas`, una fila se quedaría sin pintar cuando esa lista todavía
      // no se ha cargado. Ya pasó: la pestaña salía vacía con capital dentro.
      select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true },
    }),
    prisma.capital.findFirst({ where: { organizationId }, select: { saldo: true } }),
  ])

  const porRuta = rutas.map((r) => ({
    rutaId: r.id,
    nombre: r.nombre,
    saldoCapital: Math.round(r.saldoCapital || 0),
    capitalHabilitado: !!r.capitalHabilitado,
  }))
  /* ⚠ SOLO LAS RUTAS CON CAPITAL PROPIO (DETALLES-CAJA #24). En una sin él,
     `saldoCapital` es la cuenta interna de lo que movieron sus préstamos con la
     plata del negocio, no plata suya —como en las tarjetas de abajo
     (`agruparCajaPorRuta`) y al unir rutas—. Sumándolas, un negocio sin
     ninguna ruta con capital veía «Capital en las rutas −$500.933» y un aviso
     de rutas en negativo que no tenía arreglo. */
  const conCapital = porRuta.filter((r) => r.capitalHabilitado)
  const enRutas = conCapital.reduce((a, r) => a + r.saldoCapital, 0)
  const global = Math.round(capital?.saldo || 0)

  return {
    porRuta,
    global,
    enRutas,
    // Lo que queda fuera de las rutas. Puede ser negativo si las sub-bolsas
    // suman más que el global; se muestra igual, que esconderlo es peor.
    sinAsignar: global - enRutas,
    // Una sub-bolsa no puede tener menos de cero pesos FÍSICOS: si está
    // negativa, salió plata que nunca se registró como entrada.
    negativas: conCapital.filter((r) => r.saldoCapital < 0).length,
  }
}

// ── LOS GASTOS DEL DÍA, POR RUTA ───────────────────────────────────────────
//
// ⚠ `GastoMenor` NO TIENE `rutaId`. Solo `cobradorId`. Así que la ruta hay que
// deducirla del cobrador, y eso SOLO es honesto cuando ese cobrador lleva UNA
// ruta: si lleva tres, repartir su gasto entre ellas sería inventar, y esto es
// la pantalla del dinero.
//
// Medido en producción (30 días) antes de escribir esto:
//   · 31 cobradores llevan 1 ruta  → $10.280.000 asignables
//   ·  2 llevan varias             → $0 en juego
//   · en el negocio del video, los 9 llevan 1 ruta: 366 de 366 gastos
//
// O sea que en la práctica se asigna casi todo. Lo que no, NO se reparte: viaja
// aparte (`ambiguos` y `sinCobrador`) para que la pantalla pueda enseñarlo en su
// propia línea. Una cifra que no cuadra y se ve es un dato; una que no cuadra y
// se esconde es un fallo esperando.
async function calcularGastosPorRutaDia(organizationId, gastos) {
  const conCobrador = (gastos || []).filter((g) => g.cobradorId)
  if (conCobrador.length === 0) {
    const sinCobrador = (gastos || []).reduce((a, g) => a + (g.monto || 0), 0)
    return { porRuta: [], ambiguos: 0, sinCobrador: Math.round(sinCobrador) }
  }

  // Cuántas rutas activas lleva cada cobrador que gastó hoy.
  const rutas = await prisma.ruta.findMany({
    where: {
      organizationId,
      activo: true,
      cobradorId: { in: [...new Set(conCobrador.map((g) => g.cobradorId))] },
    },
    select: { id: true, cobradorId: true },
  })
  const rutasDelCobrador = new Map()
  for (const r of rutas) {
    if (!rutasDelCobrador.has(r.cobradorId)) rutasDelCobrador.set(r.cobradorId, [])
    rutasDelCobrador.get(r.cobradorId).push(r.id)
  }

  const porRuta = new Map()
  let ambiguos = 0
  let sinCobrador = 0
  for (const g of gastos || []) {
    const monto = Math.round(g.monto || 0)
    if (!g.cobradorId) { sinCobrador += monto; continue }
    const suyas = rutasDelCobrador.get(g.cobradorId) || []
    // Una sola ruta: el gasto es de esa ruta, sin ambigüedad. Varias (o
    // ninguna activa): no se reparte.
    if (suyas.length !== 1) { ambiguos += monto; continue }
    porRuta.set(suyas[0], (porRuta.get(suyas[0]) || 0) + monto)
  }

  return {
    porRuta: [...porRuta.entries()].map(([rutaId, gastado]) => ({ rutaId, gastado })),
    ambiguos: Math.round(ambiguos),
    sinCobrador: Math.round(sinCobrador),
  }
}

// Solo para MOSTRAR: no alimenta ningún saldo ni cuadre.
async function calcularPrestadoPorRutaDia(organizationId, inicio, fin) {
  const prestamos = await prisma.prestamo.findMany({
    where: {
      organizationId,
      createdAt: { gte: inicio, lt: fin },
      estado: { not: 'cancelado' },
    },
    select: {
      id: true,
      montoPrestado: true,
      renovadoDeId: true,
      cliente: { select: { ruta: { select: { id: true, nombre: true } } } },
    },
  })
  if (prestamos.length === 0) return []

  // El movimiento manda sobre `montoPrestado` porque en las renovaciones guarda
  // lo que de verdad se entregó en mano. El más reciente gana, por si se editó.
  const movs = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      tipo: 'desembolso',
      // Ver la nota de arriba: la reserva de ruta no es plata entregada.
      ajusteArranqueRuta: false,
      createdAt: { gte: inicio, lt: fin },
      referenciaTipo: 'prestamo',
      referenciaId: { in: prestamos.map((p) => p.id) },
    },
    select: { referenciaId: true, monto: true, createdAt: true },
  })
  const entregadoPorPrestamo = new Map()
  for (const m of movs) {
    if (!m.referenciaId) continue
    const prev = entregadoPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.createdAt) entregadoPorPrestamo.set(m.referenciaId, m)
  }

  /* Sin los migrados, como «Lo que prestaste» de la caja (`detalleDesembolsadoDia`):
     de la caja no salió un billete (decisión de Carlos, 18 oct 2026). Sin esto
     «Por ruta» decía $1.100.000 y la caja $900.000 (DETALLES-CAJA #23). */
  const migrados = await prestamosMigrados(prisma, prestamos.map((p) => p.id))

  const porRuta = new Map()
  for (const p of prestamos) {
    if (migrados.has(p.id)) continue
    const mov = entregadoPorPrestamo.get(p.id)
    // Sin movimiento: en un préstamo nuevo lo entregado ES el monto; en una
    // renovación, cero.
    const entregado = mov ? mov.monto : (p.renovadoDeId ? 0 : (p.montoPrestado || 0))
    const id = p.cliente?.ruta?.id || '__sin_ruta__'
    if (!porRuta.has(id)) {
      porRuta.set(id, { rutaId: p.cliente?.ruta?.id || null, prestado: 0, cuantos: 0 })
    }
    const fila = porRuta.get(id)
    fila.prestado += entregado
    fila.cuantos += 1
  }

  return [...porRuta.values()].map((f) => ({
    rutaId: f.rutaId,
    prestado: Math.round(f.prestado),
    cuantos: f.cuantos,
  }))
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

  /* Los gastos del día: LA LISTA que se enseña, y de paso los gastos de cada
     ruta (`calcularGastosPorRutaDia` recibe justo este array).

     ⚠ SIN LOS RECHAZADOS, Y ESTE FILTRO FALTABA.

     Reportado por PRESTA MIL: «la ruta 9 ingresó unos gastos, acepté algunos y
     rechacé otros, y en la caja de la ruta me siguen apareciendo todos».

     El TOTAL de arriba ya los excluía (`whereGastosDia`, unos renglones más
     arriba, pide `pendiente` o `aprobado`). La lista no, así que el dueño veía
     una suma que no podía reconstruir sumando lo que le enseñaban — y los
     gastos por ruta contaban plata que él había rechazado a mano.

     Medido en su organización, el día 11 de agosto:

         TOTAL de la caja   $142.000   (10 gastos aprobados)
         LISTA de la caja   $262.000   (los mismos + uno rechazado de $120.000)

     Tiene 29 rechazados por $658.000 desde julio, así que le pasaba a diario.

     Es la MISMA regla que ya está escrita para los pagos veinte renglones más
     abajo: «la lista tiene que traer los mismos que el total de arriba». El
     rechazo en sí estaba bien: `PATCH /api/gastos/[id]` revierte su asiento de
     capital, así que la plata nunca se descontó. Solo se seguía viendo. */
  const whereGastos = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    estado: { in: ['pendiente', 'aprobado'] },
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
    // El abono previo de un migrado no se cobró ese día (abono-previo.js).
    AND: [SIN_ABONO_PREVIO],
  }
  /* La LISTA tiene que traer los mismos pagos que el TOTAL de arriba, o el
     cobrador ve una suma que no puede reconstruir sumando lo que le enseñan.
     Mismo criterio: lo suyo es su ruta, no solo lo que tecleó él. */
  const quienFiltra = rol === 'cobrador' ? userId : (rol === 'owner' ? cobradorParam : null)
  if (quienFiltra) {
    const rutasDelCobrador = await rutaIdsDe(organizationId, quienFiltra)
    wherePagosDia.OR = [
      { cobradorId: quienFiltra },
      ...(rutasDelCobrador.length ? [{ prestamo: { cliente: { rutaId: { in: rutasDelCobrador } } } }] : []),
    ]
  }

  const pagosDiaRaw = await prisma.pago.findMany({
    where: wherePagosDia,
    select: {
      id: true,
      montoPagado: true,
      fechaPago: true,
      tipo: true,
      // Para decir «parcial» o «de más» en la lista (cuota-de-referencia.js).
      cuotaEsperada: true,
      metodoPago: true,
      plataforma: true,
      cobrador: {
        select: { id: true, nombre: true },
      },
      prestamo: {
        select: {
          id: true,
          cliente: {
            // La RUTA del cliente: es lo que permite agrupar la caja por ruta
            // (T08-02) sin una consulta más. Va por el cliente y no por el pago
            // porque un pago no tiene ruta: la tiene la persona a la que se le
            // cobra.
            select: {
              id: true, nombre: true, cedula: true,
              ruta: { select: { id: true, nombre: true } },
            },
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
    cuotaEsperada: pago.cuotaEsperada ?? null,
    metodoPago: pago.metodoPago || null,
    plataforma: pago.plataforma || null,
    cobradorId: pago.cobrador?.id || null,
    cobradorNombre: pago.cobrador?.nombre || null,
    prestamoId: pago.prestamo?.id || null,
    clienteId: pago.prestamo?.cliente?.id || null,
    clienteNombre: pago.prestamo?.cliente?.nombre || 'Cliente',
    clienteCedula: pago.prestamo?.cliente?.cedula || null,
    rutaId: pago.prestamo?.cliente?.ruta?.id || null,
    rutaNombre: pago.prestamo?.cliente?.ruta?.nombre || null,
  }))
  const totalPagosDia = pagosDia.reduce((acc, pago) => acc + pago.montoPagado, 0)

  // Para owner: obtener lista de cobradores con estado de cierre
  let cobradores = []
  if (rol === 'owner') {
    // Cobradores a listar: los activos MAS los inactivos que tuvieron movimiento
    // ese dia (pagos o cierre). Sin esto, al desactivar/reemplazar un cobrador su
    // historial quedaba inalcanzable en la UI: la caja de ese dia desaparecia
    // aunque los pagos siguieran en la base (reportado: "cerre caja ayer y no
    // aparece lo cobrado" tras crear un cobrador nuevo).
    const [idsPagoDia, idsCierreDia] = await Promise.all([
      prisma.pago.findMany({
        where: {
          organizationId,
          fechaPago: { gte: inicio, lt: fin },
          tipo: { notIn: ['recargo', 'descuento'] },
          cobradorId: { not: null },
          AND: [SIN_ABONO_PREVIO],
        },
        select: { cobradorId: true },
        distinct: ['cobradorId'],
      }),
      prisma.cierreCaja.findMany({
        where: { organizationId, fecha: { gte: inicio, lt: fin } },
        select: { cobradorId: true },
        distinct: ['cobradorId'],
      }),
    ])
    const idsConMovimientoDia = [...new Set([
      ...idsPagoDia.map(p => p.cobradorId),
      ...idsCierreDia.map(c => c.cobradorId),
    ].filter(Boolean))]

    const [todosCobradores, recaudosDiaRaw, rutasActivas, renovacionesDiaOrg] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          rol: 'cobrador',
          OR: [
            { activo: true },
            ...(idsConMovimientoDia.length > 0 ? [{ id: { in: idsConMovimientoDia } }] : []),
          ],
        },
        select: { id: true, nombre: true, activo: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      }),
      /* ⚠ SE ATRIBUYE AL COBRADOR DE LA RUTA, NO SOLO A QUIEN LO REGISTRÓ.
         Esto era un `groupBy(['cobradorId'])`: solo contaba los pagos que había
         tecleado esa persona. Si el dueño cobraba en la ruta de Alex, la ficha
         de Alex lo sumaba (usa `cobradorId O su ruta`) y este listado no: la
         misma persona, el mismo día, dos cifras distintas.

         Medido en producción: 132 pagos, $5.444.000 en 7 días, 5 cobradores.

         Manda el criterio de la ficha —el de la ruta— porque es el que arregló
         el caso de reasignar una ruta: sin él la caja mostraba el PRESTADO de
         la ruta y «Cobrado $0» (ver el comentario de
         `caja/cobrador/[id]/route.js:190-197`).

         Se piden las filas y no un agregado porque hay que mirar dos cosas por
         pago (quién lo hizo Y de qué ruta es el cliente), y un pago no puede
         contarse dos veces si coinciden. */
      prisma.pago.findMany({
        where: {
          organizationId,
          fechaPago: { gte: inicio, lt: fin },
          tipo: { notIn: ['recargo', 'descuento'] },
          prestamo: { estado: { not: 'cancelado' } },
          AND: [SIN_ABONO_PREVIO],
        },
        select: {
          montoPagado: true,
          cobradorId: true,
          // Para el coteo: cruzar el pago con la cartulina que se renovó hoy.
          prestamoId: true,
          prestamo: { select: { cliente: { select: { ruta: { select: { cobradorId: true } } } } } },
        },
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
                select: SELECT_PRESTAMO,
              },
            },
          },
        },
      }),
      /* Las cartulinas que se renovaron o financiaron hoy, para el coteo. Mismo
         filtro que la ficha del cobrador (`caja/cobrador/[id]`, `renovacionesDia`). */
      prisma.prestamo.findMany({
        where: {
          organizationId,
          createdAt: { gte: inicio, lt: fin },
          estado: { not: 'cancelado' },
          renovadoDeId: { not: null },
        },
        select: { renovadoDeId: true },
      }),
    ])
    // Los festivos se cargan junto con la config: sin ellos, el esperado por
    // cobrador contaba como cobrable un dia festivo y le marcaba faltante a un
    // cobrador que no tenia nada que cobrar.
    const [orgCfg, festivosOrg] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { diasSinCobro: true },
      }),
      prisma.festivo.findMany({
        where: { organizationId },
        select: { fecha: true },
      }),
    ])

    /* Cada pago cuenta para quien lo registró Y para el cobrador de la ruta,
       pero UNA SOLA VEZ si son el mismo —que es el caso normal—. Sumarlo dos
       veces duplicaría la caja de casi todo el mundo. */
    const recaudoPorCobrador = recaudosDiaRaw.reduce((acc, pago) => {
      const monto = Number(pago.montoPagado || 0)
      const deLaRuta = pago.prestamo?.cliente?.ruta?.cobradorId || null
      const quienCobro = pago.cobradorId || null
      for (const id of new Set([quienCobro, deLaRuta].filter(Boolean))) {
        acc[id] = (acc[id] || 0) + monto
      }
      return acc
    }, {})
    for (const id of Object.keys(recaudoPorCobrador)) {
      recaudoPorCobrador[id] = Math.round(recaudoPorCobrador[id])
    }
    /* Los abonos de quien renovó hoy, para el COTEO (ver `lib/dinero/coteo.js`).
       Van al cobrador de la RUTA del cliente, como en su ficha: allí solo
       cuentan las renovaciones de clientes de sus rutas. */
    const abonosAlRenovarPorCobrador = {}
    for (const p of cobrosDeRenovadas(recaudosDiaRaw, renovacionesDiaOrg)) {
      const id = p.prestamo?.cliente?.ruta?.cobradorId
      if (!id) continue
      abonosAlRenovarPorCobrador[id] = (abonosAlRenovarPorCobrador[id] || 0) + Number(p.montoPagado || 0)
    }

    // La tarjeta de cada cobrador pregunta lo mismo que la banda de arriba, y
    // hasta ahora lo calculaba por su cuenta partiendo de RUTAS — asi que un
    // cliente sin ruta era invisible aqui y visible alla, y las dos cifras de
    // la misma pantalla no cuadraban. Ahora las dos preguntan al mismo sitio.
    const esperadoPorCobrador = rutasActivas.reduce((acc, ruta) => {
      if (!ruta.cobradorId) return acc
      const clientes = ruta.clientes.map((c) => ({ ...c, ruta: { diasSinCobro: ruta.diasSinCobro } }))
      const { esperado } = esperadoDeCartera({ clientes, org: orgCfg, festivos: festivosOrg }, fechaBase)
      acc[ruta.cobradorId] = Math.round((acc[ruta.cobradorId] || 0) + esperado)
      return acc
    }, {})

    const cierreIds = new Set(cierres.map(c => c.cobradorId))
    cobradores = await Promise.all(todosCobradores.map(async (c) => {
      const cierre = cierres.find(ci => ci.cobradorId === c.id) || null
      const recaudadoDia = recaudoPorCobrador[c.id] || 0
      const esperadoDia = esperadoPorCobrador[c.id] || 0
      /* ⚠ «SUGERIDO CIERRE» ES LO QUE SU CAJA LE PROPONE ENTREGAR, no lo cobrado.
         Decía `recaudadoDia` —transferencias incluidas, sin restar lo prestado
         ni los gastos—, igual que el «Cobrado» de al lado. Ahora es la cifra del
         botón «Usar» de su caja, con la misma función. Solo hace falta mientras
         no ha cerrado, que es cuando se enseña. */
      // La casilla solo se pinta si cobró algo: sin cobros no se hace la cuenta.
      const sugeridoCierre = cierre
        ? Math.round(cierre.totalRecogido || 0)
        : recaudadoDia > 0 ? Math.round(enLaManoDelDia(await getStatsDia(organizationId, fechaBase, c.id))) : 0

      // Caja detallada por cobrador: lo que prestó, los seguros que generó, sus gastos,
      // el efectivo que maneja hoy y el capital que le queda a sus rutas (sub-bolsa).
      const [prestadoDia, segurosDia, gastosAgg, rutasCobrador] = await Promise.all([
        calcularDesembolsadoDia(organizationId, inicio, fin, c.id),
        calcularSegurosDia(organizationId, inicio, fin, c.id),
        /* ⚠ PENDIENTE + APROBADO, igual que las otras dos vistas.
           Esta contaba SOLO los aprobados, así que un gasto sin aprobar hacía
           que el listado del dueño y la ficha del cobrador dijeran cifras
           distintas de la misma persona el mismo día. Medido en producción:
           10 gastos sin aprobar en 7 días, $189.000, en 4 cobradores.

           El criterio bueno es incluirlos: el cobrador ya se gastó esa plata
           —no la lleva en el fajo— aunque el dueño no la haya revisado. Es lo
           que hacen `getStatsDia` (`:643-648`) y la ficha
           (`caja/cobrador/[id]/route.js:225`). */
        prisma.gastoMenor.aggregate({
          where: {
            organizationId, cobradorId: c.id,
            estado: { in: ['pendiente', 'aprobado'] },
            fecha: { gte: inicio, lt: fin },
          },
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
        // Se listan tambien inactivos que tuvieron movimiento ese dia, para que su
        // historial siga siendo alcanzable. La UI los marca.
        inactivo: c.activo === false,
        cerrado: cierreIds.has(c.id),
        cierre,
        recaudadoDia,
        esperadoDia,
        coteo: coteo(recaudadoDia, abonosAlRenovarPorCobrador[c.id] || 0),
        sugeridoCierre,
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

  // Las tres cifras por ruta, SOLO para el dueño: la pestaña «por ruta» es
  // suya, y un cobrador no vería más que su propia ruta. Así no se pagan las
  // consultas en el móvil de quien no las usa.
  //
  // En paralelo: son independientes entre sí y encadenarlas suma latencia a la
  // pantalla que más se abre del día.
  const [prestadoPorRuta, capitalPorRuta, gastosPorRuta] = rol === 'owner'
    ? await Promise.all([
      calcularPrestadoPorRutaDia(organizationId, inicio, fin),
      calcularCapitalPorRuta(organizationId),
      calcularGastosPorRutaDia(organizationId, gastos),
    ])
    : [[], null, null]

  const payload = {
    cierres,
    gastos,
    pagosDia,
    prestadoPorRuta,
    capitalPorRuta,
    gastosPorRuta,
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
          montoPrestado: true, ...CAMPOS_DEL_REPARTO,
          // Necesarios para calcularCapitalRestante (ver dashboard/resumen).
          modoInteres: true,
          totalPagado: true, abonadoCapital: true,
          /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
             interés devengado sin pagar, y un campo que no se pide vale `undefined`
             —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
          devengos: { select: { periodo: true, interes: true } },
          cuotasAmortizacion: {
            orderBy: { numeroPeriodo: 'asc' },
            select: { numeroPeriodo: true, cuotaTotal: true, capital: true, interes: true, pagado: true, fechaEsperada: true },
          },
          pagos: { select: { montoPagado: true, tipo: true } },
        },
      }),
    ])
    const saldoCaja = Math.round(cap?.saldo ?? 0)
    let carteraActiva = 0  // pendiente por cobrar, CON intereses
    // Capital que sigue AFUERA, no el que salio algun dia. Antes sumaba
    // montoPrestado y nunca bajaba con los abonos. Misma definicion que el
    // dashboard a proposito: dos cifras distintas para lo mismo rompen la
    // confianza en una app de plata.
    let capitalEnCalle = 0
    for (const p of prestamosActivos) {
      const pagado = p.pagos
        .filter((pg) => !['recargo', 'descuento'].includes(pg.tipo))
        .reduce((a, pg) => a + pg.montoPagado, 0)
      carteraActiva  += Math.max(0, (p.totalAPagar || 0) - pagado)
      capitalEnCalle += calcularCapitalRestante(p, { paraReparto: true }) ?? p.montoPrestado ?? 0
    }
    payload.stats.capitalOrganizacion = {
      saldoCaja,
      carteraActiva: Math.round(carteraActiva),
      capitalEnCalle: Math.round(capitalEnCalle),
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
      AND: [SIN_ABONO_PREVIO],
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

  // El esperado del DIA QUE SE CIERRA, no el de hoy.
  //
  // El cierre admite hasta 7 dias atras (`maxDiasAtrasPermitidos` arriba), y
  // hasta ahora guardaba la meta de hoy para el dia que fuera: cerrar el sabado
  // la caja del lunes escribia el esperado del sabado. La diferencia que
  // quedaba grabada no comparaba nada.
  const totalEsperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId, fechaColombia))

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

  const totalDesembolsadoDia = await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId)

  /* ══ LO QUE GUARDA EL CIERRE, CON UN SOLO SENTIDO (DETALLES-CAJA N1/N2/#3) ══
     `totalRecogido` es lo que ENTREGÓ: ya viene neto de lo prestado y de los
     gastos. Aquí se le volvían a restar los dos —«Saldo final −$672.000»— y los
     gastos solo contaban los APROBADOS, cuando la caja cuenta también los
     pendientes (el billete ya salió): «Gastos $0» en el cierre y «−$15.000»
     arriba, el mismo día.

     Del cobrador se guarda además lo que el sistema decía que tenía en la mano
     al cerrar —la cifra del botón «Usar», con la misma función que su caja— y el
     cuadre la coteja contra lo que cuenta el dueño. Del dueño no: su cierre es
     lo que él cuenta de lo suyo. */
  const esDeCobrador = cobrador.rol === 'cobrador'
  const statsCierre = esDeCobrador ? await getStatsDia(organizationId, fechaColombia, cobradorId) : null
  const enLaManoSistema = statsCierre ? Math.round(enLaManoDelDia(statsCierre)) : null
  const totalGastos = statsCierre ? Math.round(statsCierre.gastos || 0) : (gastosDia._sum?.monto || 0)
  const saldoOperativoDia = enLaManoSistema ?? totalRecogido
  const saldoRealCajaDia = enLaManoSistema ?? totalRecogido
  const diferencia = totalRecogido - totalEsperado

  if (existeCierre) {
    // Con la caja REABIERTA por el dueño, el cobrador vuelve a cerrar: la rama
    // de abajo ya estaba hecha para eso («re-confirmar vuelve a bloquear»), pero
    // este 409 no la dejaba llegar (DETALLES-CAJA-Y-CAPITAL #17). Corregir lo de
    // hoy SIN reabrir sigue siendo del dueño.
    if (diasAtras === 0 && rol !== 'owner' && !existeCierre.reabiertoEn) {
      return Response.json({ error: 'Tu caja de hoy ya está cerrada. Para corregir lo entregado, pídele al dueño que la reabra.' }, { status: 409 })
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
        enLaManoSistema,
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
      enLaManoSistema,
      diferencia: Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  logActividad({ session, accion: 'cierre_caja', entidadTipo: 'caja', entidadId: cierre.id, detalle: `Cierre de caja ${cobrador.nombre} - recogido $${Math.round(totalRecogido).toLocaleString('es-CO')}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })

  /* EL DUEÑO SE ENTERA DE QUE LE CERRARON LA CAJA. Hasta el 19 sep 2026 un
     cobrador cerraba y no pasaba nada: había que entrar a Caja a mirar, ruta por
     ruta, quién había entregado. Solo cuando cierra un COBRADOR (el dueño que
     cierra la suya ya lo sabe).

     ⚠ SOLO DICE LO QUE ENTREGA. `diferencia` es recogido − ESPERADO DEL DÍA —lo
     que los clientes dejaron de pagar—, no un faltante del cobrador: avisar «le
     faltaron $X» con esa cifra sería acusarlo de algo que no pasó. El descuadre
     de verdad lo mide el dueño al contar los billetes (`/api/caja/cuadre`). */
  if (session.user.rol === 'cobrador') {
    notificar({
      organizationId, para: 'owners', tipo: 'cierre_caja',
      titulo: `${cobrador.nombre} cerró su caja`,
      mensaje: `Entrega ${plata(totalRecogido)}${totalGastos > 0 ? `, con ${plata(totalGastos)} de gastos` : ''}.`,
      href: `/caja?fecha=${fechaColombia}`,
      datos: { cierreId: cierre.id, cobradorId },
    })
  }
  return Response.json({
    ...cierre,
    resumenFinanciero: {
      totalDesembolsadoDia: cierre.totalDesembolsado,
      saldoOperativoDia: cierre.saldoOperativo,
      saldoRealCajaDia: cierre.saldoRealCaja,
    },
  }, { status: 201 })
}

/* ══ DESHACER EL CIERRE DE HOY ═══════════════════════════════════════════════
 *
 * El dueño, 20 sep 2026: «no hay ninguna opción de revocar ese cierre de caja,
 * que es muy fácil equivocarse porque es muy fácil de presionar el botón».
 *
 * Lo que había era «Reabrir y ajustar», que CORRIGE la cifra de un cierre que se
 * queda. Esto es otra cosa: el cierre no debió existir. Un cierre es solo una
 * foto (`CierreCaja`): no mueve capital ni escribe en el libro, así que quitarlo
 * deja el día exactamente como estaba antes del toque.
 *
 * Estrecho a propósito:
 *   · solo el DUEÑO (al cobrador el cierre lo bloquea, y desbloquearlo ya tiene
 *     su camino con aprobación: `caja/reabrir`);
 *   · solo el día de HOY — ver `reverso_solo_del_dia_abierto`: lo de ayer ya se
 *     entregó y se contó, eso se corrige, no se borra;
 *   · y deja rastro en el Historial con la cifra que tenía.
 */
export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { organizationId, rol, id: userId } = session.user
  if (rol !== 'owner') return Response.json({ error: 'Solo el administrador puede deshacer un cierre' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const cobradorId = searchParams.get('cobradorId') || userId
  const { inicio, fin } = getDayRange(getHoyLocal())

  const cierre = await prisma.cierreCaja.findFirst({
    where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } },
    select: { id: true, totalRecogido: true, cobrador: { select: { nombre: true } } },
  })
  if (!cierre) return Response.json({ error: 'Hoy no hay un cierre que deshacer' }, { status: 404 })

  await prisma.cierreCaja.deleteMany({ where: { id: cierre.id, organizationId } })
  logActividad({
    session, accion: 'deshacer_cierre_caja', entidadTipo: 'caja', entidadId: cierre.id,
    detalle: `Deshizo el cierre de caja de ${cierre.cobrador?.nombre ?? 'hoy'} - tenía recogido $${Math.round(cierre.totalRecogido || 0).toLocaleString('es-CO')}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  // Si era la caja de un cobrador, se le dice: tenía el día cerrado y ya no.
  if (cobradorId !== userId) {
    notificar({
      organizationId, para: cobradorId, tipo: 'caja_reabierta',
      titulo: 'Tu caja de hoy volvió a abrirse',
      mensaje: 'El administrador deshizo tu cierre de hoy. Puedes seguir cobrando y cerrar de nuevo al terminar.',
      href: '/caja',
    })
  }
  return Response.json({ ok: true })
}
