// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5

const fmtFechaColombia = (d) => {
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

// Convierte una fecha YYYY-MM-DD de Colombia a rango UTC
// Ej: "2026-03-04" -> { inicio: 2026-03-04T05:00:00Z, fin: 2026-03-05T04:59:59Z }
const getColombiaDayRange = (fechaColombia) => {
  const fecha = new Date(fechaColombia + 'T00:00:00-05:00')
  const inicioUTC = new Date(fecha.getTime() + COLOMBIA_OFFSET)
  const finUTC = new Date(inicioUTC.getTime() + 24 * 60 * 60 * 1000 - 1)
  return { inicio: inicioUTC, fin: finUTC }
}

// Obtiene el rango de hoy en Colombia (en UTC)
const getTodayColombiaRange = () => {
  const ahora = new Date(Date.now() + COLOMBIA_OFFSET)
  const fechaColombia = ahora.toISOString().slice(0, 10)
  return getColombiaDayRange(fechaColombia)
}

const inicioDia = (fecha) => {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  return d
}

const finDia = (fecha) => {
  const d = new Date(fecha)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

// Calcula estadísticas de cartera de la organización
async function getStatsCartera(organizationId) {
  const prestamos = await prisma.prestamo.findMany({
    where: { 
      cliente: { organizationId },
      estado: 'activo'
    },
    select: {
      montoPrestado: true,
      totalAPagar: true,
      pagos: {
        select: { montoPagado: true }
      }
    }
  })

  const capitalPrestado = prestamos.reduce((a, p) => a + p.montoPrestado, 0)
  const capitalRecuperado = prestamos.reduce((a, p) => {
    return a + p.pagos.reduce((sum, pago) => sum + pago.montoPagado, 0)
  }, 0)
  
  const porcentajeRecuperacion = capitalPrestado > 0 
    ? Math.round((capitalRecuperado / capitalPrestado) * 100) 
    : 0

  return {
    capitalPrestado,
    capitalRecuperado,
    porcentajeRecuperacion
  }
}

// Calcula estadísticas del día
async function getStatsDia(organizationId, fecha, cobradorId = null) {
  // Convertir fecha Colombia a UTC
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10)
  const { inicio, fin } = getColombiaDayRange(fechaStr)

  const whereCierres = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
  }
  if (cobradorId) {
    whereCierres.cobradorId = cobradorId
  }

  const cierres = await prisma.cierreCaja.findMany({
    where: whereCierres,
    select: {
      totalEsperado: true,
      totalRecogido: true,
      totalGastos: true,
      diferencia: true
    }
  })

  // Obtener pagos del día usando rango UTC correcto
  const wherePagos = {
    prestamo: { organizationId },
    fechaPago: { gte: inicio, lt: fin },
  }
  if (cobradorId) {
    wherePagos.cobradorId = cobradorId
  }
  
  const pagosDia = await prisma.pago.findMany({
    where: wherePagos,
    select: { montoPagado: true }
  })
  
  const pagosDirectos = pagosDia.reduce((a, p) => a + p.montoPagado, 0)

  const esperado = cierres.reduce((a, c) => a + c.totalEsperado, 0)
  const recogida = cierres.reduce((a, c) => a + c.totalRecogido, 0) + pagosDirectos
  const gastos = cierres.reduce((a, c) => a + (c.totalGastos || 0), 0)
  const diferencia = recogida - esperado
  const disponible = recogida - gastos

  // Calcular tasa de recaudo
  const tasaRecaudo = esperado > 0 ? Math.round((recogida / esperado) * 100) : 0

  return {
    esperado,
    recogida,
    gastos,
    diferencia,
    disponible,
    tasaRecaudo,
    pagosDirectos
  }
}

// ─── GET /api/caja ──────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  
  const fechaParam = searchParams.get('fecha')
  const cobradorParam = searchParams.get('cobradorId')

  // Usar fecha de Colombia (hoy por defecto)
  const fechaBase = fechaParam 
    ? fechaParam 
    : new Date(Date.now() + COLOMBIA_OFFSET).toISOString().slice(0, 10)

  const { inicio, fin } = getColombiaDayRange(fechaBase)

  const whereCierres = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
    ...(rol === 'owner' && cobradorParam && { cobradorId: cobradorParam }),
  }

  // Obtener cierres del día
  const cierres = await prisma.cierreCaja.findMany({
    where: whereCierres,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Obtener stats del día
  const statsDia = await getStatsDia(organizationId, fechaBase, rol === 'cobrador' ? userId : null)
  
  // Obtener stats de cartera (solo para owner)
  const statsCartera = rol === 'owner' 
    ? await getStatsCartera(organizationId)
    : { capitalPrestado: 0, capitalRecuperado: 0, porcentajeRecuperacion: 0 }

  // Obtener gastos del día para mostrar en lista
  const whereGastos = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
  }
  if (rol === 'cobrador') {
    whereGastos.cobradorId = userId
  }

  const gastos = await prisma.gastoMenor.findMany({
    where: whereGastos,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  })

  return Response.json({
    cierres,
    gastos,
    stats: {
      dia: statsDia,
      cartera: statsCartera
    },
    fechaDisplay: fmtFechaColombia(fechaBase),
    fecha: new Date(fechaBase.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  })
}

// ─── POST /api/caja ─────────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const body = await request.json()

  const cobradorId = rol === 'owner' ? (body.cobradorId ?? userId) : userId

  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  // Usar fecha de Colombia hoy
  const fechaColombia = new Date(Date.now() + COLOMBIA_OFFSET).toISOString().slice(0, 10)
  const { inicio, fin } = getColombiaDayRange(fechaColombia)

  const existeCierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicio, lt: fin },
    },
  })
  if (existeCierre) {
    return Response.json({ error: 'Ya existe un cierre de caja para hoy' }, { status: 409 })
  }

  const totalRecogido = Number(body.totalRecogido ?? 0)
  if (totalRecogido < 0) {
    return Response.json({ error: 'El total recogido no puede ser negativo' }, { status: 400 })
  }

  // Calcular esperado
  const ruta = await prisma.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    select: {
      clientes: {
        select: {
          prestamos: {
            where: { estado: 'activo' },
            select: { cuotaDiaria: true },
          },
        },
      },
    },
  })

  const totalEsperado = ruta 
    ? ruta.clientes.reduce((total, c) => 
        total + c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0), 0)
    : 0

  // Obtener gastos del día
  const gastosDia = await prisma.gastoMenor.aggregate({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicio, lt: fin },
    },
    _sum: { monto: true },
  })

  const totalGastos = gastosDia._sum?.monto || 0
  const diferencia = totalRecogido - totalEsperado

  const cierre = await prisma.cierreCaja.create({
    data: {
      organizationId,
      cobradorId,
      fecha: fechaBase,
      totalEsperado: Math.round(totalEsperado),
      totalRecogido: Math.round(totalRecogido),
      totalGastos: Math.round(totalGastos),
      diferencia: Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(cierre, { status: 201 })
}
