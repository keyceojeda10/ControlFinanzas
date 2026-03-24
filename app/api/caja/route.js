// app/api/caja/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5

const fmtFechaColombia = (d) => {
  // Si recibimos YYYY-MM-DD, agregar timezone Colombia para evitar que se interprete como UTC
  const fecha = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T12:00:00-05:00')
    : new Date(d)
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

// Convierte una fecha YYYY-MM-DD de Colombia a rango UTC
// Ej: "2026-03-04" -> { inicio: 2026-03-04T05:00:00Z, fin: 2026-03-05T04:59:59Z }
const getColombiaDayRange = (fechaColombia) => {
  const inicio = new Date(fechaColombia + 'T00:00:00-05:00')
  const fin    = new Date(fechaColombia + 'T23:59:59.999-05:00')
  return { inicio, fin }
}

// Obtiene la fecha de hoy en Colombia como YYYY-MM-DD
const getHoyColombia = () => {
  const ahora = new Date(Date.now() - COLOMBIA_OFFSET)
  return ahora.toISOString().slice(0, 10)
}


// Calcula el total esperado real desde los préstamos activos de las rutas
async function calcularEsperadoReal(organizationId, cobradorId = null) {
  const whereRuta = { organizationId, activo: true }
  if (cobradorId) whereRuta.cobradorId = cobradorId

  const rutas = await prisma.ruta.findMany({
    where: whereRuta,
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

  return rutas.reduce((total, ruta) =>
    total + ruta.clientes.reduce((a, c) =>
      a + c.prestamos.reduce((b, p) => b + p.cuotaDiaria, 0), 0), 0)
}

// Calcula estadísticas del día
async function getStatsDia(organizationId, fecha, cobradorId = null) {
  // Convertir fecha Colombia a UTC
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10)
  const { inicio, fin } = getColombiaDayRange(fechaStr)

  // Obtener pagos del día usando rango UTC correcto
  const wherePagos = {
    prestamo: { organizationId },
    fechaPago: { gte: inicio, lt: fin },
  }
  if (cobradorId) {
    wherePagos.cobradorId = cobradorId
  }

  const pagosDia = await prisma.pago.findMany({
    where: { ...wherePagos, tipo: { notIn: ['recargo', 'descuento'] } },
    select: { montoPagado: true }
  })

  const recogida = pagosDia.reduce((a, p) => a + p.montoPagado, 0)

  // Calcular esperado real desde las cuotas diarias de préstamos activos
  const esperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId))

  // Obtener gastos del día
  const whereGastosDia = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    estado: 'aprobado',
  }
  if (cobradorId) whereGastosDia.cobradorId = cobradorId

  const gastosDia = await prisma.gastoMenor.aggregate({
    where: whereGastosDia,
    _sum: { monto: true },
  })

  const gastos = gastosDia._sum?.monto || 0
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
  const fechaBase = fechaParam || getHoyColombia()

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

  // Para owner: obtener lista de cobradores con estado de cierre
  let cobradores = []
  if (rol === 'owner') {
    const todosCobradores = await prisma.user.findMany({
      where: { organizationId, rol: 'cobrador', activo: true },
      select: { id: true, nombre: true },
    })

    const cierreIds = new Set(cierres.map(c => c.cobradorId))
    cobradores = todosCobradores.map(c => ({
      id: c.id,
      nombre: c.nombre,
      cerrado: cierreIds.has(c.id),
      cierre: cierres.find(ci => ci.cobradorId === c.id) || null,
    }))
  }

  return Response.json({
    cierres,
    gastos,
    cobradores,
    stats: {
      dia: statsDia,
    },
    fechaDisplay: fmtFechaColombia(fechaBase),
    fecha: typeof fechaBase === 'string' ? fechaBase : new Date(fechaBase).toISOString().slice(0, 10)
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
  const fechaColombia = getHoyColombia()
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

  // Verificar que el cobrador tiene ruta asignada
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

  if (!ruta) {
    return Response.json({ error: 'No tienes una ruta asignada. Contacta al administrador.' }, { status: 400 })
  }

  const totalEsperado = ruta.clientes.reduce((total, c) =>
    total + c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0), 0)

  // Obtener gastos del día
  const gastosDia = await prisma.gastoMenor.aggregate({
    where: {
      organizationId,
      cobradorId,
      fecha: { gte: inicio, lt: fin },
      estado: 'aprobado',
    },
    _sum: { monto: true },
  })

  const totalGastos = gastosDia._sum?.monto || 0
  const diferencia = totalRecogido - totalEsperado

  const cierre = await prisma.cierreCaja.create({
    data: {
      organizationId,
      cobradorId,
      fecha: new Date(fechaColombia + 'T00:00:00-05:00'),
      totalEsperado: Math.round(totalEsperado),
      totalRecogido: Math.round(totalRecogido),
      totalGastos: Math.round(totalGastos),
      diferencia: Math.round(diferencia),
    },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })

  return Response.json(cierre, { status: 201 })
}
