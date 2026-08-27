import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { calcularDiasMora, calcularGananciaNeta } from '@/lib/calculos'
import { repartoSql, interesProporcionalDelPago, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'
import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { parsearDiasSinCobro, obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { cuotaDelPeriodo, tocaCobrarEn } from '@/lib/dinero/esperado'

// La formula del reparto interes/capital sale de UN solo sitio. Estaba escrita a
// mano aqui, en el PDF y en el reparto a socios, con tres variantes distintas de
// los casos borde — y por eso las tres pantallas contestaban distinto a la misma
// pregunta. Ver lib/dinero/reparto.js.
const REPARTO_PAGO = repartoSql({ pago: 'p', prestamo: 'pr' })
// `porFila: false`: aquí «el pago» es el PRÉSTAMO entero (`pr.totalPagado`), no
// una fila de `Pago`, así que no hay `tipo` que preguntar. Sin esto el SQL pedía
// `pr.tipo` y la pantalla entera moría con «Unknown column».
const REPARTO_VIDA = repartoSql({ pago: 'pr', prestamo: 'pr', monto: 'totalPagado', porFila: false })

// Modos que llevan tabla de amortizacion. En ellos el interes del periodo se
// calcula sobre el saldo, asi que NO se puede repartir plano sobre cada peso
// cobrado: el primer periodo pesa mucho mas que el ultimo.
//
// Un cliente lo reporto con numeros exactos: su tabla decia $7.742 de interes en
// el mes 1 y esta pantalla registraba $6.896 sobre un pago de $100.000. Medido
// sobre los 295 prestamos activos con tabla, el reparto proporcional subestimaba
// la ganancia en $7.690.180 — un 27,3%. El caso peor era el modo globo, donde
// casi todo lo que entra es interes pero la formula lo diluia.
const MODOS_CON_TABLA = ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo']

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, rol } = session.user
  if (!organizationId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
  if (rol === 'cobrador') return NextResponse.json({ error: 'Solo owner' }, { status: 403 })
  /* ⚠ ESTE ENDPOINT NO TENIA NINGUNA BARRERA DE PLAN, y por aqui se colaba
   * a plan Inicial —322 de los 431 negocios— algo que la tabla de planes
   * marca de Basico en adelante (`reportesNivel`, en lib/planes.js). No era
   * una decision: era un olvido, y llevaba abierto desde el primer dia.
   *
   * La pantalla que llama aqui enseña <PlanGate/> al ver `motivo: 'plan'`.
   * Sin eso decia «revisa tu conexion», que le echa la culpa al internet
   * del cliente por algo que es de su plan. */
  const veto = await exigeNivelReportes(session, 1)
  if (veto) return veto


  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))

  /* ⚠ EL MES EMPIEZA A LAS 05:00 UTC, QUE ES MEDIANOCHE EN BOGOTÁ.
   *
   * `new Date(año, mes, 1)` construye la fecha en la hora LOCAL DEL SERVIDOR, y
   * producción corre en UTC: el mes arrancaba a las 7 de la tarde del día
   * anterior. Un pago de las 8:48 p.m. del 31 de julio contaba como de agosto
   * aquí y como de julio en el dashboard —y esa era una de las dos diferencias
   * que Miguel Ángel reportó—.
   *
   * Es el mismo convenio del resto de la app (`inicioMes` en dashboard/resumen)
   * y el que ya se aplicó al libro de pagos del panel. En local no se ve: el
   * servidor de desarrollo corre en Bogotá y las dos cuentas coinciden. */
  const HORA_CORTE = 5

  /* ⚠ LA MISMA CLAVE DE MES QUE USA EL SQL, Y POR ESO VIVE EN UN SOLO SITIO.
   *
   * La consulta base agrupa restando el corte, y la corrección por tabla lo
   * hacía con `fechaPago.toISOString()`, que es UTC. Un pago del 1 de agosto a
   * la 1:48 UTC —las 8:48 p.m. del 31 de julio en Bogotá— caía en julio por un
   * lado y en agosto por el otro, y la corrección se sumaba a un mes que no era
   * el suyo. Salieron $40.983 de diferencia entre las dos pantallas del mismo
   * negocio, y solo se ven comparando las dos. */
  const claveMesBogota = (fecha) =>
    new Date(new Date(fecha).getTime() - HORA_CORTE * 3600000).toISOString().slice(0, 7)
  const inicioDeMes = (desplazamiento) =>
    new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1, HORA_CORTE, 0, 0))

  const mesActual = inicioDeMes(0)
  const mesAnterior = inicioDeMes(-1)

  const mesesAtras = 6
  const fechaInicio = inicioDeMes(-mesesAtras + 1)

  const [
    pagosMensuales,
    prestamosMensuales,
    gastosMensuales,
    prestamosActivos,
    prestamosCompletados,
    prestamosCancelados,
    prestamosEsclavo,
    cobradorRecaudo,
    orgUsers,
    pagosEsteMes,
    pagosMesAnterior,
    prestamosActivosDetalle,
    festivos,
    organization,
    clientesPorMes,
    totalClientes,
    capitalNoRecuperado,
    prestamosTotal,
    desgloseInteresMensual,
    rentabilidadRutas,
    prestamosConTabla,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(p.fechaPago, INTERVAL 5 HOUR), '%Y-%m') as mes, SUM(p.montoPagado) as total, COUNT(*) as cantidad
      FROM Pago p
      JOIN Prestamo pr ON pr.id = p.prestamoId
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento')
        AND pr.estado <> 'cancelado'
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), '%Y-%m') as mes, SUM(montoPrestado) as capitalPrestado,
        SUM(totalAPagar) as totalAPagar, COUNT(*) as cantidad
      FROM Prestamo WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio} AND esClavo = false
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(fecha, INTERVAL 5 HOUR), '%Y-%m') as mes, SUM(monto) as total
      FROM GastoMenor WHERE organizationId = ${organizationId} AND fecha >= ${fechaInicio} AND estado = 'aprobado'
      GROUP BY mes ORDER BY mes
    `,
    prisma.prestamo.count({ where: { organizationId, estado: 'activo', esClavo: false } }),
    prisma.prestamo.count({ where: { organizationId, estado: 'completado', esClavo: false } }),
    prisma.prestamo.count({ where: { organizationId, estado: 'cancelado', esClavo: false } }),
    prisma.prestamo.aggregate({
      where: { organizationId, esClavo: true },
      _count: true, _sum: { totalAPagar: true },
    }),
    prisma.$queryRaw`
      SELECT p.cobradorId, SUM(p.montoPagado) as recaudado, COUNT(*) as pagos
      FROM Pago p WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${mesActual}
        AND p.tipo NOT IN ('recargo', 'descuento') AND p.cobradorId IS NOT NULL
        AND EXISTS (SELECT 1 FROM Prestamo pr WHERE pr.id = p.prestamoId AND pr.estado <> 'cancelado')
      GROUP BY p.cobradorId ORDER BY recaudado DESC
    `,
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, nombre: true, rol: true },
    }),
    /* ⚠ LOS PAGOS DE UN PRÉSTAMO ANULADO NO SON GANANCIA.
     *
     * Reportado por Crediya el 16 ago 2026: «me equivoqué en registrar un pago,
     * era menos de lo que registré. A pesar de que cancelé el crédito, me sigue
     * mostrando el movimiento y me alteró las utilidades». Tenía razón al peso:
     * escribió $1.000.001 donde iban $100.000, anuló el préstamo, y el millón
     * siguió contando como interés ganado del mes.
     *
     * Las consultas hermanas de esta misma pantalla YA filtraban por estado
     * —la de rentabilidad por ruta y la de préstamos activos—; estas dos y el
     * reparto interés/capital se quedaron atrás. La misma pantalla midiendo con
     * dos criterios distintos.
     *
     * Medido en producción: 110 préstamos anulados conservan 194 pagos por
     * $43.760.053, en 34 negocios. */
    prisma.pago.aggregate({
      where: {
        organizationId, fechaPago: { gte: mesActual },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.pago.aggregate({
      where: {
        organizationId, fechaPago: { gte: mesAnterior, lt: mesActual },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'activo', esClavo: false },
      select: {
        // `estado` se filtra arriba y ADEMAS se pide. `calcularDiasMora` lo lee,
        // y un campo que no entra en el `select` vale `undefined`, no da error:
        // devolvia 0 dias de mora en TODOS los prestamos, sin un aviso. Esta
        // pantalla decia «0 en mora» de 984 mientras el otro reporte, mismo
        // negocio y mismo dia, decia 851. Ver la nota en lib/calculos.js.
        // `proximoCobroManual` tambien lo lee, para saber desde cuando cuenta.
        id: true, estado: true, montoPrestado: true, totalAPagar: true, totalPagado: true, abonadoCapital: true,
        cuotaDiaria: true, frecuencia: true, fechaInicio: true, fechaFin: true,
        diasPlazo: true, ultimoPagoAt: true, modoInteres: true, tasaInteres: true,
        proximoCobroManual: true,
        /* ⚠ LOS DIAS SIN COBRO SON DEL CLIENTE, NO SOLO DEL NEGOCIO.
           Aqui se usaban los de la organizacion para TODOS. En este negocio la
           mayoria de los clientes semanales llevan los suyos —«[0,1,2,3,4,5]»
           es «a este solo se le cobra el sabado»— y con los del negocio se les
           contaban seis dias de atraso por cada uno real: cambia la gravedad
           (grave/moderada/leve) y el monto en riesgo.
           La jerarquia es Prestamo > Cliente > Ruta > Organizacion y la resuelve
           `obtenerDiasSinCobro`, que es lo que ya hace «Como me fue». */
        diasSinCobro: true,
        cliente: {
          select: {
            id: true, nombre: true, rutaId: true, diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
        // `interes` y los abonos a capital NO estaban aqui, y sin ellos
        // `capitalEnCalle()` calcula de menos sin avisar: los prestamos con
        // tabla darian interes 0 y los abonos explicitos no bajarian el capital.
        // Es plata mal contada por un campo que falta en un select.
        /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
           interés devengado sin pagar, y un campo que no se pide vale `undefined`
           —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
        devengos: { select: { periodo: true, interes: true } },
        cuotasAmortizacion: {
          select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, fechaEsperada: true },
        },
        pagos: { where: { tipo: 'capital' }, select: { tipo: true, montoPagado: true } },
      },
    }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), '%Y-%m') as mes, COUNT(*) as nuevos
      FROM Cliente WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio}
      GROUP BY mes ORDER BY mes
    `,
    prisma.cliente.count({ where: { organizationId } }),
    // CAPITAL QUE NO VOLVIO. Prestamos cerrados (o en curso) por debajo de lo
    // prestado: la diferencia es plata del prestamista que ya nadie va a traer.
    //
    // Existe como cifra propia porque hasta hoy se disolvia dentro del interes:
    // el reparto la registraba como «interes negativo» y bajaba la ganancia de
    // meses en los que no habia pasado nada malo. Se saco de ahi (ver
    // lib/dinero/reparto.js) y tiene que poder verse por su nombre, o se
    // habria cambiado ocultar una perdida por ocultar otra.
    prisma.$queryRaw`
      SELECT COUNT(*) as prestamos, SUM(montoPrestado - totalAPagar) as monto
      FROM Prestamo
      WHERE organizationId = ${organizationId}
        AND totalAPagar > 0 AND totalAPagar < montoPrestado
    `,
    prisma.$queryRaw`
      SELECT clienteId, COUNT(*) as total
      FROM Prestamo WHERE organizationId = ${organizationId} AND esClavo = false
      GROUP BY clienteId HAVING total > 1
    `,
    // Desglose interes/capital por mes, con reparto proporcional sobre TODOS los
    // prestamos. Para los que tienen tabla de amortizacion esa cifra se corrige
    // despues (ver `correccionTablaPorMes`).
    //
    // El filtro `pr.totalAPagar > 0` que habia aqui SE FUE a proposito: excluia
    // 8 pagos por $793.000 de prestamos sin total, y esa plata no aparecia ni
    // como interes ni como capital. Ahora entran y cuentan enteros como capital
    // recuperado, que es lo que son.
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(p.fechaPago, INTERVAL 5 HOUR), '%Y-%m') as mes,
        SUM(${Prisma.raw(REPARTO_PAGO.interes)}) as interesGanado,
        SUM(${Prisma.raw(REPARTO_PAGO.capital)}) as capitalRecuperado
      FROM Pago p
      JOIN Prestamo pr ON p.prestamoId = pr.id
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento')
        AND pr.estado <> 'cancelado'
      GROUP BY mes ORDER BY mes
    `,
    // Rentabilidad por ruta — misma correccion que arriba.
    prisma.$queryRaw`
      SELECT c.rutaId, r.nombre as rutaNombre,
        SUM(pr.montoPrestado) as capitalDesplegado,
        SUM(pr.totalAPagar - pr.totalPagado) as saldoPendiente,
        SUM(pr.totalAPagar - pr.montoPrestado) as interesTotal,
        SUM(${Prisma.raw(REPARTO_VIDA.interes)}) as interesGanado,
        COUNT(*) as prestamos
      FROM Prestamo pr
      JOIN Cliente c ON pr.clienteId = c.id
      LEFT JOIN Ruta r ON c.rutaId = r.id
      WHERE pr.organizationId = ${organizationId} AND pr.estado = 'activo' AND pr.esClavo = false
      GROUP BY c.rutaId, r.nombre
      ORDER BY interesGanado DESC
    `,
    // Prestamos CON tabla: se traen las filas y los pagos para corregir su
    // aporte.
    //
    // `cuotasAmortizacion: { some: {} }` deja fuera los que estan en un modo con
    // tabla pero NO la tienen. Son 19 en produccion (17 en modo saldo y 2
    // lineal) y para ellos el reparto proporcional es lo unico calculable. Sin
    // esta condicion quedaban sin cifra por ningun lado: en una simulacion antes
    // de desplegar, dos negocios pasaban a ganancia CERO.
    prisma.prestamo.findMany({
      where: {
        organizationId,
        totalAPagar: { gt: 0 },
        /* ⚠ Y TAMBIÉN LOS QUE LLEVAN PAGOS DECLARADOS, TENGAN TABLA O NO.
         *
         * Un abono a capital es 100% capital y un pago de solo interés es 100%
         * interés, y el reparto plano del SQL no aplica el techo de interés
         * cuando esos dos se mezclan con pagos corrientes: se pasa. Sin esta
         * rama, un préstamo `fijo` sin tabla con un abono a capital se quedaba
         * fuera de la corrección y las dos pantallas seguían discrepando.
         * Medido el 27 ago 2026: 91 préstamos en 26 negocios de 10.658 vivos. */
        OR: [
          { modoInteres: { in: MODOS_CON_TABLA }, cuotasAmortizacion: { some: {} } },
          { pagos: { some: { tipo: { in: ['capital', 'intereses'] } } } },
        ],
        /* ⚠ Los anulados TAMBIÉN fuera de la corrección, no solo de la consulta
           base. Ayer se filtró la de arriba y esta se quedó atrás: la cifra
           volvía a subir por la puerta de la corrección. Lo cazó comparar las dos
           pantallas del mismo negocio en el espejo, no leer el código. */
        estado: { not: 'cancelado' },
      },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
        /* `interesPagoAPago` decide con él si usa la tabla o el reparto plano.
           Sin pedirlo llega `undefined` y se equivoca EN SILENCIO. */
        modoInteres: true,
        // La correccion por ruta se suma sobre una base SQL que solo cuenta
        // ACTIVOS no clavos. Sin estos dos campos se corregia con prestamos
        // completados y clavos que no estaban en la cifra corregida.
        estado: true,
        esClavo: true,
        cliente: { select: { rutaId: true } },
        cuotasAmortizacion: {
          orderBy: { numeroPeriodo: 'asc' },
          select: { numeroPeriodo: true, cuotaTotal: true, interes: true },
        },
        pagos: {
          where: { tipo: { notIn: ['recargo', 'descuento'] } },
          orderBy: { fechaPago: 'asc' },
          // El `tipo` manda: un abono a capital es 100% capital.
          select: { montoPagado: true, fechaPago: true, tipo: true },
        },
      },
    }),
  ])

  // Monthly trend
  const meses = []
  for (let i = 0; i < mesesAtras; i++) {
    // Por el mismo sitio que todo lo demás: `new Date(año, mes, 1)` construye la
    // fecha en la hora del servidor y aquí daba la clave correcta de casualidad.
    meses.push(claveMesBogota(inicioDeMes(-mesesAtras + 1 + i)))
  }
  const pagoMap = Object.fromEntries(pagosMensuales.map(p => [p.mes, p]))
  const prestamoMap = Object.fromEntries(prestamosMensuales.map(p => [p.mes, p]))
  const gastoMap = Object.fromEntries(gastosMensuales.map(g => [g.mes, g]))
  const clienteMap = Object.fromEntries(clientesPorMes.map(c => [c.mes, c]))
  const interesMap = Object.fromEntries(desgloseInteresMensual.map(d => [d.mes, d]))

  // ── Correccion de los prestamos CON tabla ──
  //
  // Se calcula la DIFERENCIA entre lo que dice la tabla y lo que ya conto el
  // reparto proporcional del SQL, y se suma esa diferencia. Esta hecho asi a
  // proposito: un prestamo que no entre en este bloque conserva intacta su cifra
  // proporcional. El peor caso posible es no corregir nada — nunca borrar una
  // cifra, que es justo lo que pasaba con la primera version de este arreglo.
  //
  // Se recorren los pagos en orden preguntandole a la tabla cuanto interes
  // reconoce cada uno. Como el reparto es incremental (acumulado despues menos
  // acumulado antes), la suma de los pagos reconstruye exactamente el interes
  // total del prestamo: no se puede inventar ni perder ganancia por el camino.
  const correccionTablaPorMes = {}   // 'YYYY-MM' -> { interes, capital }
  const correccionTablaPorRuta = {}  // rutaId     -> interes
  for (const prestamo of prestamosConTabla) {
    const cuotas = prestamo.cuotasAmortizacion || []
    const pagos = prestamo.pagos || []
    if (!pagos.length) continue

    /* ⚠ LAS DOS MITADES DE LA RESTA SALEN DE UNA FUNCIÓN CADA UNA, Y NINGUNA
     * SE ESCRIBE AQUÍ.
     *
     *   · lo bueno  → `interesPagoAPago`, la misma que usa el informe del
     *     contador. Sabe de tipos declarados y aplica el techo de interés.
     *   · lo que hay → `interesProporcionalDelPago`, el calco en JS de lo que
     *     genera `repartoSql`, o sea EXACTAMENTE lo que la consulta ya sumó.
     *
     * Antes se restaba «monto × fracción» a secas, y el SQL no siempre pone
     * eso: para un abono a capital pone cero. La resta se pasaba, y la misma
     * organización veía «ganancia $3.230.648» en esta pantalla y «$2.500.993»
     * en el informe del contador con el mismo recaudado. Medido préstamo a
     * préstamo: 15 de 104 divergían, $760.764, y TODOS tenían abonos a capital. */
    const filas = interesPagoAPago({ prestamo, cuotas, pagos })

    for (let i = 0; i < pagos.length; i++) {
      const pago = pagos[i]
      const segunTabla = filas[i]?.interes ?? 0
      const segunProporcion = interesProporcionalDelPago(prestamo, pago)
      const delta = segunTabla - segunProporcion

      // Solo los que la consulta de rutas cuenta. Corregir una cifra con
      // prestamos que no estan dentro de ella la deja peor que sin corregir.
      if (prestamo.estado === 'activo' && !prestamo.esClavo) {
        const rutaId = prestamo.cliente?.rutaId || null
        correccionTablaPorRuta[rutaId] = (correccionTablaPorRuta[rutaId] || 0) + delta
      }

      // El desglose mensual solo cubre la ventana de la pantalla; la ruta usa
      // el acumulado de vida del prestamo, igual que hace la consulta SQL.
      if (pago.fechaPago < fechaInicio) continue
      const mes = claveMesBogota(pago.fechaPago)
      const acc = correccionTablaPorMes[mes] || (correccionTablaPorMes[mes] = { interes: 0, capital: 0 })
      acc.interes += delta
      acc.capital -= delta          // lo que sube el interes, lo baja el capital
    }
  }

  const tendenciaMensual = meses.map(mes => {
    const recaudado = Number(pagoMap[mes]?.total || 0)
    const gastos = Number(gastoMap[mes]?.total || 0)
    // proporcional (SQL) + la correccion de los prestamos con tabla
    const interesGanado = Number(interesMap[mes]?.interesGanado || 0) + (correccionTablaPorMes[mes]?.interes || 0)
    const capitalRecuperado = Number(interesMap[mes]?.capitalRecuperado || 0) + (correccionTablaPorMes[mes]?.capital || 0)
    return {
      mes,
      recaudado,
      capitalPrestado: Number(prestamoMap[mes]?.capitalPrestado || 0),
      prestamosNuevos: Number(prestamoMap[mes]?.cantidad || 0),
      gastos,
      clientesNuevos: Number(clienteMap[mes]?.nuevos || 0),
      interesGanado: Math.round(interesGanado),
      capitalRecuperado: Math.round(capitalRecuperado),
      utilidad: Math.round(interesGanado - gastos),
    }
  })

  // Working days calculation
  const mesActualKey = claveMesBogota(mesActual)
  /* ⚠ AQUI HABIA DOS IDIOMAS EN LA MISMA LINEA.
   *
   * `diasSinCobro` se guarda como un JSON de NUMEROS —`"[0]"` es «no se cobra
   * domingo»— y esto lo comparaba contra una tabla de NOMBRES («domingo»). La
   * comparacion no fallaba: era `false` siempre, asi que el mes contaba como
   * habiles los siete dias. Con `[1,2,3,4,5]` —un negocio que solo cobra fines
   * de semana— el esperado del mes salia tres veces y media.
   *
   * Y el mismo string en crudo iba a `calcularDiasMora`, que espera un array de
   * numeros: `"[0]".length` es 3, asi que contaba tres dias excluidos por
   * semana en vez de uno.
   *
   * Medido: 20 negocios lo tienen configurado, 18 con prestamos vivos y 1.483
   * prestamos activos. */
  const diasExcluidos = parsearDiasSinCobro(organization?.diasSinCobro) ?? []

  const diasTranscurridos = hoy.getDate()
  let diasHabiles = 0
  for (let d = 1; d <= diasTranscurridos; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(f.getDay())) diasHabiles++
  }

  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  let diasHabilesTotalMes = 0
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(f.getDay())) diasHabilesTotalMes++
  }

  const recaudadoMes = Number(pagosEsteMes._sum?.montoPagado || 0)
  const recaudadoMesAnterior = Number(pagosMesAnterior._sum?.montoPagado || 0)
  /* Los dias sin cobro de CADA prestamo, por la jerarquia
     Prestamo > Cliente > Ruta > Organizacion. Se saca aqui porque lo necesitan
     dos cuentas —la meta del mes y la mora— y tenerlo dos veces es como
     empiezan a divergir. */
  const diasDeCobroDe = (p) =>
    obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, { diasSinCobro: organization?.diasSinCobro }, p)

  const festivosFechas = festivos.map(f => f.fecha)

  /* ⚠ `cuotaDiaria` NO ES UNA CUOTA DIARIA: guarda la cuota de la frecuencia
   * que tenga el prestamo. Esto sumaba todas y las multiplicaba por los dias
   * del mes, asi que un prestamo SEMANAL contaba treinta veces en vez de
   * cuatro.
   *
   * Medido sobre un negocio de la muestra —565 semanales, 30 quincenales, 11
   * mensuales y 378 diarios—: la meta del mes salia **$1.703.787.000** cuando
   * lo que de verdad vence son **$301.478.229**. Cinco veces y media, y sobre
   * una cartera total de $339M: le decia al dueño que iba por el 1 % de una
   * meta cinco veces mayor que todo lo que tiene prestado. Una barra de avance
   * contra un numero imposible no significa nada.
   *
   * Ahora se pregunta al CALENDARIO de cada prestamo, dia por dia, con
   * `tocaCobrarEn` — la misma funcion con la que se arma la meta de la caja, en
   * vez de un sexto calculo propio (ver la cabecera de lib/dinero/esperado.js).
   *
   * Se usa solo `tocaCobrarEn` y no `esperadoDePrestamo` a proposito: esa
   * ademas calcula lo ATRASADO recorriendo hasta 370 dias hacia atras, y aqui
   * serian once millones de vueltas por cada carga de la pantalla. */
  const diasDelMes = []
  for (let d = 1; d <= ultimoDiaMes; d++) {
    diasDelMes.push(new Date(hoy.getFullYear(), hoy.getMonth(), d))
  }

  const esperadoMes = prestamosActivosDetalle.reduce((suma, p) => {
    const cuota = cuotaDelPeriodo(p)
    if (!cuota) return suma
    const dias = diasDeCobroDe(p)
    let veces = 0
    for (const d of diasDelMes) {
      if (tocaCobrarEn(p, d, dias, festivosFechas)) veces++
    }
    // Nunca se puede esperar mas de lo que se debe: un prestamo al que le
    // quedan $50.000 no aporta tres cuotas a la meta del mes.
    const saldo = Math.max(0, Number(p.totalAPagar || 0) - Number(p.totalPagado || 0))
    return suma + Math.min(cuota * veces, saldo)
  }, 0)
  const gastosMesActual = Number(gastoMap[mesActualKey]?.total || 0)

  // Projection
  const promedioDiario = diasHabiles > 0 ? recaudadoMes / diasHabiles : 0
  const proyeccionMes = promedioDiario * diasHabilesTotalMes

  // Capital & ROI
  //
  // «Capital en la calle» es LO QUE SIGUE AFUERA, no lo que salio algun dia.
  // `Σ montoPrestado` era la tercera respuesta a esa pregunta —la mas inflada de
  // las tres— y encima hace de DENOMINADOR del ROI, asi que lo hundia. Medido
  // sobre la cartera real: $277.067.809 por la vieja contra $201.988.571 por
  // esta, un 37,2% de mas en un solo negocio.
  const capitalEnCalle = prestamosActivosDetalle.reduce((s, p) => s + capitalEnCalleDe(p), 0)

  // El mismo capital, partido por ruta. La suma de las rutas da exactamente el
  // total de arriba, que es lo minimo que se le puede pedir a un desglose.
  const capitalPorRuta = new Map()
  for (const p of prestamosActivosDetalle) {
    const rutaId = p.cliente?.rutaId || null
    capitalPorRuta.set(rutaId, (capitalPorRuta.get(rutaId) || 0) + capitalEnCalleDe(p))
  }
  const porCobrarTotal = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.totalPagado || 0)), 0)
  const interesEnCartera = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.montoPrestado)), 0)

  // GANANCIA = INTERES cobrado - gastos. NUNCA recaudado - gastos.
  //
  // `recaudado` es todo lo que entro por caja, y la mayor parte es el CAPITAL
  // que el prestamista habia puesto: recuperar plata propia no es ganancia.
  // Con $10M cobrados de los cuales $8M son capital y $2M interes, y $150k de
  // gastos, la ganancia real es $1.850.000 — la formula vieja mostraba
  // $9.850.000, mas de 5 veces inflada. Y es el numero por el que el dueño
  // decide si retira utilidades.
  //
  // El dato correcto ya se calculaba en tendenciaMensual (interesGanado, el
  // pedazo de interes de cada pago); solo que esta tarjeta y el ROI no lo usaban.
  // ⚠ Sale de `tendenciaMensual`, NO de `interesMap`.
  //
  // `interesMap` es el reparto proporcional en crudo, SIN la correccion de los
  // prestamos con tabla de amortizacion. `tendenciaMensual` si la lleva.
  //
  // Usar el crudo aqui es lo que hacia que la pantalla enseñara dos ganancias
  // del mismo mes, una encima de la otra: «Ganancia neta» (esta, sin corregir)
  // y «Utilidad neta» (la de abajo, corregida). Las dos con rotulo propio, para
  // que pareciera que eran cosas distintas.
  const interesGanadoMesActual = tendenciaMensual.find(t => t.mes === mesActualKey)?.interesGanado || 0
  const gananciaNetaMes = calcularGananciaNeta({ interesCobrado: interesGanadoMesActual, gastos: gastosMesActual })
  const roiMensual = capitalEnCalle > 0 ? (gananciaNetaMes / capitalEnCalle * 100) : 0

  // Mora analysis with client details
  const alertas = []
  let clientesMora = 0
  let montoMora = 0

  for (const p of prestamosActivosDetalle) {
    // Los suyos, no los del negocio. `diasExcluidos` sigue sirviendo para el
    // calendario del MES —esa si es una cuenta de la organizacion—.
    const susDias = diasDeCobroDe(p)
    const dias = calcularDiasMora(p, susDias, festivosFechas)
    if (dias > 0) {
      clientesMora++
      const deuda = Number(p.totalAPagar) - Number(p.totalPagado || 0)
      montoMora += deuda
      alertas.push({
        prestamoId: p.id,
        clienteId: p.cliente.id,
        clienteNombre: p.cliente.nombre,
        diasMora: dias,
        montoEnRiesgo: deuda,
        cuotaDiaria: Number(p.cuotaDiaria),
        severidad: dias >= 8 ? 'grave' : dias >= 4 ? 'moderada' : 'leve',
      })
    }
  }
  alertas.sort((a, b) => b.diasMora - a.diasMora)

  // Cobrador ranking
  const userMap = Object.fromEntries(orgUsers.map(u => [u.id, u]))
  const cobradores = cobradorRecaudo.map(c => ({
    id: c.cobradorId,
    nombre: userMap[c.cobradorId]?.nombre || 'Sin nombre',
    rol: userMap[c.cobradorId]?.rol || 'cobrador',
    recaudado: Number(c.recaudado),
    pagos: Number(c.pagos),
  }))

  // Repeat clients
  const clientesRepiten = prestamosTotal.length
  const pctRepiten = totalClientes > 0 ? Math.round((clientesRepiten / totalClientes) * 100) : 0

  // Ticket promedio
  const ticketPromedioActual = prestamosActivos > 0 ? capitalEnCalle / prestamosActivos : 0

  const pctChange = (curr, prev) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0)

  return NextResponse.json({
    resumen: {
      roiMensual: Math.round(roiMensual * 10) / 10,
      gananciaNetaMes,
      recaudadoMes,
      gastosMes: gastosMesActual,
      capitalEnCalle,
      porCobrar: porCobrarTotal,
      interesEnCartera,
      cambioRecaudado: pctChange(recaudadoMes, recaudadoMesAnterior),
      // Plata prestada que ya se sabe que no vuelve: prestamos cuyo total a
      // pagar quedo por debajo de lo prestado. Antes bajaba la ganancia
      // disfrazada de «interes negativo»; ahora es una cifra con su nombre.
      capitalNoRecuperado: {
        monto: Math.round(Number(capitalNoRecuperado?.[0]?.monto || 0)),
        prestamos: Number(capitalNoRecuperado?.[0]?.prestamos || 0),
      },
    },
    proyeccion: {
      proyectado: Math.round(proyeccionMes),
      esperado: Math.round(esperadoMes),
      recaudado: recaudadoMes,
      promedioDiario: Math.round(promedioDiario),
      diasHabiles,
      diasHabilesTotalMes,
      pctAvance: esperadoMes > 0 ? Math.round((recaudadoMes / esperadoMes) * 100) : 0,
    },
    alertas: alertas.slice(0, 15),
    alertasResumen: {
      total: alertas.length,
      graves: alertas.filter(a => a.severidad === 'grave').length,
      moderadas: alertas.filter(a => a.severidad === 'moderada').length,
      leves: alertas.filter(a => a.severidad === 'leve').length,
      montoTotal: montoMora,
    },
    cartera: {
      activos: prestamosActivos,
      completados: prestamosCompletados,
      cancelados: prestamosCancelados,
      enMora: clientesMora,
      pctMora: prestamosActivos > 0 ? Math.round((clientesMora / prestamosActivos) * 100) : 0,
      clavos: prestamosEsclavo._count || 0,
      moraIrrecuperable: Number(prestamosEsclavo._sum?.totalAPagar || 0),
      ticketPromedio: Math.round(ticketPromedioActual),
      clientesRepiten: pctRepiten,
    },
    cobradores,
    tendenciaMensual,
    rentabilidad: {
      interesGanadoMes: tendenciaMensual.find(t => t.mes === mesActualKey)?.interesGanado || 0,
      capitalRecuperadoMes: tendenciaMensual.find(t => t.mes === mesActualKey)?.capitalRecuperado || 0,
      // La MISMA cifra que `resumen.gananciaNetaMes`, escrita asi para que se
      // vea que lo es. Eran dos numeros distintos con dos rotulos distintos en
      // la misma pantalla; ahora son uno con un rotulo, el del diccionario.
      utilidadMes: gananciaNetaMes,
      rotacionCapital: capitalEnCalle > 0
        ? Math.round(((tendenciaMensual.find(t => t.mes === mesActualKey)?.capitalRecuperado || 0) / capitalEnCalle) * 1000) / 10
        : 0,
      porRuta: rentabilidadRutas.map(r => {
        // El capital de la ruta sale de los prestamos, no de `Σ montoPrestado`
        // del SQL: es el denominador del ROI y con la formula vieja lo hundia.
        // Mismo universo que la consulta (activos, no clavos).
        // La consulta SQL repartio proporcionalmente; aca se aplica la
        // correccion de los prestamos con tabla. El ROI se recalcula con el
        // total corregido, no con el parcial.
        const interesGanado = Math.round(
          Number(r.interesGanado || 0) + (correccionTablaPorRuta[r.rutaId] || 0),
        )
        const capitalDesplegado = capitalPorRuta.get(r.rutaId || null) || 0
        return {
          rutaId: r.rutaId,
          nombre: r.rutaNombre || 'Sin ruta',
          capitalDesplegado,
          saldoPendiente: Number(r.saldoPendiente || 0),
          interesTotal: Number(r.interesTotal || 0),
          interesGanado,
          prestamos: Number(r.prestamos || 0),
          roi: capitalDesplegado > 0
            ? Math.round((interesGanado / capitalDesplegado) * 1000) / 10
            : 0,
        }
      }).sort((a, b) => b.interesGanado - a.interesGanado),
    },
  })
}
