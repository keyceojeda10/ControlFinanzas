// app/api/cobradores/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import bcrypt               from 'bcryptjs'
import { logActividad } from '@/lib/activity-log'

import { LIMITES_USUARIOS, PLAN_NAMES, PLANES_CONFIG } from '@/lib/planes'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy = () => {
  const d = getColombiaDate()
  d.setHours(0, 0, 0, 0)
  return d
}
const manana = () => {
  const d = getColombiaDate()
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
      puedeVerSaldoCaja:   true,
      rutas:     {
        where:  { activo: true },
        select: {
          id:      true,
          nombre:  true,
          clientes: { select: { id: true } },
        },
      },
      pagos: {
        where:      { fechaPago: { gte: hoy(), lt: manana() } },
        select:     { montoPagado: true, tipo: true },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const resultado = cobradores.map((c) => ({
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
      verSaldoCaja:   c.puedeVerSaldoCaja ?? false,
    },
    ruta:            c.rutas[0] ?? null,
    cantidadClientes: c.rutas[0]?.clientes?.length ?? 0,
    recaudadoHoy:    c.pagos.filter(p => !['recargo', 'descuento'].includes(p.tipo)).reduce((a, p) => a + p.montoPagado, 0),
  }))

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

  const { organizationId, plan } = session.user

  // Planes de entrada no pueden tener cobradores
  const nombrePlan = PLAN_NAMES[plan] || plan
  if (['starter', 'basic'].includes(plan)) {
    return Response.json(
      { error: `Tu plan ${nombrePlan} no incluye cobradores. Actualiza al plan Crecimiento, Profesional o Empresarial.` },
      { status: 403 }
    )
  }

  // Verificar límite de usuarios (base del plan + cobradores extra comprados)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { cobradoresExtra: true },
  })
  const limiteBase = LIMITES_USUARIOS[plan] ?? 1
  const limite = limiteBase + (org?.cobradoresExtra ?? 0)
  const totalUsuarios = await prisma.user.count({ where: { organizationId } })
  if (totalUsuarios >= limite) {
    const precioExtra = PLANES_CONFIG[plan]?.cobradorExtra
    const msgExtra = precioExtra > 0 ? ` Puedes comprar un cobrador adicional por $${(precioExtra).toLocaleString('es-CO')}/mes.` : ''
    return Response.json(
      { error: `Has alcanzado el límite de ${limite} usuarios.${msgExtra}`, limitReached: true, plan },
      { status: 403 }
    )
  }

  const { nombre, email, password, permisos, telefono } = await request.json()

  if (!nombre?.trim())   return Response.json({ error: 'El nombre es requerido' },    { status: 400 })
  if (!email?.trim())    return Response.json({ error: 'El email es requerido' },     { status: 400 })
  if (!password?.trim()) return Response.json({ error: 'La contraseña es requerida' }, { status: 400 })

  // Email único global
  const existeEmail = await prisma.user.findUnique({ where: { email: email.trim() } })
  if (existeEmail) return Response.json({ error: 'Este correo ya está en uso. Si la persona ya tiene cuenta, intenta con otro correo o edita un cobrador existente.' }, { status: 409 })

  const hashedPassword = await bcrypt.hash(password.trim(), 10)

  // Normalizar telefono: solo digitos, vacio -> null
  const telefonoNorm = typeof telefono === 'string'
    ? telefono.replace(/\D/g, '').trim() || null
    : null

  const crearPrestamos = Boolean(permisos?.crearPrestamos)
  const gestionarPrestamos = Boolean(permisos?.gestionarPrestamos ?? crearPrestamos)
  const reportarGastos = Boolean(permisos?.reportarGastos ?? true)
  const verCapital = Boolean(permisos?.verCapital)
  const verSaldoCaja = Boolean(permisos?.verSaldoCaja)

  const cobrador = await prisma.user.create({
    data: {
      organizationId,
      nombre:   nombre.trim(),
      email:    email.trim().toLowerCase(),
      telefono: telefonoNorm,
      password: hashedPassword,
      rol:      'cobrador',
      puedeCrearPrestamos: crearPrestamos,
      puedeGestionarPrestamos: gestionarPrestamos,
      puedeCrearClientes:  Boolean(permisos?.crearClientes),
      puedeEditarClientes: Boolean(permisos?.editarClientes),
      puedeReportarGastos: reportarGastos,
      puedeVerCapital:     verCapital,
      puedeVerSaldoCaja:   verSaldoCaja,
    },
    select: { id: true, nombre: true, email: true, telefono: true, activo: true, rol: true,
      puedeCrearPrestamos: true, puedeGestionarPrestamos: true, puedeCrearClientes: true, puedeEditarClientes: true, puedeReportarGastos: true, puedeVerCapital: true, puedeVerSaldoCaja: true },
  })

  logActividad({ session, accion: 'crear_cobrador', entidadTipo: 'usuario', entidadId: cobrador.id, detalle: `Cobrador ${cobrador.nombre} creado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(cobrador, { status: 201 })
}
