// app/api/caja/ajustes/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

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
  const descripcion = (body?.descripcion || '').trim()

  if (!Number.isFinite(monto) || monto <= 0) {
    return Response.json({ error: 'El monto del ajuste debe ser mayor a 0' }, { status: 400 })
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      let capital = await tx.capital.findUnique({ where: { organizationId } })
      if (!capital) {
        capital = await tx.capital.create({
          data: { organizationId, saldo: 0 },
        })
      }

      const saldoAnterior = capital.saldo
      const saldoNuevo = direccion === 'ingreso'
        ? saldoAnterior + monto
        : saldoAnterior - monto

      if (direccion === 'egreso' && saldoNuevo < 0) {
        throw new Error('Saldo insuficiente para registrar este ajuste')
      }

      const movimiento = await tx.movimientoCapital.create({
        data: {
          capitalId: capital.id,
          organizationId,
          tipo: 'ajuste',
          monto,
          saldoAnterior,
          saldoNuevo,
          descripcion: descripcion || `Ajuste de caja manual (${direccion === 'ingreso' ? 'entrada' : 'salida'})`,
          referenciaTipo: 'caja_ajuste',
          creadoPorId: userId,
        },
      })

      const capitalActualizado = await tx.capital.update({
        where: { id: capital.id },
        data: { saldo: saldoNuevo },
      })

      return { movimiento, capital: capitalActualizado }
    })

    logActividad({
      session,
      accion: 'ajuste_caja_manual',
      entidadTipo: 'caja',
      entidadId: resultado.movimiento.id,
      detalle: `Ajuste de caja ${direccion === 'ingreso' ? 'entrada' : 'salida'} $${Math.round(monto).toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({
      ok: true,
      movimiento: {
        id: resultado.movimiento.id,
        monto: resultado.movimiento.monto,
        descripcion: resultado.movimiento.descripcion,
        createdAt: resultado.movimiento.createdAt,
        direccion,
      },
      saldo: resultado.capital.saldo,
    }, { status: 201 })
  } catch (err) {
    return Response.json({ error: err.message || 'No se pudo registrar el ajuste de caja' }, { status: 400 })
  }
}
