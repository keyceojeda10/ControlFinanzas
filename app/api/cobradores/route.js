// app/api/cobradores/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import bcrypt               from 'bcryptjs'
import { logActividad } from '@/lib/activity-log'

import { PLAN_NAMES, PLANES_CONFIG, cuposDe, selectCupos, admiteAdicionales } from '@/lib/planes'
import { getUtcOffset } from '@/lib/i18n'
import { normalizarEmail, buscarUsuarioPorEmail } from '@/lib/normalizar-email'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { loDeHoyDelPrestamo, pagadoEnElDia, selectPrestamoDelDia } from '@/lib/dinero/esperado'

/* ⚠ LA MEDIANOCHE DEL PAÍS, NO LA DEL SERVIDOR (DETALLES-RUTAS #57). Restaba
   la hora del país y luego `setHours(0)` en la hora del servidor, que es UTC:
   el «hoy» iba de 7 p. m. a 7 p. m. y a las 12:50 a. m. del domingo enseñaba
   «HOY $84.400», lo del sábado por la noche, mientras la ruta decía $0. Es la
   misma de app/api/cobradores/[id] y app/api/rutas/[id]. */
const hoy = (country = 'co') => {
  const absOffset = Math.abs(getUtcOffset(country))
  const col = new Date(Date.now() - absOffset * 60 * 60 * 1000)
  return new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate(), absOffset, 0, 0, 0))
}
const manana = (country = 'co') => new Date(hoy(country).getTime() + 24 * 60 * 60 * 1000)

