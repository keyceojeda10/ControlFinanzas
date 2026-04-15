// app/api/gastos/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

// Funciones de fecha en timezone Colombia (UTC-5)
const DAY_MS = 24 * 60 * 60 * 1000
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const getColombiaDateOnly = () => {
  const d = getColombiaDate()
  return d.toISOString().slice(0, 10)
}
const diasAtrasDesdeHoy = (fechaHoy, fechaObjetivo) => {
  const hoy = new Date(fechaHoy + 'T00:00:00-05:00')
  const objetivo = new Date(fechaObjetivo + 'T00:00:00-05:00')
  return Math.floor((hoy - objetivo) / DAY_MS)
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  const fechaParam = searchParams.get('fecha') || getColombiaDateOnly()

  // Convertir fechaParam a fechas UTC para Colombia
  const fecha = new Date(fechaParam + 'T00:00:00')
  const fechaInicio = new Date(fecha)
  fechaInicio.setHours(5, 0, 0, 0) // Colombia midnight = UTC 5:00
  const fechaFin = new Date(fecha)
  fechaFin.setDate(fechaFin.getDate() + 1)
  fechaFin.setHours(4, 59, 59, 999) // Colombia 23:59:59 = UTC 4:59:59

  const where = {
    organizationId,
    fecha: { gte: fechaInicio, lt: fechaFin },
    ...(rol === 'cobrador' && { cobradorId: userId }),
  }

  const gastos = await prisma.gastoMenor.findMany({
    where,
    include: { cobrador: { select: { nombre: true } } },
    orderBy: { fecha: 'desc' },
  })

  const resultado = gastos.map((g) => ({
    id: g.id,
    description: g.description,
    monto: g.monto,
    fecha: g.fecha,
    estado: g.estado,
    cobradorId: g.cobradorId,
    cobradorNombre: g.cobrador?.nombre,
  }))

  return NextResponse.json(resultado)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'cobrador' && session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'No tienes permisos para reportar gastos' }, { status: 403 })
  }

  if (session.user.rol === 'cobrador') {
    const cobrador = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { puedeReportarGastos: true },
    })
    const puedeReportarGastos = cobrador?.puedeReportarGastos ?? true
    if (!puedeReportarGastos) {
      return NextResponse.json({ error: 'No tienes permiso para reportar gastos menores' }, { status: 403 })
    }
  }

  const body = await req.json()
  const { description, monto, fecha } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  if (fecha != null && (typeof fecha !== 'string' || !FECHA_REGEX.test(fecha))) {
    return NextResponse.json({ error: 'La fecha debe tener formato YYYY-MM-DD' }, { status: 400 })
  }

  const fechaSolicitada = typeof fecha === 'string' && FECHA_REGEX.test(fecha)
    ? fecha
    : getColombiaDateOnly()
  const hoyColombia = getColombiaDateOnly()
  const diasAtras = diasAtrasDesdeHoy(hoyColombia, fechaSolicitada)

  if (diasAtras < 0) {
    return NextResponse.json({ error: 'No puedes reportar gastos en fechas futuras' }, { status: 400 })
  }
  if (session.user.rol === 'cobrador' && diasAtras > 1) {
    return NextResponse.json({ error: 'Solo puedes reportar gastos de hoy o ayer' }, { status: 403 })
  }

  const gasto = await prisma.gastoMenor.create({
    data: {
      description: description.trim(),
      monto: Number(monto),
      fecha: new Date(fechaSolicitada + 'T12:00:00-05:00'),
      cobradorId: session.user.rol === 'cobrador' ? session.user.id : null,
      organizationId: session.user.organizationId,
    },
  })

  logActividad({ session, accion: 'registrar_gasto', entidadTipo: 'gasto', entidadId: gasto.id, detalle: `Gasto $${gasto.monto.toLocaleString('es-CO')} - ${gasto.description}`, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return NextResponse.json(gasto)
}
