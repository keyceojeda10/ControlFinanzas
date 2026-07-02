// app/api/rutas/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import {
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularProximoCobro,
  formatFechaCobro,
  tieneCobroPendienteHoy,
  tienePeriodoEsperadoHoy,
  calcularCuotasEnMora,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo, validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'
import { distanciaMetros } from '@/lib/geo'

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
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      clientes: {
        include: {
          grupoCobro: { select: { id: true, nombre: true, color: true } },
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
              diasSinCobro: true,
              createdAt: true,
              renovadoDeId: true,
              seguro: true,
              montoSeguro: true,
              modoInteres: true,
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

  // Grupos de cobro son organizacionales; aquí se devuelven con conteo dentro de esta ruta.
  const gruposBase = await prisma.grupoCobro.findMany({
    where: { organizationId },
    orderBy: { orden: 'asc' },
    select: { id: true, nombre: true, color: true, orden: true, createdAt: true },
  })

  const conteoPorGrupo = (ruta.clientes ?? []).reduce((acc, c) => {
    if (c.grupoCobroId) acc[c.grupoCobroId] = (acc[c.grupoCobroId] ?? 0) + 1
    return acc
  }, {})

  const gruposCobro = gruposBase.map((g) => ({
    ...g,
    _count: { clientes: conteoPorGrupo[g.id] ?? 0 },
  }))

  // Calcular métricas del día + cartera
  let esperadoHoy  = 0
  let recaudadoHoy = 0
  let pendientesHoy = 0
  let clientesConCobroHoy = 0
  let clientesPagaronHoy = 0
  let enMora = 0
  let carteraTotal = 0      // saldo pendiente total (principal + intereses que faltan)
  let capitalTotal = 0      // monto original prestado (sin intereses)
  let totalAPagarRuta = 0   // suma de totalAPagar (principal + intereses) — denominador correcto para % cobrado

  // Pines del mapa: pagos del dia con coords, color por distancia con su cliente.
  const cobrosGeoHoy = []
  // IDs de pagos y prestamos de esta ruta — para cruzar con ActividadLog y
  // detectar pagos editados/anulados hoy en el feed de "Actividad del día".
  const pagoIdsRuta = []
  const prestamoIdsRuta = []

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
    const prestamosActivos = []
    let ultimaFechaPago = null
    let frecuencia   = 'diario'
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
      const montoPagadoHoy = pagosHoy.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
      pagadoHoy    += montoPagadoHoy
      recaudadoHoy += montoPagadoHoy

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

      // Métricas de cartera/mora solo para préstamos activos
      if (p.estado !== 'activo') continue

      // Tarjeta clavo: su cobro de hoy SÍ entró arriba al recaudado (dinero real),
      // pero el lado negativo del clavo (cartera, mora, cuotas vencidas, esperado)
      // NO debe descuadrar los números de la ruta. Se salta a partir de aquí.
      if (p.esClavo) continue

      // Resolver diasSinCobro por préstamo individual (incluye campo propio del préstamo)
      const diasExcluidosPrestamo = obtenerDiasSinCobro(c, ruta, org, p)

      cuotaCliente  += p.cuotaDiaria
      // Meta del dia: solo suma cuotas de prestamos cuyo ciclo de cobro
      // toca HOY (segun frecuencia + dia ancla + dias excluidos). Antes se
      // sumaba todo prestamo activo, lo que inflaba la meta con cuotas que
      // en realidad se cobraban dias despues (ej. cliente con cobro manana).
      esperadoHoy   += tienePeriodoEsperadoHoy(p, _hoySinCobro, diasExcluidosPrestamo, festivos)
        ? p.cuotaDiaria
        : 0
      const saldoPendientePrestamo = calcularSaldoPendiente(p)
      carteraTotal    += saldoPendientePrestamo
      capitalTotal    += p.montoPrestado
      totalAPagarRuta += p.totalAPagar ?? p.montoPrestado
      const moraPrestamo = calcularDiasMora(p, diasExcluidosPrestamo, festivos)
      const cuotasMoraPrestamo = calcularCuotasEnMora(p, diasExcluidosPrestamo, festivos)
      const montoMoraPrestamo = calcularMontoEnMora(p, diasExcluidosPrestamo, festivos)
      const montoAlDiaPrestamo = calcularMontoParaPonerseAlDia(p, diasExcluidosPrestamo, festivos)
      mora = Math.max(mora, moraPrestamo)
      cuotasEnMoraCliente += cuotasMoraPrestamo
      montoEnMoraCliente += montoMoraPrestamo
      montoParaAlDiaCliente += montoAlDiaPrestamo
      prestamosActivos.push({
        id: p.id,
        cuotaDiaria: p.cuotaDiaria,
        saldoPendiente: Math.round(saldoPendientePrestamo),
        totalAPagar: p.totalAPagar ?? p.montoPrestado,
        totalPagado: p.totalPagado ?? 0,
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
      })

      // Último pago más reciente (pagos ya vienen ordenados por fechaPago desc)
      if (p.pagos.length > 0) {
        const fecha = new Date(p.pagos[0].fechaPago)
        if (!ultimaFechaPago || fecha > ultimaFechaPago) ultimaFechaPago = fecha
      }

      // Frecuencia y próximo cobro del préstamo activo (lib centralizado)
      frecuencia = p.frecuencia || 'diario'
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
      pagoHoy:   yaPageHoy,
      montoPagadoHoy: Math.round(pagadoHoy),
      diasMora:  mora,
      cuotasEnMora: cuotasEnMoraCliente,
      montoEnMora: Math.round(montoEnMoraCliente),
      montoParaPonerseAlDia: Math.round(montoParaAlDiaCliente),
      diasDesdeUltimoPago,
      cuota:     cuotaCliente,
      hoySinCobro: _hoySinCobro,
      cobroPendienteHoy: pendienteHoyCliente,
      prestamoActivo: prestamosActivos[0]?.id ?? null,
      prestamosActivos,
      frecuencia,
      diasParaCobro,
      proximoCobroLabel: proximoCobro ? formatFechaCobro(proximoCobro) : null,
      grupoCobro: c.grupoCobro ?? null,
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

  return Response.json({
    id:          ruta.id,
    nombre:      ruta.nombre,
    diasSinCobro: ruta.diasSinCobro,
    saldoCapital: Math.round(ruta.saldoCapital || 0),
    capitalHabilitado: !!ruta.capitalHabilitado,
    cobrador:    ruta.cobrador,
    gruposCobro,
    clientes:    clientesEnriquecidos,
    esperadoHoy: Math.round(esperadoHoy),
    recaudadoHoy: Math.round(recaudadoHoy),
    pendientesHoy,
    clientesConCobroHoy,
    clientesPagaronHoy,
    enMora,
    carteraTotal: Math.round(carteraTotal),
    capitalTotal: Math.round(capitalTotal),
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

  // Validar cobrador si se envía (mismo tenant y rol correcto)
  if (cobradorId !== undefined && cobradorId !== null && cobradorId !== '') {
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
