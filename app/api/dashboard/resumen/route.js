// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPatrimonio, tienePeriodoEsperadoHoy, calcularCapitalRestante } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'
import { fraccionInteres } from '@/lib/dinero/reparto'
import { interesCobradoDeLosPrestamos, SELECT_PARA_INTERES } from '@/lib/dinero/interes-cobrado'

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
  // Corte de ayer a la MISMA hora que llevamos hoy. Comparar la mañana contra
  // el dia completo de ayer siempre da negativo antes del cierre: a las 10am
  // el cartel decia "94% menos que ayer" todos los dias, asi que la alarma
  // sonaba siempre y dejaba de significar algo.
  const msTranscurridosHoy = Math.max(0, Date.now() - inicioDiaUTC.getTime())
  const finAyerMismaHoraUTC = new Date(
    Math.min(inicioAyerUTC.getTime() + msTranscurridosHoy, finAyerUTC.getTime())
  )
  // Rango ultimos 7 dias (incluye hoy) para el sparkline.
  // Antes se traian 30 dias de pagos para alimentar un heatmap que nunca se
  // renderizaba: 23 dias de pagos individuales leidos en CADA carga del
  // dashboard para no pintar nada.
  const inicio7DiasUTC = new Date(Date.UTC(y, m, d - 6, 5, 0, 0))

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
    pagosAyerMismaHora,
    pagosHoyPorCobrador,
    prestamosHoy,
    gastosHoy,
    movimientosHoy,
    clientesSinRutaCount,
    clientesSinPagosLargo,
    pagos7Dias,
    prestamosQueCobraronEsteMes,
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
        totalPagado: true, abonadoCapital: true,
        ultimoPagoAt: true,
        modoInteres: true,
        proximoCobroManual: true,
        /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
           interés devengado sin pagar, y un campo que no se pide vale `undefined`
           —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
        devengos: { select: { periodo: true, interes: true } },
        cuotasAmortizacion: {
          orderBy: { numeroPeriodo: 'asc' },
          // `capital` lo necesita calcularCapitalRestante en los modos con tabla.
          select: { numeroPeriodo: true, cuotaTotal: true, capital: true, interes: true, pagado: true, interesPagado: true, fechaEsperada: true },
        },
        // SOLO los abonos a capital. calcularCapitalRestante los excluye de la
        // cascada interes-primero, y son un puñado por prestamo. Traer todos los
        // pagos aqui costaria caro en las carteras grandes y no se usan para nada
        // mas en esta ruta. Medido: +5ms en la org mas pesada (970 activos).
        pagos: { where: { tipo: 'capital' }, select: { montoPagado: true, tipo: true } },
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
    //
    // Solo los APROBADOS. Sin este filtro se sumaban tambien los RECHAZADOS
    // ($247.000 en produccion) y los pendientes ($49.000): plata que no salio,
    // bajando la ganancia. Analiticas, capital y «mas» ya filtraban asi, con lo
    // que «gastos del mes» daba dos cifras segun la pantalla.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        estado: 'aprobado',
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

    // Pagos de ayer HASTA LA MISMA HORA que llevamos hoy: es la unica
    // comparacion honesta antes de que termine el dia.
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioAyerUTC, lte: finAyerMismaHoraUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
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
    //
    // Aqui SI cuenta el pendiente, y es a proposito: es la caja del dia y el
    // cobrador ya saco esa plata de su bolsillo aunque el dueño no la haya
    // revisado. El rechazado no cuenta en ningun sitio: nunca salio.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        estado: { in: ['pendiente', 'aprobado'] },
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
        fechaPago: { gte: inicio7DiasUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      select: { montoPagado: true, fechaPago: true },
    }),

    /* Los PRÉSTAMOS que cobraron este mes, con su tabla y su historial de pagos.
     *
     * ⚠ Antes esto traía los pagos sueltos y repartía cada uno por la PROPORCIÓN
     *   del préstamo entero. En un préstamo francés las primeras cuotas son casi
     *   todo interés, así que esa cuenta se queda corta: Miguel Ángel veía
     *   $135.417 aquí y $215.019 en analíticas, el mismo mes. Ver
     *   lib/dinero/interes-cobrado.js.
     *
     * ⚠ Hace falta el historial ENTERO, no solo los pagos del mes: el interés de
     *   un pago depende de por dónde va la tabla, y eso lo dice lo pagado antes.
     *
     * El coste medido es despreciable: el negocio con más movimiento son 43
     * préstamos y 169 filas de cuotas. */
    esCobrador ? Promise.resolve([]) : prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: { not: 'cancelado' },
        pagos: {
          some: {
            fechaPago: { gte: inicioMes, lte: finMes },
            tipo: { notIn: ['recargo', 'descuento'] },
          },
        },
      },
      select: SELECT_PARA_INTERES,
    }),
  ])

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  let saldoPorCobrar = 0
  // Capital que sigue AFUERA, no el que salio algun dia. Antes esto sumaba
  // `montoPrestado` de cada prestamo activo, o sea el monto original, y nunca
  // bajaba cuando el cliente abonaba: decia "cuanto hay en la calle" mostrando
  // cuanto SALIO a la calle. Medido en produccion, inflaba 15,2% en las 12
  // carteras mas grandes (hasta 37% en una) — $210 millones de mas en total.
  // Dos clientes lo reportaron el mismo dia, uno con el diagnostico exacto:
  // "no descuenta lo que ya le he colocado como pagado".
  let capitalEnCalle = 0
  let cuotaDiariaTotal = 0
  // Meta REAL del dia: solo las cuotas que de verdad vencen HOY segun la
  // frecuencia de cada prestamo, descontando dias sin cobro y festivos.
  // `cuotaDiariaTotal` suma una cuota de CADA prestamo activo, asi que con
  // cartera semanal o quincenal inflaba la meta varias veces: el usuario veia
  // $3.261.868 cuando lo que tocaba cobrar ese dia eran $647.867, y el donut
  // marcaba 1% en vez de 3%. Una meta inalcanzable enseña a ignorar la meta.
  let esperadoHoy = 0
  // Cuanta plata hay ATRAPADA en los prestamos en mora. T02-01 lo pide junto al
  // conteo: «20 de 25 · $3,1M expuestos».
  //
  // El conteo solo no dice el tamano del problema: veinte clientes en mora
  // debiendo $50.000 cada uno es un mal dia, y veinte debiendo $500.000 es el
  // negocio en peligro. Son la misma cifra en la pantalla vieja y dos
  // situaciones distintas.
  let saldoEnMora = 0
  // Cuantos pasan de 30 dias. ESTABA FIJADO A CERO en la respuesta —el campo
  // existia y nunca se calculaba— asi que la fila «N prestamos con mas de 30
  // dias de mora» de T02-01 no podia aparecer nunca.
  let mora30plus = 0
  // ── LOS MONTOS DE CADA ALERTA (T02-07) ──
  // La lamina pone la PLATA al lado de cada fila —«13 prestamos con mas de 30
  // dias de mora · $1.84M»— y hasta ahora solo viajaba el conteo. Sin el monto,
  // las tres filas parecen igual de urgentes: trece prestamos de $50.000 y tres
  // de $2.000.000 se leen igual, y no lo son.
  //
  // Se suman en el MISMO bucle y con `saldoP`, que ya se calcula aqui abajo:
  // hacerlo aparte obligaria a recorrer la cascada de pagos otra vez.
  let mora30Monto = 0
  let sinPagosMonto = 0
  let sinPagos7 = 0
  // ⚠ SIETE DÍAS DE CALENDARIO, NO 7×24 HORAS AL MILISEGUNDO.
  //
  // Decía `new Date(Date.now() - 7*86400000)`: una ventana que se arrastra con
  // el reloj. Medido contra producción, en DIECINUEVE MINUTOS la cifra se movió
  // sola porque los préstamos iban cruzando el borde:
  //
  //     PRESTA MIL        499 → 502 préstamos · $133.986.898 → $134.765.898
  //     PRESTAMOS PEDRO    24 →  25 · $88.386.551 → $91.081.177
  //
  // Comprobado en la base: exactamente 3 y 1 préstamos con su último pago
  // dentro de esos 19 minutos, y $779.000 y $2.694.626. Cuadraba al peso.
  //
  // Un dueño que recarga dos veces ve dos números distintos sin que haya pasado
  // nada, y eso es de lo que más desconfianza genera. Anclado al inicio del día
  // —el mismo `inicioDiaUTC` que ya usa el resto del archivo— la cifra solo
  // cambia cuando cambia el día o cuando alguien paga.
  const hace7dias = new Date(inicioDiaUTC.getTime() - 7 * 24 * 60 * 60 * 1000)
  let renovarMonto = 0
  // A cuantos clientes toca cobrarles hoy. Ver la nota del `.add()` de abajo.
  const clientesConCobroHoy = new Set()
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
    // calcularCapitalRestante devuelve null si el prestamo no tiene monto util;
    // ahi el capital vivo es lo mejor que tenemos: el monto prestado.
    capitalEnCalle += calcularCapitalRestante(p) ?? p.montoPrestado ?? 0
    cuotaDiariaTotal += p.cuotaDiaria ?? 0

    // Misma regla que usa /api/rutas para su esperadoHoy, para que el hero y el
    // bloque "Por ruta hoy" no se contradigan.
    const _diasExcl = getDiasExcluidos(p.cliente)
    const _sinCobroHoy = esHoySinCobro(_diasExcl) || esHoyFestivo(festivos)
    if (tienePeriodoEsperadoHoy(p, _sinCobroHoy, _diasExcl, festivos)) {
      esperadoHoy += p.cuotaDiaria ?? 0
      // A CUANTOS toca cobrarles hoy, con la MISMA regla que la plata.
      //
      // Esto faltaba, y era una carencia con consecuencia: el resumen daba
      // `esperadoHoy` (la plata) pero no el conteo, asi que el panel lo pasaba
      // en 0 y el bloque del dia no se pintaba. La alternativa que se descarto
      // —usar `cantidadClientes` de /api/rutas— es el total de la ruta, no los
      // que tocan hoy: habria dicho 68 cobros pendientes habiendo 12.
      //
      // Es un Set de clienteId, no un contador: un cliente con tres prestamos
      // que vencen hoy es UNA visita, no tres.
      clientesConCobroHoy.add(p.clienteId)
    }

    const diasExcluidos = getDiasExcluidos(p.cliente)
    const diasMora = calcularDiasMora(p, diasExcluidos, festivos)
    const estaEnMora = diasMora > 0
    if (estaEnMora) {
      clientesMora.add(p.clienteId)
      // Mas de 30 dias es otra cosa: no es un atraso, es un prestamo que
      // probablemente no vuelve. T02-01 le da su propia fila en «Necesita tu
      // atencion», separada del conteo general de mora.
      if (diasMora > 30) mora30plus += 1
    }

    const saldoP = calcularSaldoPendiente(p)
    // SIN PAGOS HACE +7 DIAS, contado y sumado EN EL MISMO SITIO.
    // El conteo venia de un `count()` aparte cuyo filtro no es identico al de
    // este bucle —aquel no excluye los clavos— asi que el numero y el monto
    // habrian salido de dos reglas distintas. Eso es exactamente el fallo que
    // llevo toda la tanda arreglando: dos preguntas parecidas que se contestan
    // por caminos distintos y se contradicen. Excluir los clavos ademas es mas
    // correcto: un clavo ya esta dado por perdido, no es un cliente abandonado.
    if (!p.ultimoPagoAt || new Date(p.ultimoPagoAt) < hace7dias) {
      sinPagos7 += 1
      sinPagosMonto += saldoP
    }
    // El monto va DESPUES de `saldoP`, por lo mismo que el expuesto de abajo.
    if (estaEnMora && diasMora > 30) mora30Monto += saldoP
    // El saldo expuesto se suma ACA y no arriba porque `saldoP` se calcula en
    // esta linea: hacerlo antes obligaria a llamar dos veces a
    // calcularSaldoPendiente(), que recorre la cascada de pagos del prestamo.
    if (estaEnMora) saldoEnMora += saldoP
    const pctPagado = p.totalAPagar > 0 ? Math.round(((p.totalPagado || 0) / p.totalAPagar) * 100) : 0
    if (pctPagado >= 80 && pctPagado < 100 && saldoP > 0) {
      renovarMonto += saldoP
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
  // La fraccion la define lib/dinero/reparto.js, no esta linea.
  // Funciona para prestamos y mercancia (ahi el "interes" es la ganancia
  // = precio venta - costo). El resto del pago es recuperacion de capital.
  //
  // De paso se separa lo de HOY: "recaudado hoy" mezcla dos cosas muy
  // distintas —la plata del prestamista volviendo (capital) y lo que de verdad
  // gano (interes)—. Cobrar $500.000 de capital no es ganar $500.000.
  let interesGanadoMes = null
  let interesGanadoHoy = null
  let capitalRecuperadoHoy = null
  if (!esCobrador) {
    /* La MISMA cuenta que analíticas, de la misma función: con tabla manda la
       tabla, sin tabla manda la proporción. Escrita aparte era como la misma
       ganancia del mismo mes salía distinta según la pantalla. */
    const conPagos = prestamosQueCobraronEsteMes || []
    interesGanadoMes = interesCobradoDeLosPrestamos(conPagos, { desde: inicioMes, hasta: finMes })
    interesGanadoHoy = interesCobradoDeLosPrestamos(conPagos, { desde: inicioDiaUTC, hasta: finMes })
    // El capital de hoy es el resto: lo recaudado hoy menos lo que fue interés.
    let recaudadoHoy = 0
    for (const pr of conPagos) {
      for (const g of (pr.pagos || [])) {
        if (g.fechaPago && g.fechaPago >= inicioDiaUTC && g.fechaPago <= finMes) {
          recaudadoHoy += g.montoPagado ?? 0
        }
      }
    }
    capitalRecuperadoHoy = Math.round(Math.max(0, recaudadoHoy - interesGanadoHoy))
  }

  // Sparkline 7d (de mas viejo a mas reciente, hoy es el ultimo): sparkline7d[6] = hoy
  const sparkline7d = Array(7).fill(0)
  for (const p of pagos7Dias) {
    const fecha = new Date(p.fechaPago)
    const offsetMs = Math.abs(getUtcOffset(country)) * 60 * 60 * 1000
    const fechaCO = new Date(fecha.getTime() - offsetMs)
    const diaCO = Date.UTC(fechaCO.getUTCFullYear(), fechaCO.getUTCMonth(), fechaCO.getUTCDate())
    const hoyCO = Date.UTC(y, m, d)
    const diasAtras = Math.floor((hoyCO - diaCO) / (24 * 60 * 60 * 1000))
    if (diasAtras >= 0 && diasAtras < 7) {
      sparkline7d[6 - diasAtras] += p.montoPagado
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    clientes: {
      total:  clientesActivos.size,
      enMora: clientesMora.size,
      // Ver la nota de `saldoEnMora`: el conteo solo no dice el tamano del
      // problema. Veinte clientes debiendo $50.000 y veinte debiendo $500.000
      // son la misma cifra en pantalla y dos situaciones distintas.
      saldoEnMora: Math.round(saldoEnMora),
    },
    prestamos: {
      activos:         prestamosActivosDetalle.length,
      completados:     prestamosCompletados,
      carteraActiva:   carteraActiva,
      saldoPorCobrar:  saldoPorCobrar,
      // Nombre nuevo a proposito: la clave vieja `capitalPrestado` describia el
      // numero viejo. Renombrar obliga a que cualquier consumidor se entere del
      // cambio de significado en vez de heredarlo en silencio.
      capitalEnCalle: capitalEnCalle,
      cuotaDiariaTotal: cuotaDiariaTotal,
      // Lo que de verdad toca cobrar hoy. Es la meta del hero; cuotaDiariaTotal
      // se queda como "suma de cuotas de la cartera" en el bloque Operacion.
      esperadoHoy: Math.round(esperadoHoy),
      // Cuantos clientes toca visitar hoy, con la MISMA regla que `esperadoHoy`.
      clientesConCobroHoy: clientesConCobroHoy.size,
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
      // Lo que llevabas ayer a esta misma hora. Es contra esto que tiene
      // sentido comparar el dia en curso.
      ayerAEstaHora: Math.round(pagosAyerMismaHora?._sum?.montoPagado ?? 0),
      interesGanadoMes,
      // De lo cobrado hoy, cuanto fue ganancia real y cuanto capital propio
      // volviendo. Solo owner.
      interesGanadoHoy,
      capitalRecuperadoHoy,
      sparkline7d,
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
      prestamosSinPagosLargo: sinPagos7,
      mora30plus,
      // Los tres montos que la lamina pone a la derecha de cada fila.
      mora30Monto:   Math.round(mora30Monto),
      sinPagosMonto: Math.round(sinPagosMonto),
      renovarMonto:  Math.round(renovarMonto),
      // «5 prestamos listos para renovar»: los que van por encima del 80%. Ya se
      // calculaban para otra cosa; T02-01 les da su fila.
      listosParaRenovar: proximosACompletar.length,
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
