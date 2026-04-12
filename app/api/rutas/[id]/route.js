// app/api/rutas/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularProximoCobro, formatFechaCobro } from '@/lib/calculos'
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
          prestamos: {
            where:   { estado: 'activo' },
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

  // Calcular métricas del día + cartera
  let esperadoHoy  = 0
  let recaudadoHoy = 0
  let pendientesHoy = 0
  let enMora = 0
  let carteraTotal = 0  // saldo pendiente de todos los préstamos
  let capitalTotal = 0  // monto original prestado

  // Cachear fechas para evitar recalcular en cada iteración
  const _hoy = hoy(), _manana = manana()

  // Calcular próximo cobro para frecuencias no diarias
  const calcProximoCobro = (fechaInicio, frecuencia) => {
    if (!fechaInicio || frecuencia === 'diario') return null
    const diasPeriodo = { semanal: 7, quincenal: 15, mensual: 30 }[frecuencia]
    if (!diasPeriodo) return null
    const inicio = new Date(fechaInicio)
    inicio.setHours(0, 0, 0, 0)
    const hoyMs = _hoy.getTime()
    const inicioMs = inicio.getTime()
    const diffDias = Math.floor((hoyMs - inicioMs) / 86400000)
    if (diffDias < 0) return new Date(fechaInicio) // aún no empieza
    // Si hoy cae exacto en un ciclo, es día de cobro (diasParaCobro=0)
    if (diffDias % diasPeriodo === 0) return _hoy
    const siguientePeriodo = Math.ceil(diffDias / diasPeriodo)
    const proxFecha = new Date(inicioMs + siguientePeriodo * diasPeriodo * 86400000)
    return proxFecha
  }

  const clientesEnriquecidos = ruta.clientes.map((c) => {
    const diasExcluidos = obtenerDiasSinCobro(c, ruta, org)
    const _hoySinCobro = esHoySinCobro(diasExcluidos)
    let cuotaCliente = 0
    let pagadoHoy    = 0
    let mora         = 0
    let ultimaFechaPago = null
    let frecuencia   = 'diario'
    let proximoCobro = null

    for (const p of c.prestamos) {
      cuotaCliente  += p.cuotaDiaria
      esperadoHoy   += _hoySinCobro ? 0 : p.cuotaDiaria
      carteraTotal  += calcularSaldoPendiente(p)
      capitalTotal  += p.montoPrestado
      const pagosHoy = p.pagos.filter(
        (pg) => new Date(pg.fechaPago) >= _hoy && new Date(pg.fechaPago) < _manana
      )
      const montoPagadoHoy = pagosHoy.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
      pagadoHoy    += montoPagadoHoy
      recaudadoHoy += montoPagadoHoy
      mora = Math.max(mora, calcularDiasMora(p, diasExcluidos))

      // Último pago más reciente (pagos ya vienen ordenados por fechaPago desc)
      if (p.pagos.length > 0) {
        const fecha = new Date(p.pagos[0].fechaPago)
        if (!ultimaFechaPago || fecha > ultimaFechaPago) ultimaFechaPago = fecha
      }

      // Frecuencia y próximo cobro del préstamo activo
      frecuencia = p.frecuencia || 'diario'
      if (frecuencia !== 'diario') {
        proximoCobro = calcProximoCobro(p.fechaInicio, frecuencia)
      }
      // Próximo cobro centralizado (toma en cuenta pagos del ciclo actual)
      if (!c._proximoCobroFull) {
        c._proximoCobroFull = calcularProximoCobro(p)
      }
    }

    const yaPageHoy = pagadoHoy > 0
    if (!yaPageHoy && c.prestamos.length > 0) pendientesHoy++
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
      diasDesdeUltimoPago,
      cuota:     cuotaCliente,
      hoySinCobro: _hoySinCobro,
      prestamoActivo: c.prestamos[0]?.id ?? null,
      frecuencia,
      diasParaCobro,
      proximoCobroLabel: c._proximoCobroFull ? formatFechaCobro(c._proximoCobroFull) : null,
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

  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
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
