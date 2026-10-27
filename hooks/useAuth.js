'use client'
// hooks/useAuth.js - Hook de autenticación del lado del cliente

import { useSession } from 'next-auth/react'

/* ⚠ EL MODO ABREVIADO NO SE PIERDE CON LA SESIÓN (26 oct 2026).
   Desde cf-v1205 la sesión se renueva cada 10 min. Si esa renovación falla
   (mala señal en la calle, un reinicio del servidor), next-auth deja la sesión
   en `null` y ya no vuelve a pedirla; el cobrador sigue cobrando porque la
   cookie sigue buena. Con `?? false`, el modo se APAGABA en silencio: tecleaba
   «50» y se guardaban $50. INVERSIONESJYM y Distribuidora BM, cinco abonos
   entre el 22 y el 26 de octubre. Sin sesión a mano, manda la última de este
   teléfono (la misma que guarda el SessionProvider). */
function modoAbreviadoGuardado() {
  if (typeof window === 'undefined') return false
  try { return !!JSON.parse(localStorage.getItem('cf-session-cache') || 'null')?.user?.modoAbreviado } catch { return false }
}

export function useAuth() {
  const { data: session, status, update } = useSession()
  const loading = status === 'loading'

  const esOwner    = session?.user?.rol === 'owner'
  const permisos   = session?.user?.permisos ?? {}

  return {
    session,
    loading,
    updateSession: update,
    rol: session?.user?.rol ?? null,
    organizationId: session?.user?.organizationId ?? null,
    plan: session?.user?.plan ?? null,
    country: session?.user?.country ?? 'co',
    timezone: session?.user?.timezone ?? null,
    orgNombre: session?.user?.orgNombre ?? null,
    modoAbreviado: session?.user ? !!session.user.modoAbreviado : modoAbreviadoGuardado(),
    ocultarSaldoWA: session?.user?.ocultarSaldoWA ?? false,
    camposRecibo: session?.user?.camposRecibo ?? null,
    rutaId: session?.user?.rutaId ?? null,
    rutaIds: session?.user?.rutaIds ?? [],
    esOwner,
    esCobrador: session?.user?.rol === 'cobrador',
    esSuperadmin: session?.user?.rol === 'superadmin',
    // Permisos: owner siempre true, cobrador según configuración
    puedeCrearPrestamos: esOwner || Boolean(permisos.crearPrestamos),
    puedeGestionarPrestamos: esOwner || Boolean(permisos.gestionarPrestamos ?? permisos.crearPrestamos),
    puedeCrearClientes:  esOwner || Boolean(permisos.crearClientes),
    puedeEditarClientes: esOwner || Boolean(permisos.editarClientes),
    puedeReportarGastos: esOwner || Boolean(permisos.reportarGastos ?? true),
    puedeVerCapital:     esOwner || Boolean(permisos.verCapital),
    puedeVerCapitalRuta: Boolean(permisos.verCapitalRuta),
    puedeVerSaldoCaja:   esOwner || Boolean(permisos.verSaldoCaja),
    puedeGestionarRutas: esOwner || Boolean(permisos.gestionarRutas),
    puedeAplicarDescuentos: esOwner || Boolean(permisos.aplicarDescuentos),
    puedeDesembolsarLinea: esOwner || Boolean(permisos.desembolsarLinea),
    puedeReabrirCajaSinAprobacion: esOwner || Boolean(permisos.reabrirCajaSinAprobacion),
    // Encendido salvo que el dueño lo apague; el servidor decide igual.
    puedePrestarConPrestamoActivo: esOwner || permisos.prestarConPrestamoActivo !== false,
  }
}
