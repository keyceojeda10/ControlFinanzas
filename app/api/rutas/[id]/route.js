// app/api/rutas/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { esId }             from '@/lib/ids'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularCapitalRestante,
  calcularProximoCobro,
  formatFechaCobro,
  tieneCobroPendienteHoy,
  calcularCuotasEnMora,
  calcularCuotasPendientes,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
  obtenerCuotaPeriodoActual,
  obtenerProximaCuotaTabla,
  tieneTablaAmortizacion,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo, validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { tocaCobrarEn, cuotaDelPeriodo, inicioDia } from '@/lib/dinero/esperado'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'
import { distanciaMetros } from '@/lib/geo'
// Suma los tramos consecutivos de una lista de clientes con coordenadas. Ya la
// usa el optimizador de orden; aquí da el «3,4 km» de la cabecera (T27-02).
import { totalDistance } from '@/lib/routeOptimizer'

const hoy = (country = 'co') => {
  const now = new Date()
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(now.getTime() - absOffset * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, absOffset, 0, 0, 0))
}
const manana = (country = 'co') => {
  const h = hoy(country)
  return new Date(h.getTime() + 24 * 60 * 60 * 1000)
}

function detectarCuotaExtra(prestamo, proximaCuota) {
  if (!proximaCuota || !Array.isArray(prestamo.capitalExtra) || !prestamo.capitalExtra.length) {
    return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  }
  const periodo = proximaCuota.numeroPeriodo
  const extra = prestamo.capitalExtra.find(e => e.numeroPeriodo === periodo)
  if (!extra || !extra.monto) return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  return { cuotaExtraHoy: true, montoCuotaExtra: Math.round(extra.monto) }
}

