// app/api/capital/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

// GET — obtener saldo actual
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver el capital' }, { status: 403 })
  }

  const capital = await prisma.capital.findUnique({
    where: { organizationId: session.user.organizationId },
  })

  return Response.json({ capital })
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

  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    return Response.json({ error: 'Tipo de movimiento no válido' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  const montoNum = Number(monto)

  const resultado = await prisma.$transaction(async (tx) => {
    // Obtener o crear Capital
    let capital = await tx.capital.findUnique({ where: { organizationId } })
    if (!capital) {
      capital = await tx.capital.create({
        data: { organizationId, saldo: 0 },
      })
    }

    const esIngreso = ['capital_inicial', 'inyeccion'].includes(tipo)
    // Para ajuste: si monto es positivo suma, si tipo es ajuste puede ser negativo conceptualmente
    // Pero monto siempre es positivo; retiro y ajuste restan solo si es retiro
    const saldoAnterior = capital.saldo
    const saldoNuevo = esIngreso ? saldoAnterior + montoNum : saldoAnterior - montoNum

    if (tipo === 'retiro' && saldoNuevo < 0) {
      throw new Error('Saldo insuficiente para este retiro')
    }

    await tx.movimientoCapital.create({
      data: {
        capitalId: capital.id,
        organizationId,
        tipo,
        monto: montoNum,
        saldoAnterior,
        saldoNuevo,
        descripcion: descripcion?.trim() || null,
        creadoPorId: userId,
      },
    })

    const capitalActualizado = await tx.capital.update({
      where: { id: capital.id },
      data: { saldo: saldoNuevo },
    })

    return capitalActualizado
  })

  logActividad({ session, accion: 'movimiento_capital', entidadTipo: 'capital', entidadId: resultado.id, detalle: `${tipo} $${montoNum.toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({ capital: resultado }, { status: 201 })
}
