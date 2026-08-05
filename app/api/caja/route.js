// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { tieneTablaAmortizacion, obtenerCuotaPeriodoActual, calcularCapitalRestante } from '@/lib/calculos'
import { esperadoDeCartera, SELECT_PRESTAMO } from '@/lib/dinero/esperado'
import { conciliar, resumirLibro, ALCANCE } from '@/lib/dinero/conciliacion'
import { getUtcOffset, getLocalDateStr, getLocalDayRange, formatFechaCorta } from '@/lib/i18n'
// Una sola definición para los TRES sitios que cierran cajas. Ver el archivo:
// estaba duplicada con los argumentos en orden distinto y el tercer sitio se
// quedó sin ninguna, escribiendo 0.
import { calcularDesembolsadoDia } from '@/lib/dinero/desembolsado'

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

// Las rutas de un cobrador. Lo que el cobrador entiende por «lo mio» son sus
// rutas, no solo lo que registro el: el dueño tambien cobra en sus rutas. Es la
// misma regla que ya usa el detalle del cobrador, y la lista NO usaba — por eso
// el mismo cobrador el mismo dia daba dos cifras distintas segun donde miraras.
async function rutaIdsDe(organizationId, cobradorId) {
  if (!cobradorId) return []
  const rutas = await prisma.ruta.findMany({
    where: { organizationId, cobradorId, activo: true },
    select: { id: true },
  })
  return rutas.map((r) => r.id)
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
async function calcularEsperadoReal(organizationId, cobradorId = null, fecha = null) {
  // Se parte de los CLIENTES, no de las rutas.
  //
  // Antes esto arrancaba en prisma.ruta.findMany e iteraba ruta.clientes, asi
  // que un cliente sin ruta asignada era invisible para la meta. Con cero rutas
  // —el estado normal del 95% de las organizaciones, porque el onboarding no
  // crea ninguna— el resultado era literalmente 0: la caja decia "Esperado $0"
  // y "Diferencia +todo lo cobrado", mientras el dashboard mostraba la meta
  // real. Dos pantallas de la misma app contradiciendose el mismo dia.
  //
  // Ahora usa el mismo criterio que /api/dashboard/resumen: recorre prestamos
  // activos y pregunta por cada uno si su ciclo de cobro toca hoy. La ruta pasa
  // a ser solo un filtro opcional, cuando se pide la caja de un cobrador.
  const [clientes, org, festivos] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        organizationId,
        estado: { notIn: ['eliminado'] },
        ...(cobradorId ? { ruta: { cobradorId, activo: true } } : {}),
      },
      select: {
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: {
          // El clavo no genera cuota esperada (es el lado negativo): se excluye de la meta.
          where: { estado: 'activo', esClavo: false },
          // El `select` sale del propio modulo. Cada uno de los cinco
          // llamadores tenia el suyo escrito a mano, y es asi como empezaron a
          // divergir: al que se le olvidaba `modoInteres` y
          // `cuotasAmortizacion` caia a `cuotaDiaria`, que en Decreciente es
          // la cuota MAS ALTA y en Globo es solo el interes.
          select: SELECT_PRESTAMO,
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    // La caja pasaba [] como festivos, o sea que los ignoraba, mientras el
    // dashboard si los descuenta. Otra razon por la que las dos pantallas no
    // cuadraban.
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  // Meta del dia: solo cuenta cuotas de prestamos cuyo ciclo de cobro toca esa
  // fecha (segun frecuencia + dia ancla). La cuenta la hace `lib/dinero/esperado.js`,
  // que es la MISMA que usan el cuadre, el cierre automatico y la ficha de ruta.
  //
  // `fecha` es nueva y no es un adorno: el cierre de caja admite hasta 7 dias
  // atras, y hasta ahora guardaba el esperado de HOY para el dia que fuera.
  return esperadoDeCartera({ clientes, org, festivos }, fecha ?? new Date()).esperado
}

// Calcula desembolsos realizados en el día para reflejar el saldo real de caja.

// Devuelve DOS cifras del dia que no son lo mismo y hoy se confundian:
//
//   valorPrestado     = suma de montoPrestado (el valor de las cartulinas)
//   efectivoEntregado = plata que de verdad salio de la caja
//
// Se separan en las renovaciones: si renueva una de $100 a un cliente que debia
// $50, el valor prestado es $100 pero de la caja solo salen $50. El cliente que
// mas cobradores tiene lo pidio asi: "aca me muestra lo que le entrego en
// efectivo y aca que me muestre la totalidad de los prestamos que hago en el
// dia... para yo saber cuanto presta el cobrador en el dia".
//
// NO reemplaza a calcularDesembolsadoDia: esa sigue alimentando el saldo de caja
// y no se toca. Esto es aditivo, solo para mostrar.
//
// El universo (que prestamos cuentan) es el MISMO que usa el desembolsado, para
// que las cifras sean comparables entre si:
//   sin cobradorId -> todos los prestamos de la organizacion
//   con cobradorId -> los de sus rutas + los que el creo + sus movimientos
async function calcularPrestadoDetalleDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWherePrestamos = {
    organizationId,
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Mapa prestamo -> monto realmente entregado (el movimiento de capital manda:
  // en renovaciones guarda la diferencia en mano, no el montoPrestado completo).
  const construirMapaEntregado = async (whereMov) => {
    const movs = await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        ...whereMov,
      },
      select: { referenciaId: true, monto: true, createdAt: true },
    })
    const mapa = new Map()
    for (const m of movs) {
      if (!m.referenciaId) continue
      const prev = mapa.get(m.referenciaId)
      // el mas reciente gana, por si el movimiento se edito
      if (!prev || m.createdAt > prev.createdAt) mapa.set(m.referenciaId, m)
    }
    return mapa
  }

  if (!cobradorId) {
    const [prestamos, mapaEntregado] = await Promise.all([
      prisma.prestamo.findMany({
        where: baseWherePrestamos,
        select: { id: true, montoPrestado: true, renovadoDeId: true },
      }),
      construirMapaEntregado({}),
    ])
    let valorPrestado = 0
    let efectivoEntregado = 0
    for (const p of prestamos) {
      valorPrestado += p.montoPrestado || 0
      const mov = mapaEntregado.get(p.id)
      // Sin movimiento: en renovacion el efectivo entregado no es el monto nuevo
      // (incluye el saldo viejo absorbido, que nunca salio de la caja).
      efectivoEntregado += mov ? mov.monto : (p.renovadoDeId ? 0 : (p.montoPrestado || 0))
    }
    return {
      valorPrestado: Math.round(valorPrestado),
      efectivoEntregado: Math.round(efectivoEntregado),
      cantidadPrestamos: prestamos.length,
    }
  }

  // ── Vista por cobrador ──
  const rutasCobrador = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true },
  })
  const rutaIds = rutasCobrador.map(r => r.id)

  const [prestamosRuta, actividadesCreador, mapaEntregado] = await Promise.all([
    prisma.prestamo.findMany({
      where: { ...baseWherePrestamos, cliente: { ruta: { cobradorId } } },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
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
    construirMapaEntregado({
      OR: [
        { creadoPorId: cobradorId },
        ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
      ],
    }),
  ])

  const idsActividad = actividadesCreador.map(a => a.entidadId).filter(Boolean)
  const prestamosActividad = idsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: idsActividad },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    })
    : []

  const vistos = new Set()
  let valorPrestado = 0
  let efectivoEntregado = 0

  for (const p of [...prestamosRuta, ...prestamosActividad]) {
    if (vistos.has(p.id)) continue
    vistos.add(p.id)
    valorPrestado += p.montoPrestado || 0
    const mov = mapaEntregado.get(p.id)
    // Sin movimiento: una renovacion no entrego el monto nuevo en efectivo.
    efectivoEntregado += mov ? mov.monto : (p.renovadoDeId ? 0 : (p.montoPrestado || 0))
  }

  // Movimientos sin prestamo en ruta ni actividad (ej: el owner desembolso en su
  // ruta). Sin el montoPrestado a mano, el movimiento es la mejor cifra de ambas.
  const idsFaltantes = [...mapaEntregado.keys()].filter(id => !vistos.has(id))
  if (idsFaltantes.length) {
    const sueltos = await prisma.prestamo.findMany({
      where: { organizationId, id: { in: idsFaltantes } },
      select: { id: true, montoPrestado: true },
    })
    const montoPorId = new Map(sueltos.map(p => [p.id, p.montoPrestado || 0]))
    for (const id of idsFaltantes) {
      vistos.add(id)
      const mov = mapaEntregado.get(id)
      efectivoEntregado += mov ? mov.monto : 0
      valorPrestado += montoPorId.get(id) ?? (mov ? mov.monto : 0)
    }
  }

  return {
    valorPrestado: Math.round(valorPrestado),
    efectivoEntregado: Math.round(efectivoEntregado),
    cantidadPrestamos: vistos.size,
  }
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
  const enRutas = porRuta.reduce((a, r) => a + r.saldoCapital, 0)
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
    negativas: porRuta.filter((r) => r.saldoCapital < 0).length,
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

  const porRuta = new Map()
  for (const p of prestamos) {
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
    /* ⚠ LO SUYO ES SU RUTA, NO SOLO LO QUE TECLEÓ ÉL.
       Esto filtraba `cobradorId` a secas, así que un cobro que hiciera el dueño
       en la ruta de Alex no salía aquí y sí en la ficha de Alex: la misma
       persona, el mismo día, dos cifras. Medido: 132 pagos, $5.444.000 en 7
       días, 5 cobradores.

       `rutaIdsDe` existe justo para esto y su comentario ya describe el fallo.
       Mismo criterio que `caja/cobrador/[id]/route.js:198-204`. */
    const rutasDelCobrador = await rutaIdsDe(organizationId, cobradorId)
    wherePagos.OR = [
      { cobradorId },
      ...(rutasDelCobrador.length ? [{ prestamo: { cliente: { rutaId: { in: rutasDelCobrador } } } }] : []),
    ]
  }

  // ── LO COBRADO, Y EN QUE SE COBRO ──
  //
  // Se pide agregado y separado por medio en la MISMA consulta. Antes se
  // traian las filas y se sumaban en JS, que funciona hasta que un negocio
  // tiene 300 pagos al dia — y el cliente de 10 cobradores los tiene.
  //
  // La separacion efectivo/transferencia no es un adorno: una caja fisica no
  // contiene Nequi. En ese mismo cliente el 12% del recaudo entra por
  // transferencia ($35.261.200 en 736 pagos) y la caja lo cuenta como efectivo,
  // asi que el fajo de la noche no puede cuadrar nunca.
  const pagosPorMedio = await prisma.pago.groupBy({
    by: ['metodoPago'],
    where: { ...wherePagos, tipo: { notIn: ['recargo', 'descuento'] } },
    _sum: { montoPagado: true },
  })

  let recogida = 0, recogidaEfectivo = 0, recogidaDigital = 0
  for (const g of pagosPorMedio) {
    const monto = Math.round(g._sum?.montoPagado || 0)
    recogida += monto
    // Lo que no dice nada es efectivo: es el modo por defecto de un cobro en
    // la calle, y descartarlo perdia plata del desglose.
    if (g.metodoPago === 'transferencia') recogidaDigital += monto
    else recogidaEfectivo += monto
  }

  // Calcular esperado real desde las cuotas diarias de préstamos activos
  const esperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId, fechaStr))

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
  // Aditivo: valor de las cartulinas vs efectivo que salio de la caja. No entra
  // en ningun calculo de saldo, es solo para mostrar los dos numeros separados.
  const prestadoDetalle = await calcularPrestadoDetalleDia(organizationId, inicio, fin, cobradorId)
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

  // ── LA CONCILIACION ──────────────────────────────────────────────────────
  //
  // `ajustesOperativosDia` de arriba es el residuo que hace cuadrar la banda
  // SIEMPRE. Se conserva de momento para no romper la pantalla vieja, pero la
  // cifra que hay que creer es esta: enfrenta el LIBRO contra las OPERACIONES
  // y contra el efectivo contado, y cuando no cuadra LO DICE en vez de
  // absorberlo.
  //
  // Corrida contra 60 dias del cliente de 10 cobradores: 53 con descuadre,
  // 4 cuadrados. La banda vieja decia «cuadra» los 57.
  const movimientosDia = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      createdAt: { gte: inicio, lt: fin },
      ...(cobradorId ? { OR: [{ creadoPorId: cobradorId }, { rutaId: { in: await rutaIdsDe(organizationId, cobradorId) } }] } : {}),
    },
    select: {
      tipo: true, monto: true, saldoAnterior: true, saldoNuevo: true,
      descripcion: true, metodoPago: true, createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // ── EL DIA SIN MOVIMIENTOS ──
  //
  // Sin asientos no hay «primer asiento», y la apertura salia en CERO: la
  // pantalla decia «con lo que amaneciste $0» mientras su propio titular, tres
  // centimetros arriba, decia «saldo en caja $3.895.947». Con el resto de la
  // cuenta tambien en cero, el desglose entero contradecia a su encabezado.
  //
  // El calculo correcto YA ESTABA en este archivo: `baseInicialDia` (linea
  // ~812) cae en `saldoCapitalActual` justo cuando no hay primer movimiento.
  // La conciliacion no lo usaba. Es el mismo patron de otras veces: la cifra
  // buena existia al lado y la pantalla leia la mala.
  //
  // ⚠ SOLO CUANDO SE MIRA LA ORGANIZACION ENTERA. Filtrando por cobrador,
  // `saldoCapitalActual` es el saldo de TODO el negocio, no el de su ruta:
  // pasarlo ahi le pintaria al cobrador una apertura que no es suya. En ese
  // caso se queda en null y la apertura vale cero, que es lo que habia.
  const saldoPrevioDelDia = cobradorId ? null : baseInicialDia

  const conciliacion = conciliar({
    alcance: cobradorId ? ALCANCE.COBRADOR : ALCANCE.ORGANIZACION,
    libro: resumirLibro(movimientosDia, saldoPrevioDelDia),
    operaciones: {
      pagos: recogida,
      pagosEfectivo: recogidaEfectivo,
      pagosDigital: recogidaDigital,
      gastos,
      // EL EFECTIVO QUE DE VERDAD SALIO, no el valor nominal de los prestamos.
      // `desembolsadoDia` suma `montoPrestado` crudo, asi que en una renovacion
      // resta de la caja un dinero que nunca salio: el saldo viejo que se
      // absorbe. Medido en produccion: 765 renovaciones, $132.339.683 de
      // inflado. El calculo bueno ya existia en este archivo y la pantalla
      // usaba el malo.
      desembolsos: prestadoDetalle.efectivoEntregado,
    },
    esperado: { esperado, atrasado: 0 },
  })

  return {
    esperado,
    recogida,
    recogidaEfectivo,
    recogidaDigital,
    conciliacion,
    gastos,
    desembolsadoDia,
    // Dos cifras distintas del dia (se separan en renovaciones):
    valorPrestadoDia: prestadoDetalle.valorPrestado,
    efectivoEntregadoDia: prestadoDetalle.efectivoEntregado,
    cantidadPrestamosDia: prestadoDetalle.cantidadPrestamos,
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

    const [todosCobradores, recaudosDiaRaw, rutasActivas] = await Promise.all([
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
        },
        select: {
          montoPagado: true,
          cobradorId: true,
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
          montoPrestado: true,
          // Necesarios para calcularCapitalRestante (ver dashboard/resumen).
          modoInteres: true,
          totalPagado: true,
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
      capitalEnCalle += calcularCapitalRestante(p) ?? p.montoPrestado ?? 0
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
