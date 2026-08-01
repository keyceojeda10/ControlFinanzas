import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { calcularDiasMora, calcularGananciaNeta, interesDelPagoSegunTabla } from '@/lib/calculos'
import { repartoSql, fraccionInteres, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'

// La formula del reparto interes/capital sale de UN solo sitio. Estaba escrita a
// mano aqui, en el PDF y en el reparto a socios, con tres variantes distintas de
// los casos borde — y por eso las tres pantallas contestaban distinto a la misma
// pregunta. Ver lib/dinero/reparto.js.
const REPARTO_PAGO = repartoSql({ pago: 'p', prestamo: 'pr' })
const REPARTO_VIDA = repartoSql({ pago: 'pr', prestamo: 'pr', monto: 'totalPagado' })

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

  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)

  const mesesAtras = 6
  const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 1)

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
      SELECT DATE_FORMAT(fechaPago, '%Y-%m') as mes, SUM(montoPagado) as total, COUNT(*) as cantidad
      FROM Pago WHERE organizationId = ${organizationId} AND fechaPago >= ${fechaInicio}
        AND tipo NOT IN ('recargo', 'descuento')
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, SUM(montoPrestado) as capitalPrestado,
        SUM(totalAPagar) as totalAPagar, COUNT(*) as cantidad
      FROM Prestamo WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio} AND esClavo = false
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
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
      SELECT cobradorId, SUM(montoPagado) as recaudado, COUNT(*) as pagos
      FROM Pago WHERE organizationId = ${organizationId} AND fechaPago >= ${mesActual}
        AND tipo NOT IN ('recargo', 'descuento') AND cobradorId IS NOT NULL
      GROUP BY cobradorId ORDER BY recaudado DESC
    `,
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, nombre: true, rol: true },
    }),
    prisma.pago.aggregate({
      where: { organizationId, fechaPago: { gte: mesActual }, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.pago.aggregate({
      where: { organizationId, fechaPago: { gte: mesAnterior, lt: mesActual }, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true }, _count: true,
    }),
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'activo', esClavo: false },
      select: {
        id: true, montoPrestado: true, totalAPagar: true, totalPagado: true,
        cuotaDiaria: true, frecuencia: true, fechaInicio: true, fechaFin: true,
        diasPlazo: true, ultimoPagoAt: true, modoInteres: true, tasaInteres: true,
        cliente: { select: { id: true, nombre: true, rutaId: true } },
        // `interes` y los abonos a capital NO estaban aqui, y sin ellos
        // `capitalEnCalle()` calcula de menos sin avisar: los prestamos con
        // tabla darian interes 0 y los abonos explicitos no bajarian el capital.
        // Es plata mal contada por un campo que falta en un select.
        cuotasAmortizacion: {
          select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, fechaEsperada: true },
        },
        pagos: { where: { tipo: 'capital' }, select: { tipo: true, montoPagado: true } },
      },
    }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, COUNT(*) as nuevos
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
      SELECT DATE_FORMAT(p.fechaPago, '%Y-%m') as mes,
        SUM(${Prisma.raw(REPARTO_PAGO.interes)}) as interesGanado,
        SUM(${Prisma.raw(REPARTO_PAGO.capital)}) as capitalRecuperado
      FROM Pago p
      JOIN Prestamo pr ON p.prestamoId = pr.id
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento')
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
        modoInteres: { in: MODOS_CON_TABLA },
        totalAPagar: { gt: 0 },
        cuotasAmortizacion: { some: {} },
      },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
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
          select: { montoPagado: true, fechaPago: true },
        },
      },
    }),
  ])

  // Monthly trend
  const meses = []
  for (let i = 0; i < mesesAtras; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1 + i, 1)
    meses.push(d.toISOString().slice(0, 7))
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
    const cuotas = prestamo.cuotasAmortizacion
    if (!cuotas.length) continue
    // La MISMA fraccion que usa el SQL de arriba. Tiene que salir de la misma
    // funcion o la correccion resta contra una cifra que nadie calculo asi.
    const fraccionProporcional = fraccionInteres(prestamo)
    let acumulado = 0
    for (const pago of prestamo.pagos) {
      const segunTabla = interesDelPagoSegunTabla(cuotas, acumulado, pago.montoPagado)
      const segunProporcion = pago.montoPagado * fraccionProporcional
      const delta = segunTabla - segunProporcion
      acumulado += pago.montoPagado

      // Solo los que la consulta de rutas cuenta. Corregir una cifra con
      // prestamos que no estan dentro de ella la deja peor que sin corregir.
      if (prestamo.estado === 'activo' && !prestamo.esClavo) {
        const rutaId = prestamo.cliente?.rutaId || null
        correccionTablaPorRuta[rutaId] = (correccionTablaPorRuta[rutaId] || 0) + delta
      }

      // El desglose mensual solo cubre la ventana de la pantalla; la ruta usa
      // el acumulado de vida del prestamo, igual que hace la consulta SQL.
      if (pago.fechaPago < fechaInicio) continue
      const mes = pago.fechaPago.toISOString().slice(0, 7)
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
  const mesActualKey = mesActual.toISOString().slice(0, 7)
  const diasExcluidos = organization?.diasSinCobro || []
  const diasMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

  const diasTranscurridos = hoy.getDate()
  let diasHabiles = 0
  for (let d = 1; d <= diasTranscurridos; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(diasMap[f.getDay()])) diasHabiles++
  }

  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  let diasHabilesTotalMes = 0
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), d)
    if (!diasExcluidos.includes(diasMap[f.getDay()])) diasHabilesTotalMes++
  }

  const recaudadoMes = Number(pagosEsteMes._sum?.montoPagado || 0)
  const recaudadoMesAnterior = Number(pagosMesAnterior._sum?.montoPagado || 0)
  const cuotaDiariaTotal = prestamosActivosDetalle.reduce((s, p) => s + Number(p.cuotaDiaria || 0), 0)
  const esperadoMes = cuotaDiariaTotal * diasHabilesTotalMes
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
  const interesGanadoMesActual = Number(interesMap[mesActualKey]?.interesGanado || 0)
  const gananciaNetaMes = calcularGananciaNeta({ interesCobrado: interesGanadoMesActual, gastos: gastosMesActual })
  const roiMensual = capitalEnCalle > 0 ? (gananciaNetaMes / capitalEnCalle * 100) : 0

  // Mora analysis with client details
  const festivosFechas = festivos.map(f => f.fecha)
  const alertas = []
  let clientesMora = 0
  let montoMora = 0

  for (const p of prestamosActivosDetalle) {
    const dias = calcularDiasMora(p, diasExcluidos, festivosFechas)
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
      utilidadMes: tendenciaMensual.find(t => t.mes === mesActualKey)?.utilidad || 0,
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
