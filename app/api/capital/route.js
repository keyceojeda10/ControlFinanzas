// app/api/capital/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital } from '@/lib/capital'

// GET — obtener saldo actual y config (capitalEstricto)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver el capital' }, { status: 403 })
  }

  const [capital, org] = await Promise.all([
    prisma.capital.findUnique({
      where: { organizationId: session.user.organizationId },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { capitalEstricto: true },
    }),
  ])

  return Response.json({
    capital,
    config: { capitalEstricto: !!org?.capitalEstricto },
  })
}

// PATCH — actualizar configuración del capital (toggle modo estricto)
export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede cambiar la configuración' }, { status: 403 })
  }

  const body = await request.json()
  const { capitalEstricto } = body
  if (typeof capitalEstricto !== 'boolean') {
    return Response.json({ error: 'capitalEstricto debe ser booleano' }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { capitalEstricto },
    select: { capitalEstricto: true },
  })

  logActividad({
    session,
    accion: 'configurar_capital',
    entidadTipo: 'capital',
    detalle: `Modo capital estricto ${capitalEstricto ? 'activado' : 'desactivado'}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ config: { capitalEstricto: org.capitalEstricto } })
}

// POST — registrar movimiento manual (capital_inicial, inyeccion, retiro, ajuste)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede gestionar el capital' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const body = await request.json()
  const { tipo, monto, descripcion } = body
  const direccion = body?.direccion === 'ingreso' ? 'ingreso' : 'egreso'

  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    return Response.json({ error: 'Tipo de movimiento no válido' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  const montoNum = Number(monto)

  const resultado = await prisma.$transaction(async (tx) => {
    return registrarMovimientoManualCapital(tx, {
      organizationId,
      tipo,
      monto: montoNum,
      descripcion,
      creadoPorId: userId,
      direccion: tipo === 'ajuste' ? direccion : undefined,
      permitirNegativo: false,
    })
  })

  logActividad({
    session,
    accion: 'movimiento_capital',
    entidadTipo: 'capital',
    entidadId: resultado.movimiento.id,
    detalle: `${tipo} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${montoNum.toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({
    capital: resultado.capital,
    movimiento: resultado.movimiento,
    direccion: resultado.direccion,
  }, { status: 201 })
}