// ─── GET /api/cobradores ────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver cobradores' }, { status: 403 })
  }

  const { organizationId } = session.user

  const cobradores = await prisma.user.findMany({
    where: { organizationId, rol: 'cobrador' },
    select: {
      id:        true,
      nombre:    true,
      email:     true,
      activo:    true,
      puedeCrearPrestamos: true,
      puedeGestionarPrestamos: true,
      puedeCrearClientes:  true,
      puedeEditarClientes: true,
      puedeReportarGastos: true,
      puedeVerCapital:     true,
      puedeVerCapitalRuta: true,
      puedeVerSaldoCaja:   true,
      puedeGestionarRutas: true,
      puedeAplicarDescuentos: true,
      puedeReabrirCajaSinAprobacion: true,
      rutas:     {
        where:  { activo: true },
        select: {
          id:      true,
          nombre:  true,
          diasSinCobro: true,
          clientes: {
            select: {
              id: true,
              diasSinCobro: true,
              prestamos: {
                where: { estado: 'activo' },
                // Todo lo que lee `loDeHoyDelPrestamo` (DETALLES-RUTAS #70).
                select: selectPrestamoDelDia(),
              },
            },
          },
        },
      },
      pagos: {
        where:      { fechaPago: { gte: hoy(session.user.country), lt: manana(session.user.country) } },
        // `metodoPago` es 'efectivo' | 'transferencia', y es lo que separa lo
        // que el cobrador TIENE EN EL BOLSILLO de lo que ya está en la cuenta.
        // Sin él, «debe entregar» miente en cuanto un cliente paga por Nequi.
        select:     { montoPagado: true, tipo: true, fechaPago: true, metodoPago: true },
        orderBy:    { fechaPago: 'desc' },
      },
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })

  const [orgCfg, festivosRows] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])
  const festivos = festivosRows.map((f) => f.fecha)
  const ahora = new Date()

  const resultado = cobradores.map((c) => {
    const pagosValidos = c.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo))
    const recaudadoHoy = pagosValidos.reduce((a, p) => a + p.montoPagado, 0)
    const cantidadPagos = pagosValidos.length
    // Lo que lleva encima vs lo que ya está en la cuenta. Sin `metodoPago` un
    // pago es efectivo: es lo que asumía el sistema antes y es la suposición
    // conservadora — de más para entregar, nunca de menos.
    let recaudadoDigitalHoy = 0
    let recaudadoEfectivoHoy = 0
    for (const p of pagosValidos) {
      if (p.metodoPago === 'transferencia') recaudadoDigitalHoy += p.montoPagado
      else recaudadoEfectivoHoy += p.montoPagado
    }
    const ultimoPago = c.pagos[0]?.fechaPago ?? null
    // Esperado hoy: solo cuotas de prestamos cuyo ciclo de cobro toca HOY
    // (frecuencia diaria, semanal en el dia ancla, mensual en el dia configurado).
    // Antes sumaba todas las cuotas diarias activas, lo que inflaba la cifra.
    // Desde DETALLES-RUTAS #70, con la regla de Rutas y del Inicio: sin quien
    // tiene las cuotas cubiertas y sin lo que adelantaron ayer. Y con los
    // festivos del negocio, que aquí se pasaban vacíos.
    let esperadoHoy = 0
    let faltaHoy = 0
    for (const ruta of c.rutas) {
      for (const cliente of (ruta.clientes ?? [])) {
        for (const p of (cliente.prestamos ?? [])) {
          const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, orgCfg, p)
          const hoyEste = loDeHoyDelPrestamo(p, { diasExcluidos, festivos, pagadoHoy: pagadoEnElDia(p, ahora) })
          if (!hoyEste.cuenta) continue
          esperadoHoy += hoyEste.toca
          faltaHoy += hoyEste.falta
        }
      }
    }
    return {
      id:              c.id,
      nombre:          c.nombre,
      email:           c.email,
      activo:          c.activo,
      permisos: {
        crearPrestamos: c.puedeCrearPrestamos,
        gestionarPrestamos: c.puedeGestionarPrestamos ?? c.puedeCrearPrestamos,
        crearClientes:  c.puedeCrearClientes,
        editarClientes: c.puedeEditarClientes,
        reportarGastos: c.puedeReportarGastos ?? true,
        verCapital:     c.puedeVerCapital ?? false,
        verCapitalRuta: c.puedeVerCapitalRuta ?? false,
        verSaldoCaja:   c.puedeVerSaldoCaja ?? false,
        gestionarRutas: c.puedeGestionarRutas ?? false,
        aplicarDescuentos: c.puedeAplicarDescuentos ?? false,
        desembolsarLinea: c.puedeDesembolsarLinea ?? false,
        reabrirCajaSinAprobacion: c.puedeReabrirCajaSinAprobacion ?? false,
      },
      ruta:            c.rutas[0] ? { id: c.rutas[0].id, nombre: c.rutas[0].nombre } : null,
      // TODAS sus rutas: «Ya cobra en …» nombraba solo la primera (DETALLES-RUTAS #61).
      rutas:           c.rutas.map((r) => ({ id: r.id, nombre: r.nombre })),
      // Los de TODAS sus rutas (#14): decía «Zona Norte · 3 clientes» de quien lleva dos.
      cantidadClientes: c.rutas.reduce((n, r) => n + (r.clientes?.length ?? 0), 0),
      recaudadoHoy,
      recaudadoEfectivoHoy: Math.round(recaudadoEfectivoHoy),
      recaudadoDigitalHoy: Math.round(recaudadoDigitalHoy),
      esperadoHoy: Math.round(esperadoHoy),
      faltaHoy: Math.round(faltaHoy),
      cantidadPagosHoy: cantidadPagos,
      ultimoPago,
    }
  })

  return Response.json(resultado)
}

