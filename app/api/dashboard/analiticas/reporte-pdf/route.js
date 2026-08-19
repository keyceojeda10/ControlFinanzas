import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma, Prisma } from '@/lib/prisma'
import { formatMoney } from '@/lib/i18n'
import { calcularDiasMora, calcularGananciaNeta, interesDelPagoSegunTabla } from '@/lib/calculos'
import { repartoSql, fraccionInteres, capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'
import { abrirDocumento, respuestaPdf, F } from '@/lib/papel/documento'
import { COLOR, TIPO } from '@/lib/papel/tokens'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { rotulo } from '@/lib/dinero/definiciones'
import { parsearDiasSinCobro, obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { cuotaDelPeriodo, tocaCobrarEn } from '@/lib/dinero/esperado'

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


  const country = session.user.country ?? 'co'
  const fmt = v => formatMoney(v, country)

  const ahora = new Date()
  const hoy = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  /* El mismo corte que la pantalla: el mes empieza a las 05:00 UTC, que es
     medianoche en Bogotá. `new Date(año, mes, 1)` lo construye en la hora local
     del servidor —UTC en producción— y arrancaba el mes a las 7 de la tarde del
     día anterior. Ver la nota larga en dashboard/analiticas/route.js. */
  const HORA_CORTE = 5
  const claveMesBogota = (fecha) =>
    new Date(new Date(fecha).getTime() - HORA_CORTE * 3600000).toISOString().slice(0, 7)
  const inicioDeMes = (desplazamiento) =>
    new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1, HORA_CORTE, 0, 0))

  const mesActual = inicioDeMes(0)
  const mesAnterior = inicioDeMes(-1)
  const mesesAtras = 6
  const fechaInicio = inicioDeMes(-mesesAtras + 1)

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
      SELECT DATE_FORMAT(DATE_SUB(p.fechaPago, INTERVAL 5 HOUR), '%Y-%m') as mes,
        SUM(p.montoPagado) as total,
        COUNT(*) as cantidad,
        SUM(${Prisma.raw(REPARTO_PAGO.interes)}) as interesGanado,
        SUM(${Prisma.raw(REPARTO_PAGO.capital)}) as capitalRecuperado
      FROM Pago p
      JOIN Prestamo pr ON pr.id = p.prestamoId
      WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${fechaInicio}
        AND p.tipo NOT IN ('recargo', 'descuento')
        AND pr.estado <> 'cancelado'
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
        /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
           interés devengado sin pagar, y un campo que no se pide vale `undefined`
           —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
        devengos: { select: { periodo: true, interes: true } },
        cuotasAmortizacion: { some: {} },
        /* ⚠ Los anulados TAMBIÉN fuera de la corrección, no solo de la consulta
           base. Ayer se filtró la de arriba y esta se quedó atrás: la cifra
           volvía a subir por la puerta de la corrección. Lo cazó comparar las dos
           pantallas del mismo negocio en el espejo, no leer el código. */
        estado: { not: 'cancelado' },
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
      SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL 5 HOUR), '%Y-%m') as mes, SUM(montoPrestado) as capitalPrestado,
        COUNT(*) as cantidad
      FROM Prestamo WHERE organizationId = ${organizationId} AND createdAt >= ${fechaInicio} AND esClavo = false
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(fecha, INTERVAL 5 HOUR), '%Y-%m') as mes, SUM(monto) as total
      FROM GastoMenor WHERE organizationId = ${organizationId} AND fecha >= ${fechaInicio} AND estado = 'aprobado'
      GROUP BY mes ORDER BY mes
    `,
    prisma.$queryRaw`
      SELECT cobradorId, SUM(montoPagado) as recaudado, COUNT(*) as pagos
      FROM Pago p WHERE p.organizationId = ${organizationId} AND p.fechaPago >= ${mesActual}
        AND p.tipo NOT IN ('recargo', 'descuento') AND p.cobradorId IS NOT NULL
        AND EXISTS (SELECT 1 FROM Prestamo pr WHERE pr.id = p.prestamoId AND pr.estado <> 'cancelado')
      GROUP BY p.cobradorId ORDER BY recaudado DESC
    `,
    prisma.user.findMany({ where: { organizationId }, select: { id: true, nombre: true, rol: true } }),
    /* Los anulados fuera, IGUAL que en la pantalla: este PDF es la misma cifra
       impresa, y dos criterios distintos son dos ganancias distintas para el
       mismo mes. Ver la nota larga en dashboard/analiticas/route.js. */
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
        // `estado` se filtra arriba y ADEMAS se pide: `calcularDiasMora` lo lee,
        // y sin el campo veia `undefined` y devolvia 0 en todos. Ver la nota en
        // lib/calculos.js.
        id: true, estado: true, montoPrestado: true, totalAPagar: true, totalPagado: true, abonadoCapital: true,
        cuotaDiaria: true, frecuencia: true, fechaInicio: true, fechaFin: true,
        diasPlazo: true, ultimoPagoAt: true, modoInteres: true, tasaInteres: true,
        proximoCobroManual: true,
        /* ⚠ Los dias sin cobro son del CLIENTE, no solo del negocio: ver la
           nota igual en /api/dashboard/analiticas. */
        diasSinCobro: true,
        cliente: {
          select: {
            id: true, nombre: true, diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
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
  /* ⚠ AQUI HABIA DOS IDIOMAS EN LA MISMA LINEA.
   *
   * `diasSinCobro` se guarda como un JSON de NUMEROS —`"[0]"` es «no se cobra
   * domingo»— y esto lo comparaba contra una tabla de NOMBRES («domingo»). La
   * comparacion no fallaba: era `false` siempre, asi que el mes contaba como
   * habiles los siete dias de la semana. Con `[1,2,3,4,5]` —un negocio que solo
   * cobra fines de semana— el esperado del mes salia tres veces y media.
   *
   * `parsearDiasSinCobro` devuelve el array de numeros de verdad, que es lo que
   * entienden tanto esto como `calcularDiasMora`. Medido: 20 negocios lo tienen
   * configurado, 18 con prestamos vivos, 1.483 prestamos activos. */
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
      const mes = claveMesBogota(pago.fechaPago)
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
  const mesActualKey = claveMesBogota(mesActual)
  const gastosMesActual = Number(gastoMap[mesActualKey]?.total || 0)
  // GANANCIA = INTERES cobrado - gastos. `recaudado` incluye la devolucion del
  // capital que el prestamista habia puesto, y recuperar plata propia no es
  // ganancia: la formula vieja inflaba este numero varias veces y de el salia
  // tambien el ROI del reporte. Mismo criterio que /api/dashboard/analiticas.
  const interesGanadoMesActual = Number(pagoMap[mesActualKey]?.interesGanado || 0)
  const gananciaNetaMes = calcularGananciaNeta({ interesCobrado: interesGanadoMesActual, gastos: gastosMesActual })
  const roiMensual = capitalEnCalle > 0 ? (gananciaNetaMes / capitalEnCalle * 100) : 0

  // Mora
  const alertas = []
  for (const p of prestamosActivosDetalle) {
    // Los suyos, no los del negocio. `diasExcluidos` sigue sirviendo para el
    // calendario del MES —esa si es una cuenta de la organizacion—.
    const susDias = diasDeCobroDe(p)
    const dias = calcularDiasMora(p, susDias, festivosFechas)
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
    // Por el mismo sitio que todo lo demás: `new Date(año, mes, 1)` construye la
    // fecha en la hora del servidor y aquí daba la clave correcta de casualidad.
    meses.push(claveMesBogota(inicioDeMes(-mesesAtras + 1 + i)))
  }

  /* ⚠ Estas dos vivian en el bloque de PDFKit que se retiro, y al retirarlo se
     fueron con el: el informe reventaba con «mesNombre is not defined». Lo
     dijo el LOG del espejo, no el build ni las pruebas: sin TypeScript, un
     identificador que no existe solo falla cuando alguien pulsa el boton. */
  const mesNombre = hoy.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const fechaGeneracion = hoy.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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
  // Coma decimal: aqui «0.2%» se lee como otra cosa.
  hoja.escribir(`${String(Math.round(roiMensual * 10) / 10).replace('.', ',')}%`, L + 16, y + 28)
  doc.font(F.texto).fontSize(TIPO.texto).fillColor(COLOR.ink2)
  hoja.escribir('de lo que tienes en la calle', L + 16, y + 60)

  doc.font(F.texto).fontSize(TIPO.pie).fillColor(COLOR.ink4)
  // Manrope no trae el signo de dividir y PDFKit lo sustituia por un «+»,
  // que dice lo contrario. En palabras no hay glifo que falte.
  hoja.escribir('la ganancia entre el capital en calle', L, y + 60, { width: W - 16, align: 'right' })
  doc.font(F.cifraFuerte).fontSize(TIPO.cifra).fillColor(COLOR.ink)
  hoja.escribir(fmt(gananciaNetaMes), L, y + 30, { width: W - 16, align: 'right' })
  doc.font(F.texto).fontSize(TIPO.rotulo).fillColor(COLOR.ink3)
  // El mismo nombre que la pantalla. «Ganancia neta» esta prohibido en la
  // interfaz por chocar con «Utilidad neta»; el papel no puede decir otra cosa.
  hoja.escribir(rotulo('gananciaMes').toUpperCase(), L, y + 16, { width: W - 16, align: 'right', characterSpacing: 0.6 })
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
