// app/api/caja/ajustes/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital } from '@/lib/capital'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

const getHoyColombia = () => {
  const ahora = new Date(Date.now() - COLOMBIA_OFFSET)
  return ahora.toISOString().slice(0, 10)
}

const getFechaOperacionColombia = (fechaColombia) => {
  // Se fija a mediodía local para evitar desfaces de zona horaria al persistir.
  return new Date(`${fechaColombia}T12:00:00-05:00`)
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede registrar ajustes de caja' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const body = await request.json()
  const monto = Number(body?.monto)
  const direccion = body?.direccion === 'egreso' ? 'egreso' : 'ingreso'
  const movimientoSolicitado = typeof body?.movimiento === 'string' ? body.movimiento : null
  const descripcion = (body?.descripcion || '').trim()
  const fechaSolicitada = typeof body?.fecha === 'string' && FECHA_REGEX.test(body.fecha)
    ? body.fecha
    : getHoyColombia()

  if (fechaSolicitada > getHoyColombia()) {
    return Response.json({ error: 'No se pueden registrar movimientos en fechas futuras' }, { status: 400 })
  }

  const createdAtOperacion = getFechaOperacionColombia(fechaSolicitada)

  const tipoMovimiento = ['inyeccion', 'retiro', 'ajuste'].includes(movimientoSolicitado)
    ? movimientoSolicitado
    : (direccion === 'ingreso' ? 'inyeccion' : 'retiro')

  if (!Number.isFinite(monto) || monto <= 0) {
    return Response.json({ error: 'El monto del ajuste debe ser mayor a 0' }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const descripcionPorDefecto = tipoMovimiento === 'inyeccion'
        ? 'Inyección manual desde caja'
        : tipoMovimiento === 'retiro'
          ? 'Retiro manual desde caja'
          : `Ajuste de caja manual (${direccion === 'ingreso' ? 'entrada' : 'salida'})`

      return registrarMovimientoManualCapital(tx, {
        organizationId,
        tipo: tipoMovimiento,
        monto,
        direccion: tipoMovimiento === 'ajuste' ? direccion : undefined,
        descripcion: descripcion || descripcionPorDefecto,
        referenciaTipo: tipoMovimiento === 'ajuste' ? 'caja_ajuste' : 'caja_capital_manual',
        creadoPorId: userId,
        createdAt: createdAtOperacion,
        permitirNegativo: false,
      })
    })

    logActividad({
      session,
      accion: 'movimiento_caja_manual',
      entidadTipo: 'caja',
      entidadId: resultado.movimiento.id,
      detalle: `${tipoMovimiento} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${Math.round(monto).toLocaleString('es-CO')} (${fechaSolicitada})${descripcion ? ` - ${descripcion}` : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ok: true,
      movimiento: {
        id: resultado.movimiento.id,
        tipo: resultado.movimiento.tipo,
        monto: resultado.movimiento.monto,
        descripcion: resultado.movimiento.descripcion,
        createdAt: resultado.movimiento.createdAt,
        direccion: resultado.direccion,
        fecha: fechaSolicitada,
      },
      saldo: resultado.capital.saldo,
    }, { status: 201 })
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo registrar el ajuste de caja' }, { status: 400 })
  }
}
