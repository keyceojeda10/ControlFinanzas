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
  calcularCuotasEnMora,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, validarDiasSinCobro } from '@/lib/dias-sin-cobro'

// Funciones de fecha en timezone Colombia (UTC-5)
// Medianoche Colombia = 05:00 UTC
const hoy = () => {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0)) // midnight Colombia in UTC
}
const manana = () => {
  const h = hoy()
  return new Date(h.getTime() + 24 * 60 * 60 * 1000)
}

// ─── GET /api/rutas/[id] ────────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaId } = session.user

  // Cobrador solo puede ver su propia ruta
  if (rol === 'cobrador' && id !== rutaId) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  // Config org para días sin cobro
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: {
      cobrador: { select: { id: true, nombre: true, email: true } },
      clientes: {
        include: {
          grupoCobro: { select: { id: true, nombre: true, color: true } },
          prestamos: {
            where:   { estado: 'activo' },
            orderBy: { createdAt: 'asc' },
            include: {
              pagos: {
                select:  { montoPagado: true, fechaPago: true, tipo: true },
                orderBy: { fechaPago: 'desc' },
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
  let enMora = 0
  let carteraTotal = 0  // saldo pendiente de todos los préstamos
  let capitalTotal = 0  // monto original prestado

  // Cachear fechas para evitar recalcular en cada iteración
  const _hoy = hoy(), _manana = manana()

  const clientesEnriquecidos = ruta.clientes.map((c) => {
    const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
    const _hoySinCobro = esHoySinCobro(diasExcluidos)
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

    for (const p of c.prestamos) {
      cuotaCliente  += p.cuotaDiaria
      esperadoHoy   += _hoySinCobro ? 0 : p.cuotaDiaria
      const saldoPendientePrestamo = calcularSaldoPendiente(p)
      carteraTotal  += saldoPendientePrestamo
      capitalTotal  += p.montoPrestado
      const pagosHoy = p.pagos.filter(
        (pg) => new Date(pg.fechaPago) >= _hoy && new Date(pg.fechaPago) < _manana
      )
      const montoPagadoHoy = pagosHoy.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
      pagadoHoy    += montoPagadoHoy
      recaudadoHoy += montoPagadoHoy
      const moraPrestamo = calcularDiasMora(p, diasExcluidos)
      const cuotasMoraPrestamo = calcularCuotasEnMora(p, diasExcluidos)
      const montoMoraPrestamo = calcularMontoEnMora(p, diasExcluidos)
      const montoAlDiaPrestamo = calcularMontoParaPonerseAlDia(p, diasExcluidos)
      mora = Math.max(mora, moraPrestamo)
      cuotasEnMoraCliente += cuotasMoraPrestamo
      montoEnMoraCliente += montoMoraPrestamo
      montoParaAlDiaCliente += montoAlDiaPrestamo
      prestamosActivos.push({
        id: p.id,
        cuotaDiaria: p.cuotaDiaria,
        saldoPendiente: Math.round(saldoPendientePrestamo),
        diasMora: moraPrestamo,
        cuotasEnMora: cuotasMoraPrestamo,
        montoEnMora: Math.round(montoMoraPrestamo),
        montoParaPonerseAlDia: Math.round(montoAlDiaPrestamo),
        frecuencia: p.frecuencia || 'diario',
      })

      // Último pago más reciente (pagos ya vienen ordenados por fechaPago desc)
      if (p.pagos.length > 0) {
        const fecha = new Date(p.pagos[0].fechaPago)
        if (!ultimaFechaPago || fecha > ultimaFechaPago) ultimaFechaPago = fecha
      }

      // Frecuencia y próximo cobro del préstamo activo (lib centralizado)
      frecuencia = p.frecuencia || 'diario'
      const pc = calcularProximoCobro(p, diasExcluidos)
      if (pc && (!proximoCobro || pc < proximoCobro)) proximoCobro = pc

      // Pendiente hoy según cobertura real esperada al día de hoy.
      if (!_hoySinCobro && tieneCobroPendienteHoy(p, diasExcluidos)) {
        cobroPendienteHoy = true
      }
    }

    const yaPageHoy = pagadoHoy > 0
    const pendienteHoyCliente = !_hoySinCobro && cobroPendienteHoy
    if (pendienteHoyCliente) pendientesHoy++
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
      latitud:   c.latitud,
      longitud:  c.longitud,
      estado:    c.prestamos.length === 0 ? 'completado' : (mora > 0 ? 'mora' : 'activo'),
      pagoHoy:   yaPageHoy,
      diasMora:  mora,
      cuotasEnMora: cuotasEnMoraCliente,
      montoEnMora: Math.round(montoEnMoraCliente),
      montoParaPonerseAlDia: Math.round(montoParaAlDiaCliente),
      diasDesdeUltimoPago,
      cuota:     cuotaCliente,
      hoySinCobro: _hoySinCobro,
      cobroPendienteHoy: pendienteHoyCliente,
      prestamoActivo: c.prestamos[0]?.id ?? null,
      prestamosActivos,
      frecuencia,
      diasParaCobro,
      proximoCobroLabel: proximoCobro ? formatFechaCobro(proximoCobro) : null,
      grupoCobro: c.grupoCobro ?? null,
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

  return Response.json({
    id:          ruta.id,
    nombre:      ruta.nombre,
    diasSinCobro: ruta.diasSinCobro,
    cobrador:    ruta.cobrador,
    gruposCobro,
    clientes:    clientesEnriquecidos,
    esperadoHoy: Math.round(esperadoHoy),
    recaudadoHoy: Math.round(recaudadoHoy),
    pendientesHoy,
    enMora,
    carteraTotal: Math.round(carteraTotal),
    capitalTotal: Math.round(capitalTotal),
    cierre,
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

  const { nombre, cobradorId, diasSinCobro } = await request.json()

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
    const hoyCo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const inicioHoy = new Date(hoyCo + 'T00:00:00-05:00')
    const finHoy = new Date(hoyCo + 'T23:59:59.999-05:00')
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
