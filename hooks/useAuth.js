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
   teléfono (la misma que guarda el SessionProvider).

   ⚠ Y NO SOLO EL MODO: EL ROL Y LOS PERMISOS TAMBIÉN (27 oct 2026). Caían a
   falso igual, y a los cobradores de PRESTA MIL se les fue «Gestión» —con ella
   «Financiar el saldo»— de la ficha del préstamo, teniendo el permiso. Es solo
   lo que se ENSEÑA: cada API vuelve a mirar el permiso en el servidor.
   `session` sigue siendo la de verdad. */
function usuarioGuardado() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(localStorage.getItem('cf-session-cache') || 'null')?.user ?? null } catch { return null }
}

export function useAuth() {
  const { data: session, status, update } = useSession()
  const loading = status === 'loading'

  const user       = session?.user ?? usuarioGuardado()
  const esOwner    = user?.rol === 'owner'
  const permisos   = user?.permisos ?? {}

  return {
    session,
    loading,
    updateSession: update,
    rol: user?.rol ?? null,
    organizationId: user?.organizationId ?? null,
    plan: user?.plan ?? null,
    country: user?.country ?? 'co',
    timezone: user?.timezone ?? null,
    orgNombre: user?.orgNombre ?? null,
    modoAbreviado: !!user?.modoAbreviado,
    ocultarSaldoWA: user?.ocultarSaldoWA ?? false,
    camposRecibo: user?.camposRecibo ?? null,
    rutaId: user?.rutaId ?? null,
    rutaIds: user?.rutaIds ?? [],
    esOwner,
    esCobrador: user?.rol === 'cobrador',
    esSuperadmin: user?.rol === 'superadmin',
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
