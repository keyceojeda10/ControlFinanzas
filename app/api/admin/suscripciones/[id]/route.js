// app/api/admin/suscripciones/[id]/route.js — Gestión manual de suscripción
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

/* Los mismos del enum `Plan` de Prisma. Se escriben aquí porque el enum no se
   puede importar en tiempo de ejecución, y una lista suelta que no se comprueba
   es como se cuela un valor inválido y revienta con PrismaClientValidationError
   — ya pasó en este proyecto. La prueba `barreras-de-plan` los coteja. */
const PLANES = ['test', 'starter', 'basic', 'growth', 'standard', 'professional']

function calcularNuevaFecha(base, dias, diaFijo) {
  const fecha = new Date(base)
  if (diaFijo && diaFijo >= 1 && diaFijo <= 31) {
    fecha.setDate(fecha.getDate() + dias)
    fecha.setDate(diaFijo)
    if (fecha <= base) fecha.setMonth(fecha.getMonth() + 1)
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
    if (diaFijo > ultimoDia) fecha.setDate(ultimoDia)
  } else {
    fecha.setDate(fecha.getDate() + dias)
  }
  return fecha
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body   = await req.json()
  const { accion } = body // renovar | extender | fecha | plan | cancelar

  const sub = await prisma.suscripcion.findUnique({
    where: { id },
    include: { organization: { select: { id: true, nombre: true } } },
  })
  if (!sub) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })

  const orgNombre = sub.organization.nombre

  if (accion === 'renovar') {
    const dias    = parseInt(body.dias) || 30
    const diaFijo = parseInt(body.diaFijo) || null
    if (dias < 1 || dias > 365) {
      return NextResponse.json({ error: 'Días debe estar entre 1 y 365' }, { status: 400 })
    }

    const ahora = new Date()
    const base  = new Date(sub.fechaVencimiento) > ahora ? new Date(sub.fechaVencimiento) : ahora
    const nuevaFecha = calcularNuevaFecha(base, dias, diaFijo)

    await prisma.$transaction([
      prisma.suscripcion.update({
        where: { id },
        data: { estado: 'vencida' },
      }),
      prisma.suscripcion.create({
        data: {
          organizationId:   sub.organization.id,
          plan:             sub.plan,
          estado:           'activa',
          fechaInicio:      ahora,
          fechaVencimiento: nuevaFecha,
          montoCOP:         sub.montoCOP,
        },
      }),
      prisma.organization.update({
        where: { id: sub.organization.id },
        data: { waChurnSent: false, waPreVencSent: false },
      }),
    ])
    const label = diaFijo ? `${dias}d (día fijo: ${diaFijo})` : `${dias} días`
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'renovar_suscripcion',
        detalle:        `Suscripción de "${orgNombre}" renovada ${label} hasta ${nuevaFecha.toISOString().slice(0, 10)}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Suscripción renovada hasta ${nuevaFecha.toISOString().slice(0, 10)}` })
  }

  /* ⚠ AQUÍ SE PUEDE RESTAR, Y ANTES NO.
   *
   * «Yo puedo agregar días, pero no puedo quitar días. No puedo ubicarle una
   *  fecha específica o establecerle una fecha con un calendario.» — el dueño.
   *
   * `dias < 1` rechazaba cualquier número negativo, así que un dedazo de +30 no
   * se podía deshacer: había que darle 335 días más para dar la vuelta al año.
   * Ahora el rango es de -365 a 365 y el cero se sigue rechazando, porque
   * «extender 0 días» no es una orden, es un formulario a medio llenar. */
  if (accion === 'extender') {
    const dias    = parseInt(body.dias)
    const diaFijo = parseInt(body.diaFijo) || null
    if (!dias || dias < -365 || dias > 365) {
      return NextResponse.json({ error: 'Los días van de -365 a 365, y no pueden ser 0' }, { status: 400 })
    }

    const ahora = new Date()
    /* Al SUMAR se parte de lo que venza más tarde —regalar días a una vencida no
       puede empezar en el pasado—. Al RESTAR se parte siempre del vencimiento
       real: si se partiera de hoy, quitarle 5 días a una que vence en 60 la
       dejaría vencida hace 5, que es lo contrario de lo que se pidió. */
    const vence = new Date(sub.fechaVencimiento)
    const base  = dias < 0 ? vence : (vence > ahora ? vence : ahora)
    const nuevaFecha = calcularNuevaFecha(base, dias, diaFijo)

    await prisma.suscripcion.update({
      where: { id },
      /* Restar puede dejarla vencida, y entonces tiene que DECIRLO: una fila que
         venció ayer y sigue marcada «activa» es la que hace que el panel enseñe
         un MRR que nadie va a pagar. */
      data: { fechaVencimiento: nuevaFecha, estado: nuevaFecha > ahora ? 'activa' : 'vencida' },
    })
    const label = diaFijo ? `${dias}d (día fijo: ${diaFijo})` : `${dias} días`
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         dias < 0 ? 'recortar_suscripcion' : 'extender_suscripcion',
        detalle:        `Extensión de ${label} aplicada a "${orgNombre}" hasta ${nuevaFecha.toISOString().slice(0, 10)}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Extendida hasta ${nuevaFecha.toISOString().slice(0, 10)}` })
  }

  /* ── LA FECHA EXACTA, CON CALENDARIO ──────────────────────────────────────
   *
   * Pedida por el dueño: sumar y restar días sirve para ajustar, pero cuando
   * alguien paga hasta el 15 de octubre, lo que uno quiere es escribir el 15 de
   * octubre — no calcular cuántos días faltan y confiar en la resta.
   *
   * Se guarda a las 23:59:59 de ESE día para que el día pactado se disfrute
   * entero: a medianoche en punto, quien pagó «hasta el 15» perdía el 15. */
  if (accion === 'fecha') {
    const texto = String(body.fecha ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      return NextResponse.json({ error: 'La fecha va como AAAA-MM-DD' }, { status: 400 })
    }
    const nuevaFecha = new Date(`${texto}T23:59:59.000Z`)
    if (Number.isNaN(nuevaFecha.getTime())) {
      return NextResponse.json({ error: 'Esa fecha no existe' }, { status: 400 })
    }
    /* Un tope de cordura, no una regla de negocio: teclear 2206 en vez de 2026
       dejaría un plan regalado 180 años y nadie lo notaría hasta el balance. */
    const tope = new Date()
    tope.setFullYear(tope.getFullYear() + 5)
    if (nuevaFecha > tope) {
      return NextResponse.json({ error: 'Esa fecha está a más de 5 años. ¿Se coló un año mal escrito?' }, { status: 400 })
    }

    const ahora = new Date()
    await prisma.suscripcion.update({
      where: { id },
      data: { fechaVencimiento: nuevaFecha, estado: nuevaFecha > ahora ? 'activa' : 'vencida' },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'fechar_suscripcion',
        detalle:        `Vencimiento de "${orgNombre}" puesto a mano en ${texto} (antes ${new Date(sub.fechaVencimiento).toISOString().slice(0, 10)})`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Vence el ${texto}` })
  }

  /* ── CAMBIAR EL PLAN ──────────────────────────────────────────────────────
   * Sin tocar la fecha: son dos decisiones distintas y mezclarlas obliga a
   * recalcular el vencimiento cada vez que alguien sube de plan a mitad de mes. */
  if (accion === 'plan') {
    const plan = String(body.plan ?? '')
    if (!PLANES.includes(plan)) {
      return NextResponse.json({ error: `Plan que no existe: ${plan}` }, { status: 400 })
    }
    if (plan === sub.plan) {
      return NextResponse.json({ error: `Ya está en ${plan}` }, { status: 400 })
    }
    const antes = sub.plan
    await prisma.$transaction([
      prisma.suscripcion.update({ where: { id }, data: { plan } }),
      /* La organización lleva su propia copia del plan y es la que mandan las
         barreras: cambiar solo la suscripción dejaría al negocio con el plan
         viejo en la app y el nuevo en el panel. */
      prisma.organization.update({ where: { id: sub.organization.id }, data: { plan } }),
    ])
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'cambiar_plan',
        detalle:        `Plan de "${orgNombre}": ${antes} → ${plan}`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: `Ahora es ${plan}` })
  }

  if (accion === 'cancelar') {
    await prisma.suscripcion.update({
      where: { id },
      data: { estado: 'cancelada' },
    })
    await prisma.adminLog.create({
      data: {
        adminId:        session.user.id,
        organizacionId: sub.organization.id,
        accion:         'cancelar_suscripcion',
        detalle:        `Suscripción de "${orgNombre}" cancelada`,
      },
    })
    return NextResponse.json({ ok: true, mensaje: 'Suscripción cancelada' })
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
}
