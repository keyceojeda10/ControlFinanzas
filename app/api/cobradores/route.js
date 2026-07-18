// app/api/cobradores/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import bcrypt               from 'bcryptjs'
import { logActividad } from '@/lib/activity-log'

import { LIMITES_USUARIOS, PLAN_NAMES, PLANES_CONFIG } from '@/lib/planes'
import { getUtcOffset } from '@/lib/i18n'
import { normalizarEmail } from '@/lib/normalizar-email'
import { tienePeriodoEsperadoHoy } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'

const getLocalDate = (country = 'co') => new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
const hoy = (country = 'co') => {
  const d = getLocalDate(country)
  d.setHours(0, 0, 0, 0)
  return d
}
const manana = (country = 'co') => {
  const d = getLocalDate(country)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

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
                select: {
                  cuotaDiaria: true,
                  frecuencia: true,
                  fechaInicio: true,
                  diasPlazo: true,
                  diaCobroSemana: true,
                  diaCobroMes: true,
                  diaCobroMes2: true,
                },
              },
            },
          },
        },
      },
      pagos: {
        where:      { fechaPago: { gte: hoy(), lt: manana() } },
        select:     { montoPagado: true, tipo: true, fechaPago: true },
        orderBy:    { fechaPago: 'desc' },
      },
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })

  const orgCfg = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  const resultado = cobradores.map((c) => {
    const pagosValidos = c.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo))
    const recaudadoHoy = pagosValidos.reduce((a, p) => a + p.montoPagado, 0)
    const cantidadPagos = pagosValidos.length
    const ultimoPago = c.pagos[0]?.fechaPago ?? null
    // Esperado hoy: solo cuotas de prestamos cuyo ciclo de cobro toca HOY
    // (frecuencia diaria, semanal en el dia ancla, mensual en el dia configurado).
    // Antes sumaba todas las cuotas diarias activas, lo que inflaba la cifra.
    let esperadoHoy = 0
    for (const ruta of c.rutas) {
      for (const cliente of (ruta.clientes ?? [])) {
        const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, orgCfg)
        const hoySinCobro = esHoySinCobro(diasExcluidos) || esHoyFestivo([])
        for (const p of (cliente.prestamos ?? [])) {
          if (tienePeriodoEsperadoHoy(p, hoySinCobro, diasExcluidos, [])) {
            esperadoHoy += p.cuotaDiaria ?? 0
          }
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
      cantidadClientes: c.rutas[0]?.clientes?.length ?? 0,
      recaudadoHoy,
      esperadoHoy,
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
    select: { plan: true, cobradoresExtra: true },
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

  // Verificar límite de usuarios (base del plan + cobradores extra comprados)
  const limiteBase = LIMITES_USUARIOS[plan] ?? 1
  const limite = limiteBase + (org?.cobradoresExtra ?? 0)
  const totalUsuarios = await prisma.user.count({ where: { organizationId } })
  if (totalUsuarios >= limite) {
    const precioExtra = PLANES_CONFIG[plan]?.cobradorExtra
    const opciones = []
    if (precioExtra > 0) opciones.push(`comprar un cobrador adicional por $${precioExtra.toLocaleString('es-CO')}/mes`)
    opciones.push('actualizar tu plan para tener más usuarios')
    const msgOpciones = ` Puedes ${opciones.join(' o ')}.`
    return Response.json(
      { error: `Has alcanzado el límite de ${limite} usuarios.${msgOpciones}`, limitReached: true, plan },
      { status: 403 }
    )
  }

  const { nombre, email, password, permisos, telefono } = await request.json()

  if (!nombre?.trim())   return Response.json({ error: 'El nombre es requerido' },    { status: 400 })
  if (!email?.trim())    return Response.json({ error: 'El email es requerido' },     { status: 400 })
  if (!password?.trim()) return Response.json({ error: 'La contraseña es requerida' }, { status: 400 })

  // Normalizar email (quita puntos decorativos de Gmail, lowercase)
  const emailNorm = normalizarEmail(email)

  // Email único global
  const existeEmail = await prisma.user.findUnique({ where: { email: emailNorm } })
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