// ─── POST /api/cobradores ───────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede crear cobradores' }, { status: 403 })
  }

  const { organizationId } = session.user

  // Leer plan desde DB (el JWT puede estar desactualizado si el plan
  // se cambio durante onboarding y la sesion aun no se refresco).
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ...selectCupos, planOriginal: true },
  })
  const plan = org?.plan ?? session.user.plan

  // Planes de entrada no pueden tener cobradores
  const nombrePlan = PLAN_NAMES[plan] || plan
  if (['starter', 'basic'].includes(plan)) {
    return Response.json(
      { error: `Tu plan ${nombrePlan} no incluye cobradores. Actualiza al plan Crecimiento, Profesional o Empresarial.` },
      { status: 403 }
    )
  }

  // Verificar límite de usuarios: plan + regalados + adicionales (`cuposDe`)
  /* Solo los ACTIVOS, como el congelamiento, «Mi plan» y quitar un adicional.
     Contando los desactivados, a quien tenía uno desactivado se le pedía
     comprar un cupo que ya tenía (revisión del 24 sep 2026). */
  const limite = cuposDe(org, plan).usuarios
  const totalUsuarios = await prisma.user.count({ where: { organizationId, activo: true } })
  if (totalUsuarios >= limite) {
    /* El plan que se paga, no el de la prueba: es el que decide si «Mi plan»
       enseña la tarjeta de adicionales. */
    const puedeAgregar = admiteAdicionales(org?.planOriginal || plan)
    const msgOpciones = puedeAgregar
      ? ' Agrega un cobrador adicional en Mi plan, o sube de plan.'
      : ' Sube de plan para tener más usuarios.'
    return Response.json(
      { error: `Has alcanzado el límite de ${limite} usuarios.${msgOpciones}`, limitReached: true, puedeAgregar, plan },
      { status: 403 }
    )
  }

  const { nombre, email, password, permisos, telefono } = await request.json()

  if (!nombre?.trim())   return Response.json({ error: 'El nombre es requerido' },    { status: 400 })
  if (!email?.trim())    return Response.json({ error: 'El email es requerido' },     { status: 400 })
  if (!password?.trim()) return Response.json({ error: 'La contraseña es requerida' }, { status: 400 })

  // Normalizar email (quita puntos decorativos de Gmail, lowercase)
  const emailNorm = normalizarEmail(email)

  // Email único global, también contra las cuentas guardadas sin sus puntos.
  const existeEmail = await buscarUsuarioPorEmail(prisma, email, { select: { id: true } })
  if (existeEmail) return Response.json({ error: 'Este correo ya está en uso. Si la persona ya tiene cuenta, intenta con otro correo o edita un cobrador existente.' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password.trim(), 10)

  // Normalizar telefono: solo digitos, vacio -> null
  const telefonoNorm = typeof telefono === 'string'
    ? telefono.replace(/\D/g, '').trim() || null
    : null

  // Teléfono único dentro de la organización (evita duplicados entre cobradores del mismo owner)
  if (telefonoNorm) {
    const telEnUso = await prisma.user.findFirst({
      where: { telefono: telefonoNorm, organizationId },
      select: { id: true },
    })
    if (telEnUso) return Response.json({ error: 'Ese número de WhatsApp ya está asignado a otro usuario de tu organización.' }, { status: 409 })
  }

  const crearPrestamos = Boolean(permisos?.crearPrestamos)
  const gestionarPrestamos = Boolean(permisos?.gestionarPrestamos ?? crearPrestamos)
  const reportarGastos = Boolean(permisos?.reportarGastos ?? true)
  const verCapital = Boolean(permisos?.verCapital)
  const verCapitalRuta = Boolean(permisos?.verCapitalRuta)
  const verSaldoCaja = Boolean(permisos?.verSaldoCaja)
  const gestionarRutas = Boolean(permisos?.gestionarRutas)
  const aplicarDescuentos = Boolean(permisos?.aplicarDescuentos)
  const desembolsarLinea = Boolean(permisos?.desembolsarLinea)
  const reabrirCajaSinAprobacion = Boolean(permisos?.reabrirCajaSinAprobacion)

  const cobrador = await prisma.user.create({
    data: {
      organizationId,
      nombre:   nombre.trim(),
      email:    emailNorm,
      telefono: telefonoNorm,
      password: hashedPassword,
      rol:      'cobrador',
      puedeCrearPrestamos: crearPrestamos,
      puedeGestionarPrestamos: gestionarPrestamos,
      puedeCrearClientes:  Boolean(permisos?.crearClientes),
      puedeEditarClientes: Boolean(permisos?.editarClientes),
      puedeReportarGastos: reportarGastos,
      puedeVerCapital:     verCapital,
      puedeVerCapitalRuta: verCapitalRuta,
      puedeVerSaldoCaja:   verSaldoCaja,
      puedeGestionarRutas: gestionarRutas,
      puedeAplicarDescuentos: aplicarDescuentos,
      puedeDesembolsarLinea: desembolsarLinea,
      puedeReabrirCajaSinAprobacion: reabrirCajaSinAprobacion,
    },
    select: { id: true, nombre: true, email: true, telefono: true, activo: true, rol: true,
      puedeCrearPrestamos: true, puedeGestionarPrestamos: true, puedeCrearClientes: true, puedeEditarClientes: true, puedeReportarGastos: true, puedeVerCapital: true, puedeVerSaldoCaja: true, puedeGestionarRutas: true, puedeAplicarDescuentos: true, puedeDesembolsarLinea: true, puedeReabrirCajaSinAprobacion: true },
  })

  logActividad({ session, accion: 'crear_cobrador', entidadTipo: 'usuario', entidadId: cobrador.id, detalle: `Cobrador ${cobrador.nombre} creado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(cobrador, { status: 201 })
}
