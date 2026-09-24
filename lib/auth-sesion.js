/* LA SESIÓN SE ARMA EN UN SOLO SITIO — 24 sep 2026.
 * Hoy entra por cuatro puertas: contraseña, cuenta guardada, «ver como» y
 * «volver». Si cada una revisara por su cuenta, una acabaría dejando pasar a un
 * cobrador desactivado o fuera del plan. Todo lo que el login con contraseña
 * revisaba vive aquí, igual, y las cuatro lo llaman. */
import { prisma } from '@/lib/prisma'
import { usuarioPermitido } from '@/lib/limites-plan'
import { selectCobro, vencimientoEfectivo } from '@/lib/cobro-automatico'

export const INCLUDE_USUARIO_SESION = {
  organization: { select: { plan: true, activo: true, country: true, timezone: true, nombre: true, modoAbreviado: true, ocultarSaldoWA: true, camposRecibo: true, ...selectCobro } },
}

export function usuarioParaSesion(userId) {
  if (!userId) return Promise.resolve(null)
  return prisma.user.findUnique({ where: { id: String(userId) }, include: INCLUDE_USUARIO_SESION })
}

export function revisarCuenta(user) {
  if (!user.activo) {
    throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
  }
  if (user.rol !== 'superadmin' && !user.emailVerificado) {
    const horasDesdeRegistro = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60)
    if (horasDesdeRegistro > 168) throw new Error('VERIFY_EMAIL')
  }
  if (user.organization && !user.organization.activo) {
    throw new Error('Tu cuenta está suspendida. Escríbenos a soporte@control-finanzas.com')
  }
}

// Movido SIN CAMBIOS desde el authorize de lib/auth.js (líneas 92–167 hoy).
export async function armarSesion(user) {
  // Cobradores: verificar que el usuario esta dentro del limite del plan
  if (user.rol === 'cobrador' && user.organizationId) {
    const permitido = await usuarioPermitido(user.organizationId, user.id)
    if (!permitido) {
      throw new Error('Tu cuenta de cobrador excede el limite del plan actual. Contacta al administrador.')
    }
  }

  // Para cobradores: obtener las rutas asignadas y permisos
  let rutaId = null
  let rutaIds = []
  let permisos = null
  if (user.rol === 'cobrador') {
    const rutas = await prisma.ruta.findMany({
      where:  { cobradorId: user.id, activo: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    rutaIds = rutas.map(r => r.id)
    rutaId = rutaIds[0] ?? null
    permisos = {
      crearPrestamos: user.puedeCrearPrestamos,
      gestionarPrestamos: user.puedeGestionarPrestamos ?? user.puedeCrearPrestamos,
      crearClientes:  user.puedeCrearClientes,
      editarClientes: user.puedeEditarClientes,
      reportarGastos: user.puedeReportarGastos ?? true,
      verCapital:     user.puedeVerCapital ?? false,
      verCapitalRuta: user.puedeVerCapitalRuta ?? false,
      verSaldoCaja:   user.puedeVerSaldoCaja ?? false,
      gestionarRutas: user.puedeGestionarRutas ?? false,
      aplicarDescuentos: user.puedeAplicarDescuentos ?? false,
      desembolsarLinea: user.puedeDesembolsarLinea ?? false,
      reabrirCajaSinAprobacion: user.puedeReabrirCajaSinAprobacion ?? false,
    }
  }

  // Obtener fecha de vencimiento de suscripción
  // Ignorar suscripciones pending (creadas al iniciar pago en MP pero nunca completadas)
  let suscripcionVencimiento = null
  if (user.organizationId) {
    const sub = await prisma.suscripcion.findFirst({
      where: {
        organizationId: user.organizationId,
        // Excluir solo pending. NULL (trials) debe contar.
        // Prisma `not: 'pending'` excluye NULL en MySQL — usar OR explicito.
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      orderBy: { fechaVencimiento: 'desc' },
      select: { fechaVencimiento: true },
    })
    /* Con el cobro automático vivo, la fecha que corta el acceso lleva la
       gracia: el middleware echa con ESTE dato. Ver lib/cobro-automatico.js. */
    suscripcionVencimiento = vencimientoEfectivo(sub?.fechaVencimiento?.toISOString() ?? null, user.organization)
  }

  return {
    id:                    user.id,
    nombre:                user.nombre,
    email:                 user.email,
    rol:                   user.rol,
    organizationId:        user.organizationId,
    plan:                  user.organization?.plan ?? null,
    rutaId,
    rutaIds,
    permisos,
    suscripcionVencimiento,
    onboardingCompletado:  user.onboardingCompletado ?? false,
    emailVerificado:       user.emailVerificado,
    avatarId:              user.avatarId ?? null,
    country:               user.organization?.country ?? 'co',
    timezone:              user.organization?.timezone ?? null,
    orgNombre:             user.organization?.nombre ?? null,
    modoAbreviado:         user.organization?.modoAbreviado ?? false,
    ocultarSaldoWA:        user.organization?.ocultarSaldoWA ?? false,
    camposRecibo:          user.organization?.camposRecibo ?? null,
  }
}

export async function sesionDeUsuario(user) {
  revisarCuenta(user)
  return armarSesion(user)
}
