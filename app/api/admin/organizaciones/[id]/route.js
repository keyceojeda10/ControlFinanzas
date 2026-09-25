// app/api/admin/organizaciones/[id]/route.js — Detalle y gestión de organización
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt               from 'bcryptjs'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado } from '@/lib/email'
import { PLANES_VALIDOS, PLANES_CONFIG } from '@/lib/planes'
import { registrarPagoSuscripcion } from '@/lib/libro-pagos'
import { ultimoPago, ultimaSuscripcion } from '@/lib/cobro-intento'
import { registrarAdminLog }  from '@/lib/admin-log'
import { cortarCuentasGuardadas } from '@/lib/cuentas-guardadas'
import {
  MESES_PERIODO, ofertaPublica, pagoCuadra, inicioDelPeriodo, resumenPrecio,
  leerPreferencial, describirPreferencial,
} from '@/lib/precio-plan'

/* Los cuatro campos del preferencial, vacíos. */
const SIN_PREFERENCIAL = {
  precioPreferencial: null,
  precioPreferencialPlan: null,
  precioPreferencialHasta: null,
  precioPreferencialNota: null,
}

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

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
        /* `rutas` es para el cupo de rutas extra: sin él la ficha no puede
           decir cuántas tiene creadas y el superadmin concede a ciegas. Ver
           [[feedback_verificar_prisma_select]]. */
        select: { clientes: true, prestamos: true, rutas: true },
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

  /* ⚠ `precio` es lo que el cobro automático va a hacer de verdad: sale de la
     misma función que el cron. La ficha no calcula precios por su cuenta. */
  const pagada = await ultimoPago(id)
  return NextResponse.json({
    ...org,
    prestamosActivos: cartera._count,
    carteraActiva:    cartera._sum.totalAPagar ?? 0,
    precio: resumenPrecio(org, { pagada, ultima: org.suscripciones?.[0] ?? null }),
    cobroAutomaticoPuesto: !!(org.cobroAutomatico && org.wompiFuentePagoId),
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

  /* ══ PRECIO PREFERENCIAL ══════════════════════════════════════════════════
   *
   * «Que en la plataforma de superadmin se pudiera gestionar y que avisara qué
   *  clientes tienen precio preferencial, y si es por algún tiempo limitado,
   *  para que el ajuste se haga automático al pasar el tiempo, o el valor que se
   *  le dio fue definitivo.» — el dueño, 12 sep 2026.
   *
   * Aquí vivía `cambiarDescuento`, un % que el checkout aplicaba y el cobro
   * automático no. No lo usaba nadie: los 10 precios especiales que había se
   * pusieron escribiendo un monto a mano en «Asignar plan», sin rastro.
   *
   * Lo decide lib/precio-plan.js; aquí solo se guarda y se apunta.
   */
  if (accion === 'precioPreferencial') {
    const [pagada, ultima] = await Promise.all([ultimoPago(id), ultimaSuscripcion(id)])
    const leido = leerPreferencial(body, { inicio: inicioDelPeriodo(ultima), country: org.country })
    if (leido.error) return NextResponse.json({ error: leido.error }, { status: 400 })

    /* El «antes» sin su nota: la nota nueva ya va en «ahora», y las dos juntas
       pasaban de los 191 caracteres del registro. */
    const antes = org.precioPreferencial > 0
      ? describirPreferencial({ ...org, precioPreferencialNota: null }, org.country)
      : 'sin precio preferencial'
    /* Decidir el precio es revisar el último pago: deja de salir «por revisar». */
    await prisma.organization.update({
      where: { id },
      data: { ...leido.data, precioPagoRevisado: pagada?.montoCOP ?? null },
    })
    const ahora = describirPreferencial(leido.data, org.country)
    await registrarAdminLog({
      adminId:        session.user.id,
      organizacionId: id,
      accion:         'precio_preferencial',
      detalle:        `Precio preferencial de "${org.nombre}": ${ahora}. Antes: ${antes}`,
    })
    return NextResponse.json({ ok: true, mensaje: `Precio preferencial guardado: ${ahora}` })
  }

  /* Quitar el preferencial y «cobrar lista» a un pago por revisar son la misma
     decisión: desde el próximo cobro, precio de lista. */
  if (accion === 'quitarPrecioPreferencial') {
    const pagada = await ultimoPago(id)
    const tenia = org.precioPreferencial > 0
    await prisma.organization.update({
      where: { id },
      data: { ...SIN_PREFERENCIAL, precioPagoRevisado: pagada?.montoCOP ?? null },
    })
    const detalle = tenia
      ? `Precio preferencial quitado a "${org.nombre}" (era ${describirPreferencial(org, org.country)}). Próximos cobros a lista`
      : `Pago de ${pesos(pagada?.montoCOP)} de "${org.nombre}" revisado: próximos cobros a lista`
    await registrarAdminLog({
      adminId:        session.user.id,
      organizacionId: id,
      accion:         'quitar_precio_preferencial',
      detalle,
    })
    return NextResponse.json({ ok: true, mensaje: 'Desde el próximo cobro, precio de lista' })
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

  /* ══ ADICIONALES PAGADOS ══════════════════════════════════════════════════
   *
   * Los que el negocio PAGA con su plan (los de arriba se regalan). En
   * Colombia se compran solos en «Mi plan»; en los países de MercadoPago y en
   * los de cobro a mano se piden por WhatsApp y se cargan aquí. Desde el
   * próximo cobro van en el precio (lib/precio-plan.js). */
  if (accion === 'cambiarAdicionales') {
    const tipo = body.tipo === 'rutas' ? 'rutas' : body.tipo === 'cobradores' ? 'cobradores' : null
    const cantidad = parseInt(body.cantidad)
    if (!tipo) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })
    if (isNaN(cantidad) || cantidad < 0 || cantidad > 50) {
      return NextResponse.json({ error: 'Cantidad debe ser entre 0 y 50' }, { status: 400 })
    }
    const campo = tipo === 'rutas' ? 'rutasAdicionales' : 'cobradoresAdicionales'
    const anterior = org[campo] ?? 0
    await prisma.organization.update({ where: { id }, data: { [campo]: cantidad } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_adicionales',
        detalle:        `${tipo === 'rutas' ? 'Rutas' : 'Cobradores'} adicionales (pagados): ${anterior} → ${cantidad} para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `${tipo === 'rutas' ? 'Rutas' : 'Cobradores'} adicionales: ${cantidad}. Van en el próximo cobro.` })
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

  /* ══ RUTAS EXTRA ══════════════════════════════════════════════════════════
   *
   * «Lo de la ruta se lo aumenta a ese cliente y también déjalo en el superadmin
   *  para no tener que pedírtelo a ti.» — el dueño, 14 sep 2026.
   *
   * Era el único de los tres cupos que no se podía dar desde aquí: cobradores y
   * clientes sí, rutas no. `rutasExtra` solo subía por el webhook de Wompi al
   * comprar una ruta, así que conceder una había que hacerlo tocando la base a
   * mano — y sin rastro de quién ni por qué.
   *
   * ⚠ Y EN LOS PLANES BAJOS LA RUTA EXTRA NO ESTÁ A LA VENTA. Inicial y Básico
   *   tienen `rutaExtra: 0` en `lib/planes.js`: nadie puede comprarla aunque
   *   quiera. Por eso este cupo no es un atajo del checkout, es la ÚNICA forma
   *   de que una cuenta de plan bajo tenga una segunda ruta.
   *
   * El tope de 20 no es capricho: por encima de eso lo que toca es cambiar de
   * plan, no seguir sumando cupo suelto. La misma regla que en clientes.
   */
  if (accion === 'cambiarRutas') {
    const cantidad = parseInt(body.rutasExtra)
    if (isNaN(cantidad) || cantidad < 0 || cantidad > 20) {
      return NextResponse.json({ error: 'Cantidad debe ser entre 0 y 20' }, { status: 400 })
    }
    const anterior = org.rutasExtra ?? 0
    await prisma.organization.update({ where: { id }, data: { rutasExtra: cantidad } })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: id,
        accion:         'cambiar_rutas',
        detalle:        `Rutas extra: ${anterior} → ${cantidad} para "${org.nombre}"`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Rutas extra actualizadas a ${cantidad}` })
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

    await cortarCuentasGuardadas(body.userId)

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
    const periodoValido = ['mensual', 'trimestral', 'semestral', 'anual'].includes(periodo) ? periodo : 'mensual'
    // Días fijos, 30 por mes, como ya hacían el mensual y el trimestral (90).
    const diasExtension = { mensual: 30, trimestral: 90, semestral: 180, anual: 365 }[periodoValido]
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

    // Por defecto: empezar desde HOY (nuevo plan pagado)
    // Solo extender si el admin lo elige explícitamente Y es el mismo plan
    const debeExtender = !!subExistente
      && extender === true
      && subExistente.estado === 'activa'
      && new Date(subExistente.fechaVencimiento) > ahora
      && subExistente.plan === planNuevo
    const fechaVencimiento = new Date(debeExtender ? new Date(subExistente.fechaVencimiento) : ahora)
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasExtension)

    /* ══ ¿Y LOS COBROS QUE VIENEN? ═════════════════════════════════════════
     *
     * Aquí se escribía un monto a mano y nada más. Así nacieron los 10 precios
     * especiales que había el 12 sep 2026: nadie sabía cuáles eran, ni si eran
     * para siempre, y el cobro automático repetía el monto sin fin.
     *
     * Ahora, si lo cobrado va por debajo del precio público del periodo y no es
     * un preferencial que ya tenga, hay que decir qué pasa después: lista, o
     * precio preferencial (definitivo o con fecha). Se valida ANTES de escribir
     * nada: un preferencial mal puesto no deja un pago a medias.
     */
    const meses = MESES_PERIODO[periodoValido]
    const oferta = ofertaPublica(planNuevo, periodoValido, org.country)
    const cuadra = montoCOP === 0 || pagoCuadra(org, planNuevo, montoCOP)
    const debajo = !cuadra && montoCOP < oferta - 1
    const decision = ['lista', 'preferencial'].includes(body.proximosCobros) ? body.proximosCobros : null
    if (debajo && !decision) {
      return NextResponse.json({
        error: `Cobraste ${pesos(montoCOP)} y el precio de ${PLANES_CONFIG[planNuevo].nombre} ${periodoValido} es ${pesos(oferta)}. Di si los próximos cobros van a lista o con precio preferencial.`,
        requiereDecision: true,
        oferta,
      }, { status: 400 })
    }

    let datosPrecio = {}
    let proximosLabel = null
    if (debajo && decision === 'preferencial') {
      const leido = leerPreferencial({
        plan:   planNuevo,
        precio: body.precioPreferencial ?? Math.round(montoCOP / meses),
        hasta:  body.hastaPreferencial,
        cobros: body.cobrosPreferencial,
        nota:   body.notaPreferencial,
      }, { inicio: fechaVencimiento, country: org.country })
      if (leido.error) return NextResponse.json({ error: leido.error }, { status: 400 })
      datosPrecio = leido.data
      proximosLabel = `precio preferencial, ${describirPreferencial(leido.data, org.country)}`
    } else if (debajo && decision === 'lista') {
      if (org.precioPreferencialPlan === planNuevo) datosPrecio = { ...SIN_PREFERENCIAL }
      proximosLabel = `a lista (${pesos(ofertaPublica(planNuevo, 'mensual', org.country))}/mes)`
    }
    /* Un monto que no cuadra y ya se decidió (o va por encima de lista, que el
       cobro nunca repite) no sale «por revisar». */
    if (!cuadra) datosPrecio.precioPagoRevisado = montoCOP

    /* El apunte del libro va en la MISMA transacción que la suscripción: si
       se da el servicio, la plata queda registrada, y si no, ninguna de las
       dos cosas pasa. Este era el camino por el que entraron 82 de los 93
       pagos y era el que menos rastro dejaba. Ver lib/libro-pagos.js. */
    await prisma.$transaction(async (tx) => {
      if (subExistente) {
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
      } else {
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
      }
      await registrarPagoSuscripcion(tx, {
        organizationId: id,
        plan:    planNuevo,
        montoCOP,
        periodo: periodoValido,
        gateway: 'manual',
        adminId: session.user.id,
      })
      // Actualizar plan de la organización y activarla, con su precio
      await tx.organization.update({
        where: { id },
        data: { plan: planNuevo, activo: true, ...datosPrecio },
      })
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

    /* ⚠ Después de la transacción: el pago YA está apuntado. Un registro que
       falle aquí (el preferencial con nota pasa de 191 caracteres) respondía
       500, y un 500 invita a asignar otra vez: el mismo pago dos veces en el
       libro. `registrarAdminLog` recorta y no tira. */
    const periodoLabel = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }[periodoValido]
    await registrarAdminLog({
      adminId:        session.user.id,
      organizacionId: id,
      accion:         'pago_directo',
      detalle:        `Plan ${planNuevo} asignado (pago directo). Período: ${periodoLabel}. Monto: $${montoCOP.toLocaleString('es-CO')}. Vigente hasta: ${fechaVencimiento.toLocaleDateString('es-CO')}`
        + (proximosLabel ? `. Próximos cobros: ${proximosLabel}` : ''),
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
