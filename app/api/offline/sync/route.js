// app/api/offline/sync/route.js — Descarga TODOS los datos para modo offline
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado, calcularProximoCobro, formatFechaCobro, pagoHoy } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro } from '@/lib/dias-sin-cobro'

// Medianoche Colombia = 05:00 UTC
function hoyColombiaUTC() {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear(), m = col.getUTCMonth(), d = col.getUTCDate()
  return new Date(Date.UTC(y, m, d, 5, 0, 0, 0))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const orgId = session.user.organizationId
  const userId = session.user.id
  const rol = session.user.rol
  const rutaId = session.user.rutaId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { diasSinCobro: true },
  })

  // ── Filtro base: cobrador solo ve su ruta ──
  const clienteWhere = {
    organizationId: orgId,
    estado: { not: 'eliminado' },
    ...(rol === 'cobrador' && rutaId ? { rutaId } : {}),
  }

  // ── 1. Todos los clientes con sus préstamos y pagos ──
  const clientesRaw = await prisma.cliente.findMany({
    where: clienteWhere,
    include: {
      ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
      prestamos: {
        orderBy: { createdAt: 'desc' },
        include: {
          pagos: {
            orderBy: { fechaPago: 'desc' },
            include: { cobrador: { select: { id: true, nombre: true } } },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  // Enriquecer préstamos con cálculos
  const clientes = clientesRaw.map((c) => ({
    ...c,
    ...(() => {
      const diasExcluidos = obtenerDiasSinCobro(c, c.ruta, org)
      const hoySinCobro = esHoySinCobro(diasExcluidos)
      return {
        hoySinCobro,
        prestamos: c.prestamos.map((p) => ({
          ...p,
          totalPagado: p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
          diasMora: calcularDiasMora(p, diasExcluidos),
          saldoPendiente: calcularSaldoPendiente(p),
          porcentajePagado: calcularPorcentajePagado(p),
          pagoHoy: pagoHoy(p),
          proximoCobro: calcularProximoCobro(p, diasExcluidos),
        })),
      }
    })(),
  }))

  // ── 2. Rutas (enriquecidas con metricas completas) ──
  const rutasRaw = await prisma.ruta.findMany({
    where: {
      organizationId: orgId,
      ...(rol === 'cobrador' && rutaId ? { id: rutaId } : {}),
    },
    include: {
      cobrador: { select: { id: true, nombre: true } },
      clientes: {
        where: { estado: { not: 'eliminado' } },
        select: { id: true, nombre: true, cedula: true, telefono: true, direccion: true, latitud: true, longitud: true, ordenRuta: true },
        orderBy: { ordenRuta: 'asc' },
      },
    },
  })

  const inicioHoy = hoyColombiaUTC()
  const finHoy = new Date(inicioHoy.getTime() + 86400000)

  // Index clientes enriquecidos por ID para lookup rapido
  const clientesById = new Map(clientes.map(c => [c.id, c]))

  // Batch query: todos los cierres de caja del dia
  const cierresHoy = await prisma.cierreCaja.findMany({
    where: { organizationId: orgId, fecha: { gte: inicioHoy, lt: finHoy } },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  const rutas = rutasRaw.map(r => {
    let esperadoHoy = 0, recaudadoHoy = 0, pendientesHoy = 0
    let enMora = 0, carteraTotal = 0, capitalTotal = 0

    const clientesEnriquecidos = r.clientes.map(rc => {
      const ce = clientesById.get(rc.id)
      if (!ce) return { ...rc, estado: 'activo', pagoHoy: false, diasMora: 0, cuota: 0, diasDesdeUltimoPago: null }

      const activos = ce.prestamos.filter(p => p.estado === 'activo')
      const cuota = activos.reduce((s, p) => s + (p.cuotaDiaria || 0), 0)
      const diasMora = activos.length > 0 ? Math.max(0, ...activos.map(p => p.diasMora || 0)) : 0
      const pagadoHoy = activos.some(p => p.pagoHoy)
      const estado = activos.length === 0 ? 'completado' : diasMora > 0 ? 'mora' : 'activo'
      const hoySinCobro = Boolean(ce.hoySinCobro)
      let proximoCobro = null
      let frecuencia = activos[0]?.frecuencia || 'diario'
      let cobroPendienteHoy = false

      for (const p of activos) {
        const pc = p.proximoCobro ? new Date(p.proximoCobro) : null
        if (pc && (!proximoCobro || pc < proximoCobro)) proximoCobro = pc
        frecuencia = p.frecuencia || frecuencia
        if ((p.saldoPendiente ?? 0) > 0 && (!pc || pc < finHoy)) {
          cobroPendienteHoy = true
        }
      }

      esperadoHoy += hoySinCobro ? 0 : cuota
      if (pagadoHoy) {
        recaudadoHoy += activos.reduce((s, p) => {
          return s + p.pagos
            .filter(pg => new Date(pg.fechaPago) >= inicioHoy && new Date(pg.fechaPago) < finHoy && !['recargo', 'descuento'].includes(pg.tipo))
            .reduce((a, pg) => a + pg.montoPagado, 0)
        }, 0)
      }
      const pendienteHoyCliente = !hoySinCobro && cobroPendienteHoy
      if (pendienteHoyCliente) pendientesHoy++
      if (diasMora > 0) enMora++
      carteraTotal += activos.reduce((s, p) => s + (p.saldoPendiente || 0), 0)
      capitalTotal += activos.reduce((s, p) => s + p.montoPrestado, 0)

      // Dias desde ultimo pago
      let diasDesdeUltimoPago = null
      for (const p of activos) {
        if (p.pagos && p.pagos.length > 0) {
          const fecha = new Date(p.pagos[0].fechaPago)
          fecha.setHours(0, 0, 0, 0)
          const dias = Math.floor((inicioHoy - fecha) / 86400000)
          if (diasDesdeUltimoPago === null || dias < diasDesdeUltimoPago) diasDesdeUltimoPago = dias
        }
      }

      let diasParaCobro = null
      if (proximoCobro) {
        diasParaCobro = Math.round((proximoCobro.getTime() - inicioHoy.getTime()) / 86400000)
      }

      return {
        ...rc,
        estado,
        pagoHoy: pagadoHoy,
        diasMora,
        cuota,
        diasDesdeUltimoPago,
        hoySinCobro,
        cobroPendienteHoy: pendienteHoyCliente,
        frecuencia,
        diasParaCobro,
        proximoCobroLabel: proximoCobro ? formatFechaCobro(proximoCobro) : null,
      }
    })

    const cierre = cierresHoy.find(c => c.cobradorId === r.cobradorId) || null

    return {
      id: r.id, nombre: r.nombre, cobrador: r.cobrador, cobradorId: r.cobradorId,
      clientes: clientesEnriquecidos,
      cantidadClientes: r.clientes.length,
      esperadoHoy: Math.round(esperadoHoy),
      recaudadoHoy: Math.round(recaudadoHoy),
      pendientesHoy, enMora,
      carteraTotal: Math.round(carteraTotal),
      capitalTotal: Math.round(capitalTotal),
      cierre,
    }
  })

  // ── 3. Dashboard resumen simple ──
  const prestamosActivos = clientes.flatMap(c => c.prestamos.filter(p => p.estado === 'activo'))
  const prestamosCompletados = clientes.flatMap(c => c.prestamos.filter(p => p.estado === 'completado'))
  const clientesActivos = clientes.filter(c => c.prestamos.some(p => p.estado === 'activo'))
  const clientesEnMora = clientesActivos.filter(c => c.prestamos.some(p => p.estado === 'activo' && p.diasMora > 0))

  const dashboard = {
    clientes: { total: clientesActivos.length, enMora: clientesEnMora.length },
    prestamos: {
      activos: prestamosActivos.length,
      completados: prestamosCompletados.length,
      carteraActiva: prestamosActivos.reduce((s, p) => s + (p.saldoPendiente || 0), 0),
      capitalPrestado: prestamosActivos.reduce((s, p) => s + p.montoPrestado, 0),
      cuotaDiariaTotal: prestamosActivos.reduce((s, p) => s + (p.cuotaDiaria || 0), 0),
    },
  }

  // ── 4. Datos de caja del dia (para offline) ──
  const recogidaCaja = prestamosActivos.reduce((s, p) => {
    return s + p.pagos
      .filter(pg => new Date(pg.fechaPago) >= inicioHoy && new Date(pg.fechaPago) < finHoy && !['recargo', 'descuento'].includes(pg.tipo))
      .reduce((a, pg) => a + pg.montoPagado, 0)
  }, 0)
  const esperadoCaja = rutas.reduce((s, r) => s + (r.esperadoHoy || 0), 0)

  const gastosMenores = await prisma.gastoMenor.findMany({
    where: { organizationId: orgId, fecha: { gte: inicioHoy, lt: finHoy }, estado: 'aprobado' },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })
  const totalGastos = gastosMenores.reduce((s, g) => s + g.monto, 0)

  let cobradoresCaja = []
  if (rol === 'owner') {
    const todosCobradores = await prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador', activo: true },
      select: { id: true, nombre: true },
    })
    const cierreIds = new Set(cierresHoy.map(c => c.cobradorId))
    cobradoresCaja = todosCobradores.map(c => ({
      id: c.id, nombre: c.nombre,
      cerrado: cierreIds.has(c.id),
      cierre: cierresHoy.find(ci => ci.cobradorId === c.id) || null,
    }))
  }

  const fechaHoyStr = inicioHoy.toISOString().slice(0, 10)
  const caja = {
    stats: { dia: {
      esperado: Math.round(esperadoCaja),
      recogida: Math.round(recogidaCaja),
      gastos: totalGastos,
      diferencia: Math.round(recogidaCaja - esperadoCaja),
      disponible: Math.round(recogidaCaja - totalGastos),
      tasaRecaudo: esperadoCaja > 0 ? Math.round((recogidaCaja / esperadoCaja) * 100) : 0,
    }},
    cierres: cierresHoy,
    cobradores: cobradoresCaja,
    gastos: gastosMenores,
    fechaDisplay: inicioHoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }),
    fecha: fechaHoyStr,
  }

  return Response.json({
    syncedAt: new Date().toISOString(),
    clientes,
    rutas,
    dashboard,
    caja,
    userId,
    rol,
  })
}
