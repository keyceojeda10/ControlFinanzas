// app/api/admin/organizaciones/[id]/route.js — Detalle y gestión de organización
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt               from 'bcryptjs'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado } from '@/lib/email'
import { PLANES_VALIDOS } from '@/lib/planes'
import { registrarPagoSuscripcion } from '@/lib/libro-pagos'

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
        select: { id: true, nombre: true, email: true, rol: true, activo: true, emailVerificado: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      suscripciones: {
        // Excluir pending (pagos MP iniciados pero nunca completados)
        where: {
          OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
        },
        // Ordenar por fechaVencimiento desc para mostrar la suscripcion
        // efectiva (la mas vigente), no la mas reciente por createdAt.
        orderBy: { fechaVencimiento: 'desc' },
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

  // PLANES_VALIDOS importado de @/lib/planes
  if (accion === 'cambiarPlan' && plan) {
    if (!PLANES_VALIDOS.includes(plan)) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }
    const planAnterior = org.plan

    // Cambiar plan en la organización
    await prisma.organization.update({ where: { id }, data: { plan } })

    // También actualizar el plan en la suscripción activa (mantiene mismas fechas)
    const subActiva = await prisma.suscripcion.findFirst({
      where: { organizationId: id, estado: 'activa' },
      orderBy: { createdAt: 'desc' },
    })
    if (subActiva) {
      await prisma.suscripcion.update({
        where: { id: subActiva.id },
        data: { plan },
      })
    }

    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_plan',
        detalle:        `Plan cambiado de ${planAnterior} a ${plan} (mismas fechas de suscripción)`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Plan cambiado de ${planAnterior} a ${plan}` })
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

  if (accion === 'cambiarCobradores') {
    const cantidad = parseInt(body.cobradoresExtra)
    if (isNaN(cantidad) || cantidad < 0 || cantidad > 50) {
      return NextResponse.json({ error: 'Cantidad debe ser entre 0 y 50' }, { status: 400 })
    }
    const anterior = org.cobradoresExtra ?? 0
    await prisma.organization.update({ where: { id }, data: { cobradoresExtra: cantidad } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_cobradores',
        detalle:        `Cobradores extra: ${anterior} → ${cantidad} para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Cobradores extra actualizados a ${cantidad}` })
  }

  /* Cupo de clientes por encima del plan.
   *
   * El caso que lo pidió: dos cuentas del plan Inicial estaban en 113 y 109
   * clientes con un tope de 100, así que no podían registrar ni uno más. Subir
   * de plan no siempre es la respuesta —a veces se les prometió más de lo que
   * su plan da— y hasta ahora había que tocar la base a mano.
   *
   * El tope de 5.000 no es capricho: por encima de eso lo que toca es cambiar
   * de plan, no seguir sumando cupo suelto.
   */
  if (accion === 'cambiarClientes') {
    const cantidad = parseInt(body.clientesExtra)
    if (isNaN(cantidad) || cantidad < 0 || cantidad > 5000) {
      return NextResponse.json({ error: 'Cantidad debe ser entre 0 y 5000' }, { status: 400 })
    }
    const anterior = org.clientesExtra ?? 0
    await prisma.organization.update({ where: { id }, data: { clientesExtra: cantidad } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_clientes',
        detalle:        `Clientes extra: ${anterior} → ${cantidad} para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Clientes extra actualizados a ${cantidad}` })
  }

  if (accion === 'resetearPassword' && body.userId) {
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId: id },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const nuevaPassword = String(body.nuevaPassword || '').trim()
    if (nuevaPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const hash = await bcrypt.hash(nuevaPassword, 10)
    await prisma.user.update({
      where: { id: body.userId },
      data: { password: hash },
    })

    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'resetear_password',
        detalle:        `Contraseña restablecida para "${user.nombre}" (${user.email})`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Contraseña restablecida' })
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

    // Buscar suscripción existente (ignorar pending de MP nunca completadas)
    const subExistente = await prisma.suscripcion.findFirst({
      where: {
        organizationId: id,
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      orderBy: { fechaVencimiento: 'desc' },
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

      /* El apunte del libro va en la MISMA transacción que la suscripción: si
         se da el servicio, la plata queda registrada, y si no, ninguna de las
         dos cosas pasa. Este era el camino por el que entraron 82 de los 93
         pagos y era el que menos rastro dejaba. Ver lib/libro-pagos.js. */
      await prisma.$transaction(async (tx) => {
        await tx.suscripcion.update({
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
        await registrarPagoSuscripcion(tx, {
          organizationId: id,
          plan:    planNuevo,
          montoCOP,
          periodo: periodoValido,
          gateway: 'manual',
          adminId: session.user.id,
        })
      })
    } else {
      fechaVencimiento = new Date(ahora)
      fechaVencimiento.setDate(fechaVencimiento.getDate() + diasExtension)

      await prisma.$transaction(async (tx) => {
        await tx.suscripcion.create({
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
        await registrarPagoSuscripcion(tx, {
          organizationId: id,
          plan:    planNuevo,
          montoCOP,
          periodo: periodoValido,
          gateway: 'manual',
          adminId: session.user.id,
        })
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
          where: {
            organizationId: org.referidoPorId,
            OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
          },
          orderBy: { fechaVencimiento: 'desc' },
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
        detalle:        `Plan ${planNuevo} asignado (pago directo). Período: ${periodoLabel}. Monto: $${montoCOP.toLocaleString('es-CO')}. Vigente hasta: ${fechaVencimiento.toLocaleDateString('es-CO')}`,
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
      enviarEmail({ to: owner.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Plan ${planNuevo} (${periodoLabel}) asignado. Vigente hasta ${fechaVencimiento.toLocaleDateString('es-CO')}`,
    })
  }

  if (accion === 'verificarEmail' && body.userId) {
    const user = await prisma.user.findFirst({
      where: { id: body.userId, organizationId: id },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const nuevoEstado = !user.emailVerificado
    await prisma.user.update({
      where: { id: body.userId },
      data: {
        emailVerificado: nuevoEstado,
        tokenVerificacion: null,
        tokenExpira: null,
      },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         nuevoEstado ? 'verificar_email' : 'desverificar_email',
        detalle:        `Email de "${user.nombre}" (${user.email}) ${nuevoEstado ? 'verificado' : 'marcado como no verificado'}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Email ${nuevoEstado ? 'verificado' : 'desverificado'}` })
  }

  /* ══ LO QUE EL PANEL NO PODÍA HACER ══════════════════════════════════════
   *
   * «Yo puedo agregar días, pero no puedo quitar días. Si yo quiero quitarle un
   *  día a alguien, no le puedo restar un día. No puedo ubicarle una fecha
   *  específica o establecerle una fecha con un calendario.» — 14 ago 2026.
   *
   * Y era literal: `suscripciones/[id]` validaba `dias < 1 → error`, así que la
   * única dirección posible era hacia adelante. Medido: en cinco meses la
   * extensión se usó UNA vez, y no porque no hiciera falta.
   */
  if (accion === 'ajustarVencimiento') {
    const sub = await prisma.suscripcion.findFirst({
      where: { organizationId: id, OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
      orderBy: { fechaVencimiento: 'desc' },
    })
    if (!sub) return NextResponse.json({ error: 'Este negocio no tiene suscripción' }, { status: 404 })

    const ahora = new Date()
    let nueva

    if (body.fecha) {
      // Fecha exacta, del calendario. Se ancla a las 05:00Z, el convenio de
      // fechas de toda la app (ver lib/dinero/calendario.js).
      const d = new Date(`${String(body.fecha).slice(0, 10)}T05:00:00.000Z`)
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
      nueva = d
    } else {
      const dias = parseInt(body.dias, 10)
      if (!Number.isFinite(dias) || dias === 0) {
        return NextResponse.json({ error: 'Dime cuántos días mover, en más o en menos' }, { status: 400 })
      }
      if (Math.abs(dias) > 365) {
        return NextResponse.json({ error: 'Como mucho 365 días de un tirón' }, { status: 400 })
      }
      // Se mueve desde donde vence HOY, no desde hoy: restar cinco días a quien
      // vence el 30 tiene que dar el 25, no una fecha contada desde ahora.
      nueva = new Date(sub.fechaVencimiento)
      nueva.setUTCDate(nueva.getUTCDate() + dias)
    }

    /* ⚠ La única barrera: no dejarlo por debajo del inicio de la suscripción.
       Un vencimiento anterior a su propio arranque no es un cobro adelantado,
       es una fila que no significa nada. */
    if (nueva < new Date(sub.fechaInicio)) {
      return NextResponse.json({
        error: `No puedo dejarlo antes del ${new Date(sub.fechaInicio).toISOString().slice(0, 10)}, que es cuando empezó`,
      }, { status: 400 })
    }

    const antes = new Date(sub.fechaVencimiento)
    const sigueVigente = nueva > ahora
    await prisma.suscripcion.update({
      where: { id: sub.id },
      data: {
        fechaVencimiento: nueva,
        // Si se le mueve la fecha hacia adelante y estaba vencida, revive; y si
        // se le mueve al pasado, se marca vencida. Dejar «activa» una que ya
        // pasó es lo que hace que no salga en ninguna lista de cobro.
        estado: sigueVigente ? 'activa' : 'vencida',
      },
    })
    await prisma.organization.update({
      where: { id },
      data: { waChurnSent: false, waPreVencSent: false },
    })

    const dif = Math.round((nueva - antes) / 86400000)
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'ajustar_vencimiento',
        detalle: `Vencimiento de "${org.nombre}": ${antes.toISOString().slice(0, 10)} → ${nueva.toISOString().slice(0, 10)}`
          + ` (${dif >= 0 ? '+' : ''}${dif} días)`,
      },
    })
    return NextResponse.json({
      ok: true,
      fechaVencimiento: nueva,
      mensaje: `Ahora vence el ${nueva.toISOString().slice(0, 10)} (${dif >= 0 ? '+' : ''}${dif} días)`,
    })
  }

  /* «La ficha de mis clientes se ve fea […] a algunos les aparece número, a
   * otros no.» Medido: 62 de 485 dueños no tienen teléfono en NINGÚN campo. No
   * era un fallo de la pantalla: era que no había forma de escribirlo. */
  if (accion === 'editarDueno' && body.userId) {
    const user = await prisma.user.findFirst({ where: { id: body.userId, organizationId: id } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const data = {}
    const cambios = []
    if (typeof body.nombre === 'string' && body.nombre.trim() && body.nombre.trim() !== user.nombre) {
      data.nombre = body.nombre.trim()
      cambios.push(`nombre "${user.nombre}" → "${data.nombre}"`)
    }
    if (typeof body.telefono === 'string' && body.telefono.trim() !== (user.telefono ?? '')) {
      data.telefono = body.telefono.trim() || null
      cambios.push(`teléfono ${user.telefono || '(vacío)'} → ${data.telefono || '(vacío)'}`)
    }
    if (typeof body.email === 'string' && body.email.trim().toLowerCase() !== user.email) {
      const email = body.email.trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Ese correo no tiene forma de correo' }, { status: 400 })
      }
      // ⚠ El correo ES la llave con la que entra. Si ya lo tiene otro, cambiarlo
      //   dejaría a uno de los dos sin poder iniciar sesión.
      const ocupado = await prisma.user.findFirst({ where: { email, NOT: { id: body.userId } }, select: { id: true } })
      if (ocupado) return NextResponse.json({ error: 'Ese correo ya lo usa otra cuenta' }, { status: 409 })
      data.email = email
      cambios.push(`correo ${user.email} → ${email}`)
    }

    if (!cambios.length) return NextResponse.json({ ok: true, mensaje: 'No había nada que cambiar' })

    await prisma.user.update({ where: { id: body.userId }, data })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'editar_dueno',
        detalle:        `Datos de "${user.nombre}": ${cambios.join(' · ')}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: cambios.join(' · ') })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
