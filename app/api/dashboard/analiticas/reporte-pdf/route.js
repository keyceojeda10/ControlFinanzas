import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { formatMoney } from '@/lib/i18n'
import { calcularDiasMora, calcularGananciaNeta, interesDelPagoSegunTabla } from '@/lib/calculos'
import { repartoSql, fraccionInteres, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'
import { abrirDocumento, respuestaPdf, F } from '@/lib/papel/documento'
import { COLOR, TIPO } from '@/lib/papel/tokens'

// La misma formula que la pantalla, desde el mismo sitio. Estaba copiada a mano
// y por eso el PDF y la pantalla podian dar ganancias distintas del mismo mes.
const REPARTO_PAGO = repartoSql({ pago: 'p', prestamo: 'pr' })


// Modos con tabla de amortizacion: su interes se lee de la tabla, no se
// reparte plano. Misma regla que /api/dashboard/analiticas.
const MODOS_CON_TABLA = ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo']

const INK = '#111111', TEXT = '#333333', MUTED = '#666666', FAINT = '#999999'
const BORDER = '#dddddd', BORDER_L = '#eeeeee', HEAD_BG = '#f0f0f0', ROW_BG = '#f8f8f8'
const GREEN = '#16a34a', GREEN_BG = '#dcfce7', RED = '#dc2626', RED_BG = '#fee2e2'
const AMBER = '#d97706', AMBER_BG = '#fef3c7', BLUE = '#2563eb', ACCENT = '#d4a017'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, rol } = session.user
  if (!organizationId) return Response.json({ error: 'Sin organización' }, { status: 400 })
  if (rol === 'cobrador') return Response.json({ error: 'Solo owner' }, { status: 403 })

  const country = session.user.country ?? 'co'
  const fmt = v => formatMoney(v, country)

  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const mesesAtras = 6
  const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 1)

  const [
    org,
    pagosMensuales,
    prestamosConTabla,
    prestamosMensuales,
    gastosMensuales,
    cobradorRecaudo,
    orgUsers,
    pagosEsteMes,
    pagosMesAnterior,
    prestamosActivosDetalle,
    festivos,
    organization,
    prestamosEsclavo,
    totalClientes,
    prestamosTotal,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { nombre: true } }),
    // Se separa cada pago en su parte de INTERES y su parte de CAPITAL, con el
    // mismo criterio que /api/dashboard/analiticas, para que el PDF y la pantalla
    // muestren la misma ganancia. `total` solo, sin ese desglose, llevaba a
    // reportar como ganancia la devolucion del capital propio.
    //
    // El reparto proporcional solo es correcto para los modos SIN tabla de
    // amortizacion. Los que la tienen se corrigen despues sumando la diferencia
    // contra su tabla — igual que en la pantalla, o el PDF mostraria otra cifra.
    prisma.$queryRaw`
      SELECT DATE_FORMAT(p.fechaPago, '%Y-%m') as mes,
        SUM(p.montoPagado) as total,
        COUNT(*) as cantidad,
        SUM(${Prisma.raw(REPARTO_PAGO.interes)}) as interesGanado,
        SUM(${Prisma.raw(REPARTO_PAGO.capital)}) as capitalRecuperado
      FROM Pago p
      JOIN Prestamo pr ON pr.id = p.prestamoId
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento')
      GROUP BY mes ORDER BY mes
    `,
    // Prestamos CON tabla, para corregir su aporte. El `some: {}` deja fuera los
    // que estan en un modo con tabla pero no la tienen: esos conservan su cifra
    // proporcional en vez de quedarse sin ninguna.
    prisma.prestamo.findMany({
      where: {
        organizationId,
        modoInteres: { in: MODOS_CON_TABLA },
        totalAPagar: { gt: 0 },
        cuotasAmortizacion: { some: {} },
      },
      select: {
        montoPrestado: true,
        totalAPagar: true,
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
    prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') as mes, SUM(montoPrestado) as capitalPrestado,
        COUNT(*) as cantidad
      FROM Prestamo WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio} AND esClavo = false
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, SUM(monto) as total
      FROM GastoMenor WHERE organizationId = ${organizationId} AND fecha >= ${fechaInicio} AND estado = 'aprobado'
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT cobradorId, SUM(montoPagado) as recaudado, COUNT(*) as pagos
      FROM Pago WHERE organizationId = ${organizationId} AND fechaPago >= ${mesActual}
        AND tipo NOT IN ('recargo', 'descuento') AND cobradorId IS NOT NULL
      GROUP BY cobradorId ORDER BY recaudado DESC
    `,
    prisma.user.findMany({ where: { organizationId }, select: { id: true, nombre: true, rol: true } }),
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
        // `interes` y los abonos a capital hacen falta para `capitalEnCalle()`.
        cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, fechaEsperada: true } },
        pagos: { where: { tipo: 'capital' }, select: { tipo: true, montoPagado: true } },
      },
    }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.prestamo.aggregate({ where: { organizationId, esClavo: true }, _count: true, _sum: { totalAPagar: true } }),
    prisma.cliente.count({ where: { organizationId } }),
    prisma.$queryRaw`
      SELECT clienteId, COUNT(*) as total
      FROM Prestamo WHERE organizationId = ${organizationId} AND esClavo = false
      GROUP BY clienteId HAVING total > 1
    `,
  ])

  // Calculations
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
  const promedioDiario = diasHabiles > 0 ? recaudadoMes / diasHabiles : 0
  const proyeccionMes = promedioDiario * diasHabilesTotalMes

  // Lo que sigue AFUERA, no lo que salio algun dia. `Σ montoPrestado` era la
  // version inflada, y aqui hace ademas de denominador del ROI.
  const capitalEnCalle = prestamosActivosDetalle.reduce((s, p) => s + capitalEnCalleDe(p), 0)
  const porCobrar = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.totalPagado || 0)), 0)
  const interesEnCartera = prestamosActivosDetalle.reduce((s, p) => s + (Number(p.totalAPagar) - Number(p.montoPrestado)), 0)

  // Correccion de los prestamos CON tabla: la DIFERENCIA entre lo que dice su
  // tabla y lo que ya conto el reparto proporcional. Misma regla que la pantalla
  // de analiticas, para que las dos muestren el mismo numero.
  const correccionTablaPorMes = {}
  for (const prestamo of prestamosConTabla) {
    const cuotas = prestamo.cuotasAmortizacion
    if (!cuotas.length) continue
    const fraccionProporcional = fraccionInteres(prestamo)
    let acumulado = 0
    for (const pago of prestamo.pagos) {
      const delta = interesDelPagoSegunTabla(cuotas, acumulado, pago.montoPagado)
        - pago.montoPagado * fraccionProporcional
      acumulado += pago.montoPagado
      if (pago.fechaPago < fechaInicio) continue
      const mes = pago.fechaPago.toISOString().slice(0, 7)
      const acc = correccionTablaPorMes[mes] || (correccionTablaPorMes[mes] = { interes: 0, capital: 0 })
      acc.interes += delta
      acc.capital -= delta
    }
  }

  const pagoMap = Object.fromEntries(pagosMensuales.map(p => [
    p.mes,
    {
      ...p,
      interesGanado: Number(p.interesGanado || 0) + (correccionTablaPorMes[p.mes]?.interes || 0),
      capitalRecuperado: Number(p.capitalRecuperado || 0) + (correccionTablaPorMes[p.mes]?.capital || 0),
    },
  ]))
  const gastoMap = Object.fromEntries(gastosMensuales.map(g => [g.mes, g]))
  const prestamoMap = Object.fromEntries(prestamosMensuales.map(p => [p.mes, p]))
  const mesActualKey = mesActual.toISOString().slice(0, 7)
  const gastosMesActual = Number(gastoMap[mesActualKey]?.total || 0)
  // GANANCIA = INTERES cobrado - gastos. `recaudado` incluye la devolucion del
  // capital que el prestamista habia puesto, y recuperar plata propia no es
  // ganancia: la formula vieja inflaba este numero varias veces y de el salia
  // tambien el ROI del reporte. Mismo criterio que /api/dashboard/analiticas.
  const interesGanadoMesActual = Number(pagoMap[mesActualKey]?.interesGanado || 0)
  const gananciaNetaMes = calcularGananciaNeta({ interesCobrado: interesGanadoMesActual, gastos: gastosMesActual })
  const roiMensual = capitalEnCalle > 0 ? (gananciaNetaMes / capitalEnCalle * 100) : 0

  // Mora
  const festivosFechas = festivos.map(f => f.fecha)
  const alertas = []
  for (const p of prestamosActivosDetalle) {
    const dias = calcularDiasMora(p, diasExcluidos, festivosFechas)
    if (dias > 0) {
      alertas.push({
        clienteNombre: p.cliente.nombre,
        diasMora: dias,
        montoEnRiesgo: Number(p.totalAPagar) - Number(p.totalPagado || 0),
        cuotaDiaria: Number(p.cuotaDiaria),
        severidad: dias >= 8 ? 'grave' : dias >= 4 ? 'moderada' : 'leve',
      })
    }
  }
  alertas.sort((a, b) => b.diasMora - a.diasMora)
  const montoMoraTotal = alertas.reduce((s, a) => s + a.montoEnRiesgo, 0)

  // Cobradores
  const userMap = Object.fromEntries(orgUsers.map(u => [u.id, u]))
  const cobradoresData = cobradorRecaudo.map(c => ({
    nombre: userMap[c.cobradorId]?.nombre || 'Sin nombre',
    rol: userMap[c.cobradorId]?.rol || 'cobrador',
    recaudado: Number(c.recaudado),
    pagos: Number(c.pagos),
  }))

  // Monthly trend
  const meses = []
  for (let i = 0; i < mesesAtras; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1 + i, 1)
    meses.push(d.toISOString().slice(0, 7))
  }

  /* Todo el dibujo lo pone `lib/papel/documento`.
   *
   * Lo que este informe tenia y no se veia leyendo el codigo: el pie se
   * escribia a y=760 y y=766, con el area util acabando en 752, y ademas la
   * linea de la izquierda iba SIN `lineBreak: false`. Las dos cosas abren
   * pagina en PDFKit. De ahi las «hojas de mas» del final. */
  const hoja = abrirDocumento({ pie: `${org?.nombre || 'Control Finanzas'} · Informe de rendimiento` })
  const doc = hoja.doc
  const { L, R, W } = hoja

  let y = hoja.cabecera({
    negocio: org?.nombre,
    titulo: 'Cómo va el negocio',
    subtitulo: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
    meta: `Generado el ${fechaGeneracion}`,
  })

  /* EL ROI MANDA EN LA HOJA. Es la unica cifra que contesta «¿esto me esta
     dando plata?», y estaba al mismo tamano que el resto. */
  const ALTO_ROI = 76
  const roiOk = roiMensual >= 0
  doc.roundedRect(L, y, W, ALTO_ROI, 6).fillAndStroke(roiOk ? COLOR.greenTint : COLOR.redTint, roiOk ? COLOR.green : COLOR.red)
  doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
  hoja.escribir('RENDIMIENTO DEL MES', L + 16, y + 12, { characterSpacing: 0.6 })
  doc.font(F.cifraFuerte).fontSize(34).fillColor(roiOk ? COLOR.green : COLOR.red)
  hoja.escribir(`${Math.round(roiMensual * 10) / 10}%`, L + 16, y + 28)
  doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink2)
  hoja.escribir('de lo que tienes en la calle', L + 16, y + 60)

  doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
  hoja.escribir('ganancia neta ÷ capital en calle', L, y + 60, { width: W - 16, align: 'right' })
  doc.font(F.cifraFuerte).fontSize(TIPO.cifra).fillColor(COLOR.ink)
  hoja.escribir(fmt(gananciaNetaMes), L, y + 30, { width: W - 16, align: 'right' })
  doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
  hoja.escribir('GANANCIA NETA', L, y + 16, { width: W - 16, align: 'right', characterSpacing: 0.6 })
  y += ALTO_ROI + 18

  y = hoja.cifras([
    { rotulo: 'Recaudado', valor: fmt(recaudadoMes) },
    { rotulo: 'Gastos', valor: fmt(gastosMesActual) },
    { rotulo: 'Capital en calle', valor: fmt(capitalEnCalle) },
    { rotulo: 'Proyectado del mes', valor: fmt(Math.round(proyeccionMes)) },
  ], y)

  /* La barra de avance del mes: cuanto de lo esperado ya entro. */
  y = hoja.seccion('Lo que va del mes', y)
  const pct = esperadoMes > 0 ? Math.min(recaudadoMes / esperadoMes, 1) : 0
  doc.roundedRect(L, y, W, 14, 4).fill(COLOR.surface)
  if (pct > 0) doc.roundedRect(L, y, Math.max(W * pct, 6), 14, 4).fill(COLOR.gold)
  doc.font(F.cifraFuerte).fontSize(TIPO.rotulo).fillColor(COLOR.ink2)
  hoja.escribir(`${Math.round(pct * 100)}% de ${fmt(esperadoMes)}`, L, y + 20, { width: W })
  y += 40

  y = hoja.seccion('Estado de la cartera', y)
  y = hoja.cifras([
    { rotulo: 'Préstamos activos', valor: String(prestamosActivosDetalle.length) },
    { rotulo: 'Por cobrar', valor: fmt(porCobrar) },
    { rotulo: 'Interés en cartera', valor: fmt(interesEnCartera), tono: 'bueno' },
    { rotulo: 'En mora', valor: `${alertas.length} de ${prestamosActivosDetalle.length}`, tono: alertas.length > 0 ? 'malo' : 'bueno' },
    { rotulo: 'Préstamo promedio', valor: fmt(Math.round(prestamosActivosDetalle.length > 0 ? capitalEnCalle / prestamosActivosDetalle.length : 0)) },
    { rotulo: 'Clientes que repiten', valor: `${totalClientes > 0 ? Math.round((prestamosTotal.length / totalClientes) * 100) : 0}%` },
    { rotulo: 'Clavos', valor: String(prestamosEsclavo._count || 0), tono: prestamosEsclavo._count > 0 ? 'malo' : undefined },
    { rotulo: 'Monto en clavos', valor: fmt(Number(prestamosEsclavo._sum?.totalAPagar || 0)), tono: prestamosEsclavo._count > 0 ? 'malo' : undefined },
  ], y)

  if (alertas.length > 0) {
    y = hoja.seccion(`Quién está atrasado · ${fmt(montoMoraTotal)} en riesgo`, y)
    y = hoja.tabla({
      columnas: [
        { clave: 'nombre', titulo: 'Cliente', ancho: 3.4, identidad: true },
        { clave: 'dias', titulo: 'Días', ancho: 1, alinear: 'right' },
        { clave: 'sev', titulo: 'Qué tan grave', ancho: 1.8, alinear: 'center' },
        { clave: 'cuota', titulo: 'Cuota', ancho: 1.6, fuente: 'cifra' },
        { clave: 'riesgo', titulo: 'En riesgo', ancho: 1.8, fuente: 'cifra' },
      ],
      filas: alertas.map((a) => ({
        nombre: a.clienteNombre,
        dias: String(a.diasMora),
        sev: a.severidad === 'grave' ? 'Grave' : a.severidad === 'moderada' ? 'Moderada' : 'Leve',
        sevPastilla: a.severidad === 'grave'
          ? { fondo: COLOR.redTint, color: COLOR.red }
          : a.severidad === 'moderada'
            ? { fondo: COLOR.goldTint, color: COLOR.goldInk }
            : { fondo: COLOR.surface, color: COLOR.ink3 },
        cuota: fmt(a.cuotaDiaria),
        riesgo: fmt(a.montoEnRiesgo),
        riesgoColor: a.severidad === 'grave' ? COLOR.red : undefined,
      })),
    }, y)
  }

  if (cobradoresData.length > 0) {
    y = hoja.seccion('Quién recaudó más', y)
    y = hoja.tabla({
      columnas: [
        { clave: 'pos', titulo: '#', ancho: 0.5 },
        { clave: 'nombre', titulo: 'Nombre', ancho: 4, identidad: true },
        { clave: 'rol', titulo: 'Rol', ancho: 1.6 },
        { clave: 'pagos', titulo: 'Pagos', ancho: 1.2, alinear: 'right' },
        { clave: 'recaudado', titulo: 'Recaudado', ancho: 2.2, fuente: 'cifra' },
      ],
      filas: cobradoresData.map((c, i) => ({
        pos: String(i + 1),
        nombre: c.nombre,
        rol: c.rol === 'owner' ? 'Admin' : 'Cobrador',
        pagos: String(c.pagos),
        recaudado: fmt(c.recaudado),
      })),
    }, y)
  }

  const etiquetaMes = (m) => new Date(m + '-15')
    .toLocaleDateString('es', { month: 'short' }).replace(/^de /, '').slice(0, 3).toUpperCase()

  y = hoja.barras(
    meses.map((m) => ({ etiqueta: etiquetaMes(m), valor: Number(pagoMap[m]?.total || 0) })),
    y, { titulo: 'Lo recaudado en los últimos 6 meses', formato: fmt },
  )

  y = hoja.barras(
    meses.map((m) => ({ etiqueta: etiquetaMes(m), valor: Number(gastoMap[m]?.total || 0) })),
    y, { titulo: 'Los gastos en los últimos 6 meses', formato: fmt },
  )

  const buffer = await hoja.cerrar()
  return respuestaPdf(buffer, `como-va-el-negocio-${mesActualKey}.pdf`)
}
