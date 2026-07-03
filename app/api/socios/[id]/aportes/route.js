import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede registrar aportes' }, { status: 403 })
    }
    const bloqueoSub = await bloquearSiSuscripcionVencida(session)
    if (bloqueoSub) return bloqueoSub

    const { id: socioId } = await params
    const body = await request.json()
    const { monto, fecha, nota, tipo: tipoParam } = body

    const tipo = tipoParam === 'retiro' ? 'retiro' : 'aporte'

    if (!monto || !Number.isFinite(Number(monto)) || Number(monto) <= 0) {
      return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
    }

    const organizationId = session.user.organizationId

    const socio = await prisma.socio.findFirst({
      where: { id: socioId, organizationId },
      include: { aportes: { select: { tipo: true, monto: true } } },
    })
    if (!socio) {
      return Response.json({ error: 'Socio no encontrado' }, { status: 404 })
    }

    const montoNum = Number(monto)

    if (tipo === 'retiro') {
      const totalAportes = socio.aportes.filter(a => a.tipo !== 'retiro').reduce((a, b) => a + b.monto, 0)
      const totalRetiros = socio.aportes.filter(a => a.tipo === 'retiro').reduce((a, b) => a + b.monto, 0)
      const balanceNeto = totalAportes - totalRetiros
      if (montoNum > balanceNeto) {
        return Response.json({
          error: `El retiro no puede superar el balance del socio: $${Math.round(balanceNeto).toLocaleString('es-CO')}`,
        }, { status: 400 })
      }
    }

    const aporte = await prisma.$transaction(async (tx) => {
      const registro = await tx.aporteSocio.create({
        data: {
          socioId,
          organizationId,
          tipo,
          monto: montoNum,
          fecha: fecha ? new Date(fecha) : new Date(),
          nota: nota?.trim() || null,
        },
      })

      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: tipo === 'aporte' ? 'inyeccion' : 'retiro',
        monto: montoNum,
        descripcion: tipo === 'aporte'
          ? `Aporte de socio: ${socio.nombre}`
          : `Retiro de socio: ${socio.nombre}`,
        referenciaId: registro.id,
        referenciaTipo: 'aporte_socio',
        creadoPorId: session.user.id,
      })

      return registro
    })

    const accion = tipo === 'aporte' ? 'registrar_aporte' : 'registrar_retiro_socio'
    const label = tipo === 'aporte' ? 'Aporte' : 'Retiro'
    logActividad({
      session,
      accion,
      entidadTipo: 'socio',
      entidadId: socioId,
      detalle: `${label} de $${Math.round(montoNum).toLocaleString('es-CO')} para ${socio.nombre}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json(aporte, { status: 201 })
  } catch (e) {
    if (e.message === 'CAPITAL_INSUFICIENTE') {
      return Response.json({ error: 'Capital insuficiente para este retiro' }, { status: 400 })
    }
    console.error('[POST /api/socios/[id]/aportes] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el owner puede eliminar aportes' }, { status: 403 })
    }

    const { id: socioId } = await params
    const { searchParams } = new URL(request.url)
    const aporteId = searchParams.get('aporteId')

    if (!aporteId) {
      return Response.json({ error: 'Falta aporteId' }, { status: 400 })
    }

    const organizationId = session.user.organizationId

    const aporte = await prisma.aporteSocio.findFirst({
      where: { id: aporteId, socioId, organizationId },
      include: { socio: { select: { nombre: true } } },
    })
    if (!aporte) {
      return Response.json({ error: 'Aporte no encontrado' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.aporteSocio.delete({ where: { id: aporteId } })

      // Reversar el movimiento de capital: si era aporte (inyeccion), ahora es retiro y viceversa
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        direccion: aporte.tipo === 'aporte' ? 'egreso' : 'ingreso',
        monto: aporte.monto,
        descripcion: `Reverso ${aporte.tipo} eliminado - socio: ${aporte.socio.nombre}`,
        referenciaId: aporteId,
        referenciaTipo: 'aporte_socio',
        creadoPorId: session.user.id,
      })
    })

    logActividad({
      session,
      accion: 'eliminar_aporte',
      entidadTipo: 'socio',
      entidadId: socioId,
      detalle: `${aporte.tipo === 'retiro' ? 'Retiro' : 'Aporte'} eliminado: $${Math.round(aporte.monto).toLocaleString('es-CO')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    return Response.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/socios/[id]/aportes] error:', e)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
