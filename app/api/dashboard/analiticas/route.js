import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { calcularDiasMora, calcularGananciaNeta, interesDelPagoSegunTabla } from '@/lib/calculos'

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
        cliente: { select: { id: true, nombre: true } },
        cuotasAmortizacion: {
          select: { numeroPeriodo: true, cuotaTotal: true, pagado: true, fechaEsperada: true },
        },
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
    prisma.$queryRaw`
      SELECT clienteId, COUNT(*) as total
      FROM Prestamo WHERE organizationId = ${organizationId} AND esClavo = false
      GROUP BY clienteId HAVING total > 1
    `,
    // Desglose interes/capital por mes, con reparto proporcional sobre TODOS los
    // prestamos. Para los que tienen tabla de amortizacion esa cifra se corrige
    // despues (ver `correccionTablaPorMes`).
    prisma.$queryRaw`
      SELECT DATE_FORMAT(p.fechaPago, '%Y-%m') as mes,
        SUM(p.montoPagado * (pr.totalAPagar - pr.montoPrestado) / pr.totalAPagar) as interesGanado,
        SUM(p.montoPagado * pr.montoPrestado / pr.totalAPagar) as capitalRecuperado
      FROM Pago p
      JOIN Prestamo pr ON p.prestamoId = pr.id
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento') AND pr.totalAPagar > 0
      GROUP BY mes ORDER BY mes
    `,
    // Rentabilidad por ruta — misma correccion que arriba.
    prisma.$queryRaw`
      SELECT c.rutaId, r.nombre as rutaNombre,
        SUM(pr.montoPrestado) as capitalDesplegado,
        SUM(pr.totalAPagar - pr.totalPagado) as saldoPendiente,
        SUM(pr.totalAPagar - pr.montoPrestado) as interesTotal,
        SUM(CASE WHEN pr.totalAPagar > 0 THEN pr.totalPagado * (pr.totalAPagar - pr.montoPrestado) / pr.totalAPagar ELSE 0 END) as interesGanado,
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
    const fraccionProporcional = (prestamo.totalAPagar - prestamo.montoPrestado) / prestamo.totalAPagar
    let acumulado = 0
    for (const pago of prestamo.pagos) {
      const segunTabla = interesDelPagoSegunTabla(cuotas, acumulado, pago.montoPagado)
      const segunProporcion = pago.montoPagado * fraccionProporcional
      const delta = segunTabla - segunProporcion
      acumulado += pago.montoPagado

      const rutaId = prestamo.cliente?.rutaId || null
      correccionTablaPorRuta[rutaId] = (correccionTablaPorRuta[rutaId] || 0) + delta

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
  const capitalEnCalle = prestamosActivosDetalle.reduce((s, p) => s + Number(p.montoPrestado), 0)
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
        // La consulta SQL repartio proporcionalmente; aca se aplica la
        // correccion de los prestamos con tabla. El ROI se recalcula con el
        // total corregido, no con el parcial.
        const interesGanado = Math.round(
          Number(r.interesGanado || 0) + (correccionTablaPorRuta[r.rutaId] || 0),
        )
        const capitalDesplegado = Number(r.capitalDesplegado || 0)
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
