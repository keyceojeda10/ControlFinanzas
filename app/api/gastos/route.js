// app/api/gastos/route.js
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { getCachedMutation, setCachedMutation, buildMutationKey } from '@/lib/mutation-idempotency'
import { getUtcOffset, getLocalDateStr } from '@/lib/i18n'

const DAY_MS = 24 * 60 * 60 * 1000
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const getLocalDate = (country = 'co') => new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
const getLocalDateOnly = (country = 'co') => getLocalDateStr(country)
const diasAtrasDesdeHoy = (fechaHoy, fechaObjetivo, country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const offsetStr = `-${pad(absOffset)}:00`
  const hoy = new Date(fechaHoy + `T00:00:00${offsetStr}`)
  const objetivo = new Date(fechaObjetivo + `T00:00:00${offsetStr}`)
  return Math.floor((hoy - objetivo) / DAY_MS)
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId, rol, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  const fechaParam = searchParams.get('fecha')
  const estadoParam = searchParams.get('estado')
  const cobradorParam = searchParams.get('cobrador')

  const where = {
    organizationId,
    ...(rol === 'cobrador' && { cobradorId: userId }),
  }

  // Filtro estado (pendiente | aprobado | rechazado)
  if (estadoParam && ['pendiente', 'aprobado', 'rechazado'].includes(estadoParam)) {
    where.estado = estadoParam
  }

  // Filtro cobrador (solo owner)
  if (rol === 'owner' && cobradorParam) {
    where.cobradorId = cobradorParam
  }

  // Filtro fecha: default = hoy cuando no hay estado, si hay estado y no fecha → todas
  if (fechaParam && FECHA_REGEX.test(fechaParam)) {
    const fecha = new Date(fechaParam + 'T00:00:00')
    const fechaInicio = new Date(fecha)
    fechaInicio.setHours(5, 0, 0, 0)
    const fechaFin = new Date(fecha)
    fechaFin.setDate(fechaFin.getDate() + 1)
    fechaFin.setHours(4, 59, 59, 999)
    where.fecha = { gte: fechaInicio, lt: fechaFin }
  } else if (!estadoParam) {
    const hoy = getLocalDateOnly()
    const fecha = new Date(hoy + 'T00:00:00')
    const fechaInicio = new Date(fecha)
    fechaInicio.setHours(5, 0, 0, 0)
    const fechaFin = new Date(fecha)
    fechaFin.setDate(fechaFin.getDate() + 1)
    fechaFin.setHours(4, 59, 59, 999)
    where.fecha = { gte: fechaInicio, lt: fechaFin }
  }

  const gastos = await prisma.gastoMenor.findMany({
    where,
    include: { cobrador: { select: { id: true, nombre: true } } },
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

  const mutationId = req.headers.get('x-mutation-id')
  const idemKey = mutationId ? buildMutationKey(session, mutationId, 'gasto.create') : null
  if (idemKey) {
    const cached = getCachedMutation(idemKey)
    if (cached) return NextResponse.json(cached)
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
    : getLocalDateOnly()
  const hoyColombia = getLocalDateOnly()
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
  if (idemKey) setCachedMutation(idemKey, gasto)
  return NextResponse.json(gasto)
}
