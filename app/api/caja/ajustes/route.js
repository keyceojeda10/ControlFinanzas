// app/api/caja/ajustes/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital } from '@/lib/capital'

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
        permitirNegativo: false,
      })
    })

    logActividad({
      session,
      accion: 'movimiento_caja_manual',
      entidadTipo: 'caja',
      entidadId: resultado.movimiento.id,
      detalle: `${tipoMovimiento} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${Math.round(monto).toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`,
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
      },
      saldo: resultado.capital.saldo,
    }, { status: 201 })
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo registrar el ajuste de caja' }, { status: 400 })
  }
}