// ─── GET /api/rutas/[id] ────────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { id: userId, organizationId, rol } = session.user

  // Cobrador: solo rutas donde es el asignado
  if (rol === 'cobrador') {
    const acceso = await prisma.ruta.findFirst({ where: { id, organizationId, cobradorId: userId }, select: { id: true } })
    if (!acceso) return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  // Config org para días sin cobro + festivos de la organización
  // Calcular rango de hoy antes del query para filtrarlo en DB (no en JS)
  const _hoy = hoy(), _manana = manana()

  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true, tasaMoratorio: true, diasGraciaMoratorio: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: {
      cobrador: { select: { id: true, nombre: true, email: true, latitud: true, longitud: true, ubicacionUpdatedAt: true } },
      clientes: {
        include: {
          prestamos: {
            // Se traen TODOS (incluido clavo): el cobro de hoy de un clavo sí suma al
            // recaudado de la ruta (dinero real). El lado negativo del clavo
            // (cartera/mora/esperado) se salta más abajo con `if (p.esClavo) continue`.
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              estado: true,
              esClavo: true,
              cuotaDiaria: true,
              montoPrestado: true,
              totalAPagar: true,
              totalPagado: true,
              frecuencia: true,
              fechaInicio: true,
              diasPlazo: true,
              diaCobroSemana: true,
              diaCobroMes: true,
              diaCobroMes2: true,
              diasSinCobro: true,
              createdAt: true,
              renovadoDeId: true,
              seguro: true,
              montoSeguro: true,
              modoInteres: true,
              capitalExtra: true,
              proximoCobroManual: true,
              cuotasAmortizacion: {
                orderBy: { numeroPeriodo: 'asc' },
                select: { numeroPeriodo: true, capital: true, interes: true, cuotaTotal: true, saldoRestante: true, pagado: true, interesPagado: true, fechaEsperada: true },
              },
              pagos: {
                where:  { fechaPago: { gte: _hoy, lt: _manana } },
                orderBy: { fechaPago: 'desc' },
                select: { id: true, montoPagado: true, fechaPago: true, createdAt: true, tipo: true, latitud: true, longitud: true, metodoPago: true, cobradorId: true },
              },
            },
          },
        },
        orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
      },
    },
  })

  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  /* ── CUÁNDO TERMINÓ DE PAGAR CADA PRÉSTAMO LIQUIDADO (Adenda 5 · E09) ──
     La fila de «sin deuda» dice «Terminó de pagar el 4 de julio», y esa fecha
     es el último pago del préstamo. No se puede sacar del `include` de arriba:
     allí los pagos vienen filtrados al día de hoy para calcular el recaudado, y
     un préstamo liquidado en mayo no tiene ninguno.

     UNA consulta agregada para toda la ruta, no una por cliente: en una ruta de
     203 clientes lo segundo son 203 viajes a la base.

     ⚠ Y VA SOBRE TODOS LOS PRÉSTAMOS, no solo los liquidados, porque el mismo
     filtro de hoy rompía otra cosa: `diasDesdeUltimoPago` se calculaba también
     desde `p.pagos[0]`, así que solo podía salir 0 —si cobró hoy— o `null`. La
     tira de cifras de la tarjeta pinta ese dato como «Últ. pago», y con `null`
     escribe «nunca» EN ROJO. Es decir: toda la ruta marcada como gente a la que
     jamás se le ha cobrado, que es lo contrario de la verdad y justo la línea
     que se mira para decidir a quién apretar. */
  /* ── LA VISITA QUE EL COBRADOR YA DIO POR CERRADA ──────────────────────
     «Ya abonó lo que iba a abonar, déjame seguir con la ruta.» Se anota como
     `VisitaReagendada` con `motivo: 'pago_parcial'` —o con los otros cuatro,
     que son los del «¿qué te dijo?» cuando no pagó nada—.

     ⚠ ESTO NO TOCA `cobroPendienteHoy`. Ese campo alimenta `esperadoHoy`, el
     cuadre de caja y los reportes: la deuda del cliente NO se encoge porque el
     cobrador decida seguir camino, y bajar el esperado inflaría el porcentaje
     cumplido del día. Lo que cambia es DÓNDE SALE en la lista y si sigue
     contando como parada por hacer, que es presentación.

     Ese modelo ya se escribía desde la ruta y no lo leía NADIE: anotar «no
     estaba» tampoco sacaba al cliente de la lista, así que el gesto no servía
     de nada. Se arregla aquí para los dos casos a la vez. */
  const cerradas = await prisma.visitaReagendada.findMany({
    where: {
      organizationId,
      clienteId: { in: (ruta.clientes ?? []).map((c) => c.id) },
      fechaOriginal: { gte: _hoy, lt: _manana },
    },
    select: { clienteId: true, motivo: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const cierreDeHoy = new Map()
  for (const v of cerradas) if (!cierreDeHoy.has(v.clienteId)) cierreDeHoy.set(v.clienteId, v.motivo)

  const idsPrestamos = (ruta.clientes ?? []).flatMap((c) =>
    (c.prestamos ?? []).map((p) => p.id)
  )
  const finDePrestamo = new Map()
  if (idsPrestamos.length > 0) {
    const finales = await prisma.pago.groupBy({
      by: ['prestamoId'],
      where: {
        prestamoId: { in: idsPrestamos },
        // Un recargo o un descuento no son «pagar»: mueven la deuda, no la
        // saldan. La fecha tiene que ser la del último dinero entregado.
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _max: { fechaPago: true },
    })
    for (const f of finales) finDePrestamo.set(f.prestamoId, f._max.fechaPago)
  }

  // Calcular métricas del día + cartera
  let esperadoHoy  = 0
  let recaudadoHoy = 0
  let recaudadoEfectivoHoy = 0   // ver el desglose por medio, más abajo
  let recaudadoDigitalHoy = 0
  let pendientesHoy = 0
  let clientesConCobroHoy = 0
  let clientesPagaronHoy = 0
  let enMora = 0
  let carteraTotal = 0      // saldo pendiente total (principal + intereses que faltan)
  let capitalTotal = 0      // monto original prestado (sin intereses)
  let totalAPagarRuta = 0   // suma de totalAPagar (principal + intereses) — denominador correcto para % cobrado

  // CAPITAL QUE TODAVÍA ESTÁ EN LA CALLE, no el que se prestó algún día.
  //
  // Hace falta para partir la cartera de la ruta en «lo puesto» y «lo que queda
  // por ganar» (T27-02). Con `capitalTotal` no se puede: es el monto ORIGINAL, así
  // que en cuanto un cliente abona, `carteraTotal - capitalTotal` sale NEGATIVO y
  // la ruta que más cobra es la que peor se ve.
  //
  //   presté 1.000.000 · total pactado 1.200.000 · ya pagó 300.000
  //   → saldo pendiente 900.000 · capitalTotal 1.000.000 → «por ganar» −100.000
  //
  // `calcularCapitalRestante` reparte cada pago entre interés y capital con la
  // misma cascada que usa la ficha, y excluye los abonos tipo 'capital' de esa
  // cascada. Así `capitalPendiente + porGanar = carteraTotal` siempre.
  let capitalPendiente = 0

  // ── LO QUE SALIO DE LA CARTERA HOY EN ESTA RUTA (T04-03) ──
  //
  // Se lee de `MovimientoCapital`, que es el libro unico del sistema y ya lleva
  // `rutaId` y `metodoPago`. No se recalcula desde prestamos ni gastos: hacerlo
  // por otro camino es como se acaban teniendo dos cifras que no cuadran.
  //
  // SOLO EFECTIVO. Lo que salio por transferencia no esta en el fajo que el
  // cobrador entrega de noche, asi que restarlo descuadraria el cierre.
  // ── EL MES DE LA RUTA (T24-03) ──
  // Lo que entro, lo que salio a prestar y la diferencia. `FichaRuta` responde
  // «¿me rinde meter plata aqui?», y sin el mes esa pregunta no se puede
  // contestar: el dia suelto no dice nada de una ruta.
  const inicioMes = new Date(Date.UTC(_hoy.getUTCFullYear(), _hoy.getUTCMonth(), 1))
  const movimientosMes = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      rutaId: id,
      tipo: { in: ['recaudo', 'desembolso'] },
      createdAt: { gte: inicioMes },
    },
    select: { tipo: true, monto: true },
  })
  let entroMes = 0
  let salioAPrestarMes = 0
  for (const m of movimientosMes) {
    if (m.tipo === 'recaudo') entroMes += m.monto
    else salioAPrestarMes += m.monto
  }

  const movimientosHoy = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      rutaId: id,
      tipo: { in: ['desembolso', 'gasto'] },
      createdAt: { gte: _hoy, lt: _manana },
    },
    select: { tipo: true, monto: true, metodoPago: true },
  })
  let desembolsadoEfectivoHoy = 0
  let gastosEfectivoHoy = 0
  for (const m of movimientosHoy) {
    // `null` cuenta como efectivo: es el modo por defecto y el de todo lo
    // historico, anterior a que existiera la columna.
    if (m.metodoPago === 'transferencia') continue
    if (m.tipo === 'desembolso') desembolsadoEfectivoHoy += m.monto
    else gastosEfectivoHoy += m.monto
  }

  // Pines del mapa: pagos del dia con coords, color por distancia con su cliente.
  const cobrosGeoHoy = []
  // IDs de pagos y prestamos de esta ruta — para cruzar con ActividadLog y
  // detectar pagos editados/anulados hoy en el feed de "Actividad del día".
  const pagoIdsRuta = []
  const prestamoIdsRuta = []

  // El dia por el que se pregunta, una sola vez para todo el recorrido.
  const hoyLocal = inicioDia()

  const clientesEnriquecidos = ruta.clientes.map((c) => {
    // diasSinCobro se resuelve a nivel cliente (sin prestamo individual aquí,
    // ya que la vista de ruta no tiene acceso al campo diasSinCobro del prestamo)
    const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
    const _hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)
    let cuotaCliente = 0
    let pagadoHoy    = 0
    let mora         = 0
    let cuotasEnMoraCliente = 0
    let montoEnMoraCliente = 0
    let montoParaAlDiaCliente = 0
    // CUMPLIMIENTO del cliente: de las cuotas que YA debian estar pagadas,
    // cuantas lo estan. Misma definicion que en /api/clientes — si se cambia
    // alli, se cambia aqui. Es la columna «Cumple» de la tabla de T04-09.
    let cuotasVencidasCliente = 0
    let cuotasPagadasCliente = 0
    const prestamosActivos = []
    let ultimaFechaPago = null
    // ── LOS QUE NO SON VISITA DE HOY (Adenda 5 · E09) ──
    // La lámina baja a «también en esta ruta» a quien no toca cobrar, y le pide
    // a cada estado la frase que de verdad sirve. Al de SIN DEUDA le pide dos
    // datos que no teníamos: cuándo terminó de pagar y cuánto se le puede
    // prestar. Se sacan de sus préstamos ya liquidados, que la consulta YA trae
    // enteros —«se traen TODOS»—, así que no cuesta una consulta más.
    //
    // `puedePrestarHasta` es lo más grande que ya devolvió completo. No es una
    // recomendación de riesgo: es el único techo que este cliente tiene
    // demostrado. Inventar una cifra mayor sería mandar a prestar de más desde
    // una pantalla de cobro.
    let terminoDePagar = null
    let puedePrestarHasta = 0
    let prestamosCompletados = 0
    let frecuencia   = null   // null = todavia no se ha visto ningun prestamo
    let proximoCobro = null
    let cobroPendienteHoy = false
    // Pago de hoy con coords mas reciente — alimenta el badge en la card del cliente.
    let pagoHoyGeoCliente = null
    // Detalle de pagos de hoy (vista de auditoria): monto, metodo y hora de cada cobro real.
    const pagosHoyDetalle = []
    // Préstamos creados hoy para este cliente (nuevos o renovaciones), y seguros
    // cobrados hoy — recorre TODOS los préstamos (no solo activos), porque un
    // préstamo renovado hoy puede haber quedado liquidado/inactivo de inmediato.
    const eventosHoy = []

    for (const p of c.prestamos) {
      if (p.createdAt && new Date(p.createdAt) >= _hoy && new Date(p.createdAt) < _manana) {
        eventosHoy.push({
          prestamoId: p.id,
          tipo: p.renovadoDeId ? 'renovacion' : 'prestamo_nuevo',
          montoPrestado: p.montoPrestado,
          totalAPagar: p.totalAPagar ?? p.montoPrestado,
          seguro: !!p.seguro,
          montoSeguro: p.montoSeguro ?? null,
          createdAt: p.createdAt,
        })
      }
    }

    for (const p of c.prestamos) {
      prestamoIdsRuta.push(p.id)
      // p.pagos ya viene filtrado por hoy desde la query (where fechaPago gte/lt)
      const pagosHoy = p.pagos
      for (const pg of pagosHoy) pagoIdsRuta.push(pg.id)
      const cobrosReales = pagosHoy.filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
      const montoPagadoHoy = cobrosReales.reduce((a, pg) => a + pg.montoPagado, 0)
      pagadoHoy    += montoPagadoHoy
      recaudadoHoy += montoPagadoHoy

      // EN QUÉ SE COBRÓ, separado. Es lo que hace posible cuadrar la caja de la
      // noche: sin esto el cobrador entrega un fajo de efectivo y nadie sabe
      // cuánto de lo recaudado llegó por transferencia y no tiene que aparecer.
      //
      // `metodoPago` es 'efectivo' | 'transferencia' y es distinto de
      // `metodoPagoId`, que apunta a la cuenta concreta de la organización.
      // Confundirlos rompe la vista por cuenta. Lo que no dice nada cuenta como
      // efectivo, que es el modo por defecto de un cobro en la calle.
      for (const pg of cobrosReales) {
        if (pg.metodoPago === 'transferencia') recaudadoDigitalHoy += pg.montoPagado
        else recaudadoEfectivoHoy += pg.montoPagado
      }

      // Detalle de pagos reales de hoy (auditoria): un item por pago, mas reciente
      // primero. Incluye distancia al cliente cuando el pago trae coords (para
      // detectar cobros registrados lejos del domicilio) y si el registro en
      // sistema (createdAt) difiere mucho de la hora del pago (fechaPago) —
      // indicio de que se "cuadro" o registro despues, no en el momento del cobro.
      for (const pg of pagosHoy) {
        if (['recargo', 'descuento'].includes(pg.tipo)) continue
        const tieneCoords = pg.latitud != null && pg.longitud != null
        const minutosRegistroTardio = Math.round((new Date(pg.createdAt) - new Date(pg.fechaPago)) / 60000)
        pagosHoyDetalle.push({
          prestamoId: p.id,
          monto: pg.montoPagado,
          metodoPago: pg.metodoPago || null,
          fechaPago: pg.fechaPago,
          distanciaMetros: tieneCoords ? distanciaMetros(pg.latitud, pg.longitud, c.latitud, c.longitud) : null,
          clienteSinCoords: c.latitud == null || c.longitud == null,
          // > 60 min de diferencia: el pago se registro bastante despues de la
          // hora que se le asigno (puede ser legitimo, pero vale la pena verlo).
          registradoTarde: minutosRegistroTardio > 60 ? minutosRegistroTardio : null,
        })
      }

      // Geolocalizacion del cobro: recolectar pagos reales (no ajustes) de hoy
      // con lat/lng. Cada pago alimenta `cobrosGeoHoy` (pines del mapa) y el
      // mas reciente del cliente alimenta `pagoHoyGeo` (badge en card).
      for (const pg of pagosHoy) {
        if (['recargo', 'descuento'].includes(pg.tipo)) continue
        if (pg.latitud == null || pg.longitud == null) continue
        const dist = distanciaMetros(pg.latitud, pg.longitud, c.latitud, c.longitud)
        cobrosGeoHoy.push({
          clienteId: c.id,
          latitud: pg.latitud,
          longitud: pg.longitud,
          distanciaMetros: dist,
        })
        if (!pagoHoyGeoCliente || new Date(pg.fechaPago) > new Date(pagoHoyGeoCliente.fechaPago)) {
          pagoHoyGeoCliente = {
            latitud: pg.latitud,
            longitud: pg.longitud,
            distanciaMetros: dist,
            fechaPago: pg.fechaPago,
          }
        }
      }

      // ── EL ÚLTIMO PAGO, DE TODOS LOS PRÉSTAMOS ──
      // Antes del `continue`: estaba después, así que el cliente sin préstamo
      // activo —que es justo el de la zona de abajo— se quedaba sin fecha. Un
      // «hace cuánto se le vio» que solo existe para quien todavía debe no
      // sirve para decidir si la ruta está desactualizada.
      //
      // ⚠ Y NO desde `p.pagos[0]`, que es lo que había: ese `include` viene
      // filtrado a hoy —lo pide el cálculo del recaudado—, así que la fecha
      // solo podía ser la de hoy o ninguna. Nunca «hace 9 días», que es el
      // caso que importa. Sale del agregado de arriba, que mira el historial.
      const ultimo = finDePrestamo.get(p.id)
      if (ultimo) {
        const fecha = new Date(ultimo)
        if (!ultimaFechaPago || fecha > ultimaFechaPago) ultimaFechaPago = fecha
      }

      // ── E09 · lo que dejó atrás el que ya no debe ──
      // Antes del `continue`, que es el único sitio donde se ven los préstamos
      // liquidados. El clavo no cuenta: se perdió, no lo devolvió, y ofrecerle
      // más plata a quien dejó un clavo por el mismo camino es al revés.
      if (p.estado !== 'activo' && !p.esClavo) {
        prestamosCompletados++
        puedePrestarHasta = Math.max(puedePrestarHasta, p.montoPrestado ?? 0)
        // ⚠ LA FECHA NO SALE DE `p.pagos`. Ese `include` viene filtrado a HOY
        // —`fechaPago: { gte: _hoy, lt: _manana }`—, así que un préstamo que se
        // terminó de pagar hace meses trae CERO pagos y `p.pagos[0]` es
        // `undefined`. Leerlo daría `null` siempre y la fila diría «terminó de
        // pagar» sin fecha, sin que nada fallara. Sale de `finDePrestamo`, que
        // se resuelve arriba en una sola consulta agregada.
        const fin = finDePrestamo.get(p.id)
        if (fin && (!terminoDePagar || fin > terminoDePagar)) terminoDePagar = fin
      }

      // Métricas de cartera/mora solo para préstamos activos
      if (p.estado !== 'activo') continue

      // Tarjeta clavo: su cobro de hoy SÍ entró arriba al recaudado (dinero real),
      // pero el lado negativo del clavo (cartera, mora, cuotas vencidas, esperado)
      // NO debe descuadrar los números de la ruta. Se agrega a prestamosActivos
      // para que el UI muestre saldo/cuota, pero no suma a cartera ni mora.
      if (p.esClavo) {
        const saldoClavo = calcularSaldoPendiente(p)
        const cuotaClavo = cuotaDelPeriodo(p)
        const proximaCuotaClavo = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
        cuotaCliente += cuotaClavo
        const extraClavo = detectarCuotaExtra(p, proximaCuotaClavo)
        prestamosActivos.push({
          id: p.id,
          // Que se sepa desde fuera. Sin esto, un cliente cuyo único préstamo
          // es un clavo se lee como cliente con préstamo activo, y la zona de
          // abajo le ponía «Al día» con anillo verde a un préstamo PERDIDO.
          esClavo: true,
          cuotaDiaria: Math.round(cuotaClavo),
          cuotaDiariaOriginal: p.cuotaDiaria,
          saldoPendiente: Math.round(saldoClavo),
          totalAPagar: p.totalAPagar ?? p.montoPrestado,
          totalPagado: p.totalPagado ?? 0,
          pagadoHoy: montoPagadoHoy > 0,
          montoPagadoHoy: Math.round(montoPagadoHoy),
          diasMora: 0,
          cuotasEnMora: 0,
          montoEnMora: 0,
          montoParaPonerseAlDia: 0,
          frecuencia: p.frecuencia || 'diario',
          montoPrestado: p.montoPrestado,
          fechaInicio: p.fechaInicio,
          seguro: !!p.seguro,
          montoSeguro: p.montoSeguro ?? null,
          modoInteres: p.modoInteres || 'fijo',
          esBalloon: proximaCuotaClavo?.esBalloon || false,
          cuotaNumero: proximaCuotaClavo?.numeroPeriodo ?? null,
          esClavo: true,
          ...extraClavo,
        })
        continue
      }

      // Resolver diasSinCobro por préstamo individual (incluye campo propio del préstamo)
      const diasExcluidosPrestamo = obtenerDiasSinCobro(c, ruta, org, p)

      // La cuota y el «toca hoy» salen del modulo comun. Esta era la unica de
      // las cinco implementaciones que respetaba el override por prestamo, y
      // por eso el modulo lo respeta tambien: aqui no se pierde nada.
      const cuota = cuotaDelPeriodo(p)
      cuotaCliente  += cuota
      esperadoHoy   += tocaCobrarEn(p, hoyLocal, diasExcluidosPrestamo, festivos) ? cuota : 0
      const saldoPendientePrestamo = calcularSaldoPendiente(p)
      carteraTotal    += saldoPendientePrestamo
      capitalTotal    += p.montoPrestado
      totalAPagarRuta += p.totalAPagar ?? p.montoPrestado
      // Nunca por encima del saldo: si un préstamo tiene recargos, el capital
      // restante no puede pasarse de lo que queda por cobrar.
      capitalPendiente += Math.min(calcularCapitalRestante(p), saldoPendientePrestamo)
      const moraPrestamo = calcularDiasMora(p, diasExcluidosPrestamo, festivos)
      const cuotasMoraPrestamo = calcularCuotasEnMora(p, diasExcluidosPrestamo, festivos)
      const montoMoraPrestamo = calcularMontoEnMora(p, diasExcluidosPrestamo, festivos)
      const montoAlDiaPrestamo = calcularMontoParaPonerseAlDia(p, diasExcluidosPrestamo, festivos)
      mora = Math.max(mora, moraPrestamo)
      cuotasEnMoraCliente += cuotasMoraPrestamo
      montoEnMoraCliente += montoMoraPrestamo
      montoParaAlDiaCliente += montoAlDiaPrestamo
      {
        const totalCuotasP = tieneTablaAmortizacion(p)
          ? p.cuotasAmortizacion.length
          : (p.cuotaDiaria > 0 ? Math.ceil((p.totalAPagar || 0) / p.cuotaDiaria) : 0)
        const pagadasP = Math.max(0, totalCuotasP - calcularCuotasPendientes(p))
        cuotasPagadasCliente += pagadasP
        cuotasVencidasCliente += pagadasP + cuotasMoraPrestamo
      }
      const cuotaReal = cuotaDelPeriodo(p)
      const proximaCuota = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
      const extraInfo = detectarCuotaExtra(p, proximaCuota)
      prestamosActivos.push({
        id: p.id,
        cuotaDiaria: Math.round(cuotaReal),
        cuotaDiariaOriginal: p.cuotaDiaria,
        saldoPendiente: Math.round(saldoPendientePrestamo),
        totalAPagar: p.totalAPagar ?? p.montoPrestado,
        totalPagado: p.totalPagado ?? 0,
        pagadoHoy: montoPagadoHoy > 0,
        montoPagadoHoy: Math.round(montoPagadoHoy),
        diasMora: moraPrestamo,
        cuotasEnMora: cuotasMoraPrestamo,
        montoEnMora: Math.round(montoMoraPrestamo),
        montoParaPonerseAlDia: Math.round(montoAlDiaPrestamo),
        frecuencia: p.frecuencia || 'diario',
        montoPrestado: p.montoPrestado,
        fechaInicio: p.fechaInicio,
        seguro: !!p.seguro,
        montoSeguro: p.montoSeguro ?? null,
        modoInteres: p.modoInteres || 'fijo',
        esBalloon: proximaCuota?.esBalloon || false,
        cuotaNumero: proximaCuota?.numeroPeriodo ?? null,
        ...extraInfo,
      })

      /* ⚠ CON DOS PRESTAMOS DE FRECUENCIAS DISTINTAS, ESTO MENTIA.
         Se quedaba con la del ULTIMO del bucle, sin avisar: un cliente con uno
         diario y uno semanal salia rotulado como semanal y el cobrador le pedia
         la cuota del dia equivocado. Cuando no coinciden se dice `varias`, que
         es la verdad, y la tarjeta no pone rotulo. */
      const suya = p.frecuencia || 'diario'
      frecuencia = frecuencia === null ? suya : (frecuencia === suya ? suya : 'varias')
      const pc = calcularProximoCobro(p, diasExcluidosPrestamo, festivos)
      if (pc && (!proximoCobro || pc < proximoCobro)) proximoCobro = pc

      // Pendiente hoy según cobertura real esperada al día de hoy.
      if (!_hoySinCobro && tieneCobroPendienteHoy(p, diasExcluidosPrestamo, festivos)) {
        cobroPendienteHoy = true
      }
    }

    const yaPageHoy = pagadoHoy > 0
    const pendienteHoyCliente = !_hoySinCobro && cobroPendienteHoy
    const tieneCobroHoy = !_hoySinCobro && (cobroPendienteHoy || yaPageHoy)
    if (pendienteHoyCliente) pendientesHoy++
    if (tieneCobroHoy) clientesConCobroHoy++
    if (tieneCobroHoy && yaPageHoy) clientesPagaronHoy++
    if (mora > 0) enMora++

    // Calcular días desde último pago
    let diasDesdeUltimoPago = null
    if (ultimaFechaPago) {
      const ultimoDia = new Date(ultimaFechaPago)
      ultimoDia.setHours(0, 0, 0, 0)
      diasDesdeUltimoPago = Math.floor((_hoy - ultimoDia) / 86400000)
    }

    // Días para próximo cobro
    let diasParaCobro = null
    if (proximoCobro) {
      diasParaCobro = Math.round((proximoCobro.getTime() - _hoy.getTime()) / 86400000)
    }

    if (yaPageHoy && !pendienteHoyCliente && diasParaCobro === 0) {
      diasParaCobro = 1
    }

    return {
      id:        c.id,
      nombre:    c.nombre,
      cedula:    c.cedula,
      direccion: c.direccion,
      telefono:  c.telefono,
      latitud:   c.latitud,
      longitud:  c.longitud,
      // El estado del cliente se basa en sus préstamos NO clavo (los clavos no
      // cuentan en la cartera/estado de la ruta; solo aportan su cobro al recaudado).
      estado:    c.prestamos.filter((pr) => !pr.esClavo).length === 0 ? 'completado' : (mora > 0 ? 'mora' : 'activo'),
      tieneClavo: c.prestamos.some((pr) => pr.esClavo && pr.estado === 'activo'),
      pagoHoy:   yaPageHoy,
      montoPagadoHoy: Math.round(pagadoHoy),
      diasMora:  mora,
      cuotasEnMora: cuotasEnMoraCliente,
      montoEnMora: Math.round(montoEnMoraCliente),
      montoParaPonerseAlDia: Math.round(montoParaAlDiaCliente),
      // `null` mientras no le haya vencido nada: un 0% en un cliente recien
      // prestado lo pinta como el peor de la ruta, y es al reves.
      cumplimiento: cuotasVencidasCliente > 0
        ? Math.round((cuotasPagadasCliente / cuotasVencidasCliente) * 100)
        : null,
      diasDesdeUltimoPago,
      // La fecha entera, no solo los días: la tira de cifras de la tarjeta la
      // pinta como «Últ. pago · 21 jun».
      ultimoPagoAt: ultimaFechaPago,
      // E09 · para la zona «también en esta ruta». Ver el comentario largo de
      // arriba: `puedePrestarHasta` es el techo YA DEMOSTRADO, no una
      // recomendación.
      terminoDePagar,
      puedePrestarHasta: Math.round(puedePrestarHasta),
      prestamosCompletados,
      cuota:     cuotaCliente,
      hoySinCobro: _hoySinCobro,
      cobroPendienteHoy: pendienteHoyCliente,
      // Presentación, no dinero: ver la nota larga de arriba. El cliente sigue
      // debiendo y sigue contando en el esperado del día.
      visitaCerradaHoy: cierreDeHoy.has(c.id),
      motivoCierre: cierreDeHoy.get(c.id) ?? null,
      prestamoActivo: prestamosActivos[0]?.id ?? null,
      prestamosActivos,
      cuotaExtraHoy: prestamosActivos.some(p => p.cuotaExtraHoy),
      montoCuotaExtra: prestamosActivos.reduce((s, p) => s + (p.montoCuotaExtra || 0), 0),
      frecuencia: frecuencia ?? 'diario',
      diasParaCobro,
      proximoCobroLabel: proximoCobro ? formatFechaCobro(proximoCobro) : null,
      // La fecha cruda además del rótulo: E09 escribe «le cobras el 19 de
      // agosto» y necesita formatearla ella, no heredar el formato corto.
      proximoCobroAt: proximoCobro,
      // MVP geolocalizacion: pago mas reciente de hoy con coords, ya con distancia.
      // null cuando: el cobrador nego permiso, no hubo pago, o pago sin coords.
      pagoHoyGeo: pagoHoyGeoCliente
        ? {
            distanciaMetros: pagoHoyGeoCliente.distanciaMetros,
            clienteSinCoords: c.latitud == null || c.longitud == null,
          }
        : null,
      // Detalle de pagos reales de hoy (vista de auditoria), mas reciente primero.
      pagosHoyDetalle,
      // Préstamos nuevos / renovaciones creados hoy para este cliente.
      eventosHoy,
    }
  })

  // Cierre de caja del día
  const cierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId: ruta.cobradorId ?? undefined,
      fecha:      { gte: hoy(), lt: manana() },
    },
  })

  // Seguros de esta ruta: total de prestamos activos con seguro + los del dia.
  const baseSeguro = {
    organizationId,
    seguro: true,
    montoSeguro: { gt: 0 },
    esClavo: false,
    cliente: { rutaId: id },
  }
  const [segVigente, segHoy] = await Promise.all([
    prisma.prestamo.aggregate({ where: { ...baseSeguro, estado: 'activo' }, _sum: { montoSeguro: true }, _count: true }),
    prisma.prestamo.aggregate({ where: { ...baseSeguro, createdAt: { gte: hoy(), lt: manana() } }, _sum: { montoSeguro: true }, _count: true }),
  ])

  // Actividad del día (auditoria): pagos editados/anulados y préstamos
  // editados/eliminados hoy. Para pagos editados, cruza por entidadId (el pago
  // sigue existiendo). Para anulaciones/eliminaciones la entidad ya no existe,
  // así que se filtra por el cobrador de la ruta como mejor aproximación.
  const actividadHoy = await prisma.actividadLog.findMany({
    where: {
      organizationId,
      createdAt: { gte: _hoy, lt: _manana },
      OR: [
        { accion: 'editar_pago', entidadId: { in: pagoIdsRuta.length ? pagoIdsRuta : ['__none__'] } },
        { accion: { in: ['anular_pago', 'editar_prestamo', 'eliminar_prestamo'] }, userId: ruta.cobradorId ?? undefined },
      ],
    },
    select: { id: true, accion: true, entidadTipo: true, entidadId: true, detalle: true, createdAt: true, userId: true, user: { select: { nombre: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const puedeVerCapital = rol === 'owner' || session.user.permisos?.verCapitalRuta

  return Response.json({
    id:          ruta.id,
    nombre:      ruta.nombre,
    diasSinCobro: ruta.diasSinCobro,
    ...(puedeVerCapital ? {
      saldoCapital: Math.round(ruta.saldoCapital || 0),
      capitalHabilitado: !!ruta.capitalHabilitado,
      carteraTotal: Math.round(carteraTotal),
      capitalTotal: Math.round(capitalTotal),
      capitalPendiente: Math.round(capitalPendiente),
    } : {}),
    cobrador:    ruta.cobrador,
    clientes:    clientesEnriquecidos,
    esperadoHoy: Math.round(esperadoHoy),
    recaudadoHoy: Math.round(recaudadoHoy),
    recaudadoEfectivoHoy: Math.round(recaudadoEfectivoHoy),
    recaudadoDigitalHoy: Math.round(recaudadoDigitalHoy),
    // ── LO QUE SALIO DE LA CARTERA HOY, EN ESTA RUTA ──
    //
    // El cierre del dia no es «cuanto recogiste»: es cuanto recogiste MENOS lo
    // que entregaste en prestamos y MENOS lo que gastaste. Hasta ahora la
    // pantalla pedia un total a secas y el cobrador tenia que hacer esa resta
    // de cabeza, de noche y con el fajo en la mano.
    //
    // Solo EFECTIVO: lo que salio por transferencia no esta en el fajo que hay
    // que entregar, asi que restarlo descuadraria el cierre al reves.
    desembolsadoEfectivoHoy: Math.round(desembolsadoEfectivoHoy),
    gastosEfectivoHoy: Math.round(gastosEfectivoHoy),
    entroMes: Math.round(entroMes),
    salioAPrestarMes: Math.round(salioAPrestarMes),
    // ── «3,4 km» EN LA CABECERA (T27-02) ──
    //
    // Lo que se camina hoy, en el orden del recorrido. Es lo que decide si la
    // ruta cabe en una mañana, y hasta ahora no estaba en ninguna pantalla.
    //
    // `totalDistance` ya existía en lib/routeOptimizer.js — la usa el
    // optimizador de orden. Se le pasan solo los clientes CON coordenadas: los
    // que no las tienen se saltan en vez de contar como (0,0), que metería
    // miles de kilómetros de ida y vuelta al golfo de Guinea.
    //
    // NO se reordena aquí: la consulta ya sale `orderBy ordenRuta asc` (y
    // `ordenRuta` ni siquiera viaja en el objeto mapeado, así que ordenar por
    // él sería ordenar por `undefined` y dejar la lista como estaba... o no,
    // según el navegador).
    //
    // `null` con menos de dos puntos: no hay tramo que medir, y un «0,0 km» se
    // lee como que la ruta entera está en el mismo portal.
    distanciaMetros: (() => {
      const conCoords = clientesEnriquecidos.filter((c) => c.latitud != null && c.longitud != null)
      return conCoords.length >= 2 ? Math.round(totalDistance(conCoords)) : null
    })(),
    pendientesHoy,
    clientesConCobroHoy,
    clientesPagaronHoy,
    enMora,
    totalAPagarRuta: Math.round(totalAPagarRuta),
    segurosVigentes: Math.round(segVigente._sum.montoSeguro || 0),
    segurosVigentesCount: segVigente._count,
    segurosHoy: Math.round(segHoy._sum.montoSeguro || 0),
    segurosHoyCount: segHoy._count,
    cierre,
    // MVP geo: pines para el mapa de la ruta. Cada item es un cobro de hoy
    // con coords; el frontend pinta verde/naranja/rojo por distancia.
    cobrosGeoHoy,
    // Actividad del día (auditoria): pagos editados/anulados, prestamos editados/eliminados.
    actividadHoy,
    configMoratorio: {
      tasaMoratorio: org?.tasaMoratorio ?? 0,
      diasGracia: org?.diasGraciaMoratorio ?? 5,
    },
  })
}

// ─── PATCH /api/rutas/[id] ──────────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede modificar rutas' }, { status: 403 })
  }

  const { id } = await params
  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { nombre, cobradorId, diasSinCobro, capitalHabilitado } = await request.json()

  // Validar cobrador si se envía (mismo tenant y rol correcto). El `esId` es
  // porque un número casaría con un cobrador cualquiera: ver lib/ids.js.
  if (cobradorId !== undefined && cobradorId !== null && cobradorId !== '') {
    if (!esId(cobradorId)) {
      return Response.json({ error: 'Cobrador no válido' }, { status: 400 })
    }
    const cobrador = await prisma.user.findFirst({
      where: { id: cobradorId, organizationId: session.user.organizationId, rol: 'cobrador' },
      select: { id: true },
    })
    if (!cobrador) {
      return Response.json({ error: 'Cobrador no válido' }, { status: 400 })
    }
  }

  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  // Guarda: si se cambia el cobrador y el anterior ya tiene cierre o pagos del
  // dia, bloquear para evitar cierres fragmentados. Permitir bypass con ?forzar=1.
  const { searchParams } = new URL(request.url)
  const forzar = searchParams.get('forzar') === '1'
  const cambiaCobrador = cobradorId !== undefined && (cobradorId || null) !== ruta.cobradorId
  if (cambiaCobrador && ruta.cobradorId && !forzar) {
    const country = session.user.country ?? 'co'
    const absOffset = Math.abs(getUtcOffset(country))
    const hoyCo = new Date(Date.now() - absOffset * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { inicio: inicioHoy, fin: finHoy } = getLocalDayRange(hoyCo, country)
    const [cierreHoy, pagosHoy] = await Promise.all([
      prisma.cierreCaja.findFirst({
        where: { cobradorId: ruta.cobradorId, fecha: { gte: inicioHoy, lte: finHoy } },
        select: { id: true },
      }),
      prisma.pago.count({
        where: {
          cobradorId: ruta.cobradorId,
          organizationId: session.user.organizationId,
          fechaPago: { gte: inicioHoy, lte: finHoy },
          prestamo: { cliente: { rutaId: id } },
        },
      }),
    ])
    if (cierreHoy || pagosHoy > 0) {
      return Response.json({
        error: cierreHoy
          ? 'El cobrador anterior ya tiene cierre de caja hoy. Cambiar el cobrador fragmentaria el cierre.'
          : `El cobrador anterior tiene ${pagosHoy} pago(s) de hoy en esta ruta. Espera al cierre o forza el cambio.`,
        cambioBloqueado: true,
        motivo: cierreHoy ? 'cierre_existente' : 'pagos_del_dia',
      }, { status: 409 })
    }
  }

  const actualizada = await prisma.ruta.update({
    where: { id },
    data: {
      ...(nombre      !== undefined && { nombre:      nombre.trim()   }),
      ...(cobradorId  !== undefined && { cobradorId:  cobradorId || null }),
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(capitalHabilitado !== undefined && { capitalHabilitado: !!capitalHabilitado }),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(actualizada)
}

// ─── DELETE /api/rutas/[id] ─────────────────────────────────────
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar rutas' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: { _count: { select: { clientes: true } } },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  // Desasignar clientes y eliminar ruta en una transaccion atomica
  await prisma.$transaction([
    prisma.cliente.updateMany({
      where: { rutaId: id, organizationId },
      data: { rutaId: null, ordenRuta: null },
    }),
    prisma.ruta.delete({ where: { id } }),
  ])

  return Response.json({ eliminada: true, clientesDesasignados: ruta._count.clientes })
}
