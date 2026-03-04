// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const getColombiaDateOnly = () => {
  const d = getColombiaDate()
  return d.toISOString().slice(0, 10)
}
const inicioHoy    = () => { const d = getColombiaDate(); d.setHours(0,0,0,0); return d }
const inicioManana = () => { const d = getColombiaDate(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// Calcula el total esperado del día para un cobrador
async function calcularEsperado(organizationId, cobradorId) {
  const ruta = await prisma.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    select: {
      clientes: {
        select: {
          prestamos: {
            where:  { estado: 'activo' },
            select: { cuotaDiaria: true },
          },
        },
      },
    },
  })

  if (!ruta) return 0
  return ruta.clientes.reduce(
    (total, c) => total + c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0), 0
  )
}

// ─── GET /api/caja ──────────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  const fechaParam    = searchParams.get('fecha') || getColombiaDateOnly()
  const cobradorParam = searchParams.get('cobradorId')

  // Convertir fechaParam a fechas UTC para Colombia
  const fecha = new Date(fechaParam + 'T00:00:00')
  const fechaInicio = new Date(fecha)
  fechaInicio.setHours(5, 0, 0, 0) // Colombia midnight = UTC 5:00
  const fechaFin = new Date(fecha)
  fechaFin.setDate(fechaFin.getDate() + 1)
  fechaFin.setHours(4, 59, 59, 999) // Colombia 23:59:59 = UTC 4:59:59

  // 1. Obtener cierres del día
  const where = {
    organizationId,
    fecha: { gte: fechaInicio, lt: fechaFin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
    ...(rol === 'owner' && cobradorParam && { cobradorId: cobradorParam }),
  }

  const cierres = await prisma.cierreCaja.findMany({
    where,
    include: {
      cobrador: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 2. Obtener gastos del día
  const whereGastos = {
    organizationId,
    fecha: { gte: fechaInicio, lt: fechaFin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
  }

  const gastos = await prisma.gastoMenor.findMany({
    where: whereGastos,
  })

  const totalGastosDia = gastos.reduce((a, g) => a + g.monto, 0)

  // 3. Obtener pagos del día para estadísticas
  const pagosDia = await prisma.pago.aggregate({
    where: {
      organizationId,
      fechaPago: { gte: fechaInicio, lt: fechaFin },
    },
    _sum: { montoPagado: true },
    _count: true,
  })

  const ingresadosHoy = pagosDia._sum?.montoPagado || 0
  const cantidadPagosHoy = pagosDia._count || 0

  // 4. Obtener estadísticas de cartera (totales)
  const prestamosActivos = await prisma.prestamo.aggregate({
    where: { organizationId, estado: 'activo' },
    _sum: { montoPrestado: true, totalAPagar: true },
  })

  const capitalPrestado = prestamosActivos._sum?.montoPrestado || 0

  const capitalRecuperadoHistorico = await prisma.pago.aggregate({
    where: { organizationId },
    _sum: { montoPagado: true },
  })

  const recuperadoHistorico = capitalRecuperadoHistorico._sum?.montoPagado || 0

  // Calcular porcentaje de recuperación
  const porcentajeRecuperacion = capitalPrestado > 0 
    ? Math.round((recuperadoHistorico / capitalPrestado) * 100) 
    : 0

  // Calcular totales del día
  const totalEsperadoDia = cierres.reduce((a, c) => a + c.totalEsperado, 0)
  const totalRecogidoDia = cierres.reduce((a, c) => a + c.totalRecogido, 0)
  const diferenciaDia = totalRecogidoDia - totalEsperadoDia
  
  // Disponible = Recaudado - Gastos
  const disponible = totalRecogidoDia - totalGastosDia

  return Response.json({
    cierres,
    fecha: fechaParam,
    stats: {
      dia: {
        esperado: totalEsperadoDia,
        recogida: totalRecogidoDia,
        gastos: totalGastosDia,
        diferencia: diferenciaDia,
        disponible,
        ingresados: ingresadosHoy,
        cantidadPagos: cantidadPagosHoy,
      },
      cartera: {
        capitalPrestado,
        capitalRecuperado: recuperadoHistorico,
        porcentajeRecuperacion,
      },
    },
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

  // Owner puede registrar cierre para cualquier cobrador; cobrador para sí mismo
  const cobradorId = rol === 'owner' ? (body.cobradorId ?? userId) : userId

  // Verificar que el cobrador pertenece a la organización
  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  // Obtener la fecha del cierre (hoy)
  const fechaCierre = getColombiaDate()
  const fechaInicio = new Date(fechaCierre)
  fechaInicio.setHours(5, 0, 0, 0)
  const fechaFin = new Date(fechaCierre)
  fechaFin.setDate(fechaFin.getDate() + 1)
  fechaFin.setHours(4, 59, 59, 999)

  // Solo un cierre por cobrador por día
  const existeCierre = await prisma.cierreCaja.findFirst({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: fechaInicio, lt: fechaFin },
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
  const totalEsperado = await calcularEsperado(organizationId, cobradorId)

  // Obtener gastos del día para este cobrador
  const gastosDia = await prisma.gastoMenor.aggregate({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: fechaInicio, lt: fechaFin },
    },
    _sum: { montoPagado: true },
  })

  const totalGastos = gastosDia._sum?.montoPagado || 0
  const diferencia = totalRecogido - totalEsperado

  const cierre = await prisma.cierreCaja.create({
    data: {
      organizationId,
      cobradorId,
      fecha: fechaCierre,
      totalEsperado: Math.round(totalEsperado),
      totalRecogido: Math.round(totalRecogido),
      totalGastos: Math.round(totalGastos),
      diferencia: Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(cierre, { status: 201 })
}
