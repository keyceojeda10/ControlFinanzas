import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { nivelReportes }    from '@/lib/planes'
import { formatMoney, getUtcOffset, getLocalDayRange, formatFechaCorta } from '@/lib/i18n'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { abrirDocumento, respuestaPdf } from '@/lib/papel/documento'
import { COLOR } from '@/lib/papel/tokens'

const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })
  /* ⚠ NIVEL 1, NO 2, y es una decision del dueño, no un descuido.
   *
   * `resumen` —los mismos numeros, en pantalla— siempre fue nivel 1, pero
   * BAJARLOS pedia nivel 2. O sea: el plan Basico veia la cifra y no podia
   * llevarsela al contador. Cobrar por el mismo dato en otro formato es
   * exactamente lo que hace sentir engañado a quien ya pago. */
  if (nivelReportes(session.user.plan) < 1) return Response.json({ error: 'Plan insuficiente' }, { status: 403 })

  const orgId = session.user.organizationId
  const country = session.user.country ?? 'co'
  const { searchParams } = new URL(req.url)
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  let fechaDesde, fechaHasta, desdeStr, hastaStr

  if (desdeParam && hastaParam) {
    const rangeDesde = getDayRange(desdeParam, country)
    const rangeHasta = getDayRange(hastaParam, country)
    fechaDesde = rangeDesde.inicio
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
    desdeStr = desdeParam
    hastaStr = hastaParam
  } else {
    const ahora = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    desdeStr = primerDia.toISOString().slice(0, 10)
    hastaStr = ahora.toISOString().slice(0, 10)
    fechaDesde = getDayRange(desdeStr, country).inicio
    fechaHasta = new Date(getDayRange(hastaStr, country).fin.getTime() + 1)
  }

  // ── Data fetching (parallel) ─────────────────────────────
  const [
    org,
    festivos,
    prestamosActivos,
    prestamosCompletados,
    pagosAgg,
    pagosPeriodo,
    cobradores,
    desembolsos,
    recaudos,
    gastosCap,
    pagosDiarios,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, country: true, diasSinCobro: true },
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
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true, montoPrestado: true, totalAPagar: true,
        fechaInicio: true, diasPlazo: true, cuotaDiaria: true, frecuencia: true, estado: true,
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: { id: true, diasSinCobro: true, ruta: { select: { diasSinCobro: true } } },
        },
      },
    }),
    prisma.prestamo.count({ where: { organizationId: orgId, estado: 'completado' } }),
    prisma.pago.aggregate({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
    prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: {
        montoPagado: true,
        prestamo: { select: { montoPrestado: true, totalAPagar: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador', activo: true },
      include: {
        rutas: { where: { activo: true }, take: 1, select: { nombre: true } },
        cierresCaja: {
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          select: {
            totalRecogido: true, totalEsperado: true,
            totalGastos: true, totalDesembolsado: true,
          },
        },
      },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'desembolso', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'recaudo', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId: orgId, tipo: 'gasto', createdAt: { gte: fechaDesde, lt: fechaHasta } },
      _sum: { monto: true },
    }),
    prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true, fechaPago: true },
      orderBy: { fechaPago: 'asc' },
    }),
  ])

  // ── Compute metrics ──────────────────────────────────────
  let interesGanado = 0, capitalRecuperado = 0
  for (const pago of pagosPeriodo) {
    const total = pago.prestamo?.totalAPagar ?? 0
    const capital = pago.prestamo?.montoPrestado ?? 0
    const monto = pago.montoPagado ?? 0
    if (total > 0 && total > capital) {
      const fraccion = (total - capital) / total
      interesGanado += monto * fraccion
      capitalRecuperado += monto * (1 - fraccion)
    } else {
      capitalRecuperado += monto
    }
  }
  interesGanado = Math.round(interesGanado)
  capitalRecuperado = Math.round(capitalRecuperado)

  const clientesActivos = new Set()
  const clientesMora = new Set()
  // capitalPrestado se calculaba aqui y no se imprimia en ninguna parte del PDF.
  // Se quita en vez de "arreglarlo": habria costado traer la tabla de
  // amortizacion de cada prestamo para un numero que nadie ve.
  let carteraActiva = 0, saldoPorCobrar = 0

  for (const p of prestamosActivos) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    const pagado = (p.pagos || [])
      .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
      .reduce((a, pg) => a + (pg.montoPagado || 0), 0)
    saldoPorCobrar += Math.max(0, (p.totalAPagar ?? 0) - pagado)
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos, festivos) > 0) clientesMora.add(p.clienteId)
  }

  const totalPeriodo = pagosAgg._sum.montoPagado ?? 0
  const cantidadPagos = pagosAgg._count ?? 0

  const cobradoresData = cobradores.map(c => {
    const esperado = c.cierresCaja.reduce((a, ci) => a + ci.totalEsperado, 0)
    const recogido = c.cierresCaja.reduce((a, ci) => a + ci.totalRecogido, 0)
    const gastosC = c.cierresCaja.reduce((a, ci) => a + (ci.totalGastos || 0), 0)
    return {
      nombre: c.nombre,
      ruta: c.rutas?.[0]?.nombre ?? 'Sin ruta',
      esperado, recogido, gastos: gastosC,
      eficiencia: esperado > 0 ? Math.round((recogido / esperado) * 100) : 0,
    }
  })

  const desembolsadoMes = desembolsos._sum.monto ?? 0
  const recaudadoMes = recaudos._sum.monto ?? 0
  const gastosMes = gastosCap._sum.monto ?? 0
  const flujoNeto = recaudadoMes - desembolsadoMes - gastosMes

  const toLocal = (date) => new Date(date.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  const ingresosPorDia = {}
  for (const p of pagosDiarios) {
    const f = toLocal(new Date(p.fechaPago))
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    ingresosPorDia[key] = (ingresosPorDia[key] ?? 0) + p.montoPagado
  }
  const ingresosArr = Object.entries(ingresosPorDia).map(([fecha, total]) => ({ fecha, total }))

  const nombreNegocio = org?.nombre ?? 'Mi Negocio'
  const fmt = (v) => formatMoney(v, country)

  /* El dibujo entero es de `lib/papel/documento`; aqui solo se decide QUE va.
     Ver ese archivo para el porque. */
  const doc = abrirDocumento({ pie: `Control Finanzas · ${nombreNegocio}` })

  const dia = (f) => formatFechaCorta(new Date(`${f}T12:00:00Z`), country)

  let y = doc.cabecera({
    negocio: nombreNegocio,
    titulo: 'Cómo me fue',
    subtitulo: `Del ${dia(desdeStr)} al ${dia(hastaStr)}`,
    meta: `${cantidadPagos} pagos recibidos`,
  })

  y = doc.tarjetasResumen([
    { rotulo: 'Recaudado', valor: fmt(totalPeriodo) },
    { rotulo: 'Interés ganado', valor: fmt(interesGanado), tono: 'bueno' },
    { rotulo: 'Capital recuperado', valor: fmt(capitalRecuperado) },
  ], y)

  y = doc.seccion('Clientes y préstamos', y)
  y = doc.cifras([
    { rotulo: 'Clientes activos', valor: String(clientesActivos.size) },
    { rotulo: 'En mora', valor: String(clientesMora.size), tono: clientesMora.size > 0 ? 'malo' : 'bueno' },
    { rotulo: 'Préstamos activos', valor: String(prestamosActivos.length) },
    { rotulo: 'Completados', valor: String(prestamosCompletados) },
  ], y)

  y = doc.seccion('Flujo de capital', y)
  y = doc.cifras([
    { rotulo: 'Desembolsado', valor: fmt(desembolsadoMes) },
    { rotulo: 'Recaudado', valor: fmt(recaudadoMes) },
    { rotulo: 'Gastos', valor: fmt(gastosMes) },
    { rotulo: 'Flujo neto', valor: fmt(flujoNeto), tono: flujoNeto >= 0 ? 'bueno' : 'malo' },
  ], y)

  y = doc.seccion('Por saldo pendiente', y)
  y = doc.cifras([
    { rotulo: 'Falta por cobrar', valor: fmt(saldoPorCobrar), pie: 'de los préstamos vivos' },
    { rotulo: 'Cartera colocada', valor: fmt(carteraActiva), pie: 'total a pagar' },
  ], y, { columnas: 4 })

  /* ⚠ El bloque de cobradores SOLO si hay. Un negocio de una persona —que es
     la mayoria— no tiene por que ver una tabla vacia recordandole que no tiene
     empleados: es su reporte, no una lista de lo que le falta. */
  if (cobradoresData.length > 0) {
    y = doc.seccion('Cómo le fue a cada cobrador', y)
    y = doc.tabla({
      columnas: [
        { clave: 'nombre', titulo: 'Cobrador', ancho: 3, identidad: true },
        { clave: 'ruta', titulo: 'Ruta', ancho: 2.2, identidad: true },
        { clave: 'esperado', titulo: 'Esperado', ancho: 2, fuente: 'cifra' },
        { clave: 'recogido', titulo: 'Recogido', ancho: 2, fuente: 'cifra' },
        { clave: 'ef', titulo: 'Cumplió', ancho: 1.4, alinear: 'center' },
      ],
      filas: cobradoresData.map((c) => ({
        nombre: c.nombre,
        ruta: c.ruta,
        esperado: fmt(c.esperado),
        recogido: fmt(c.recogido),
        ef: `${c.eficiencia}%`,
        efPastilla: c.eficiencia >= 90
          ? { fondo: COLOR.greenTint, color: COLOR.green }
          : c.eficiencia >= 80
            ? { fondo: COLOR.goldTint, color: COLOR.goldInk }
            : { fondo: COLOR.redTint, color: COLOR.red },
      })),
    }, y)
  }

  if (ingresosArr.length > 1) {
    y = doc.barras(
      ingresosArr.map((d) => ({ etiqueta: d.fecha.slice(8), valor: d.total })),
      y,
      { titulo: 'Lo que entró cada día', formato: fmt },
    )
  }

  if (totalPeriodo === 0) {
    doc.nota('En este periodo no se registró ningún pago. Si esperabas ver movimiento, revisa que el rango de fechas sea el correcto.', y)
  }

  const buffer = await doc.cerrar()
  return respuestaPdf(buffer, `como-me-fue-${desdeStr}-a-${hastaStr}.pdf`)
}
