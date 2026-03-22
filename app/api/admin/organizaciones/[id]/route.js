// app/api/admin/organizaciones/[id]/route.js — Detalle y gestión de organización
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado } from '@/lib/email'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      suscripciones: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, plan: true, estado: true,
          fechaInicio: true, fechaVencimiento: true, montoCOP: true,
        },
      },
      referidoPor: { select: { id: true, nombre: true } },
      referidos:   { select: { id: true, nombre: true, createdAt: true } },
      _count: {
        select: { clientes: true, prestamos: true },
      },
      adminLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { admin: { select: { nombre: true } } },
      },
    },
  })

  if (!org) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  // Cartera activa
  const cartera = await prisma.prestamo.aggregate({
    where: { organizationId: id, estado: 'activo' },
    _sum: { totalAPagar: true },
    _count: true,
  })

  return NextResponse.json({
    ...org,
    prestamosActivos: cartera._count,
    carteraActiva:    cartera._sum.totalAPagar ?? 0,
  })
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await req.json()
  const { accion, plan } = body // accion: suspender | activar | cambiarPlan

  const org = await prisma.organization.findUnique({ where: { id } })
  if (!org) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  if (accion === 'suspender') {
    await prisma.organization.update({ where: { id }, data: { activo: false } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'suspender',
        detalle:        `Organización "${org.nombre}" suspendida`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Organización suspendida' })
  }

  if (accion === 'activar') {
    await prisma.organization.update({ where: { id }, data: { activo: true } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'activar',
        detalle:        `Organización "${org.nombre}" reactivada`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Organización activada' })
  }

  const PLANES_VALIDOS = ['test', 'basic', 'standard', 'professional']
  if (accion === 'cambiarPlan' && plan) {
    if (!PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }
    const planAnterior = org.plan
    await prisma.organization.update({ where: { id }, data: { plan } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_plan',
        detalle:        `Plan cambiado de ${planAnterior} a ${plan}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Plan cambiado a ${plan}` })
  }

  if (accion === 'cambiarDescuento') {
    const descuento = parseInt(body.descuento)
    if (isNaN(descuento) || descuento < 0 || descuento > 100) {
      return NextResponse.json({ error: 'Descuento debe ser entre 0 y 100' }, { status: 400 })
    }
    await prisma.organization.update({ where: { id }, data: { descuento } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_descuento',
        detalle:        `Descuento cambiado a ${descuento}% para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Descuento actualizado a ${descuento}%` })
  }

  if (accion === 'toggleUsuario' && body.userId) {
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId: id },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const nuevoEstado = !user.activo
    await prisma.user.update({
      where: { id: body.userId },
      data: { activo: nuevoEstado },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         nuevoEstado ? 'activar_usuario' : 'desactivar_usuario',
        detalle:        `Usuario "${user.nombre}" (${user.email}) ${nuevoEstado ? 'activado' : 'desactivado'}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'}` })
  }

  if (accion === 'demoDay') {
    const dias = parseInt(body.dias) || 1
    if (dias < 1 || dias > 7) {
      return NextResponse.json({ error: 'Demo entre 1 y 7 días' }, { status: 400 })
    }
    const planDemo = body.planDemo || 'professional'
    if (!PLANES_VALIDOS.includes(planDemo)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }

    // Si ya tiene demo activa, no permitir otra
    if (org.planDemoHasta && new Date(org.planDemoHasta) > new Date()) {
      return NextResponse.json({ error: 'Ya tiene un demo activo' }, { status: 400 })
    }

    const hasta = new Date()
    hasta.setDate(hasta.getDate() + dias)

    await prisma.organization.update({
      where: { id },
      data: {
        planOriginal: org.planOriginal ?? org.plan, // no sobreescribir si ya tenía uno
        plan: planDemo,
        planDemoHasta: hasta,
      },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'demo_day',
        detalle:        `Demo ${planDemo} por ${dias} día(s) para "${org.nombre}" (plan original: ${org.plan}). Expira: ${hasta.toLocaleDateString('es-CO')}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Demo ${planDemo} activado por ${dias} día(s)` })
  }

  if (accion === 'revertirDemo') {
    if (!org.planOriginal) {
      return NextResponse.json({ error: 'No hay demo activo para revertir' }, { status: 400 })
    }
    const planDemo = org.plan
    await prisma.organization.update({
      where: { id },
      data: {
        plan: org.planOriginal,
        planOriginal: null,
        planDemoHasta: null,
      },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'revertir_demo',
        detalle:        `Demo revertido: ${planDemo} → ${org.planOriginal} para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Plan revertido a ${org.planOriginal}` })
  }

  // ─── Asignar plan (pago directo / transferencia bancaria) ───
  if (accion === 'asignarPlan') {
    const { plan: planNuevo, periodo, monto, extender } = body
    if (!planNuevo || !PLANES_VALIDOS.includes(planNuevo)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }
    const periodoValido = ['mensual', 'trimestral', 'anual'].includes(periodo) ? periodo : 'mensual'
    const diasExtension = periodoValido === 'anual' ? 365 : periodoValido === 'trimestral' ? 90 : 30
    const montoCOP = parseInt(monto) || 0

    const ahora = new Date()

    // Buscar suscripción existente
    const subExistente = await prisma.suscripcion.findFirst({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
    })

    let fechaVencimiento

    if (subExistente) {
      // Por defecto: empezar desde HOY (nuevo plan pagado)
      // Solo extender si el admin lo elige explícitamente Y es el mismo plan
      const debeExtender = extender === true
        && subExistente.estado === 'activa'
        && new Date(subExistente.fechaVencimiento) > ahora
        && subExistente.plan === planNuevo

      const baseDate = debeExtender ? new Date(subExistente.fechaVencimiento) : ahora
      fechaVencimiento = new Date(baseDate)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasExtension)

      await prisma.suscripcion.update({
        where: { id: subExistente.id },
        data: {
          plan:             planNuevo,
          estado:           'activa',
          fechaInicio:      debeExtender ? undefined : ahora,
          fechaVencimiento,
          mercadopagoId:    'pago_directo',
          montoCOP,
        },
      })
    } else {
      fechaVencimiento = new Date(ahora)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasExtension)

      await prisma.suscripcion.create({
        data: {
          organizationId:   id,
          plan:             planNuevo,
          estado:           'activa',
          fechaInicio:      ahora,
          fechaVencimiento,
          mercadopagoId:    'pago_directo',
          montoCOP,
        },
      })
    }

    // Actualizar plan de la organización y activarla
    await prisma.organization.update({
      where: { id },
      data: { plan: planNuevo, activo: true },
    })

    // Recompensa de referido (mismo flujo que webhook MP)
    if (org.referidoPorId) {
      const pagosAnteriores = await prisma.suscripcion.count({
        where: { organizationId: id },
      })
      if (pagosAnteriores <= 1) {
        const subReferidor = await prisma.suscripcion.findFirst({
          where: { organizationId: org.referidoPorId },
          orderBy: { createdAt: 'desc' },
        })
        if (subReferidor) {
          const baseRef = subReferidor.estado === 'activa' && new Date(subReferidor.fechaVencimiento) > ahora
            ? new Date(subReferidor.fechaVencimiento)
            : ahora
          const nuevaFechaRef = new Date(baseRef)
          nuevaFechaRef.setDate(nuevaFechaRef.getDate() + 30)
          await prisma.suscripcion.update({
            where: { id: subReferidor.id },
            data: { fechaVencimiento: nuevaFechaRef },
          })
        }
      }
    }

    // AdminLog
    const periodoLabel = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }[periodoValido]
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'pago_directo',
        detalle:        `Plan ${planNuevo} asignado (pago directo). Periodo: ${periodoLabel}. Monto: $${montoCOP.toLocaleString('es-CO')}. Vigente hasta: ${fechaVencimiento.toLocaleDateString('es-CO')}`,
      },
    })

    // Enviar email de confirmación al owner (igual que webhook MP)
    const owner = await prisma.user.findFirst({
      where: { organizationId: id, rol: 'owner' },
      select: { nombre: true, email: true },
    })
    if (owner) {
      const { subject, html } = emailPagoAprobado({
        nombre: owner.nombre,
        plan: planNuevo,
        monto: montoCOP,
        fechaVencimiento,
      })
      enviarEmail({ to: owner.email, subject, html }).catch(() => {})
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Plan ${planNuevo} (${periodoLabel}) asignado. Vigente hasta ${fechaVencimiento.toLocaleDateString('es-CO')}`,
    })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
