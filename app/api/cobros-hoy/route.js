// app/api/cobros-hoy/route.js
// Devuelve todos los clientes pendientes de cobro del dia para el cobrador,
// agregando todas sus rutas en una sola lista plana.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularMontoParaPonerseAlDia,
  tieneCobroPendienteHoy,
  obtenerCuotaPeriodoActual,
  obtenerProximaCuotaTabla,
  tieneTablaAmortizacion,
  cuotaProximoCobro,
  // La tira de cifras de T03-01.
  calcularCuotasPendientes,
  calcularCuotasEnMora,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'

function detectarCuotaExtra(prestamo, proximaCuota) {
  if (!proximaCuota || !Array.isArray(prestamo.capitalExtra) || !prestamo.capitalExtra.length) {
    return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  }
  const periodo = proximaCuota.numeroPeriodo
  const extra = prestamo.capitalExtra.find(e => e.numeroPeriodo === periodo)
  if (!extra || !extra.monto) return { cuotaExtraHoy: false, montoCuotaExtra: 0 }
  return { cuotaExtraHoy: true, montoCuotaExtra: Math.round(extra.monto) }
}

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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id: userId, organizationId, rol, rutaIds: rutaIdsRaw } = session.user
  const esCobrador = rol === 'cobrador'
  const rutaIds = rutaIdsRaw ?? []

  // Antes esto devolvia 403 "Solo para cobradores" y el comentario decia que
  // los owners usan el dashboard normal. Pero el dashboard NO tiene lista de
  // cobro: esta es la unica pantalla del producto que responde "a quien le
  // cobro hoy", que es la pregunta que abre el dia. Y el 95% de las
  // organizaciones no tiene cobradores: el dueño sale a la calle el mismo.
  //
  // Ademas se consultaba rutas -> clientes, asi que un cliente sin ruta era
  // invisible aunque tuviera cuota hoy. Ahora se parte de los clientes y la
  // ruta es una relacion opcional.
  const _hoy = hoy(), _manana = manana()

  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  // Cobrador: los clientes de sus rutas, mas los que el mismo creo sin ruta
  // (mismo criterio que /api/clientes y /api/prestamos, para que las tres
  // pantallas muestren el mismo universo).
  // Dueño: todos los clientes de la organizacion, con o sin ruta.
  //
  // pagos: solo los de HOY (filtramos en DB, no en JS) — evita traer meses de
  // historial. Los calculos de mora/saldo usan totalPagado (denormalizado).
  const clientes = await prisma.cliente.findMany({
    where: {
      organizationId,
      estado: { notIn: ['eliminado'] },
      ...(esCobrador
        ? { OR: [{ rutaId: { in: rutaIds } }, { rutaId: null, creadoPorId: userId }] }
        : {}),
    },
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      cedula: true,
      direccion: true,
      // `referencia` TAMBIEN: son dos campos distintos del cliente y en la
      // practica unos tienen uno y otros el otro. Sin este, la fila de T02-02
      // sale sin el «donde», que en una pantalla para caminar es lo que hace
      // falta. Y no cuesta nada: es un VarChar(100) de la misma fila.
      referencia: true,
      diasSinCobro: true,
      ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
      prestamos: {
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
          modoInteres: true,
          capitalExtra: true,
          proximoCobroManual: true,
          // «Ult. pago 21 jun», la cuarta columna de la tira de T03-01. Es la
          // que dice si el cliente esta frio o si se le vio la semana pasada.
          ultimoPagoAt: true,
          cuotasAmortizacion: {
            select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
            orderBy: { numeroPeriodo: 'asc' },
          },
          pagos: {
            where: { fechaPago: { gte: _hoy, lt: _manana } },
            select: { id: true, montoPagado: true, fechaPago: true, tipo: true },
          },
        },
      },
    },
  })

  let totalClientes = 0
  let totalPendientes = 0
  let totalPagados = 0
  let esperadoHoyTotal = 0
  let recaudadoHoyTotal = 0

  const clientesAgregados = []

  {
    for (const c of clientes) {
      const ruta = c.ruta   // puede ser null: cliente sin ruta asignada
      totalClientes++

      const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
      const _hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo(festivos)

      let cuotaCliente = 0
      let pagadoHoy = 0
      let mora = 0
      let montoParaAlDia = 0
      // La tira de cifras de T03-01: Atraso · Cumple · Cuota · Ult. pago.
      // El atraso en plata es `montoParaAlDia`, que ya estaba. Estas tres no.
      let cuotasVencidas = 0
      let cuotasPagadasSum = 0
      let cuotaDeMayorMora = null
      let ultimoPagoISO = null
      let cobroPendienteHoy = false
      const prestamosActivos = []
      // La HORA del ultimo cobro de hoy y el SALDO total del cliente.
      //
      // T02-02 no borra al cobrado: lo deja tachado en su sitio diciendo
      // «Cobrado 9:06 a. m.». `fechaPago` ya se leia de la base para sumar; solo
      // no se devolvia. Y el saldo hacia falta para el «debe $160.000» de la
      // derecha, que es lo que distingue una cuota de $12.000 sobre una deuda de
      // $160.000 de la misma cuota sobre una de $20.000.
      let ultimoCobroHoy = null
      let saldoCliente = 0

      for (const p of c.prestamos) {
        // p.pagos ya viene filtrado por hoy desde la query (where fechaPago gte/lt)
        const pagosHoy = p.pagos
        const montoPagadoHoy = pagosHoy
          .filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
          .reduce((a, pg) => a + pg.montoPagado, 0)
        pagadoHoy += montoPagadoHoy
        recaudadoHoyTotal += montoPagadoHoy
        for (const pg of pagosHoy) {
          if (['recargo', 'descuento'].includes(pg.tipo)) continue
          if (!ultimoCobroHoy || pg.fechaPago > ultimoCobroHoy) ultimoCobroHoy = pg.fechaPago
        }

        if (p.estado !== 'activo') continue
        if (p.esClavo) {
          const cuotaClavo = tieneTablaAmortizacion(p) ? obtenerCuotaPeriodoActual(p) : p.cuotaDiaria
          const saldoClavo = calcularSaldoPendiente(p)
          const proximaCuotaClavo = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
          const extraClavo = detectarCuotaExtra(p, proximaCuotaClavo)
          cuotaCliente += cuotaClavo
          // El clavo TAMBIEN cuenta en lo que el cliente debe. Se le sigue
          // cobrando —su cuota ya entra en `cuotaCliente` dos lineas arriba— asi
          // que dejarlo fuera del saldo diria «debe $80.000» cobrandole sobre
          // $160.000. Un clavo es plata dificil, no plata que no existe.
          saldoCliente += saldoClavo
          prestamosActivos.push({
            id: p.id,
            cuotaDiaria: Math.round(cuotaClavo),
            saldoPendiente: Math.round(saldoClavo),
            diasMora: 0,
            modoInteres: p.modoInteres || 'fijo',
            esBalloon: false,
            cuotaNumero: proximaCuotaClavo?.numeroPeriodo ?? null,
            esClavo: true,
            ...extraClavo,
          })
          continue
        }

        const diasExcluidosPrestamo = obtenerDiasSinCobro(c, ruta, org, p)
        // cuotaProximoCobro topa la ultima cuota al saldo real (tras abonos/excedentes)
        // y usa la tabla en modos que la tienen. Antes mostraba la cuota fija completa.
        const cuotaReal = cuotaProximoCobro(p)
        cuotaCliente += cuotaReal
        esperadoHoyTotal += cuotaReal

        const saldo = calcularSaldoPendiente(p)
        // Lo que el cliente debe EN TOTAL, sumando sus prestamos activos. Es el
        // «debe $160.000» de la derecha en T02-02.
        saldoCliente += saldo
        const moraPrestamo = calcularDiasMora(p, diasExcluidosPrestamo, festivos)
        const alDia = calcularMontoParaPonerseAlDia(p, diasExcluidosPrestamo, festivos)
        mora = Math.max(mora, moraPrestamo)
        montoParaAlDia += alDia

        // ── LA TIRA DE CIFRAS DE T03-01: Atraso · Cumple · Cuota · Ult. pago ──
        // El atraso en plata ya lo da `montoParaAlDia`. Faltaban las otras tres.
        //
        // CUMPLIMIENTO: de las cuotas que YA debian estar pagadas, cuantas lo
        // estan. Misma definicion que en /api/clientes — si se cambia alli, se
        // cambia aqui.
        const totalCuotas = tieneTablaAmortizacion(p)
          ? p.cuotasAmortizacion.length
          : (p.cuotaDiaria > 0 ? Math.ceil((p.totalAPagar || 0) / p.cuotaDiaria) : 0)
        const pagadasP = Math.max(0, totalCuotas - calcularCuotasPendientes(p))
        cuotasPagadasSum += pagadasP
        cuotasVencidas += pagadasP + calcularCuotasEnMora(p, diasExcluidosPrestamo, festivos)
        // «Cuota 13/24». Se queda con la del prestamo mas atrasado, que es el
        // que manda la visita: con dos prestamos, el numero de uno solo mentiria.
        if (totalCuotas > 0 && moraPrestamo >= (cuotaDeMayorMora?.mora ?? -1)) {
          cuotaDeMayorMora = { mora: moraPrestamo, texto: `${Math.min(totalCuotas, pagadasP + 1)}/${totalCuotas}` }
        }
        if (p.ultimoPagoAt) {
          const t = new Date(p.ultimoPagoAt).getTime()
          if (!ultimoPagoISO || t > new Date(ultimoPagoISO).getTime()) ultimoPagoISO = p.ultimoPagoAt
        }

        const proximaCuota = tieneTablaAmortizacion(p) ? obtenerProximaCuotaTabla(p) : null
        const extraInfo = detectarCuotaExtra(p, proximaCuota)
        prestamosActivos.push({
          id: p.id,
          cuotaDiaria: Math.round(cuotaReal),
          saldoPendiente: Math.round(saldo),
          diasMora: moraPrestamo,
          modoInteres: p.modoInteres || 'fijo',
          esBalloon: proximaCuota?.esBalloon || false,
          cuotaNumero: proximaCuota?.numeroPeriodo ?? null,
          ...extraInfo,
        })

        if (!_hoySinCobro && tieneCobroPendienteHoy(p, diasExcluidosPrestamo, festivos)) {
          cobroPendienteHoy = true
        }
      }

      const yaPageHoy = pagadoHoy > 0
      const pendienteHoyCliente = !_hoySinCobro && cobroPendienteHoy

      if (pendienteHoyCliente) totalPendientes++
      if (yaPageHoy && !pendienteHoyCliente) totalPagados++

      // Solo incluir clientes que tienen cobro hoy (pendiente o pagado)
      if (!pendienteHoyCliente && !yaPageHoy) continue

      clientesAgregados.push({
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula,
        direccion: c.direccion,
        referencia: c.referencia,
        rutaId: ruta?.id ?? null,
        rutaNombre: ruta?.nombre ?? 'Sin ruta',
        cuota: cuotaCliente,
        pagoHoy: yaPageHoy,
        // ISO: la hora se formatea en el CLIENTE. Hecho aca saldria en la zona
        // del servidor, y en produccion eso es UTC: «Cobrado 14:06» cuando el
        // cobrador lo hizo a las 9:06.
        cobradoA: ultimoCobroHoy ? ultimoCobroHoy.toISOString() : null,
        montoCobradoHoy: Math.round(pagadoHoy),
        saldoTotal: Math.round(saldoCliente),
        cobroPendienteHoy: pendienteHoyCliente,
        diasMora: mora,
        montoParaPonerseAlDia: Math.round(montoParaAlDia),
        // La tira de T03-01. `null` cuando no hay nada vencido todavia: un 0%
        // en un cliente recien prestado lo pinta como el peor de la ruta.
        cumplimiento: cuotasVencidas > 0 ? Math.round((cuotasPagadasSum / cuotasVencidas) * 100) : null,
        cuotaTexto: cuotaDeMayorMora?.texto ?? null,
        ultimoPagoAt: ultimoPagoISO,
        hoySinCobro: _hoySinCobro,
        prestamoActivo: prestamosActivos[0]?.id ?? null,
        prestamosActivos,
        cuotaExtraHoy: prestamosActivos.some(p => p.cuotaExtraHoy),
        montoCuotaExtra: prestamosActivos.reduce((s, p) => s + (p.montoCuotaExtra || 0), 0),
      })
    }
  }

  // Orden: mora primero → pendientes → pagados; dentro de cada grupo por nombre
  clientesAgregados.sort((a, b) => {
    if (a.diasMora > 0 && b.diasMora === 0) return -1
    if (a.diasMora === 0 && b.diasMora > 0) return 1
    if (a.cobroPendienteHoy && !b.cobroPendienteHoy) return -1
    if (!a.cobroPendienteHoy && b.cobroPendienteHoy) return 1
    return a.nombre.localeCompare(b.nombre)
  })

  return Response.json({
    clientes: clientesAgregados,
    resumen: {
      total: totalClientes,
      pendientes: totalPendientes,
      pagados: totalPagados,
      esperadoHoy: Math.round(esperadoHoyTotal),
      recaudadoHoy: Math.round(recaudadoHoyTotal),
    },
  })
}
