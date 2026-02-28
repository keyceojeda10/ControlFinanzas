// lib/permisos.js - Permisos por rol y funciones de utilidad

export const permisos = {
  superadmin: {
    verTodasLasOrganizaciones: true,
    gestionarSuscripciones: true,
    suspenderOrganizaciones: true,
  },
  owner: {
    verTodosLosClientes: true,
    verTodasLasRutas: true,
    crearPrestamos: true,
    verReportes: true,
    gestionarUsuarios: true,
    verCierreCaja: true,
  },
  cobrador: {
    verTodosLosClientes: false,
    crearPrestamos: false,
    verReportes: false,
    gestionarUsuarios: false,
    registrarPagos: true,
    verCierreCaja: false,
  },
}

// ─── HELPERS DE ROL ─────────────────────────────────────

export const esOwner = (session) => session?.user?.rol === 'owner'

export const esCobrador = (session) => session?.user?.rol === 'cobrador'

export const esSuperadmin = (session) => session?.user?.rol === 'superadmin'

/**
 * Verifica que un cobrador solo vea clientes de su ruta.
 * Los owners ven todos los clientes de su organización.
 * El superadmin no accede a datos de organizaciones.
 */
export const puedeVerCliente = (session, cliente) => {
  if (!session?.user) return false
  if (session.user.rol === 'owner') return true
  if (session.user.rol === 'superadmin') return false
  // cobrador: solo ve clientes de su ruta
  return cliente?.rutaId === session.user.rutaId
}
